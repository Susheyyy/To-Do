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
        &conn,
        "Create task",
        vec![Change::Task {
            id: task.id.clone(),
            before: Box::new(None),
        }],
    )?;
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[tauri::command]
pub fn update_task(app: AppHandle, state: State<'_, AppState>, id: String, input: TaskInput) -> AppResult<Task> {
    let mut conn = state.conn()?;
    let before = capture_task(&conn, &id)?;
    let task = tasks_repo::update(&mut conn, &id, input)?;
    state.history()?.record(&conn, "Edit task", vec![before])?;
    let _ = app.emit("tasks-changed", ());
    Ok(task)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionResult {
    task: Task,
    next_task: Option<Task>,
}

#[tauri::command]
pub fn set_task_completed(app: AppHandle, state: State<'_, AppState>, id: String, done: bool) -> AppResult<CompletionResult> {
    let mut conn = state.conn()?;
    let mut history = state.history()?;
    let mut before = vec![capture_task(&conn, &id)?];
    let (task, next_task) = tasks_repo::set_completed(&mut conn, &id, done)?;
    if let Some(next) = &next_task {
        before.push(Change::Task { id: next.id.clone(), before: Box::new(None) });
    }
    let label = if done { "Complete task" } else { "Reopen task" };
    history.record(&conn, label, before)?;
    let _ = app.emit("tasks-changed", ());
    Ok(CompletionResult { task, next_task })
}

#[tauri::command]
pub fn delete_task(app: AppHandle, state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &id)?;
    tasks_repo::soft_delete(&conn, &id)?;
    state.history()?.record(&conn, "Delete task", vec![before])?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
pub fn add_subtask(app: AppHandle, state: State<'_, AppState>, task_id: String, title: String) -> AppResult<Task> {
    let conn = state.conn()?;
    let before = capture_task(&conn, &task_id)?;
    let task = tasks_repo::add_subtask(&conn, &task_id, &title)?;
    state.history()?.record(&conn, "Add subtask", vec![before])?;
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
    state.history()?.record(&conn, "Toggle subtask", vec![before])?;
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
pub fn generate_recurring(app: AppHandle, state: State<'_, AppState>) -> AppResult<usize> {
    let mut conn = state.conn()?;
    let count = tasks_repo::generate_missed_recurring(&mut conn)?;
    if count > 0 {
        let _ = app.emit("tasks-changed", ());
    }
    Ok(count)
}

#[tauri::command]
pub fn reschedule_overdue(app: AppHandle, state: State<'_, AppState>, target_date: String) -> AppResult<Vec<Task>> {
    let mut conn = state.conn()?;
    let tasks = tasks_repo::reschedule_overdue(&mut conn, &target_date)?;
    if !tasks.is_empty() {
        let _ = app.emit("tasks-changed", ());
    }
    Ok(tasks)
}

#[tauri::command]
pub fn list_completed_between(state: State<'_, AppState>, start: String, end: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::list_completed_between(&conn, &start, &end)
}

#[tauri::command]
pub fn search_tasks_fts(state: State<'_, AppState>, query: String) -> AppResult<Vec<Task>> {
    let conn = state.conn()?;
    tasks_repo::search_fts(&conn, &query)
}
#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum BatchTaskAction {
    Complete { done: bool },
    Delete,
    Reschedule { due_date: Option<String> },
    SetPriority { priority: String },
    Move { project_id: Option<String> },
}

#[tauri::command]
pub fn batch_tasks(
    app: AppHandle,
    state: State<'_, AppState>,
    ids: Vec<String>,
    action: BatchTaskAction,
) -> AppResult<Vec<Task>> {
    let mut conn = state.conn()?;
    let mut history = state.history()?;
    let (updated, before) = apply_batch(&mut conn, &ids, &action)?;
    if !before.is_empty() {
        history.record(&conn, "Edit selected tasks", before)?;
        let _ = app.emit("tasks-changed", ());
    }
    Ok(updated)
}

fn apply_batch(
    conn: &mut rusqlite::Connection,
    ids: &[String],
    action: &BatchTaskAction,
) -> AppResult<(Vec<Task>, Vec<Change>)> {
    let tx = conn.transaction()?;
    let mut before = Vec::new();
    let mut updated = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for id in ids {
        if !seen.insert(id) {
            continue;
        }
        before.push(capture_task(&tx, id)?);
        match action {
            BatchTaskAction::Complete { done } => {
                let (task, next) = tasks_repo::set_completed_in_transaction(&tx, id, *done)?;
                updated.push(task);
                if let Some(next) = next {
                    before.push(Change::Task { id: next.id.clone(), before: Box::new(None) });
                    updated.push(next);
                }
            }
            BatchTaskAction::Delete => tasks_repo::soft_delete(&tx, id)?,
            action => {
                let task = tasks_repo::get(&tx, id)?;
                let mut input = TaskInput {
                    id: None,
                    title: task.title,
                    notes: task.notes,
                    priority: task.priority,
                    due_date: task.due_date,
                    due_time: task.due_time,
                    project_id: task.project_id,
                    section_id: task.section_id,
                    tags: task.tags,
                    recur_rule: task.recur_rule,
                };
                match action {
                    BatchTaskAction::Reschedule { due_date } => input.due_date = due_date.clone(),
                    BatchTaskAction::SetPriority { priority } => input.priority = priority.clone(),
                    BatchTaskAction::Move { project_id } => {
                        input.project_id = project_id.clone();
                        input.section_id = None;
                    }
                    _ => unreachable!(),
                }
                updated.push(tasks_repo::update_in_transaction(&tx, id, input)?);
            }
        }
    }
    tx.commit()?;
    Ok((updated, before))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_rolls_back_when_a_selected_task_is_missing() {
        let mut conn = crate::db::test_connection();
        conn.execute(
            "INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('existing', 'Task', ?1, ?1)",
            ["2026-01-01T00:00:00Z"],
        ).unwrap();

        let ids = ["existing".to_string(), "missing".to_string()];
        assert!(apply_batch(&mut conn, &ids, &BatchTaskAction::Delete).is_err());
        assert!(tasks_repo::find(&conn, "existing").unwrap().is_some());
    }
}
