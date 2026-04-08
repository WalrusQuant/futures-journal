use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn images_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
async fn save_image(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let dir = images_dir(&app)?;
    let source = PathBuf::from(&source_path);
    let ext = source
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let filename = format!("{}.{}", nanos, ext);
    let dest = dir.join(&filename);
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_image(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = images_dir(&app)?;
    let target = PathBuf::from(&path);
    // Resolve and refuse anything outside our images directory.
    let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_target.starts_with(&canonical_dir) {
        return Err("refusing to delete file outside images directory".into());
    }
    fs::remove_file(&canonical_target).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add account rules_notes",
            sql: include_str!("../migrations/002_account_rules_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add plan_tags",
            sql: include_str!("../migrations/003_plan_tags.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:futures-journal.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            save_image,
            delete_image,
            write_text_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
