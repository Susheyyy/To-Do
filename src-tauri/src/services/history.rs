use std::collections::VecDeque;

use rusqlite::Connection;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;

use crate::db::{projects_repo, tasks_repo};
use crate::error::{AppError, AppResult};
use crate::models::{Project, Task};

const LIMIT: usize = 50;

#[derive(Debug, Clone)]
pub enum Change {
    Task { id: String, before: Box<Option<Task>> },
    Project { id: String, before: Option<Project> },
}

#[derive(Debug, Clone)]
pub struct Action {
    pub label: String,
    pub changes: Vec<(Change, Change)>,
}

#[derive(Default)]
pub struct History {
    undo: VecDeque<Action>,
    redo: Vec<Action>,
}

impl History {
    pub fn record(&mut self, conn: &Connection, label: &str, changes: Vec<Change>) -> AppResult<()> {
        if changes.is_empty() {
            return Ok(());
        }
        let changes = changes.into_iter().map(|before| {
            let after = capture_current(conn, &before)?;
            Ok((before, after))
        }).collect::<AppResult<Vec<_>>>()?;
        self.push_undo(Action {
            label: label.to_string(),
            changes,
        });
        self.redo.clear();
        Ok(())
    }

    pub fn pop_undo(&mut self) -> Option<Action> {
        self.undo.pop_back()
    }

    pub fn pop_redo(&mut self) -> Option<Action> {
        self.redo.pop()
    }

    pub fn push_undo(&mut self, action: Action) {
        self.undo.push_back(action);
        while self.undo.len() > LIMIT {
            self.undo.pop_front();
        }
    }

    pub fn push_redo(&mut self, action: Action) {
        self.redo.push(action);
    }
}

pub fn capture_task(conn: &Connection, id: &str) -> AppResult<Change> {
    Ok(Change::Task {
        id: id.to_string(),
        before: Box::new(tasks_repo::find(conn, id)?),
    })
}

pub fn capture_project(conn: &Connection, id: &str) -> AppResult<Change> {
    Ok(Change::Project {
        id: id.to_string(),
        before: projects_repo::find(conn, id)?,
    })
}

fn capture_current(conn: &Connection, change: &Change) -> AppResult<Change> {
    match change {
        Change::Task { id, .. } => capture_task(conn, id),
        Change::Project { id, .. } => capture_project(conn, id),
    }
}

fn history_error(error: serde_json::Error) -> AppError {
    AppError::Invalid(format!("Could not read undo history: {error}"))
}

fn conflict() -> AppError {
    AppError::Invalid("Undo or redo conflicts with a newer change to the same data.".into())
}

fn content<T: Serialize>(value: &T) -> AppResult<Value> {
    let mut value = serde_json::to_value(value).map_err(history_error)?;
    if let Some(fields) = value.as_object_mut() {
        fields.remove("updatedAt");
    }
    Ok(value)
}

fn merge<T: Serialize + DeserializeOwned + Clone>(
    before: Option<&T>, after: Option<&T>, current: Option<&T>,
) -> AppResult<Option<T>> {
    if let (Some(before), Some(after), Some(current)) = (before, after, current) {
        let before = serde_json::to_value(before).map_err(history_error)?;
        let after = serde_json::to_value(after).map_err(history_error)?;
        let mut merged = serde_json::to_value(current).map_err(history_error)?;
        let fields = before.as_object().ok_or_else(conflict)?;
        for (key, old) in fields {
            if key == "updatedAt" || after.get(key) == Some(old) {
                continue;
            }
            if merged.get(key) != after.get(key) && merged.get(key) != Some(old) {
                return Err(conflict());
            }
            merged[key] = old.clone();
        }
        return serde_json::from_value(merged).map(Some).map_err(history_error);
    }
    if content(&after)? != content(&current)? {
        return Err(conflict());
    }
    Ok(before.cloned())
}

pub fn apply(conn: &mut Connection, changes: &[(Change, Change)]) -> AppResult<Vec<(Change, Change)>> {
    let tx = conn.transaction()?;
    let mut inverse = Vec::with_capacity(changes.len());
    for (before, after) in changes {
        let current = capture_current(&tx, before)?;
        match (before, after, &current) {
            (Change::Task { id, before }, Change::Task { before: after, .. }, Change::Task { before: current, .. }) => {
                let target = merge(before.as_ref().as_ref(), after.as_ref().as_ref(), current.as_ref().as_ref())?;
                if content(&target)? != content(current.as_ref())? {
                    tasks_repo::restore(&tx, id, target.as_ref())?;
                }
            }
            (Change::Project { id, before }, Change::Project { before: after, .. }, Change::Project { before: current, .. }) => {
                let target = merge(before.as_ref(), after.as_ref(), current.as_ref())?;
                if content(&target)? != content(current)? {
                    projects_repo::restore(&tx, id, target.as_ref())?;
                }
            }
            _ => return Err(conflict()),
        }
        inverse.push((current, capture_current(&tx, before)?));
    }
    tx.commit()?;
    inverse.reverse();
    Ok(inverse)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn undo_and_redo_preserve_unrelated_edits_and_reject_field_conflicts() {
        let mut conn = crate::db::test_connection();
        conn.execute(
            "INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('task', 'Original', ?1, ?1)",
            ["2026-01-01T00:00:00Z"],
        ).unwrap();
        let mut history = History::default();
        let before = capture_task(&conn, "task").unwrap();
        conn.execute("UPDATE tasks SET title = 'Local title' WHERE id = 'task'", []).unwrap();
        history.record(&conn, "Edit task", vec![before]).unwrap();
        let action = history.pop_undo().unwrap();

        conn.execute("UPDATE tasks SET notes = 'Remote notes' WHERE id = 'task'", []).unwrap();
        let redo = apply(&mut conn, &action.changes).unwrap();
        let task = tasks_repo::get(&conn, "task").unwrap();
        assert_eq!(task.title, "Original");
        assert_eq!(task.notes.as_deref(), Some("Remote notes"));
        let undo = apply(&mut conn, &redo).unwrap();
        assert_eq!(tasks_repo::get(&conn, "task").unwrap().title, "Local title");

        conn.execute("UPDATE tasks SET title = 'Remote title' WHERE id = 'task'", []).unwrap();
        assert!(apply(&mut conn, &undo).is_err());
        assert_eq!(tasks_repo::get(&conn, "task").unwrap().title, "Remote title");
    }
}
