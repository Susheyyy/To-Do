ALTER TABLE tasks ADD COLUMN series_id TEXT;
DROP INDEX idx_tasks_recur_dedup;
CREATE UNIQUE INDEX idx_task_series_date ON tasks(series_id, due_date)
    WHERE series_id IS NOT NULL AND due_date IS NOT NULL AND deleted_at IS NULL;

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
            'series_id', new.series_id,
            'tags', (SELECT json_group_array(name) FROM (
                SELECT tags.name FROM task_tags JOIN tags ON tags.id = task_tags.tag_id
                WHERE task_tags.task_id = new.id ORDER BY tags.name
            )),
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
            'series_id', new.series_id,
            'tags', (SELECT json_group_array(name) FROM (
                SELECT tags.name FROM task_tags JOIN tags ON tags.id = task_tags.tag_id
                WHERE task_tags.task_id = new.id ORDER BY tags.name
            )),
            'created_at', new.created_at, 'updated_at', new.updated_at
        ),
        new.updated_at,
        NULL
    );
END;

-- Backfill the richer task snapshots without changing their conflict timestamps.
UPDATE tasks SET series_id = CASE WHEN recur_rule IS NOT NULL AND recur_rule != '' THEN id END;

CREATE TABLE calendar_outbox (
    revision INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL UNIQUE,
    retry_after TEXT,
    last_error TEXT
);

CREATE TRIGGER trg_calendar_task_insert AFTER INSERT ON tasks BEGIN
    INSERT OR REPLACE INTO calendar_outbox(task_id) VALUES (new.id);
END;

CREATE TRIGGER trg_calendar_task_update AFTER UPDATE OF title, notes, due_date, due_time, completed_at, deleted_at ON tasks
WHEN old.title IS NOT new.title OR old.notes IS NOT new.notes OR old.due_date IS NOT new.due_date
    OR old.due_time IS NOT new.due_time OR old.completed_at IS NOT new.completed_at
    OR old.deleted_at IS NOT new.deleted_at
BEGIN
    INSERT OR REPLACE INTO calendar_outbox(task_id) VALUES (new.id);
END;

CREATE TRIGGER trg_calendar_task_delete AFTER DELETE ON tasks BEGIN
    INSERT OR REPLACE INTO calendar_outbox(task_id) VALUES (old.id);
END;
