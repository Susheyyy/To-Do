use tauri::{AppHandle, Emitter, State};

use crate::error::AppResult;
use crate::services::history::{apply, Action};
use crate::state::AppState;

#[tauri::command]
pub fn undo(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let mut conn = state.conn()?;
    let mut history = state.history()?;
    let Some(action) = history.pop_undo() else {
        return Ok(None);
    };
    match apply(&mut conn, &action.changes) {
        Ok(inverse) => {
            let label = action.label.clone();
            history.push_redo(Action {
                label: action.label,
                changes: inverse,
            });
            let _ = app.emit("tasks-changed", ());
            Ok(Some(label))
        }
        Err(err) => {
            history.push_undo(action);
            Err(err)
        }
    }
}

#[tauri::command]
pub fn redo(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let mut conn = state.conn()?;
    let mut history = state.history()?;
    let Some(action) = history.pop_redo() else {
        return Ok(None);
    };
    match apply(&mut conn, &action.changes) {
        Ok(inverse) => {
            let label = action.label.clone();
            history.push_undo(Action {
                label: action.label,
                changes: inverse,
            });
            let _ = app.emit("tasks-changed", ());
            Ok(Some(label))
        }
        Err(err) => {
            history.push_redo(action);
            Err(err)
        }
    }
}