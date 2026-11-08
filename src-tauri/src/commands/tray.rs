use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: usize) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let label = if count > 0 {
            format!("To-Do ({} due/overdue)", count)
        } else {
            "To-Do".to_string()
        };
        tray.set_tooltip(Some(&label)).map_err(|e| e.to_string())?;
        
        // Also update tray title/badge on platforms that support it (macOS/Linux/Windows status)
        let title = if count > 0 { format!("{}", count) } else { "".to_string() };
        let _ = tray.set_title(Some(&title));
    }
    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn start_dragging(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_tray_click_action(state: tauri::State<'_, crate::state::AppState>, action: String) -> Result<(), String> {
    let conn = state.conn().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO sync_metadata (key, value) VALUES ('tray_click_action', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![action],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
