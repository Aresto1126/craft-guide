use serde_json::{json, Value};
use std::{fs, io::Read, path::Path};
fn relevant(p: &str) -> bool {
    (p.contains("/recipes/")
        || p.contains("/recipe/")
        || p.contains("/tags/items/")
        || p.contains("/tags/item/"))
        && p.ends_with(".json")
        || p.ends_with("/lang/ja_jp.json")
        || p.ends_with("/lang/en_us.json")
        || [
            "fabric.mod.json",
            "mods.toml",
            "neoforge.mods.toml",
            "mcmod.info",
            "manifest.json",
            "mmc-pack.json",
            "instance.cfg",
            "version.json",
        ]
        .iter()
        .any(|n| p.ends_with(n))
}
pub fn scan(root: &Path) -> Result<Value, String> {
    if !root.is_dir() {
        return Err("インスタンスのフォルダがありません。".into());
    }
    let mut entries = vec![];
    let mut warnings = vec![];
    let mut mods = vec![];
    let mut budget = 0usize;
    let mut files_seen = 0usize;
    fn walk(
        dir: &Path,
        root: &Path,
        depth: u8,
        entries: &mut Vec<Value>,
        warnings: &mut Vec<String>,
        mods: &mut Vec<String>,
        budget: &mut usize,
        files_seen: &mut usize,
    ) -> Result<(), String> {
        if depth > 12 {
            return Ok(());
        }
        let iter = fs::read_dir(dir).map_err(|e| format!("フォルダを読み込めません: {e}"))?;
        for file in iter {
            let file = file.map_err(|e| e.to_string())?;
            let ft = file.file_type().map_err(|e| e.to_string())?;
            if ft.is_symlink() {
                continue;
            }
            let path = file.path();
            let rel = path
                .strip_prefix(root)
                .map_err(|_| "読取り範囲外です。")?
                .to_string_lossy()
                .replace('\\', "/");
            if ft.is_dir() {
                let name = file.file_name().to_string_lossy().to_string();
                if [
                    "saves",
                    "logs",
                    "screenshots",
                    "backups",
                    ".git",
                    "node_modules",
                    "assets",
                    "libraries",
                ]
                .contains(&name.as_str())
                {
                    continue;
                }
                walk(
                    &path,
                    root,
                    depth + 1,
                    entries,
                    warnings,
                    mods,
                    budget,
                    files_seen,
                )?;
                continue;
            }
            *files_seen += 1;
            if *files_seen > 60000 {
                return Err(
                    "ファイル数上限に達しました。インスタンスのルートを指定してください。".into(),
                );
            }
            if (rel.ends_with(".js") || rel.ends_with(".zs"))
                && (rel.contains("kubejs") || rel.contains("scripts"))
            {
                warnings.push(format!("スクリプト変更は未評価: {rel}"));
                continue;
            }
            let size = file.metadata().map_err(|e| e.to_string())?.len();
            if rel.ends_with(".jar") || rel.ends_with(".zip") {
                if size > 128 * 1024 * 1024 {
                    warnings.push(format!("サイズ上限で省略: {rel}"));
                    continue;
                }
                if rel.starts_with("mods/") {
                    mods.push(file.file_name().to_string_lossy().to_string());
                }
                let Ok(f) = fs::File::open(&path) else {
                    continue;
                };
                let Ok(mut zip) = zip::ZipArchive::new(f) else {
                    warnings.push(format!("アーカイブ読取り失敗: {rel}"));
                    continue;
                };
                for i in 0..zip.len().min(100000) {
                    let Ok(mut z) = zip.by_index(i) else { continue };
                    let name = z.name().replace('\\', "/");
                    if !relevant(&name) || z.size() > 2 * 1024 * 1024 {
                        continue;
                    }
                    *budget += z.size() as usize;
                    if *budget > 48 * 1024 * 1024 || entries.len() > 30000 {
                        return Err("解析上限48MB/30000件に達しました。".into());
                    }
                    let mut s = String::new();
                    if z.read_to_string(&mut s).is_ok() {
                        entries
                            .push(json!({"path":name,"text":s,"source":format!("{rel}!{name}")}));
                    }
                }
            } else if relevant(&rel) && size < 2 * 1024 * 1024 {
                *budget += size as usize;
                if *budget > 48 * 1024 * 1024 {
                    return Err("解析上限48MBに達しました。".into());
                }
                if let Ok(s) = fs::read_to_string(&path) {
                    entries.push(json!({"path":rel,"text":s,"source":rel}));
                }
            }
        }
        Ok(())
    }
    walk(
        root,
        root,
        0,
        &mut entries,
        &mut warnings,
        &mut mods,
        &mut budget,
        &mut files_seen,
    )?;
    let mut minecraft = "未確認".to_string();
    let mut loader = if mods.is_empty() {
        "未確認"
    } else {
        "MOD環境（ローダー未確認）"
    }
    .to_string();
    for e in &entries {
        let p = e["path"].as_str().unwrap_or("");
        let Ok(v) = serde_json::from_str::<Value>(e["text"].as_str().unwrap_or("")) else {
            continue;
        };
        if p.ends_with("manifest.json") {
            if let Some(s) = v["minecraft"]["version"].as_str() {
                minecraft = s.into()
            }
            if let Some(s) = v["minecraft"]["modLoaders"][0]["id"].as_str() {
                loader = s.into()
            }
        }
        if p.ends_with("mmc-pack.json") {
            if let Some(arr) = v["components"].as_array() {
                for comp in arr {
                    match comp["uid"].as_str().unwrap_or("") {
                        "net.minecraft" => {
                            minecraft = comp["version"].as_str().unwrap_or("未確認").into()
                        }
                        s if s.contains("fabric") || s.contains("forge") => {
                            loader = format!("{} {}", s, comp["version"].as_str().unwrap_or(""))
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    Ok(
        json!({"name":root.file_name().unwrap_or_default().to_string_lossy(),"path":root.to_string_lossy(),"entries":entries,"warnings":warnings,"mods":mods,"minecraft":minecraft,"loader":loader}),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_fixture_without_executing_scripts() {
        let dir = std::env::temp_dir().join(format!("craft-scan-{}", std::process::id()));
        fs::create_dir_all(dir.join("data/demo/recipe")).unwrap();
        fs::write(dir.join("data/demo/recipe/test.json"), "{}").unwrap();
        let r = scan(&dir).unwrap();
        assert_eq!(r["entries"].as_array().unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
}
