use std::fs;
use std::io::{ErrorKind, Write};
use std::path::Path;

#[tauri::command]
fn read_file(path: String) -> Result<Option<String>, String> {
    match fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read '{}' : {}", path, e)),
    }
}

#[tauri::command]
fn write_file_atomic(path: String, contents: String) -> Result<(), String> {
    let target = Path::new(&path);
    let dir = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let name = target
        .file_name()
        .ok_or("path has no file name")?
        .to_string_lossy();
    let tmp = dir.join(format!(".{name}.chitra-tmp"));

    let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
    f.write_all(contents.as_bytes())
        .map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    drop(f);

    fs::rename(&tmp, target).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_cli_path() -> Option<String> {
    std::env::args().nth(1)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file_atomic,
            get_cli_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
