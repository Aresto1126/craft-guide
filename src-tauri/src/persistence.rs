use serde_json::Value;
use std::{fs, io::Write, path::Path};
pub fn validate(raw: &str) -> Result<Value, String> {
    if raw.len() > 48 * 1024 * 1024 {
        return Err("保存データが48MBを超えています。".into());
    }
    let v: Value = serde_json::from_str(raw).map_err(|_| "JSONデータが破損しています。")?;
    if v["version"] != 1 {
        return Err("未対応の保存バージョンです。".into());
    }
    let envs = v["environments"].as_array().ok_or("環境一覧が不正です。")?;
    if envs.is_empty() || envs.len() > 100 {
        return Err("環境件数が不正です。".into());
    }
    let mut ids = std::collections::HashSet::new();
    for e in envs {
        let id = e["id"].as_str().ok_or("環境IDが不正です。")?;
        if !ids.insert(id) {
            return Err("環境IDが重複しています。".into());
        }
        if e["name"]
            .as_str()
            .filter(|s| !s.trim().is_empty() && s.len() < 1000)
            .is_none()
        {
            return Err("環境名が不正です。".into());
        }
    }
    if !ids.contains(v["selectedEnv"].as_str().unwrap_or("")) {
        return Err("環境参照が不正です。".into());
    }
    for field in ["notes", "messages"] {
        for n in v[field].as_array().ok_or("記録の形式が不正です。")? {
            if !ids.contains(n["envId"].as_str().unwrap_or("")) {
                return Err("記録の環境参照が不正です。".into());
            }
        }
    }
    if !v["settings"].is_object() || !v["instructions"]["common"].is_string() {
        return Err("設定が不正です。".into());
    }
    Ok(v)
}
pub fn read(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        if path.with_extension("bak").exists() {
            return Err("保存中断を検出しました。バックアップから復旧してください。".into());
        }
        return Ok(None);
    }
    let s = fs::read_to_string(path).map_err(|e| format!("保存データを読み込めません: {e}"))?;
    validate(&s).map_err(|e| format!("破損データを保護しています。{e}"))?;
    Ok(Some(s))
}
pub fn save(path: &Path, raw: &str) -> Result<(), String> {
    validate(raw)?;
    read(path)?;
    let parent = path.parent().ok_or("保存先が不正です。")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let pending = path.with_extension("pending");
    let bak = path.with_extension("bak");
    let mut file = fs::File::create(&pending).map_err(|e| e.to_string())?;
    file.write_all(raw.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("保存失敗。既存データは保持されています: {e}"))?;
    drop(file);
    if path.exists() {
        if bak.exists() {
            fs::remove_file(&bak).map_err(|e| e.to_string())?
        }
        fs::rename(path, &bak).map_err(|e| e.to_string())?;
    }
    if let Err(e) = fs::rename(&pending, path) {
        if bak.exists() {
            let _ = fs::copy(&bak, path);
        }
        return Err(format!("保存失敗。バックアップを保持しています: {e}"));
    }
    Ok(())
}
pub fn recover(path: &Path) -> Result<String, String> {
    let raw = fs::read_to_string(path.with_extension("bak"))
        .map_err(|_| "復旧用バックアップがありません。")?;
    validate(&raw)?;
    if path.exists() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        fs::copy(path, path.with_extension(format!("damaged-{stamp}")))
            .map_err(|e| e.to_string())?;
    }
    fs::copy(path.with_extension("bak"), path).map_err(|e| e.to_string())?;
    Ok(raw)
}
pub fn restore(path: &Path, raw: &str) -> Result<(), String> {
    validate(raw)?;
    fs::create_dir_all(path.parent().ok_or("保存先が不正です。")?).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let damaged = path.with_extension(format!("damaged-{stamp}"));
    let pending = path.with_extension("restore-pending");
    let mut f = fs::File::create(&pending).map_err(|e| e.to_string())?;
    f.write_all(raw.as_bytes())
        .and_then(|_| f.sync_all())
        .map_err(|e| e.to_string())?;
    drop(f);
    if path.exists() {
        fs::rename(path, &damaged).map_err(|e| e.to_string())?;
    }
    if let Err(e) = fs::rename(&pending, path) {
        if damaged.exists() {
            let _ = fs::copy(&damaged, path);
        }
        return Err(format!("復元失敗。元データを保持しています: {e}"));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn data() -> String {
        r#"{"version":1,"settings":{},"instructions":{"common":""},"environments":[{"id":"a","name":"環境"}],"selectedEnv":"a","notes":[],"messages":[]}"#.into()
    }
    #[test]
    fn validates_future_and_dangling() {
        assert!(validate(&data()).is_ok());
        assert!(validate(&data().replace("\"version\":1", "\"version\":2")).is_err());
        assert!(
            validate(&data().replace("\"selectedEnv\":\"a\"", "\"selectedEnv\":\"b\"")).is_err()
        );
    }
    #[test]
    fn corrupt_is_preserved_and_backup_restored() {
        let dir = std::env::temp_dir().join(format!("craft-guide-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("state.json");
        save(&p, &data()).unwrap();
        save(&p, &data()).unwrap();
        fs::write(&p, "broken").unwrap();
        assert!(save(&p, &data()).is_err());
        assert_eq!(fs::read_to_string(&p).unwrap(), "broken");
        recover(&p).unwrap();
        assert!(read(&p).unwrap().is_some());
        fs::remove_dir_all(dir).unwrap();
    }
}
