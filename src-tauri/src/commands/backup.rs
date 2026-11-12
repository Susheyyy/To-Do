use tauri::{AppHandle, Manager};

use crate::db;
use crate::error::AppResult;

#[tauri::command]
pub fn create_backup(app: AppHandle) -> AppResult<String> {
    let dir = app.path().app_data_dir()?;
    let target = db::create_auto_backup(&dir)?;
    Ok(target.to_string_lossy().to_string())
}
