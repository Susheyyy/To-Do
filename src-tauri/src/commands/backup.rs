use chrono::Utc;
use std::fs;
use tauri::{AppHandle, Manager, State};

use crate::db;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub fn create_backup(app: AppHandle, _state: State<AppState>) -> AppResult<String> {
    let dir = app.path().app_data_dir()?;
    let target = db::create_auto_backup(&dir)?;
    Ok(target.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
pub struct BackupEntry {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
}


#[tauri::command]
pub fn list_backups(app: AppHandle) -> AppResult<Vec<BackupEntry>> {
    let dir = app.path().app_data_dir()?;
    let backups_dir = dir.join("backups");
    if !backups_dir.exists() {
        return Ok(vec![]);
    }
    let mut entries: Vec<BackupEntry> = fs::read_dir(&backups_dir)?
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            if path.extension()?.to_str()? != "db" {
                return None;
            }
            let meta = fs::metadata(&path).ok()?;
            let filename = path.file_name()?.to_string_lossy().into_owned();
            
            let created_at = filename
                .strip_prefix("todo_backup_")
                .and_then(|s| s.strip_suffix(".db"))
                .map(|s| s.to_string())
                .unwrap_or_else(|| filename.clone());
            Some(BackupEntry {
                path: path.to_string_lossy().into_owned(),
                filename,
                size_bytes: meta.len(),
                created_at,
            })
        })
        .collect();
    
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(entries)
}



#[tauri::command]
pub fn restore_backup(app: AppHandle, state: State<AppState>, filename: String) -> AppResult<()> {
    
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(AppError::Invalid("invalid backup filename".into()));
    }
    if !filename.ends_with(".db") {
        return Err(AppError::Invalid("not a .db file".into()));
    }

    let dir = app.path().app_data_dir()?;
    let backup_path = dir.join("backups").join(&filename);
    if !backup_path.exists() {
        return Err(AppError::NotFound(format!("backup {filename} not found")));
    }

    
    let ts = Utc::now().format("%Y%m%d_%H%M%S");
    let safety = dir.join("backups").join(format!("todo_before_restore_{ts}.db"));
    let db_path = dir.join("todo.db");
    if db_path.exists() {
        let _ = fs::copy(&db_path, &safety);
    }


    let mut conn = state.conn()?;
    let src_conn = rusqlite::Connection::open(&backup_path)?;
    {
        let backup = rusqlite::backup::Backup::new(&src_conn, &mut *conn)?;
        backup.run_to_completion(100, std::time::Duration::from_millis(250), None)?;
    }

    let _ = conn.execute_batch("PRAGMA wal_checkpoint(FULL);");
    Ok(())
}
