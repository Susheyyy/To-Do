pub mod habits_repo;
pub mod projects_repo;
pub mod recur;
pub mod sync_repo;
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
    ("006_sync_engine", include_str!("migrations/006_sync_engine.sql")),
    ("007_sync_timestamps", include_str!("migrations/007_sync_timestamps.sql")),
    ("008_task_integrations", include_str!("migrations/008_task_integrations.sql")),
    ("009_sync_quarantine", include_str!("migrations/009_sync_quarantine.sql")),
];


pub const BACKUP_KEEP: usize = 7;

pub fn open(dir: &Path) -> AppResult<Connection> {
    std::fs::create_dir_all(dir)?;
    let db_path = dir.join("todo.db");
    let conn = open_with_recovery(dir, &db_path)?;
    Ok(conn)
}



fn open_with_recovery(dir: &Path, db_path: &Path) -> AppResult<Connection> {
    let original_error = match try_open(db_path) {
        Ok(conn) => return Ok(conn),
        Err(err @ AppError::Db(rusqlite::Error::SqliteFailure(code, _)))
            if matches!(code.code, rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase) => err,
        Err(err) => return Err(err),
    };
    let Ok(entries) = std::fs::read_dir(dir.join("backups")) else {
        return Err(original_error);
    };
    let mut candidates: Vec<_> = entries.flatten().map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "db")).collect();
    candidates.sort_by(|left, right| right.cmp(left));

    for candidate in candidates {
        let recovery_dir = dir.join(format!("recovery-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&recovery_dir)?;
        let staged = recovery_dir.join("replacement.db");
        let prepared = (|| -> AppResult<()> {
            let source = Connection::open_with_flags(&candidate, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
            source.execute("VACUUM INTO ?1", [staged.to_string_lossy().as_ref()])?;
            let conn = try_open(&staged)?;
            conn.execute_batch("PRAGMA journal_mode = DELETE;")?;
            Ok(())
        })();
        if let Err(err) = prepared {
            eprintln!("[db] rejected backup {candidate:?}: {err}");
            let _ = std::fs::remove_file(&staged);
            let _ = std::fs::remove_dir(&recovery_dir);
            continue;
        }

        let mut preserved = Vec::new();
        let install = (|| -> AppResult<()> {
            let archived_primary = recovery_dir.join("todo.db");
            std::fs::copy(db_path, &archived_primary)?;
            std::fs::OpenOptions::new().write(true).open(&archived_primary)?.sync_all()?;
            for name in ["todo.db-wal", "todo.db-shm", "todo.db-journal"] {
                let source = dir.join(name);
                if source.try_exists()? {
                    let target = recovery_dir.join(name);
                    std::fs::rename(&source, &target)?;
                    preserved.push((source, target));
                }
            }
            std::fs::rename(&staged, db_path)?;
            Ok(())
        })();
        if let Err(err) = install {
            for (source, target) in preserved.into_iter().rev() {
                std::fs::rename(target, source)?;
            }
            return Err(err);
        }
        eprintln!("[db] recovered from {candidate:?}; original files preserved in {recovery_dir:?}");
        return try_open(db_path);
    }
    Err(original_error)
}

fn try_open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    conn.execute_batch("PRAGMA synchronous = FULL;")?;
    conn.execute_batch("PRAGMA wal_autocheckpoint = 400;")?;
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;
    
    let ok: String = conn.query_row("PRAGMA integrity_check(1)", [], |r| r.get(0))?;
    if ok != "ok" {
        return Err(AppError::Db(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CORRUPT),
            Some(format!("integrity_check: {ok}")),
        )));
    }
    migrate(&conn).map_err(|err| AppError::Invalid(format!("Database migration failed: {err}")))?;
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
    src.execute("VACUUM INTO ?1", [target.to_string_lossy().as_ref()])?;

    
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
#[cfg(test)]
pub(crate) fn test_connection() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    migrate(&conn).unwrap();
    conn
}

#[cfg(test)]
mod recovery_tests {
    use super::*;

    #[test]
    fn only_corrupt_primary_is_replaced_and_its_bytes_are_preserved() {
        let dir = std::env::temp_dir().join(format!("todo-recovery-test-{}", uuid::Uuid::new_v4()));
        let primary = dir.join("todo.db");
        let conn = open(&dir).unwrap();
        create_auto_backup(&dir).unwrap();
        conn.execute_batch("DELETE FROM schema_migrations WHERE name = '001_init';").unwrap();
        drop(conn);
        assert!(open(&dir).is_err());
        let check = Connection::open(&primary).unwrap();
        assert_eq!(check.query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE name = '001_init'", [], |row| row.get::<_, i64>(0)
        ).unwrap(), 0);
        drop(check);
        let corrupt = b"invalid SQLite file for recovery testing";
        std::fs::write(&primary, corrupt).unwrap();
        drop(open(&dir).unwrap());
        let recovery = std::fs::read_dir(&dir).unwrap().flatten()
            .find(|entry| entry.file_name().to_string_lossy().starts_with("recovery-")).unwrap().path();
        assert_eq!(std::fs::read(recovery.join("todo.db")).unwrap(), corrupt);
        for folder in [recovery, dir.join("backups"), dir] {
            for entry in std::fs::read_dir(&folder).unwrap() {
                let entry = entry.unwrap();
                if entry.file_type().unwrap().is_file() {
                    std::fs::remove_file(entry.path()).unwrap();
                }
            }
            std::fs::remove_dir(folder).unwrap();
        }
    }
}
