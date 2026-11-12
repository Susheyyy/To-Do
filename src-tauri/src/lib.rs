mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use std::sync::Mutex;
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use commands::{backup, calendar, export, habits, history, projects, sync, tasks, tray};
use services::history::History;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {

            let deep_url = args.iter().find(|a| a.starts_with("todo://"));
            if let Some(url_str) = deep_url {

                if url_str.contains("create") || url_str.contains("add") {
                    if let Some(win) = app.get_webview_window("quick-capture") {
                        let _ = win.show();
                        let _ = win.set_focus();
                        return;
                    }
                }
            }

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
            let mut conn = db::open(&dir).map_err(|e| e.to_string())?;
            let _ = db::tasks_repo::generate_missed_recurring(&mut conn);
            let _ = db::sync_repo::auto_purge_synced_log(&conn);
            app.manage(AppState {
                db: Mutex::new(conn),
                history: Mutex::new(History::default()),
            });

            let show_item = MenuItem::with_id(app, "show", "Open To-Do", true, None::<&str>)?;
            let quick_add_item = MenuItem::with_id(app, "quick_add", "Quick Add Task...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quick_add_item, &quit_item])?;

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
                            let action = if let Some(state) = app.try_state::<AppState>() {
                                if let Ok(c) = state.conn() {
                                    c.query_row(
                                        "SELECT value FROM sync_metadata WHERE key = 'tray_click_action'",
                                        [],
                                        |r| r.get::<_, String>(0),
                                    ).unwrap_or_else(|_| "quick-capture".to_string())
                                } else {
                                    "quick-capture".to_string()
                                }
                            } else {
                                "quick-capture".to_string()
                            };

                            let win_name = match action.as_str() {
                                "floating-bar" => "floating-bar",
                                "main" => "main",
                                _ => "quick-capture",
                            };

                            if let Some(win) = app.get_webview_window(win_name) {
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
                    "quick_add" => {
                        if let Some(win) = app.get_webview_window("floating-bar") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {

                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(conn) = state.conn() {
                                let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
            if let Err(err) = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed
                    && let Some(win) = app.get_webview_window("floating-bar")
                {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_always_on_top(true);
                        let _ = win.set_focus();
                        let win_c = win.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(80));
                            let _ = win_c.set_focus();
                        });
                    }
                }
            }) {
                eprintln!("[shortcut] Failed to register global shortcut (Ctrl+Alt+Space): {err}. Wayland or OS hotkey manager might restrict global registration.");
            }

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
            } else if !args.contains(&"--minimized".to_string())
                && let Some(win) = app.get_webview_window("main")
            {
                let _ = win.show();
            }

            {
                let app_data_dir = app.path().app_data_dir()?;
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(5 * 60));
                    loop {
                        match db::create_auto_backup(&app_data_dir) {
                            Ok(path) => eprintln!("[backup] auto-backup → {:?}", path),
                            Err(e) => eprintln!("[backup] auto-backup failed: {e}"),
                        }
                        std::thread::sleep(Duration::from_secs(30 * 60));
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tasks::create_task,
            tasks::batch_tasks,
            tasks::update_task,
            tasks::set_task_completed,
            tasks::delete_task,
            tasks::add_subtask,
            tasks::toggle_subtask,
            tasks::list_open_tasks,
            tasks::list_today,
            tasks::list_overdue,
            tasks::list_tasks_for_project,
            tasks::list_completed_between,
            tasks::generate_recurring,
            tasks::reschedule_overdue,
            tasks::search_tasks_fts,
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
            tray::start_dragging,
            tray::set_tray_click_action,
            habits::create_habit,
            habits::list_habits,
            habits::update_habit,
            habits::delete_habit,
            habits::log_habit,
            habits::unlog_habit,
            habits::list_habit_logs,
            backup::create_backup,
            calendar::get_calendar_changes,
            calendar::acknowledge_calendar_change,
            calendar::defer_calendar_change,
            export::export_json,
            export::export_csv,
            export::export_ical,
            sync::get_sync_status,
            sync::set_sync_config,
            sync::get_unsynced_items,
            sync::mark_synced,
            sync::apply_sync_changes,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "main"
            {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
