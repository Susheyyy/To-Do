ALTER TABLE tasks ADD COLUMN recur_rule TEXT;

CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekly', 'custom')),
    custom_days TEXT,
    target_streak INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id),
    logged_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(habit_id, logged_date)
);

CREATE INDEX idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX idx_habit_logs_date ON habit_logs(logged_date);

