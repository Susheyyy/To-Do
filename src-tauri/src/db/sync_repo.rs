use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncItem {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub op_type: String,
    pub payload: Option<String>,
    pub client_timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub enabled: bool,
    pub server_url: Option<String>,
    pub device_id: String,
    pub unsynced_count: usize,
    pub last_synced_at: Option<String>,
}

pub fn get_unsynced_items(conn: &Connection, limit: usize) -> AppResult<Vec<SyncItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, entity_type, entity_id, op_type, payload, client_timestamp 
         FROM sync_log 
         WHERE synced_at IS NULL 
         ORDER BY id ASC 
         LIMIT ?1"
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(SyncItem {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            op_type: row.get(3)?,
            payload: row.get(4)?,
            client_timestamp: row.get(5)?,
        })
    })?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r?);
    }
    Ok(items)
}

pub fn auto_purge_synced_log(conn: &Connection) -> AppResult<usize> {
    let count = conn.execute(
        "DELETE FROM sync_log WHERE synced_at IS NOT NULL AND julianday('now') - julianday(synced_at) > 30",
        [],
    )?;
    Ok(count)
}

pub fn mark_synced(conn: &Connection, ids: &[i64], timestamp: &str) -> AppResult<()> {
    for id in ids {
        conn.execute(
            "UPDATE sync_log SET synced_at = ?1 WHERE id = ?2",
            params![timestamp, id],
        )?;
    }
    conn.execute(
        "INSERT INTO sync_metadata (key, value) VALUES ('last_synced_at', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![timestamp],
    )?;
    Ok(())
}

pub fn get_sync_status(conn: &Connection) -> AppResult<SyncStatus> {
    let unsynced_count: usize = conn.query_row(
        "SELECT COUNT(*) FROM sync_log WHERE synced_at IS NULL",
        [],
        |r| r.get(0),
    ).unwrap_or(0);

    let last_synced_at: Option<String> = conn.query_row(
        "SELECT value FROM sync_metadata WHERE key = 'last_synced_at'",
        [],
        |r| r.get(0),
    ).ok();

    let server_url: Option<String> = conn.query_row(
        "SELECT value FROM sync_metadata WHERE key = 'server_url'",
        [],
        |r| r.get(0),
    ).ok();

    let device_id: String = conn.query_row(
        "SELECT value FROM sync_metadata WHERE key = 'device_id'",
        [],
        |r| r.get(0),
    ).unwrap_or_else(|_| {
        let new_id = uuid::Uuid::new_v4().to_string();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('device_id', ?1)",
            params![new_id],
        );
        new_id
    });

    let enabled: bool = conn.query_row(
        "SELECT value = 'true' FROM sync_metadata WHERE key = 'sync_enabled'",
        [],
        |r| r.get(0),
    ).unwrap_or(false);

    Ok(SyncStatus {
        enabled,
        server_url,
        device_id,
        unsynced_count,
        last_synced_at,
    })
}

pub fn set_sync_config(conn: &Connection, enabled: bool, server_url: Option<&str>) -> AppResult<()> {
    conn.execute(
        "INSERT INTO sync_metadata (key, value) VALUES ('sync_enabled', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![if enabled { "true" } else { "false" }],
    )?;
    if let Some(url) = server_url {
        conn.execute(
            "INSERT INTO sync_metadata (key, value) VALUES ('server_url', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![url],
        )?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingChange {
    pub entity_type: String,
    pub entity_id: String,
    pub op_type: String,
    pub payload: Option<String>,
    pub updated_at: String,
}

pub fn apply_incoming_changes(conn: &mut Connection, changes: Vec<IncomingChange>) -> AppResult<usize> {
    let tx = conn.transaction()?;
    let mut applied = 0;

    for change in changes {

        let _ = tx.execute(
            "INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![
                change.entity_type,
                change.entity_id,
                change.op_type,
                change.payload,
                change.updated_at,
            ],
        );

        if change.entity_type == "task" {
            if let Some(payload_str) = &change.payload {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload_str) {
                    let id = change.entity_id.clone();
                    let title = v.get("title").and_then(|s| s.as_str()).unwrap_or("");
                    let notes = v.get("notes").and_then(|s| s.as_str());
                    let priority = v.get("priority").and_then(|s| s.as_str()).unwrap_or("none");
                    let due_date = v.get("due_date").and_then(|s| s.as_str());
                    let due_time = v.get("due_time").and_then(|s| s.as_str());
                    let completed_at = v.get("completed_at").and_then(|s| s.as_str());
                    let deleted_at = v.get("deleted_at").and_then(|s| s.as_str());
                    let project_id = v.get("project_id").and_then(|s| s.as_str());
                    let section_id = v.get("section_id").and_then(|s| s.as_str());
                    let recur_rule = v.get("recur_rule").and_then(|s| s.as_str());
                    let updated_at = &change.updated_at;


                    let should_apply: bool = tx.query_row(
                        "SELECT CASE 
                            WHEN NOT EXISTS(SELECT 1 FROM tasks WHERE id = ?1) THEN 1 
                            WHEN (SELECT updated_at FROM tasks WHERE id = ?1) <= ?2 THEN 1 
                            ELSE 0 
                         END",
                        params![id, updated_at],
                        |r| r.get(0),
                    ).unwrap_or(true);

                    if should_apply {
                        tx.execute(
                            "INSERT INTO tasks (id, title, notes, priority, due_date, due_time, completed_at, deleted_at, project_id, section_id, recur_rule, created_at, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
                             ON CONFLICT(id) DO UPDATE SET
                                title = excluded.title,
                                notes = excluded.notes,
                                priority = excluded.priority,
                                due_date = excluded.due_date,
                                due_time = excluded.due_time,
                                completed_at = excluded.completed_at,
                                deleted_at = excluded.deleted_at,
                                project_id = excluded.project_id,
                                section_id = excluded.section_id,
                                recur_rule = excluded.recur_rule,
                                updated_at = excluded.updated_at",
                            params![
                                id, title, notes, priority, due_date, due_time, completed_at, deleted_at,
                                project_id, section_id, recur_rule, updated_at
                            ],
                        )?;
                        applied += 1;
                    }
                }
            } else if change.op_type == "delete" {
                tx.execute(
                    "UPDATE tasks SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
                    params![change.entity_id, change.updated_at],
                )?;
                applied += 1;
            }
        } else if change.entity_type == "subtask" {
            if let Some(payload_str) = &change.payload {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload_str) {
                    let id = change.entity_id.clone();
                    let task_id = v.get("task_id").and_then(|s| s.as_str()).unwrap_or("");
                    let title = v.get("title").and_then(|s| s.as_str()).unwrap_or("");
                    let completed_at = v.get("completed_at").and_then(|s| s.as_str());

                    tx.execute(
                        "INSERT INTO subtasks (id, task_id, title, completed_at)
                         VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            completed_at = excluded.completed_at",
                        params![id, task_id, title, completed_at],
                    )?;
                    applied += 1;
                }
            } else if change.op_type == "delete" {
                tx.execute("DELETE FROM subtasks WHERE id = ?1", params![change.entity_id])?;
                applied += 1;
            }
        } else if change.entity_type == "project" {
            if let Some(payload_str) = &change.payload {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload_str) {
                    let id = change.entity_id.clone();
                    let name = v.get("name").and_then(|s| s.as_str()).unwrap_or("");
                    let color = v.get("color").and_then(|s| s.as_str()).unwrap_or("#6366f1");
                    let deleted_at = v.get("deleted_at").and_then(|s| s.as_str());

                    tx.execute(
                        "INSERT INTO projects (id, name, color, deleted_at)
                         VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            color = excluded.color,
                            deleted_at = excluded.deleted_at",
                        params![id, name, color, deleted_at],
                    )?;
                    applied += 1;
                }
            }
        } else if change.entity_type == "habit_log" {
            if let Some(payload_str) = &change.payload {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload_str) {
                    let id = change.entity_id.clone();
                    let habit_id = v.get("habit_id").and_then(|s| s.as_str()).unwrap_or("");
                    let logged_date = v.get("logged_date").and_then(|s| s.as_str()).unwrap_or("");
                    let created_at = v.get("created_at").and_then(|s| s.as_str()).unwrap_or(&change.updated_at);

                    tx.execute(
                        "INSERT INTO habit_logs (id, habit_id, logged_date, created_at)
                         VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT(habit_id, logged_date) DO NOTHING",
                        params![id, habit_id, logged_date, created_at],
                    )?;
                    applied += 1;
                }
            } else if change.op_type == "delete" {
                tx.execute("DELETE FROM habit_logs WHERE id = ?1", params![change.entity_id])?;
                applied += 1;
            }
        }
    }

    tx.commit()?;
    Ok(applied)
}

