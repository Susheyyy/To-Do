use serde::Serialize;
use tauri::State;

use crate::db::{projects_repo, tasks_repo};
use crate::error::AppResult;
use crate::models::{Project, Task};
use crate::state::AppState;

#[derive(Serialize)]
pub struct FullExportData {
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
}

#[tauri::command]
pub fn export_json(state: State<AppState>) -> AppResult<String> {
    let conn = state.conn()?;
    let projects = projects_repo::list(&conn)?;
    let tasks = tasks_repo::list_open(&conn)?;
    let data = FullExportData { projects, tasks };
    let json_str = serde_json::to_string_pretty(&data).map_err(|e| crate::error::AppError::Invalid(e.to_string()))?;
    Ok(json_str)
}

#[tauri::command]
pub fn export_csv(state: State<AppState>) -> AppResult<String> {
    let conn = state.conn()?;
    let tasks = tasks_repo::list_open(&conn)?;
    let projects = projects_repo::list(&conn)?;

    let mut csv = String::from("id,title,priority,due_date,due_time,project,tags,notes\n");

    for t in tasks {
        let proj_name = t
            .project_id
            .as_ref()
            .and_then(|pid| projects.iter().find(|p| &p.id == pid).map(|p| p.name.as_str()))
            .unwrap_or("Inbox");

        let escaped_title = t.title.replace('"', "\"\"");
        let escaped_notes = t.notes.unwrap_or_default().replace('"', "\"\"");
        let tags_str = t.tags.join(";");

        csv.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            t.id,
            escaped_title,
            t.priority,
            t.due_date.unwrap_or_default(),
            t.due_time.unwrap_or_default(),
            proj_name,
            tags_str,
            escaped_notes
        ));
    }

    Ok(csv)
}

