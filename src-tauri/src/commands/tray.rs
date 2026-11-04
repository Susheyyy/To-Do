use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: usize) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let label = if count > 0 {
            format!("To-Do — {} overdue", count)
        } else {
            "To-Do".to_string()
        };
        tray.set_tooltip(Some(&label)).map_err(|e| e.to_string())?;
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
