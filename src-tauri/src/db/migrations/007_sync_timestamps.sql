-- Preserve entity timestamps and include sections referenced by synced tasks.

DROP TRIGGER trg_sync_task_insert;
CREATE TRIGGER trg_sync_task_insert AFTER INSERT ON tasks BEGIN
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
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_task_update;
CREATE TRIGGER trg_sync_task_update AFTER UPDATE ON tasks BEGIN
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
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_subtask_insert;
CREATE TRIGGER trg_sync_subtask_insert AFTER INSERT ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'task_id', new.task_id,
            'title', new.title,
            'completed_at', new.completed_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_subtask_update;
CREATE TRIGGER trg_sync_subtask_update AFTER UPDATE ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'task_id', new.task_id,
            'title', new.title,
            'completed_at', new.completed_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_subtask_delete;
CREATE TRIGGER trg_sync_subtask_delete AFTER DELETE ON subtasks BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'subtask',
        old.id,
        'delete',
        json_object('id', old.id, 'task_id', old.task_id),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        NULL
    );
END;

DROP TRIGGER trg_sync_project_insert;
CREATE TRIGGER trg_sync_project_insert AFTER INSERT ON projects BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'project',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'position', new.position,
            'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_project_update;
CREATE TRIGGER trg_sync_project_update AFTER UPDATE ON projects BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'project',
        new.id,
        'upsert',
        json_object(
            'id', new.id,
            'name', new.name,
            'color', new.color,
            'position', new.position,
            'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_habit_insert;
CREATE TRIGGER trg_sync_habit_insert AFTER INSERT ON habits BEGIN
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
            'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_habit_update;
CREATE TRIGGER trg_sync_habit_update AFTER UPDATE ON habits BEGIN
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
            'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_habit_log_insert;
CREATE TRIGGER trg_sync_habit_log_insert AFTER INSERT ON habit_logs BEGIN
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
        new.created_at,
        NULL
    );
END;

DROP TRIGGER trg_sync_habit_log_delete;
CREATE TRIGGER trg_sync_habit_log_delete AFTER DELETE ON habit_logs BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp, synced_at)
    VALUES (
        'habit_log',
        old.id,
        'delete',
        json_object('id', old.id, 'habit_id', old.habit_id, 'logged_date', old.logged_date),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        NULL
    );
END;

CREATE TRIGGER trg_sync_section_insert AFTER INSERT ON sections BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp)
    VALUES ('section', new.id, 'upsert',
        json_object('id', new.id, 'project_id', new.project_id, 'name', new.name,
            'position', new.position, 'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at),
        new.updated_at);
END;

CREATE TRIGGER trg_sync_section_update AFTER UPDATE ON sections BEGIN
    INSERT INTO sync_log (entity_type, entity_id, op_type, payload, client_timestamp)
    VALUES ('section', new.id, 'upsert',
        json_object('id', new.id, 'project_id', new.project_id, 'name', new.name,
            'position', new.position, 'deleted_at', new.deleted_at,
            'created_at', new.created_at, 'updated_at', new.updated_at),
        new.updated_at);
END;

-- Queue existing parents and sections for devices that have never received them.
UPDATE projects SET updated_at = updated_at;
UPDATE sections SET updated_at = updated_at;
UPDATE habits SET updated_at = updated_at;
