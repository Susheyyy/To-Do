use rusqlite::{params, Connection, OptionalExtension};
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
    pub pull_cursor: Option<String>,
    pub quarantined_count: usize,
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

    let pull_cursor = conn.query_row(
        "SELECT value FROM sync_metadata WHERE key = 'pull_cursor'", [], |r| r.get(0),
    ).optional()?;

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

    let quarantined_count = conn.query_row("SELECT COUNT(*) FROM sync_quarantine", [], |row| row.get(0))?;
    Ok(SyncStatus {
        enabled,
        server_url,
        device_id,
        unsynced_count,
        last_synced_at,
        pull_cursor,
        quarantined_count,
    })
}

pub fn set_sync_config(
    conn: &mut Connection, enabled: Option<bool>, server_url: Option<&str>, group_id: Option<&str>,
) -> AppResult<()> {
    let tx = conn.transaction()?;
    if let Some(url) = server_url {
        let group = group_id.filter(|id| uuid::Uuid::parse_str(id).is_ok())
            .ok_or_else(|| crate::error::AppError::Invalid("Invalid relay group identity.".into()))?;
        let pinned: Option<String> = tx.query_row(
            "SELECT value FROM sync_metadata WHERE key = 'relay_group'", [], |row| row.get(0),
        ).optional()?;
        let status = get_sync_status(&tx)?;
        let previous_group = pinned.as_deref().or_else(|| {
            status.pull_cursor.as_deref().and_then(|cursor| cursor.split_once(':').map(|(id, _)| id))
        });
        if previous_group.is_some_and(|id| id != group)
            || (previous_group.is_none() && status.server_url.as_deref()
                .is_some_and(|old| old.trim_end_matches('/') != url.trim_end_matches('/')))
        {
            return Err(crate::error::AppError::Invalid(
                "This database is already associated with another relay group. Use a separate database for the new group.".into(),
            ));
        }
        tx.execute(
            "INSERT INTO sync_metadata (key, value) VALUES ('server_url', ?1), ('relay_group', ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![url, group],
        )?;
    }
    if let Some(enabled) = enabled {
        tx.execute(
            "INSERT INTO sync_metadata (key, value) VALUES ('sync_enabled', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [if enabled { "true" } else { "false" }],
        )?;
    }
    tx.commit()?;
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

fn apply_change(tx: &Connection, change: &IncomingChange) -> AppResult<usize> {
    if !matches!(change.op_type.as_str(), "upsert" | "delete") {
        return Err(crate::error::AppError::Invalid("Unsupported sync operation".into()));
    }
    let valid_timestamp: bool = tx.query_row("SELECT julianday(?1) IS NOT NULL", [&change.updated_at], |row| row.get(0))?;
    if !valid_timestamp {
        return Err(crate::error::AppError::Invalid("Invalid sync timestamp".into()));
    }
    if change.op_type == "delete" {
        match change.entity_type.as_str() {
            "task" => tx.execute(
                "UPDATE tasks SET deleted_at = ?2, updated_at = ?2
                 WHERE id = ?1 AND julianday(updated_at) <= julianday(?2)",
                params![change.entity_id, change.updated_at],
            )?,
            "subtask" => tx.execute("DELETE FROM subtasks WHERE id = ?1", [&change.entity_id])?,
            "habit_log" => {
                let payload: serde_json::Value = serde_json::from_str(change.payload.as_deref().unwrap_or("null"))
                    .map_err(|err| crate::error::AppError::Invalid(err.to_string()))?;
                tx.execute("DELETE FROM habit_logs WHERE id = ?1 OR (habit_id = ?2 AND logged_date = ?3)",
                    params![change.entity_id, payload["habit_id"].as_str(), payload["logged_date"].as_str()])?
            }
            _ => return Err(crate::error::AppError::Invalid("Unsupported sync deletion".into())),
        };
        return Ok(1);
    }

    let payload = change.payload.as_deref().ok_or_else(|| crate::error::AppError::Invalid("Missing sync payload".into()))?;
    let v: serde_json::Value = serde_json::from_str(payload)
        .map_err(|err| crate::error::AppError::Invalid(err.to_string()))?;
    let field = |name: &str| v.get(name).and_then(|value| value.as_str());
    let updated_at = field("updated_at").unwrap_or(&change.updated_at);
    let created_at = field("created_at").unwrap_or(updated_at);
    let valid_timestamps: bool = tx.query_row(
        "SELECT julianday(?1) IS NOT NULL AND julianday(?2) IS NOT NULL", params![created_at, updated_at], |row| row.get(0),
    )?;
    if !valid_timestamps {
        return Err(crate::error::AppError::Invalid("Invalid task or project timestamp".into()));
    }
    let id = &change.entity_id;
    let changed = match change.entity_type.as_str() {
        "task" => tx.execute(
            "INSERT INTO tasks (id, title, notes, priority, due_date, due_time, completed_at, deleted_at, project_id, section_id, recur_rule, created_at, updated_at, series_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
             ON CONFLICT(id) DO UPDATE SET title=excluded.title, notes=excluded.notes, priority=excluded.priority,
                 due_date=excluded.due_date, due_time=excluded.due_time, completed_at=excluded.completed_at,
                 deleted_at=excluded.deleted_at, project_id=excluded.project_id, section_id=excluded.section_id,
                 recur_rule=excluded.recur_rule, updated_at=excluded.updated_at, series_id=excluded.series_id
             WHERE julianday(tasks.updated_at) <= julianday(excluded.updated_at)",
            params![id, field("title"), field("notes"), field("priority").unwrap_or("none"),
                field("due_date"), field("due_time"), field("completed_at"), field("deleted_at"),
                field("project_id"), field("section_id"), field("recur_rule"), created_at, updated_at,
                field("series_id").or_else(|| field("recur_rule").map(|_| id.as_str()))],
        )?,
        "subtask" => tx.execute(
            "INSERT INTO subtasks (id, task_id, title, completed_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET title=excluded.title, completed_at=excluded.completed_at, updated_at=excluded.updated_at
             WHERE julianday(subtasks.updated_at) <= julianday(excluded.updated_at)",
            params![id, field("task_id"), field("title"), field("completed_at"), created_at, updated_at],
        )?,
        "project" => tx.execute(
            "INSERT INTO projects (id, name, color, deleted_at, created_at, updated_at, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, position=excluded.position,
                 deleted_at=excluded.deleted_at, updated_at=excluded.updated_at
             WHERE julianday(projects.updated_at) <= julianday(excluded.updated_at)",
            params![id, field("name"), field("color"), field("deleted_at"), created_at, updated_at, v["position"].as_i64().unwrap_or_default()],
        )?,
        "section" => tx.execute(
            "INSERT INTO sections (id, project_id, name, position, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, position=excluded.position,
                 deleted_at=excluded.deleted_at, updated_at=excluded.updated_at
             WHERE julianday(sections.updated_at) <= julianday(excluded.updated_at)",
            params![id, field("project_id"), field("name"), v["position"].as_i64().unwrap_or_default(),
                field("deleted_at"), created_at, updated_at],
        )?,
        "habit" => tx.execute(
            "INSERT INTO habits (id, name, color, icon, frequency, custom_days, target_streak, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, icon=excluded.icon,
                 frequency=excluded.frequency, custom_days=excluded.custom_days, target_streak=excluded.target_streak,
                 deleted_at=excluded.deleted_at, updated_at=excluded.updated_at
             WHERE julianday(habits.updated_at) <= julianday(excluded.updated_at)",
            params![id, field("name"), field("color"), field("icon"), field("frequency").unwrap_or("daily"),
                field("custom_days"), v["target_streak"].as_i64().unwrap_or(1), field("deleted_at"), created_at, updated_at],
        )?,
        "habit_log" => tx.execute(
            "INSERT INTO habit_logs (id, habit_id, logged_date, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(habit_id, logged_date) DO UPDATE SET id=excluded.id, created_at=excluded.created_at",
            params![id, field("habit_id"), field("logged_date"), created_at],
        )?,
        _ => return Err(crate::error::AppError::Invalid("Unsupported sync entity".into())),
    };
    if change.entity_type == "task" && changed > 0 && let Some(tags) = v.get("tags") {
        let tags = serde_json::from_value::<Vec<String>>(tags.clone())
            .map_err(|err| crate::error::AppError::Invalid(err.to_string()))?;
        super::tasks_repo::replace_tags(&tx, id, &tags)?;
    }
    Ok(changed)
}

pub fn apply_incoming_changes(conn: &mut Connection, changes: Vec<IncomingChange>, cursor: &str) -> AppResult<usize> {
    let mut tx = conn.transaction()?;
    let last_log_id: i64 = tx.query_row("SELECT COALESCE(MAX(id), 0) FROM sync_log", [], |row| row.get(0))?;
    let mut applied = 0;
    let mut pending = {
        let mut stmt = tx.prepare(
            "SELECT change_json FROM sync_quarantine WHERE retryable = 1 AND ?1 > 0",
        )?;
        stmt.query_map([changes.len()], |row| row.get::<_, String>(0))?
            .map(|row| serde_json::from_str::<IncomingChange>(&row?).map_err(|error|
                crate::error::AppError::Invalid(format!("Could not read deferred sync record: {error}"))))
            .collect::<AppResult<Vec<_>>>()?
    };
    let replaced: std::collections::HashSet<_> = changes.iter()
        .map(|change| (&change.entity_type, &change.entity_id)).collect();
    pending.retain(|change| !replaced.contains(&(&change.entity_type, &change.entity_id)));
    pending.extend(changes);
    // Place parents before dependents so each record can be checked with immediate foreign keys.
    pending.sort_by_key(|change| match change.entity_type.as_str() {
        "project" | "habit" => 0,
        "section" => 1,
        "task" | "habit_log" => 2,
        _ => 3,
    });
    for change in pending {
        let savepoint = tx.savepoint()?;
        match apply_change(&savepoint, &change) {
            Ok(count) => {
                savepoint.commit()?;
                applied += count;
                tx.execute("DELETE FROM sync_quarantine WHERE entity_type = ?1 AND entity_id = ?2",
                    params![change.entity_type, change.entity_id])?;
            }
            Err(err) => {
                drop(savepoint);
                let retryable = match &err {
                    crate::error::AppError::Invalid(_) => false,
                    crate::error::AppError::Db(rusqlite::Error::SqliteFailure(code, _))
                        if code.code == rusqlite::ErrorCode::ConstraintViolation =>
                            code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY,
                    _ => return Err(err),
                };
                let json = serde_json::to_string(&change)
                    .map_err(|error| crate::error::AppError::Invalid(error.to_string()))?;
                tx.execute(
                    "INSERT INTO sync_quarantine(entity_type, entity_id, change_json, error, retryable)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
                         change_json = excluded.change_json, error = excluded.error, retryable = excluded.retryable",
                    params![change.entity_type, change.entity_id, json, err.to_string(), retryable],
                )?;
            }
        }
    }

    // Only mutations generated by this incoming transaction are above this watermark.
    tx.execute("DELETE FROM sync_log WHERE id > ?1", [last_log_id])?;
    tx.execute(
        "INSERT INTO sync_metadata (key, value) VALUES ('pull_cursor', ?1), ('last_synced_at', ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![cursor, chrono::Utc::now().to_rfc3339()],
    )?;
    tx.commit()?;
    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn change(entity_type: &str, id: &str, payload: serde_json::Value) -> IncomingChange {
        IncomingChange {
            entity_type: entity_type.into(),
            entity_id: id.into(),
            op_type: "upsert".into(),
            payload: Some(payload.to_string()),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn database_rejects_a_different_relay_group_without_changing_settings() {
        let mut conn = crate::db::test_connection();
        let group = "a1200000-0000-4000-8000-000000000001";
        let other = "a1200000-0000-4000-8000-000000000002";
        set_sync_config(&mut conn, Some(true), Some("https://first.example"), Some(group)).unwrap();
        assert!(set_sync_config(&mut conn, Some(true), Some("https://second.example"), Some(other)).is_err());
        assert_eq!(get_sync_status(&conn).unwrap().server_url.as_deref(), Some("https://first.example"));
        set_sync_config(&mut conn, None, Some("https://moved.example"), Some(group)).unwrap();
        assert_eq!(get_sync_status(&conn).unwrap().server_url.as_deref(), Some("https://moved.example"));
    }

    #[test]
    fn incoming_batch_resolves_parent_links_and_does_not_requeue_changes() {
        use serde_json::json;

        let mut conn = crate::db::test_connection();
        conn.execute(
            "INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('local', 'Local', ?1, ?1)",
            ["2026-01-01T00:00:00Z"],
        ).unwrap();

        let incoming = vec![
            change("habit_log", "log", json!({"habit_id": "habit", "logged_date": "2026-01-01"})),
            change("subtask", "subtask", json!({"task_id": "task", "title": "Step"})),
            change("task", "task", json!({"project_id": "project", "section_id": "section", "title": "Task"})),
            change("section", "section", json!({"project_id": "project", "name": "Section"})),
            change("project", "project", json!({"name": "Project"})),
            change("habit", "habit", json!({"name": "Habit"})),
        ];
        assert_eq!(apply_incoming_changes(&mut conn, incoming, "relay:1").unwrap(), 6);
        let pending = get_unsynced_items(&conn, 50).unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].entity_id, "local");
        assert_eq!(get_sync_status(&conn).unwrap().pull_cursor.as_deref(), Some("relay:1"));

        let invalid = vec![change("subtask", "orphan", json!({"task_id": "missing", "title": "Orphan"}))];
        let mut mixed = invalid;
        mixed.push(change("task", "good", json!({"title": "Good"})));
        assert_eq!(apply_incoming_changes(&mut conn, mixed, "relay:2").unwrap(), 1);
        let status = get_sync_status(&conn).unwrap();
        assert_eq!(status.pull_cursor.as_deref(), Some("relay:2"));
        assert_eq!(status.quarantined_count, 1);

        let parent = change("task", "missing", json!({"title": "Parent"}));
        assert_eq!(apply_incoming_changes(&mut conn, vec![parent], "relay:3").unwrap(), 2);
        assert_eq!(get_sync_status(&conn).unwrap().quarantined_count, 0);
    }
}
