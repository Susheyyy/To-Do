use chrono::{NaiveDate, NaiveTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, ToSql};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{Subtask, Task, TaskInput};

const PRIORITIES: [&str; 3] = ["high", "medium", "low"];
const ORDER: &str = "ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due_time, created_at";

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn validate(input: &TaskInput) -> AppResult<()> {
    if input.title.trim().is_empty() {
        return Err(AppError::Invalid("title is required".into()));
    }
    if !PRIORITIES.contains(&input.priority.as_str()) {
        return Err(AppError::Invalid(format!("unknown priority: {}", input.priority)));
    }
    if let Some(date) = &input.due_date {
        NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|_| AppError::Invalid(format!("bad date: {date}")))?;
    }
    if let Some(time) = &input.due_time {
        NaiveTime::parse_from_str(time, "%H:%M")
            .map_err(|_| AppError::Invalid(format!("bad time: {time}")))?;
    }
    Ok(())
}

fn normalize_tag(raw: &str) -> Option<String> {
    let tag = raw.trim().trim_start_matches('@').trim();
    if tag.is_empty() {
        None
    } else {
        Some(tag.to_lowercase())
    }
}

fn set_tags(conn: &Connection, task_id: &str, tags: &[String]) -> AppResult<()> {
    conn.execute("DELETE FROM task_tags WHERE task_id = ?1", [task_id])?;
    let ts = now();
    for raw in tags {
        let Some(name) = normalize_tag(raw) else {
            continue;
        };
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![Uuid::new_v4().to_string(), name, ts],
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO task_tags (task_id, tag_id)
             SELECT ?1, id FROM tags WHERE name = ?2 COLLATE NOCASE",
            params![task_id, name],
        )?;
    }
    Ok(())
}

fn load_tags(conn: &Connection, task_id: &str) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT t.name FROM tags t
         JOIN task_tags tt ON tt.tag_id = t.id
         WHERE tt.task_id = ?1
         ORDER BY t.name",
    )?;
    let names = stmt
        .query_map([task_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

fn load_subtasks(conn: &Connection, task_id: &str) -> AppResult<Vec<Subtask>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, completed_at FROM subtasks
         WHERE task_id = ?1 AND deleted_at IS NULL
         ORDER BY created_at",
    )?;
    let subtasks = stmt
        .query_map([task_id], |row| {
            Ok(Subtask {
                id: row.get(0)?,
                title: row.get(1)?,
                completed_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(subtasks)
}

pub fn get(conn: &Connection, id: &str) -> AppResult<Task> {
    let mut task = conn
        .query_row(
            "SELECT id, title, notes, priority, due_date, due_time, completed_at,
                    project_id, section_id, created_at, updated_at
             FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    notes: row.get(2)?,
                    priority: row.get(3)?,
                    due_date: row.get(4)?,
                    due_time: row.get(5)?,
                    completed_at: row.get(6)?,
                    project_id: row.get(7)?,
                    section_id: row.get(8)?,
                    tags: Vec::new(),
                    subtasks: Vec::new(),
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("task {id}")))?;
    task.tags = load_tags(conn, id)?;
    task.subtasks = load_subtasks(conn, id)?;
    Ok(task)
}

fn collect(conn: &Connection, sql: &str, args: &[&dyn ToSql]) -> AppResult<Vec<Task>> {
    let mut stmt = conn.prepare(sql)?;
    let ids = stmt
        .query_map(args, |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    ids.iter().map(|id| get(conn, id)).collect()
}

pub fn create(conn: &mut Connection, input: TaskInput) -> AppResult<Task> {
    validate(&input)?;
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO tasks (id, title, notes, priority, due_date, due_time, project_id, section_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        params![
            id,
            input.title.trim(),
            input.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.project_id,
            input.section_id,
            ts
        ],
    )?;
    set_tags(&tx, &id, &input.tags)?;
    tx.commit()?;
    get(conn, &id)
}

pub fn update(conn: &mut Connection, id: &str, input: TaskInput) -> AppResult<Task> {
    validate(&input)?;
    let tx = conn.transaction()?;
    let changed = tx.execute(
        "UPDATE tasks SET title = ?2, notes = ?3, priority = ?4, due_date = ?5, due_time = ?6,
                project_id = ?7, section_id = ?8, updated_at = ?9
         WHERE id = ?1 AND deleted_at IS NULL",
        params![
            id,
            input.title.trim(),
            input.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.project_id,
            input.section_id,
            now()
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    set_tags(&tx, id, &input.tags)?;
    tx.commit()?;
    get(conn, id)
}

pub fn set_completed(conn: &Connection, id: &str, done: bool) -> AppResult<Task> {
    let completed_at = if done { Some(now()) } else { None };
    let changed = conn.execute(
        "UPDATE tasks SET completed_at = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, completed_at, now()],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    get(conn, id)
}

pub fn soft_delete(conn: &Connection, id: &str) -> AppResult<()> {
    let ts = now();
    let changed = conn.execute(
        "UPDATE tasks SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, ts],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    Ok(())
}

pub fn add_subtask(conn: &Connection, task_id: &str, title: &str) -> AppResult<Task> {
    if title.trim().is_empty() {
        return Err(AppError::Invalid("subtask title is required".into()));
    }
    let ts = now();
    conn.execute(
        "INSERT INTO subtasks (id, task_id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![Uuid::new_v4().to_string(), task_id, title.trim(), ts],
    )?;
    get(conn, task_id)
}

pub fn toggle_subtask(conn: &Connection, subtask_id: &str, done: bool) -> AppResult<Task> {
    let task_id: String = conn
        .query_row(
            "SELECT task_id FROM subtasks WHERE id = ?1 AND deleted_at IS NULL",
            [subtask_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("subtask {subtask_id}")))?;
    let completed_at = if done { Some(now()) } else { None };
    conn.execute(
        "UPDATE subtasks SET completed_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![subtask_id, completed_at, now()],
    )?;
    get(conn, &task_id)
}

pub fn list_open(conn: &Connection) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!("SELECT id FROM tasks WHERE completed_at IS NULL AND deleted_at IS NULL {ORDER}"),
        &[],
    )
}

pub fn list_today(conn: &Connection, today: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT id FROM tasks WHERE due_date = ?1 AND completed_at IS NULL AND deleted_at IS NULL {ORDER}"
        ),
        &[&today],
    )
}

pub fn list_overdue(conn: &Connection, today: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT id FROM tasks WHERE due_date < ?1 AND completed_at IS NULL AND deleted_at IS NULL {ORDER}"
        ),
        &[&today],
    )
}

pub fn list_for_project(conn: &Connection, project_id: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT id FROM tasks WHERE project_id = ?1 AND deleted_at IS NULL {ORDER}"
        ),
        &[&project_id],
    )
}

pub fn list_for_tag(conn: &Connection, tag: &str) -> AppResult<Vec<Task>> {
    let name = normalize_tag(tag).ok_or_else(|| AppError::Invalid("tag is required".into()))?;
    collect(
        conn,
        &format!(
            "SELECT id FROM tasks
             WHERE deleted_at IS NULL
               AND id IN (
                   SELECT tt.task_id FROM task_tags tt
                   JOIN tags t ON t.id = tt.tag_id
                   WHERE t.name = ?1 COLLATE NOCASE
               )
             {ORDER}"
        ),
        &[&name],
    )
}


pub fn find(conn: &Connection, id: &str) -> AppResult<Option<Task>> {
    match get(conn, id) {
        Ok(task) => Ok(Some(task)),
        Err(AppError::NotFound(_)) => Ok(None),
        Err(err) => Err(err),
    }
}

pub fn restore(conn: &Connection, id: &str, snapshot: Option<&Task>) -> AppResult<()> {
    let ts = now();
    match snapshot {
        None => {
            conn.execute(
                "UPDATE tasks SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
                params![id, ts],
            )?;
        }
        Some(task) => {
            conn.execute(
                "INSERT INTO tasks (id, title, notes, priority, due_date, due_time, completed_at,
                                    project_id, section_id, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    notes = excluded.notes,
                    priority = excluded.priority,
                    due_date = excluded.due_date,
                    due_time = excluded.due_time,
                    completed_at = excluded.completed_at,
                    project_id = excluded.project_id,
                    section_id = excluded.section_id,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL",
                params![
                    task.id,
                    task.title,
                    task.notes,
                    task.priority,
                    task.due_date,
                    task.due_time,
                    task.completed_at,
                    task.project_id,
                    task.section_id,
                    task.created_at,
                    ts
                ],
            )?;
            set_tags(conn, &task.id, &task.tags)?;
            conn.execute("DELETE FROM subtasks WHERE task_id = ?1", [&task.id])?;
            for subtask in &task.subtasks {
                conn.execute(
                    "INSERT INTO subtasks (id, task_id, title, completed_at, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    params![subtask.id, task.id, subtask.title, subtask.completed_at, ts],
                )?;
            }
        }
    }
    Ok(())
}


pub fn list_completed_between(conn: &Connection, start: &str, end: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT id FROM tasks
             WHERE deleted_at IS NULL
               AND completed_at IS NOT NULL
               AND julianday(completed_at) >= julianday(?1)
               AND julianday(completed_at) < julianday(?2)
             {ORDER}"
        ),
        &[&start, &end],
    )
}