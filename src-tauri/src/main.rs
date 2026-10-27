#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod ai;
mod persistence;
mod scanner;
use std::{collections::HashSet, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};
struct Store {
    path: PathBuf,
    lock: Mutex<()>,
    roots: Mutex<HashSet<PathBuf>>,
    ai_busy: Mutex<bool>,
}
#[tauri::command]
async fn export_backup(data: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        persistence::validate(&data)?;
        let Some(path) = rfd::FileDialog::new()
            .set_title("JSONバックアップを書き出す")
            .add_filter("JSON", &["json"])
            .set_file_name("craft-guide-backup.json")
            .save_file()
        else {
            return Ok(false);
        };
        persistence::save(&path, &data)?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn read_backup() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .set_title("JSONバックアップを選択")
            .add_filter("JSON", &["json"])
            .pick_file()
        else {
            return Ok(None);
        };
        if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 48 * 1024 * 1024 {
            return Err("バックアップの上限は48MBです。".into());
        }
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("バックアップを読み込めません: {e}"))?;
        persistence::validate(&raw)?;
        Ok(Some(raw))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn load_data(s: State<Store>) -> Result<Option<String>, String> {
    let _guard = s.lock.lock().map_err(|_| "保存処理が使用中です。")?;
    persistence::read(&s.path)
}
#[tauri::command]
fn save_data(s: State<Store>, data: String) -> Result<(), String> {
    let _guard = s.lock.lock().map_err(|_| "保存処理が使用中です。")?;
    persistence::save(&s.path, &data)
}
#[tauri::command]
fn recover_data(s: State<Store>) -> Result<String, String> {
    let _guard = s.lock.lock().map_err(|_| "保存処理が使用中です。")?;
    persistence::recover(&s.path)
}
#[tauri::command]
fn restore_data(s: State<Store>, data: String) -> Result<(), String> {
    let _guard = s.lock.lock().map_err(|_| "保存処理が使用中です。")?;
    persistence::restore(&s.path, &data)
}
#[tauri::command]
async fn choose_instance(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .set_title("Minecraftインスタンスのフォルダを選択")
            .pick_folder()
        else {
            return Ok(None);
        };
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        app.state::<Store>()
            .roots
            .lock()
            .map_err(|_| "環境一覧が使用中です。")?
            .insert(path.clone());
        scanner::scan(&path).map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn rescan_instance(app: tauri::AppHandle, path: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(path)
            .canonicalize()
            .map_err(|_| "登録フォルダが見つかりません。")?;
        let store = app.state::<Store>();
        let allowed = store
            .roots
            .lock()
            .map_err(|_| "環境一覧が使用中です。")?
            .contains(&p)
            || persistence::read(&store.path)?
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .map(|v| {
                    v["environments"]
                        .as_array()
                        .map(|a| {
                            a.iter().any(|e| {
                                e["path"]
                                    .as_str()
                                    .and_then(|s| PathBuf::from(s).canonicalize().ok())
                                    .as_ref()
                                    == Some(&p)
                            })
                        })
                        .unwrap_or(false)
                })
                .unwrap_or(false);
        if !allowed {
            return Err("登録済みのインスタンスのみ再解析できます。".into());
        }
        scanner::scan(&p)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn ai_status() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(ai::status)
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn ask_guide(app: tauri::AppHandle, prompt: String, consent: bool) -> Result<String, String> {
    {
        let s = app.state::<Store>();
        let mut busy = s.ai_busy.lock().map_err(|_| "AIは使用中です。")?;
        if *busy {
            return Err("回答中です。完了までお待ちください。".into());
        }
        *busy = true;
    }
    let result = tauri::async_runtime::spawn_blocking(move || ai::ask(prompt, consent))
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
    if let Ok(mut busy) = app.state::<Store>().ai_busy.lock() {
        *busy = false;
    }
    result
}
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("state.json");
            // Debug-only isolation for native tests; production always uses app data.
            #[cfg(debug_assertions)]
            let path = std::env::var_os("CRAFTGUIDE_TEST_DATA_DIR")
                .map(|dir| PathBuf::from(dir).join("state.json"))
                .unwrap_or(path);
            app.manage(Store {
                path,
                lock: Mutex::new(()),
                roots: Mutex::new(HashSet::new()),
                ai_busy: Mutex::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            recover_data,
            restore_data,
            export_backup,
            read_backup,
            choose_instance,
            rescan_instance,
            ai_status,
            ask_guide
        ])
        .run(tauri::generate_context!())
        .expect("Craft Guideを起動できませんでした");
}
