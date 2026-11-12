use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::State;

use crate::{db::tasks_repo, error::AppResult, models::Task, state::AppState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarChange {
    revision: i64,
    task_id: String,
    task: Option<Task>,
}

#[derive(Serialize)]
pub struct CalendarQueue {
    changes: Vec<CalendarChange>,
    error: Option<String>,
}

#[tauri::command]
pub fn get_calendar_changes(state: State<'_, AppState>) -> AppResult<CalendarQueue> {
    let conn = state.conn()?;
    let mut stmt = conn.prepare(
        "SELECT revision, task_id FROM calendar_outbox
         WHERE retry_after IS NULL OR retry_after <= datetime('now')
         ORDER BY revision LIMIT 25",
    )?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get::<_, String>(1)?)))?;
    let mut changes = Vec::new();
    for row in rows {
        let (revision, task_id) = row?;
        changes.push(CalendarChange {
            revision,
            task: tasks_repo::find(&conn, &task_id)?,
            task_id,
        });
    }
    let error = conn.query_row(
        "SELECT last_error FROM calendar_outbox WHERE last_error IS NOT NULL ORDER BY retry_after DESC LIMIT 1",
        [],
        |row| row.get(0),
    ).optional()?;
    Ok(CalendarQueue { changes, error })
}

#[tauri::command]
pub fn acknowledge_calendar_change(state: State<'_, AppState>, revision: i64) -> AppResult<()> {
    let conn = state.conn()?;
    conn.execute("DELETE FROM calendar_outbox WHERE revision = ?1", [revision])?;
    Ok(())
}

#[tauri::command]
pub fn defer_calendar_change(state: State<'_, AppState>, revision: i64, error: String) -> AppResult<()> {
    let conn = state.conn()?;
    conn.execute(
        "UPDATE calendar_outbox SET retry_after = datetime('now', '+1 minute'), last_error = ?2 WHERE revision = ?1",
        rusqlite::params![revision, error],
    )?;
    Ok(())
}
