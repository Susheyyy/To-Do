pub mod habits_repo;
pub mod projects_repo;
pub mod recur;
pub mod tasks_repo;

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("migrations/001_init.sql")),
    ("002_priority_none", include_str!("migrations/002_priority_none.sql")),
    ("003_recurring_habits", include_str!("migrations/003_recurring_habits.sql")),
    ("004_perf_indexes", include_str!("migrations/004_perf_indexes.sql")),
    ("005_fts", include_str!("migrations/005_fts.sql")),
];


pub const BACKUP_KEEP: usize = 7;

pub fn open(dir: &Path) -> AppResult<Connection> {
    std::fs::create_dir_all(dir)?;
    let db_path = dir.join("todo.db");
    let conn = open_with_recovery(dir, &db_path)?;
    Ok(conn)
}



fn open_with_recovery(dir: &Path, db_path: &Path) -> AppResult<Connection> {
    match try_open(db_path) {
        Ok(conn) => Ok(conn),
        Err(first_err) => {
            
            eprintln!("[db] primary open failed ({first_err}), attempting backup recovery…");
            let backups_dir = dir.join("backups");
            if let Ok(entries) = std::fs::read_dir(&backups_dir) {
                let mut candidates: Vec<PathBuf> = entries
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("db"))
                    .collect();
                candidates.sort_by(|a, b| b.cmp(a)); 
                for candidate in candidates {
                    eprintln!("[db] trying backup {:?}", candidate);
                    if let Ok(conn) = try_open(&candidate) {
                        
                        if let Err(e) = std::fs::copy(&candidate, db_path) {
                            eprintln!("[db] could not restore backup file: {e}");
                        }
                        eprintln!("[db] recovered from backup {:?}", candidate);
                        return Ok(conn);
                    }
                }
            }
            Err(first_err)
        }
    }
}

fn try_open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    
    
    conn.execute_batch("PRAGMA synchronous = FULL;")?;
    
    conn.execute_batch("PRAGMA wal_autocheckpoint = 400;")?;
    
    let ok: String = conn.query_row("PRAGMA integrity_check(1)", [], |r| r.get(0))?;
    if ok != "ok" {
        return Err(AppError::Db(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CORRUPT),
            Some(format!("integrity_check: {ok}")),
        )));
    }
    migrate(&conn)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(conn)
}



pub fn create_auto_backup(dir: &Path) -> AppResult<PathBuf> {
    let db_path = dir.join("todo.db");
    if !db_path.exists() {
        return Err(AppError::NotFound("database file not found".into()));
    }
    let backups_dir = dir.join("backups");
    std::fs::create_dir_all(&backups_dir)?;

    
    let src = Connection::open(&db_path)?;
    src.execute_batch("PRAGMA journal_mode = WAL;")?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("todo_backup_{ts}.db");
    let target = backups_dir.join(&filename);
    src.execute(
        &format!("VACUUM INTO '{}'", target.to_string_lossy().replace('\\', "/")),
        [],
    )?;

    
    prune_backups(&backups_dir);

    Ok(target)
}


fn prune_backups(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("db"))
        .collect();
    files.sort(); 
    while files.len() > BACKUP_KEEP {
        let oldest = files.remove(0);
        let _ = std::fs::remove_file(oldest);
    }
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
        if applied {
            continue;
        }
        conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?1, datetime('now'))",
            [name],
        )?;
        tx.commit()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    }
    Ok(())
}