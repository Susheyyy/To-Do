use std::collections::VecDeque;

use rusqlite::Connection;

use crate::db::{projects_repo, tasks_repo};
use crate::error::AppResult;
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
    pub changes: Vec<Change>,
}

#[derive(Default)]
pub struct History {
    undo: VecDeque<Action>,
    redo: Vec<Action>,
}

impl History {
    pub fn record(&mut self, label: &str, changes: Vec<Change>) {
        if changes.is_empty() {
            return;
        }
        self.push_undo(Action {
            label: label.to_string(),
            changes,
        });
        self.redo.clear();
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

pub fn apply(conn: &mut Connection, changes: &[Change]) -> AppResult<Vec<Change>> {
    let tx = conn.transaction()?;
    let mut inverse = Vec::with_capacity(changes.len());
    for change in changes {
        match change {
            Change::Task { id, before } => {
                let current = tasks_repo::find(&tx, id)?;
                tasks_repo::restore(&tx, id, before.as_ref().as_ref())?;
                inverse.push(Change::Task {
                    id: id.clone(),
                    before: Box::new(current),
                });
            }
            Change::Project { id, before } => {
                let current = projects_repo::find(&tx, id)?;
                projects_repo::restore(&tx, id, before.as_ref())?;
                inverse.push(Change::Project {
                    id: id.clone(),
                    before: current,
                });
            }
        }
    }
    tx.commit()?;
    Ok(inverse)
}