CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low', 'none')),
    due_date TEXT,
    due_time TEXT,
    completed_at TEXT,
    project_id TEXT REFERENCES projects(id),
    section_id TEXT REFERENCES sections(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

INSERT INTO tasks_new (id, title, notes, priority, due_date, due_time, completed_at,
                       project_id, section_id, created_at, updated_at, deleted_at)
SELECT id, title, notes, priority, due_date, due_time, completed_at,
       project_id, section_id, created_at, updated_at, deleted_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_project ON tasks(project_id);