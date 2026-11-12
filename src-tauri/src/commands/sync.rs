use tauri::{AppHandle, Emitter, State};
use crate::db::sync_repo::{self, IncomingChange, SyncItem, SyncStatus};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn get_sync_status(state: State<'_, AppState>) -> AppResult<SyncStatus> {
    let conn = state.conn()?;
    sync_repo::get_sync_status(&conn)
}

#[tauri::command]
pub fn set_sync_config(
    state: State<'_, AppState>,
    enabled: Option<bool>,
    server_url: Option<String>,
    group_id: Option<String>,
) -> AppResult<()> {
    let mut conn = state.conn()?;
    sync_repo::set_sync_config(&mut conn, enabled, server_url.as_deref(), group_id.as_deref())
}

#[tauri::command]
pub fn get_unsynced_items(state: State<'_, AppState>, limit: Option<usize>) -> AppResult<Vec<SyncItem>> {
    let conn = state.conn()?;
    sync_repo::get_unsynced_items(&conn, limit.unwrap_or(100))
}

#[tauri::command]
pub fn mark_synced(state: State<'_, AppState>, ids: Vec<i64>, timestamp: String) -> AppResult<()> {
    let conn = state.conn()?;
    sync_repo::mark_synced(&conn, &ids, &timestamp)
}

#[tauri::command]
pub fn apply_sync_changes(
    app: AppHandle,
    state: State<'_, AppState>,
    changes: Vec<IncomingChange>,
    cursor: String,
) -> AppResult<usize> {
    let mut conn = state.conn()?;
    let count = sync_repo::apply_incoming_changes(&mut conn, changes, &cursor)?;
    if count > 0 {
        let _ = app.emit("tasks-changed", ());
        let _ = app.emit("habits-changed", ());
    }
    Ok(count)
}

