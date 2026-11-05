use tauri::{AppHandle, Emitter, State};

use crate::db::tasks_repo;
use crate::error::AppResult;
use crate::models::{Task, TaskInput};
use crate::services::history::{capture_task, Change};
use crate::state::AppState;

#[tauri::command]
pub fn create_task(app: AppHandle, state: State<'_, AppState>, input: TaskInput) -> AppResult<Task> {
    let mut conn = state.conn()?;
    let task = tasks_repo::create(&mut conn, input)?;
    state.history()?.record(
        "Create task",
        vec![Change::Task {
            id: task.id.clone(),
            before: None,
        }],
    );
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn update_task(app: AppHandle, state: State<'_, AppState>, id: String, input: TaskInput) -> AppResult<Task> {
    let mut conn = state.conn()?;
    let before = capture_task(&conn, &id)?;
    let task = tasks_repo::update(&mut conn, &id, input)?;
    state.history()?.record("Edit task", vec![before]);
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn set_task_completed(app: AppHandle, state: State<'_, AppState>, id: String, done: bool) -> AppResult<Task> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &id)?;
    let task = tasks_repo::set_completed(&conn, &id, done)?;
    let label = if done { "Complete task" } else { "Reopen task" };
    state.history()?.record(label, vec![before]);
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn delete_task(app: AppHandle, state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &id)?;
    tasks_repo::soft_delete(&conn, &id)?;
    state.history()?.record("Delete task", vec![before]);
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
pub fn add_subtask(app: AppHandle, state: State<'_, AppState>, task_id: String, title: String) -> AppResult<Task> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &task_id)?;
    let task = tasks_repo::add_subtask(&conn, &task_id, &title)?;
    state.history()?.record("Add subtask", vec![before]);
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn toggle_subtask(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    subtask_id: String,
    done: bool,
) -> AppResult<Task> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &task_id)?;
    let task = tasks_repo::toggle_subtask(&conn, &subtask_id, done)?;
    state.history()?.record("Toggle subtask", vec![before]);
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn list_open_tasks(state: State<'_, AppState>) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_open(&conn)
}

#[tauri::command]
pub fn list_today(state: State<'_, AppState>, today: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_today(&conn, &today)
}

#[tauri::command]
pub fn list_overdue(state: State<'_, AppState>, today: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_overdue(&conn, &today)
}

#[tauri::command]
pub fn list_tasks_for_project(state: State<'_, AppState>, project_id: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_for_project(&conn, &project_id)
}

#[tauri::command]
pub fn list_tasks_for_tag(state: State<'_, AppState>, tag: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_for_tag(&conn, &tag)
}

#[tauri::command]
pub fn list_completed_between(state: State<'_, AppState>, start: String, end: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_completed_between(&conn, &start, &end)
}