use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::services::history::History;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub history: Mutex<History>,
}

impl AppState {
    pub fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.db.lock().map_err(|_| AppError::Lock)
    }

    pub fn history(&self) -> AppResult<MutexGuard<'_, History>> {
        self.history.lock().map_err(|_| AppError::Lock)
    }
}