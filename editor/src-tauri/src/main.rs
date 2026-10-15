//! Galgame 编辑器桌面版
//!
//! 设计原则：**所有落盘操作都在 Rust 侧完成**，前端只负责传数据。
//! 这样可以完全绕开 Tauri 2 文件系统插件的路径作用域（scope）配置，
//! 用户选哪就写哪，不用改任何权限文件。

// Release 下不弹控制台黑窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::{DialogExt, FilePath};

/// 打开文件对话框的返回值
#[derive(serde::Serialize)]
struct TextFile {
    name: String,
    text: String,
}

/// 把 dialog 插件的 FilePath 转成本地路径
fn to_path(value: FilePath) -> Result<PathBuf, String> {
    match value {
        FilePath::Path(path) => Ok(path),
        FilePath::Url(url) => Err(format!("不是本地文件路径：{}", url)),
    }
}

/// 防路径穿越：拼出来的路径必须还在根目录里
fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err(format!("不允许绝对路径：{}", rel));
    }
    for component in rel_path.components() {
        if !matches!(component, std::path::Component::Normal(_)) {
            return Err(format!("路径里包含不允许的部分：{}", rel));
        }
    }
    let full = root.join(rel_path);
    if !full.starts_with(root) {
        return Err(format!("路径越界：{}", rel));
    }
    Ok(full)
}

/// 解码 base64
fn decode(data: &str) -> Result<Vec<u8>, String> {
    BASE64.decode(data.trim()).map_err(|e| format!("数据解码失败：{}", e))
}

/* ---------------- 目录与文件 ---------------- */

/// 让用户选一个文件夹（导出 exe 时用）
#[tauri::command]
async fn pick_directory(app: tauri::AppHandle) -> Option<String> {
    // blocking_* 不能在主线程调用；async 命令跑在异步运行时线程里，没问题
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|value| to_path(value).ok())
        .map(|path| path.to_string_lossy().to_string())
}

/* ---------------- 导出游戏目录 ---------------- */

/// 在用户选的位置建游戏文件夹，返回完整路径。
/// 路径拼接放在 Rust 里做，避免前端处理 Windows / macOS 的分隔符差异。
#[tauri::command]
fn create_game_folder(root: String, folder: String) -> Result<String, String> {
    let root_path = PathBuf::from(&root);
    let game_dir = safe_join(&root_path, &folder)?;
    std::fs::create_dir_all(&game_dir)
        .map_err(|e| format!("创建目录失败 {}：{}", game_dir.display(), e))?;
    Ok(game_dir.to_string_lossy().to_string())
}

/// 往游戏目录里写一个文件（素材较多时前端会逐个调用，进度条更平滑）
#[tauri::command]
fn write_game_file(game_dir: String, rel: String, data: String) -> Result<(), String> {
    let root = PathBuf::from(&game_dir);
    let target = safe_join(&root, &rel)?;
    let bytes = decode(&data)?;

    // 自动补上中间目录（assets/ 之类）
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败 {}：{}", parent.display(), e))?;
    }
    std::fs::write(&target, bytes).map_err(|e| format!("写入失败 {}：{}", target.display(), e))
}

/* ---------------- 通用保存 / 打开 ---------------- */

/// 弹出系统「另存为」对话框并写二进制文件，返回实际保存的路径（取消则返回 null）
#[tauri::command]
async fn save_bytes(
    app: tauri::AppHandle,
    data: String,
    suggested_name: String,
    filter_name: Option<String>,
    filter_exts: Option<Vec<String>>,
) -> Result<Option<String>, String> {
    let bytes = decode(&data)?;

    let mut builder = app.dialog().file().set_file_name(&suggested_name);
    if let (Some(name), Some(exts)) = (filter_name.clone(), filter_exts.clone()) {
        builder = builder.add_filter(&name, &exts.iter().map(String::as_str).collect::<Vec<_>>());
    }

    let picked = builder
        .blocking_save_file()
        .ok_or_else(|| "cancelled".to_string())?;
    let path = to_path(picked)?;

    std::fs::write(&path, bytes).map_err(|e| format!("写入失败 {}：{}", path.display(), e))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// 弹出系统「另存为」对话框并写文本文件
#[tauri::command]
async fn save_text(
    app: tauri::AppHandle,
    text: String,
    suggested_name: String,
    filter_name: Option<String>,
    filter_exts: Option<Vec<String>>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file().set_file_name(&suggested_name);
    if let (Some(name), Some(exts)) = (filter_name.clone(), filter_exts.clone()) {
        builder = builder.add_filter(&name, &exts.iter().map(String::as_str).collect::<Vec<_>>());
    }

    let picked = builder
        .blocking_save_file()
        .ok_or_else(|| "cancelled".to_string())?;
    let path = to_path(picked)?;

    std::fs::write(&path, text).map_err(|e| format!("写入失败 {}：{}", path.display(), e))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// 弹出系统「打开」对话框并读文本文件（.galproj 用）
#[tauri::command]
async fn open_text(
    app: tauri::AppHandle,
    filter_name: Option<String>,
    filter_exts: Option<Vec<String>>,
) -> Result<Option<TextFile>, String> {
    let mut builder = app.dialog().file();
    if let (Some(name), Some(exts)) = (filter_name, filter_exts) {
        builder = builder.add_filter(&name, &exts.iter().map(String::as_str).collect::<Vec<_>>());
    }

    let picked = match builder.blocking_pick_file() {
        Some(value) => value,
        // 用户取消
        None => return Ok(None),
    };
    let path = to_path(picked)?;

    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取失败 {}：{}", path.display(), e))?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());

    Ok(Some(TextFile { name, text }))
}

/* ---------------- 导出 exe ---------------- */

/// 找到「便携播放器」的可执行文件。
/// 依次尝试：环境变量指定 → 编辑器旁边的 player 目录 → 资源目录 → 开发时的编译产物。
fn find_player_exe(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;

    let exe_name = if cfg!(windows) { "galgame-player.exe" } else { "galgame-player" };

    // 1. 环境变量显式指定（CI / 自定义构建常用）
    if let Ok(custom) = std::env::var("GALGAME_PLAYER_EXE") {
        let path = PathBuf::from(custom);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "环境变量 GALGAME_PLAYER_EXE 指向的文件不存在：{}",
            path.display()
        ));
    }

    // 2. 编辑器 exe 旁边的 player/ 目录（发布版随包分发）
    if let Ok(self_path) = std::env::current_exe() {
        if let Some(dir) = self_path.parent() {
            let candidate = dir.join("player").join(exe_name);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    // 3. 资源目录（Tauri bundle.resources 装到这里）
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidate = res_dir.join("player").join(exe_name);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    // 4. 开发模式：从编辑器 src-tauri 相对定位到播放器的编译产物
    let dev_candidates = [
        PathBuf::from("../../../runtime/src-tauri/target/release").join(exe_name),
        PathBuf::from("../../runtime/src-tauri/target/release").join(exe_name),
        PathBuf::from("../runtime/src-tauri/target/release").join(exe_name),
    ];
    for candidate in dev_candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "找不到播放器（{}）。请先执行：npm run build:player，然后把生成的 exe 放到编辑器旁边的 player/ 目录，或设置环境变量 GALGAME_PLAYER_EXE。",
        exe_name
    ))
}

/// 把播放器复制到游戏目录里，命名成作品名，返回目标路径
#[tauri::command]
fn copy_player_exe(app: tauri::AppHandle, game_dir: String, exe_name: String) -> Result<String, String> {
    let source = find_player_exe(&app)?;
    let safe_name = exe_name
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    let target = Path::new(&game_dir).join(format!("{}.exe", safe_name));

    std::fs::copy(&source, &target).map_err(|e| {
        format!(
            "复制播放器失败（{} -> {}）：{}",
            source.display(),
            target.display(),
            e
        )
    })?;

    Ok(target.to_string_lossy().to_string())
}

/// 在资源管理器里显示某个文件/目录（导出完成后"打开所在文件夹"用）
#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败：{}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败：{}", e))?;
        Ok(())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败：{}", e))?;
        Ok(())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_directory,
            create_game_folder,
            write_game_file,
            save_bytes,
            save_text,
            open_text,
            copy_player_exe,
            reveal_path
        ])
        .run(tauri::generate_context!())
        .expect("编辑器启动失败");
}
