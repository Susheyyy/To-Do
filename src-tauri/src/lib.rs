mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use std::sync::Mutex;

use tauri::Manager;

use commands::{history, projects, tasks};
use services::history::History;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let conn = db::open(&dir).map_err(|e| e.to_string())?;
            app.manage(AppState {
                db: Mutex::new(conn),
                history: Mutex::new(History::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tasks::create_task,
            tasks::update_task,
            tasks::set_task_completed,
            tasks::delete_task,
            tasks::add_subtask,
            tasks::toggle_subtask,
            tasks::list_open_tasks,
            tasks::list_today,
            tasks::list_overdue,
            tasks::list_tasks_for_project,
            tasks::list_tasks_for_tag,
            projects::create_project,
            projects::list_projects,
            projects::delete_project,
            projects::create_section,
            history::undo,
            history::redo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}