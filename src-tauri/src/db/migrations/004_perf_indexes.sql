CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(deleted_at, completed_at, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recur_dedup ON tasks(title, due_date) WHERE recur_rule IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id, task_id);

