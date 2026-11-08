use std::collections::HashMap;
use chrono::{NaiveDate, NaiveTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, ToSql};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{Subtask, Task, TaskInput};

const PRIORITIES: [&str; 4] = ["high", "medium", "low", "none"];
const SELECT_COLS: &str = "id, title, notes, priority, due_date, due_time, completed_at, project_id, section_id, recur_rule, created_at, updated_at";
const ORDER: &str = "ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END, due_time, created_at";

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

    conn.execute(
        "UPDATE tasks SET updated_at = ?2 WHERE id = ?1",
        params![task_id, ts],
    )?;
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
         ORDER BY id ASC, created_at ASC",
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
                    project_id, section_id, recur_rule, created_at, updated_at
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
                    recur_rule: row.get(9)?,
                    tags: Vec::new(),
                    subtasks: Vec::new(),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
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
    let mut rows = stmt.query(args)?;
    let mut tasks = Vec::new();
    let mut ids = Vec::new();

    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        ids.push(id.clone());
        tasks.push(Task {
            id,
            title: row.get(1)?,
            notes: row.get(2)?,
            priority: row.get(3)?,
            due_date: row.get(4)?,
            due_time: row.get(5)?,
            completed_at: row.get(6)?,
            project_id: row.get(7)?,
            section_id: row.get(8)?,
            recur_rule: row.get(9)?,
            tags: Vec::new(),
            subtasks: Vec::new(),
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        });
    }

    if ids.is_empty() {
        return Ok(tasks);
    }

    
    let mut tags_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut sub_map: HashMap<String, Vec<Subtask>> = HashMap::new();


    for chunk in ids.chunks(400) {
        let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let args_ref: Vec<&dyn ToSql> = chunk.iter().map(|id| id as &dyn ToSql).collect();


        let tags_sql = format!(
            "SELECT tt.task_id, t.name FROM tags t
             JOIN task_tags tt ON tt.tag_id = t.id
             WHERE tt.task_id IN ({placeholders})
             ORDER BY t.name"
        );
        let mut tags_stmt = conn.prepare(&tags_sql)?;
        let mut tag_rows = tags_stmt.query(args_ref.as_slice())?;
        while let Some(row) = tag_rows.next()? {
            let task_id: String = row.get(0)?;
            let tag_name: String = row.get(1)?;
            tags_map.entry(task_id).or_default().push(tag_name);
        }


        let subtasks_sql = format!(
            "SELECT task_id, id, title, completed_at FROM subtasks
             WHERE task_id IN ({placeholders}) AND deleted_at IS NULL
             ORDER BY created_at"
        );
        let mut sub_stmt = conn.prepare(&subtasks_sql)?;
        let mut sub_rows = sub_stmt.query(args_ref.as_slice())?;
        while let Some(row) = sub_rows.next()? {
            let task_id: String = row.get(0)?;
            let subtask = Subtask {
                id: row.get(1)?,
                title: row.get(2)?,
                completed_at: row.get(3)?,
            };
            sub_map.entry(task_id).or_default().push(subtask);
        }
    }

    for task in &mut tasks {
        if let Some(tags) = tags_map.remove(&task.id) {
            task.tags = tags;
        }
        if let Some(subtasks) = sub_map.remove(&task.id) {
            task.subtasks = subtasks;
        }
    }

    Ok(tasks)
}

pub fn create(conn: &mut Connection, input: TaskInput) -> AppResult<Task> {
    validate(&input)?;
    let id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let ts = now();
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO tasks (id, title, notes, priority, due_date, due_time, project_id, section_id, recur_rule, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            notes = excluded.notes,
            priority = excluded.priority,
            due_date = excluded.due_date,
            due_time = excluded.due_time,
            project_id = excluded.project_id,
            section_id = excluded.section_id,
            recur_rule = excluded.recur_rule,
            updated_at = excluded.updated_at",
        params![
            id,
            input.title.trim(),
            input.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.project_id,
            input.section_id,
            input.recur_rule,
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
                project_id = ?7, section_id = ?8, recur_rule = ?9, updated_at = ?10
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
            input.recur_rule,
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

pub fn set_completed(conn: &mut Connection, id: &str, done: bool) -> AppResult<Task> {
    let completed_at = if done { Some(now()) } else { None };
    let changed = conn.execute(
        "UPDATE tasks SET completed_at = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, completed_at, now()],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    let task = get(conn, id)?;

    
    if done
        && let Some(rule) = &task.recur_rule
    {
        let today_str = Utc::now().format("%Y-%m-%d").to_string();
        let base_date = task.due_date.as_deref().unwrap_or(&today_str);
        if let Some(next_date) = crate::db::recur::next_due(base_date, rule) {
            let exists: bool = conn.query_row(
                "SELECT EXISTS(
                    SELECT 1 FROM tasks 
                    WHERE title = ?1 AND due_date = ?2 AND deleted_at IS NULL
                )",
                params![task.title.trim(), next_date],
                |row| row.get(0),
            )?;
            if !exists {
                let next_input = TaskInput {
                    id: None,
                    title: task.title.clone(),
                    notes: task.notes.clone(),
                    priority: task.priority.clone(),
                    due_date: Some(next_date),
                    due_time: task.due_time.clone(),
                    project_id: task.project_id.clone(),
                    section_id: task.section_id.clone(),
                    tags: task.tags.clone(),
                    recur_rule: Some(rule.clone()),
                };
                let _ = create(conn, next_input);
            }
        }
    }

    Ok(task)
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

pub fn restore_task(conn: &Connection, id: &str) -> AppResult<()> {
    let ts = now();
    let changed = conn.execute(
        "UPDATE tasks SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NOT NULL",
        params![id, ts],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    Ok(())
}

pub fn permanent_delete(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM task_tags WHERE task_id = ?1", params![id])?;
    conn.execute("DELETE FROM subtasks WHERE task_id = ?1", params![id])?;
    let changed = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("task {id}")));
    }
    Ok(())
}

pub fn empty_trash(conn: &Connection) -> AppResult<usize> {
    conn.execute("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL)", [])?;
    conn.execute("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL)", [])?;
    let count = conn.execute("DELETE FROM tasks WHERE deleted_at IS NOT NULL", [])?;
    Ok(count)
}

pub fn auto_purge_trash(conn: &Connection) -> AppResult<usize> {
    conn.execute("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL AND julianday('now') - julianday(deleted_at) > 30)", [])?;
    conn.execute("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL AND julianday('now') - julianday(deleted_at) > 30)", [])?;
    let count = conn.execute(
        "DELETE FROM tasks WHERE deleted_at IS NOT NULL AND julianday('now') - julianday(deleted_at) > 30",
        [],
    )?;
    Ok(count)
}

pub fn list_trash(conn: &Connection) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!("SELECT {SELECT_COLS} FROM tasks WHERE deleted_at IS NOT NULL ORDER BY updated_at DESC"),
        &[],
    )
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

    conn.execute(
        "UPDATE tasks SET updated_at = ?2 WHERE id = ?1",
        params![task_id, now()],
    )?;
    get(conn, &task_id)
}

pub fn list_open(conn: &Connection) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!("SELECT {SELECT_COLS} FROM tasks WHERE completed_at IS NULL AND deleted_at IS NULL {ORDER}"),
        &[],
    )
}

pub fn list_today(conn: &Connection, today: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks WHERE due_date = ?1 AND completed_at IS NULL AND deleted_at IS NULL {ORDER}"
        ),
        &[&today],
    )
}

pub fn list_overdue(conn: &Connection, today: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks WHERE due_date < ?1 AND completed_at IS NULL AND deleted_at IS NULL {ORDER}"
        ),
        &[&today],
    )
}

pub fn list_for_project(conn: &Connection, project_id: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks WHERE project_id = ?1 AND deleted_at IS NULL {ORDER}"
        ),
        &[&project_id],
    )
}

pub fn list_for_tag(conn: &Connection, tag: &str) -> AppResult<Vec<Task>> {
    let name = normalize_tag(tag).ok_or_else(|| AppError::Invalid("tag is required".into()))?;
    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks
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
                                    project_id, section_id, recur_rule, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                 ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    notes = excluded.notes,
                    priority = excluded.priority,
                    due_date = excluded.due_date,
                    due_time = excluded.due_time,
                    completed_at = excluded.completed_at,
                    project_id = excluded.project_id,
                    section_id = excluded.section_id,
                    recur_rule = excluded.recur_rule,
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
                    task.recur_rule,
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


pub fn generate_missed_recurring(conn: &mut Connection) -> AppResult<usize> {
    let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    
    
    let overdue_recurring: Vec<Task> = collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks 
             WHERE recur_rule IS NOT NULL 
               AND recur_rule != '' 
               AND due_date IS NOT NULL 
               AND due_date < ?1 
               AND completed_at IS NULL 
               AND deleted_at IS NULL"
        ),
        &[&today_str],
    )?;

    let mut generated_count = 0;
    for task in overdue_recurring {
        if let (Some(rule), Some(curr_due_val)) = (&task.recur_rule, &task.due_date) {
            let mut curr_due = curr_due_val.clone();

            
            let mut iterations = 0;
            let mut next_due_opt = crate::db::recur::next_due(&curr_due, rule);
            
            while let Some(next_due) = next_due_opt {
                iterations += 1;
                if iterations > 365 {
                    break;
                }
                if next_due.as_str() >= today_str.as_str() {
                    
                    let exists: bool = conn.query_row(
                        "SELECT EXISTS(
                            SELECT 1 FROM tasks 
                            WHERE title = ?1 AND due_date = ?2 AND deleted_at IS NULL
                        )",
                        params![task.title.trim(), next_due],
                        |row| row.get(0),
                    )?;

                    if !exists {
                        let next_input = TaskInput {
                            id: None,
                            title: task.title.clone(),
                            notes: task.notes.clone(),
                            priority: task.priority.clone(),
                            due_date: Some(next_due),
                            due_time: task.due_time.clone(),
                            project_id: task.project_id.clone(),
                            section_id: task.section_id.clone(),
                            tags: task.tags.clone(),
                            recur_rule: Some(rule.clone()),
                        };
                        let _ = create(conn, next_input);
                        generated_count += 1;
                    }
                    break;
                } else {
                    curr_due = next_due;
                    next_due_opt = crate::db::recur::next_due(&curr_due, rule);
                }
            }
        }
    }

    Ok(generated_count)
}

pub fn reschedule_overdue(conn: &Connection, target_date: &str) -> AppResult<usize> {
    let ts = now();
    let count = conn.execute(
        "UPDATE tasks 
         SET due_date = ?1, updated_at = ?2 
         WHERE due_date < ?1 AND completed_at IS NULL AND deleted_at IS NULL",
        params![target_date, ts],
    )?;
    Ok(count)
}

pub fn search_fts(conn: &Connection, query: &str) -> AppResult<Vec<Task>> {
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }

    let escaped = clean_query.replace('"', "\"\"");
    let fts_query = format!("\"{}\"", escaped);

    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks
             WHERE id IN (
                 SELECT task_id FROM tasks_fts WHERE tasks_fts MATCH ?1
             ) AND deleted_at IS NULL
             {ORDER}"
        ),
        &[&fts_query],
    )
}

pub fn list_completed_between(conn: &Connection, start: &str, end: &str) -> AppResult<Vec<Task>> {
    collect(
        conn,
        &format!(
            "SELECT {SELECT_COLS} FROM tasks
             WHERE deleted_at IS NULL
               AND completed_at IS NOT NULL
               AND julianday(completed_at) >= julianday(?1)
               AND julianday(completed_at) < julianday(?2)
             {ORDER}"
        ),
        &[&start, &end],
    )
}