pub mod projects_repo;
pub mod tasks_repo;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

const MIGRATIONS: &[(&str, &str)] = &[("001_init", include_str!("migrations/001_init.sql"))];

pub fn open(dir: &Path) -> AppResult<Connection> {
    std::fs::create_dir_all(dir)?;
    let conn = Connection::open(dir.join("todo.db"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;
    for (name, sql) in MIGRATIONS {
        let applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = ?1)",
            [name],
            |row| row.get(0),
        )?;
        if !applied {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?1, datetime('now'))",
                [name],
            )?;
        }
    }
    Ok(())
}