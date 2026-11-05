mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use commands::{backup, export, habits, history, projects, tasks, tray};
use services::history::History;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == "--quick" || a == "-q") {
                if let Some(win) = app.get_webview_window("quick-capture") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            } else if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
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

            let show_item = MenuItem::with_id(app, "show", "Open To-Do", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("To-Do")
                .menu(&menu)
                .on_tray_icon_event(|tray_icon, event| {
                    let app = tray_icon.app_handle();
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(win) = app.get_webview_window("quick-capture") {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                        TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        } => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
            app.global_shortcut()
                .on_shortcut(shortcut, |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(win) = app.get_webview_window("floating-bar") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })?;

            let args: Vec<String> = std::env::args().collect();
            let autolaunch = app.autolaunch();
            if !autolaunch.is_enabled().unwrap_or(false) {
                let _ = autolaunch.enable();
            }

            if args.iter().any(|a| a == "--quick" || a == "-q") {
                if let Some(win) = app.get_webview_window("quick-capture") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            } else if !args.contains(&"--minimized".to_string()) {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                }
            }

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
            tasks::list_completed_between,
            projects::create_project,
            projects::list_projects,
            projects::delete_project,
            projects::create_section,
            projects::update_project,
            projects::rename_section,
            projects::delete_section,
            history::undo,
            history::redo,
            tray::update_tray_badge,
            tray::hide_window,
            habits::create_habit,
            habits::list_habits,
            habits::update_habit,
            habits::delete_habit,
            habits::log_habit,
            habits::unlog_habit,
            habits::list_habit_logs,
            backup::create_backup,
            export::export_json,
            export::export_csv,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
