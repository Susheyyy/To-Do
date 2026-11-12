CREATE TABLE sync_quarantine (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    change_json TEXT NOT NULL,
    error TEXT NOT NULL,
    retryable INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX idx_sync_quarantine_retryable ON sync_quarantine(retryable);

-- An outer task UPSERT can override the conflict policy of INSERT OR REPLACE
-- inside its triggers. Replace the entry explicitly so its revision still advances.
DROP TRIGGER trg_calendar_task_insert;
CREATE TRIGGER trg_calendar_task_insert AFTER INSERT ON tasks BEGIN
    DELETE FROM calendar_outbox WHERE task_id = new.id;
    INSERT INTO calendar_outbox(task_id) VALUES (new.id);
END;

DROP TRIGGER trg_calendar_task_update;
CREATE TRIGGER trg_calendar_task_update AFTER UPDATE OF title, notes, due_date, due_time, completed_at, deleted_at ON tasks
WHEN old.title IS NOT new.title OR old.notes IS NOT new.notes OR old.due_date IS NOT new.due_date
    OR old.due_time IS NOT new.due_time OR old.completed_at IS NOT new.completed_at
    OR old.deleted_at IS NOT new.deleted_at
BEGIN
    DELETE FROM calendar_outbox WHERE task_id = new.id;
    INSERT INTO calendar_outbox(task_id) VALUES (new.id);
END;

DROP TRIGGER trg_calendar_task_delete;
CREATE TRIGGER trg_calendar_task_delete AFTER DELETE ON tasks BEGIN
    DELETE FROM calendar_outbox WHERE task_id = old.id;
    INSERT INTO calendar_outbox(task_id) VALUES (old.id);
END;
