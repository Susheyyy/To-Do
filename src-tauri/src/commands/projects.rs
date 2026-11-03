use tauri::State;

use crate::db::projects_repo;
use crate::error::AppResult;
use crate::models::{Project, Section};
use crate::services::history::{capture_project, Change};
use crate::state::AppState;

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, name: String, color: Option<String>) -> AppResult<Project> {
    let conn = state.conn()?;
    let project = projects_repo::create(&conn, &name, color)?;
    state.history()?.record(
        "Create project",
        vec![Change::Project {
            id: project.id.clone(),
            before: None,
        }],
    );
    Ok(project)
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    let conn = state.conn()?;
    projects_repo::list(&conn)
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    let before = capture_project(&conn, &id)?;
    projects_repo::soft_delete(&conn, &id)?;
    state.history()?.record("Delete project", vec![before]);
    Ok(())
}

#[tauri::command]
pub fn create_section(state: State<'_, AppState>, project_id: String, name: String) -> AppResult<Section> {
    let conn = state.conn()?;
    let before = capture_project(&conn, &project_id)?;
    let section = projects_repo::create_section(&conn, &project_id, &name)?;
    state.history()?.record("Add section", vec![before]);
    Ok(section)
}


#[tauri::command]
pub fn update_project(state: State<'_, AppState>, id: String, name: String, color: Option<String>) -> AppResult<()> {
    let conn = state.conn()?;
    projects_repo::update(&conn, &id, &name, color)
}

#[tauri::command]
pub fn rename_section(state: State<'_, AppState>, id: String, name: String) -> AppResult<()> {
    let conn = state.conn()?;
    projects_repo::rename_section(&conn, &id, &name)
}

#[tauri::command]
pub fn delete_section(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let conn = state.conn()?;
    projects_repo::delete_section(&conn, &id)
}