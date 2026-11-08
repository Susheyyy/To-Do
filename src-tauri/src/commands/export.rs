use chrono::{Datelike, NaiveDate, NaiveTime, Timelike, Utc};
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

#[tauri::command]
pub fn export_ical(state: State<AppState>) -> AppResult<String> {
    let conn = state.conn()?;
    let tasks = tasks_repo::list_open(&conn)?;
    let projects = projects_repo::list(&conn)?;

    let mut ics = String::from("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TodoDesktop//NONSGML v1.0//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Todo Desktop Tasks\r\n");

    let now_stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();

    for t in tasks {
        let Some(due_date_str) = &t.due_date else { continue };
        let Ok(date) = NaiveDate::parse_from_str(due_date_str, "%Y-%m-%d") else { continue };

        let proj_name = t
            .project_id
            .as_ref()
            .and_then(|pid| projects.iter().find(|p| &p.id == pid).map(|p| p.name.as_str()))
            .unwrap_or("Inbox");

        let summary = format!("[{}] {}", proj_name, t.title.replace('\n', " "));
        let notes = t.notes.unwrap_or_default().replace('\n', "\\n");

        ics.push_str("BEGIN:VEVENT\r\n");
        ics.push_str(&format!("UID:{}@tododesktop.app\r\n", t.id));
        ics.push_str(&format!("DTSTAMP:{}\r\n", now_stamp));

        if let Some(time_str) = &t.due_time {
            if let Ok(time) = NaiveTime::parse_from_str(time_str, "%H:%M") {
                let dt_start = format!("{}{:02}{:02}T{:02}{:02}00", date.year(), date.month(), date.day(), time.hour(), time.minute());
                let end_time = time + chrono::Duration::minutes(30);
                let dt_end = format!("{}{:02}{:02}T{:02}{:02}00", date.year(), date.month(), date.day(), end_time.hour(), end_time.minute());

                ics.push_str(&format!("DTSTART:{}\r\n", dt_start));
                ics.push_str(&format!("DTEND:{}\r\n", dt_end));
            } else {
                ics.push_str(&format!("DTSTART;VALUE=DATE:{}\r\n", date.format("%Y%m%d")));
            }
        } else {
            ics.push_str(&format!("DTSTART;VALUE=DATE:{}\r\n", date.format("%Y%m%d")));
        }

        if let Some(recur) = &t.recur_rule {
            let rrule = match recur.to_lowercase().as_str() {
                "daily" => "RRULE:FREQ=DAILY\r\n",
                "weekly" => "RRULE:FREQ=WEEKLY\r\n",
                "monthly" => "RRULE:FREQ=MONTHLY\r\n",
                "weekdays" => "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n",
                _ => "",
            };
            if !rrule.is_empty() {
                ics.push_str(rrule);
            }
        }

        ics.push_str(&format!("SUMMARY:{}\r\n", summary));
        if !notes.is_empty() {
            ics.push_str(&format!("DESCRIPTION:{}\r\n", notes));
        }

        let prio_val = match t.priority.as_str() {
            "p1" => 1,
            "p2" => 5,
            "p3" => 9,
            _ => 0,
        };
        if prio_val > 0 {
            ics.push_str(&format!("PRIORITY:{}\r\n", prio_val));
        }

        ics.push_str("END:VEVENT\r\n");
    }

    ics.push_str("END:VCALENDAR\r\n");
    Ok(ics)
}
