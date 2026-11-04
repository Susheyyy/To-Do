use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub fn create_backup(app: AppHandle, state: State<AppState>) -> AppResult<String> {
    let app_dir = app.path().app_data_dir()?;
    let db_path = app_dir.join("todo.db");
    if !db_path.exists() {
        return Err(AppError::NotFound("database file not found".into()));
    }

    let backups_dir = app_dir.join("backups");
    fs::create_dir_all(&backups_dir)?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("todo_backup_{}.db", timestamp);
    let target_path: PathBuf = backups_dir.join(backup_filename);

    let conn = state.db.lock().unwrap();
    conn.execute(
        &format!("VACUUM INTO '{}'", target_path.to_string_lossy().replace('\\', "/")),
        [],
    )?;

    Ok(target_path.to_string_lossy().to_string())
}

