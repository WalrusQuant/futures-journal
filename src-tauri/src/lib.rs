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

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[derive(serde::Serialize)]
struct BackupEntry {
    name: String,
    path: String,
    size: u64,
    modified_ms: u64,
}

#[tauri::command]
async fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupEntry>, String> {
    let dir = backups_dir(&app)?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".json") {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        entries.push(BackupEntry {
            name,
            path: path.to_string_lossy().to_string(),
            size: meta.len(),
            modified_ms,
        });
    }
    // Newest first.
    entries.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(entries)
}

#[tauri::command]
async fn write_backup(
    app: tauri::AppHandle,
    filename: String,
    contents: String,
) -> Result<String, String> {
    // Disallow path traversal: filename must be a plain name, no separators.
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("invalid backup filename".into());
    }
    let dir = backups_dir(&app)?;
    let dest = dir.join(&filename);
    fs::write(&dest, contents).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
async fn read_backup(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    let target = PathBuf::from(&path);
    let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_target.starts_with(&canonical_dir) {
        return Err("refusing to read file outside backups directory".into());
    }
    fs::read_to_string(&canonical_target).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_backup(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = backups_dir(&app)?;
    let target = PathBuf::from(&path);
    let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_target.starts_with(&canonical_dir) {
        return Err("refusing to delete file outside backups directory".into());
    }
    fs::remove_file(&canonical_target).map_err(|e| e.to_string())?;
    Ok(())
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
        Migration {
            version: 4,
            description: "add trade risk_override",
            sql: include_str!("../migrations/004_trade_risk_override.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add trade review columns",
            sql: include_str!("../migrations/005_trade_review.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add account drawdown_mode and dd_locks_at_target",
            sql: include_str!("../migrations/006_drawdown_mode.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "account rule refinements: lock offset, mini/micro caps, consistency",
            sql: include_str!("../migrations/007_account_rule_refinements.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "account category (combine/sim_funded/live_funded/cash/bank)",
            sql: include_str!("../migrations/008_account_category.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "transactions: transfer + activation types, linked_tx_id, paid_for_account_id",
            sql: include_str!("../migrations/009_transfers_and_tx_types.sql"),
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
            read_text_file,
            list_backups,
            write_backup,
            read_backup,
            delete_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
