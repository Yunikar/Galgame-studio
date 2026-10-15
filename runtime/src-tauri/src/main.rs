//! Galgame 播放器
//!
//! 玩家双击 exe 后，播放器从「自己所在的目录」读取：
//!   story.json   剧本
//!   assets/xxx   素材
//! 这样导出的游戏文件夹是自包含的，拷到哪都能玩。

// Release 下不弹控制台黑窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

/// 游戏根目录 = exe 所在目录
fn game_dir() -> PathBuf {
    std::env::current_exe()
        .expect("无法获取程序自身路径")
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// 防路径穿越：拒绝 ..、绝对路径等越权写法
fn safe_join(base: &Path, rel: &str) -> Option<PathBuf> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return None;
    }
    for component in rel_path.components() {
        match component {
            Component::Normal(_) => {}
            _ => return None, // CurDir / ParentDir / RootDir / Prefix 一律拒绝
        }
    }
    let full = base.join(rel_path);
    // 双重确认：最终路径必须还在游戏目录里
    if !full.starts_with(base) {
        return None;
    }
    Some(full)
}

/// 读文件，返回 base64（给 <img>/<audio> 当 dataURL 用）
#[tauri::command]
fn read_game_file(rel: String) -> Option<String> {
    let path = safe_join(&game_dir(), &rel)?;
    let bytes = std::fs::read(path).ok()?;
    Some(BASE64.encode(bytes))
}

/// 读文本文件（story.json 用）
#[tauri::command]
fn read_game_text_file(rel: String) -> Option<String> {
    let path = safe_join(&game_dir(), &rel)?;
    std::fs::read_to_string(path).ok()
}

/// 从 story.json 里抠出作品标题，用来设置窗口标题
fn story_title() -> Option<String> {
    let text = read_game_text_file("story.json".to_string())?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    value
        .get("meta")?
        .get("title")?
        .as_str()
        .map(str::to_string)
}

fn main() {
    let title = story_title();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_game_file, read_game_text_file])
        .setup(move |app| {
            // 有标题就用作品名，没有就保持配置里的默认值
            if let Some(title) = title {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title(&title);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("播放器启动失败");
}
