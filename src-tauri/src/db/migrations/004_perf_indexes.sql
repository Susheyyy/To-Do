CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(deleted_at, completed_at, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
