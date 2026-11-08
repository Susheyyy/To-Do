CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'task', 'project', 'habit'
    entity_id TEXT NOT NULL,
    op_type TEXT NOT NULL, -- 'upsert', 'delete'
    payload TEXT, -- JSON snapshot of the entity
    client_timestamp TEXT NOT NULL,
    synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_unsynced ON sync_log(synced_at);

CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Triggers to automatically log mutations on tasks
CREATE TRIGGER IF NOT EXISTS trg_sync_task_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'task',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'title', new.title,
            'notes', new.notes,
            'priority', new.priority,
            'due_date', new.due_date,
            'due_time', new.due_time,
            'completed_at', new.completed_at,
            'deleted_at', new.deleted_at,
            'project_id', new.project_id,
            'section_id', new.section_id,
            'recur_rule', new.recur_rule,
            'updated_at', new.updated_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_task_update AFTER UPDATE ON tasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'task',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'title', new.title,
            'notes', new.notes,
            'priority', new.priority,
            'due_date', new.due_date,
            'due_time', new.due_time,
            'completed_at', new.completed_at,
            'deleted_at', new.deleted_at,
            'project_id', new.project_id,
            'section_id', new.section_id,
            'recur_rule', new.recur_rule,
            'updated_at', new.updated_at
        ),
        datetime('now'),
        NULL
    );
END;

-- Subtask sync triggers
CREATE TRIGGER IF NOT EXISTS trg_sync_subtask_insert AFTER INSERT ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'task_id', new.task_id,
            'title', new.title,
            'completed_at', new.completed_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_subtask_update AFTER UPDATE ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'task_id', new.task_id,
            'title', new.title,
            'completed_at', new.completed_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_subtask_delete AFTER DELETE ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        old.id,
        'delete',
        json_object('id', old.id, 'task_id', old.task_id),
        datetime('now'),
        NULL
    );
END;

-- Project sync triggers
CREATE TRIGGER IF NOT EXISTS trg_sync_project_insert AFTER INSERT ON projects BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'project',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'deleted_at', new.deleted_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_project_update AFTER UPDATE ON projects BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'project',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'deleted_at', new.deleted_at
        ),
        datetime('now'),
        NULL
    );
END;

-- Habit sync triggers
CREATE TRIGGER IF NOT EXISTS trg_sync_habit_insert AFTER INSERT ON habits BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'habit',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'icon', new.icon,
            'frequency', new.frequency,
            'custom_days', new.custom_days,
            'target_streak', new.target_streak,
            'deleted_at', new.deleted_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_habit_update AFTER UPDATE ON habits BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'habit',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'icon', new.icon,
            'frequency', new.frequency,
            'custom_days', new.custom_days,
            'target_streak', new.target_streak,
            'deleted_at', new.deleted_at
        ),
        datetime('now'),
        NULL
    );
END;

-- Habit log checkoff sync triggers
CREATE TRIGGER IF NOT EXISTS trg_sync_habit_log_insert AFTER INSERT ON habit_logs BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'habit_log',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'habit_id', new.habit_id,
            'logged_date', new.logged_date,
            'created_at', new.created_at
        ),
        datetime('now'),
        NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sync_habit_log_delete AFTER DELETE ON habit_logs BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'habit_log',
        old.id,
        'delete',
        json_object('id', old.id, 'habit_id', old.habit_id, 'logged_date', old.logged_date),
        datetime('now'),
        NULL
    );
END;

