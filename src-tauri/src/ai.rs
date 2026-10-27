#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    fs,
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
fn binary() -> Result<PathBuf, String> {
    let mut options = vec![];
    if let Ok(base) = std::env::var("APPDATA") {
        options.push(PathBuf::from(base).join("npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/codex/codex.exe"));
    }
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        options.push(PathBuf::from(base).join("OpenAI/Codex/bin/codex.exe"));
    }
    if let Some(paths) = std::env::var_os("PATH") {
        for path in std::env::split_paths(&paths) {
            options.push(path.join("codex.exe"));
        }
    }
    options
        .into_iter()
        .find(|p| p.is_file())
        .ok_or("Codex CLIが見つかりません。公式CLIを導入し、ChatGPTでログインしてください。".into())
}
fn command() -> Result<Command, String> {
    let mut c = Command::new(binary()?);
    c.env_remove("OPENAI_API_KEY").env_remove("CODEX_API_KEY");
    #[cfg(windows)]
    c.creation_flags(0x08000000);
    Ok(c)
}
pub fn status() -> Result<String, String> {
    let out = command()?
        .args(["login", "status"])
        .output()
        .map_err(|_| "Codex認証状態を確認できません。")?;
    let message = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    if out.status.success() && message.contains("ChatGPT") {
        Ok("ChatGPT認証を確認しました。質問送信時にサブスクの利用枠を消費します。".into())
    } else {
        Err("ChatGPT認証が確認できません。ターミナルで codex login を実行してください。APIキー認証は使用しません。".into())
    }
}
pub fn ask(prompt: String, consent: bool) -> Result<String, String> {
    if !consent {
        return Err("外部送信への同意が必要です。".into());
    }
    if prompt.is_empty() || prompt.len() > 64000 {
        return Err("送信内容の長さが不正です。".into());
    }
    status()?;
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("craft-guide-ai-{id}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = dir.join("answer.txt");
    let result = (|| {
        let mut c = command()?;
        c.current_dir(&dir)
            .args([
                "exec",
                "--ignore-user-config",
                "--ignore-rules",
                "--ephemeral",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "-c",
                "features.shell_tool=false",
                "-c",
                "features.unified_exec=false",
                "--output-last-message",
            ])
            .arg(&out)
            .arg("-")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = c
            .spawn()
            .map_err(|e| format!("Codexを起動できません: {e}"))?;
        if let Some(mut input) = child.stdin.take() {
            input
                .write_all(prompt.as_bytes())
                .map_err(|_| "質問を送信できません。")?;
        }
        let err = child.stderr.take().unwrap();
        let reader = std::thread::spawn(move || {
            let mut s = String::new();
            let _ = err.take(100000).read_to_string(&mut s);
            s
        });
        let start = Instant::now();
        let status = loop {
            match child.try_wait().map_err(|e| e.to_string())? {
                Some(s) => break s,
                None => {
                    if start.elapsed() > Duration::from_secs(180) {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err(
                            "回答がタイムアウトしました。時間をおいて再度お試しください。".into(),
                        );
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
        };
        let error = reader.join().unwrap_or_default();
        if !status.success() {
            return Err(
                if error.contains("rate") || error.contains("usage") || error.contains("limit") {
                    "利用枠または接続制限に達しました。追加課金は行いません。回復後に再度お試しください。".into()
                } else {
                    "AI連携に失敗しました。Codex CLIの認証・通信環境を確認してください。追加課金への切替は行いません。".into()
                },
            );
        }
        let answer = fs::read_to_string(&out).map_err(|_| "回答を取得できませんでした。")?;
        if answer.len() > 100000 {
            return Err("回答が長すぎます。質問を分けてください。".into());
        }
        Ok(answer)
    })();
    let _ = fs::remove_dir_all(dir);
    result
}
