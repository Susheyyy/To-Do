use tauri::State;

use crate::db::habits_repo;
use crate::error::AppResult;
use crate::models::{Habit, HabitInput, HabitLog};
use crate::state::AppState;

#[tauri::command]
pub fn create_habit(state: State<AppState>, input: HabitInput) -> AppResult<Habit> {
    let conn = state.conn()?;
    habits_repo::create(&conn, input)
}

#[tauri::command]
pub fn list_habits(state: State<AppState>) -> AppResult<Vec<Habit>> {
    let conn = state.conn()?;
    habits_repo::list(&conn)
}

#[tauri::command]
pub fn update_habit(state: State<AppState>, id: String, input: HabitInput) -> AppResult<Habit> {
    let conn = state.conn()?;
    habits_repo::update(&conn, &id, input)
}

#[tauri::command]
pub fn delete_habit(state: State<AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    habits_repo::delete(&conn, &id)
}

#[tauri::command]
pub fn log_habit(state: State<AppState>, habit_id: String, date: String) -> AppResult<HabitLog> {
    let conn = state.conn()?;
    habits_repo::log_today(&conn, &habit_id, &date)
}

#[tauri::command]
pub fn unlog_habit(state: State<AppState>, habit_id: String, date: String) -> AppResult<()> {
    let conn = state.conn()?;
    habits_repo::unlog(&conn, &habit_id, &date)
}

#[tauri::command]
pub fn list_habit_logs(state: State<AppState>, start: String, end: String) -> AppResult<Vec<HabitLog>> {
    let conn = state.conn()?;
    habits_repo::all_logs_for_range(&conn, &start, &end)
}

