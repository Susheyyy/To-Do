CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    task_id UNINDEXED,
    title,
    notes,
    tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(task_id, title, notes)
    VALUES (new.id, new.title, coalesce(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_update AFTER UPDATE OF title, notes ON tasks BEGIN
    DELETE FROM tasks_fts WHERE task_id = old.id;
    INSERT INTO tasks_fts(task_id, title, notes)
    VALUES (new.id, new.title, coalesce(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_delete AFTER DELETE ON tasks BEGIN
    DELETE FROM tasks_fts WHERE task_id = old.id;
END;

INSERT INTO tasks_fts(task_id, title, notes)
SELECT id, title, coalesce(notes, '')
FROM tasks
WHERE id NOT IN (SELECT task_id FROM tasks_fts);

