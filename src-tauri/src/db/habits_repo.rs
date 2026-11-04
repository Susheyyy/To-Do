use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{Habit, HabitInput, HabitLog};

fn now() -> String {
    Utc::now().to_rfc3339()
}

pub fn create(conn: &Connection, input: HabitInput) -> AppResult<Habit> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    conn.execute(
        "INSERT INTO habits (id, name, color, icon, frequency, custom_days, target_streak, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            id,
            input.name.trim(),
            input.color,
            input.icon,
            input.frequency,
            input.custom_days,
            input.target_streak,
            ts
        ],
    )?;
    get(conn, &id)
}

pub fn get(conn: &Connection, id: &str) -> AppResult<Habit> {
    conn.query_row(
        "SELECT id, name, color, icon, frequency, custom_days, target_streak, created_at, updated_at
         FROM habits WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |row| {
            Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                frequency: row.get(4)?,
                custom_days: row.get(5)?,
                target_streak: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("habit {id}")))
}

pub fn list(conn: &Connection) -> AppResult<Vec<Habit>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, frequency, custom_days, target_streak, created_at, updated_at
         FROM habits WHERE deleted_at IS NULL ORDER BY created_at",
    )?;
    let habits = stmt
        .query_map([], |row| {
            Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                frequency: row.get(4)?,
                custom_days: row.get(5)?,
                target_streak: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(habits)
}

pub fn update(conn: &Connection, id: &str, input: HabitInput) -> AppResult<Habit> {
    let changed = conn.execute(
        "UPDATE habits SET name = ?2, color = ?3, icon = ?4, frequency = ?5,
                custom_days = ?6, target_streak = ?7, updated_at = ?8
         WHERE id = ?1 AND deleted_at IS NULL",
        params![
            id,
            input.name.trim(),
            input.color,
            input.icon,
            input.frequency,
            input.custom_days,
            input.target_streak,
            now()
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("habit {id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    let ts = now();
    conn.execute(
        "UPDATE habits SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, ts],
    )?;
    Ok(())
}

pub fn log_today(conn: &Connection, habit_id: &str, date: &str) -> AppResult<HabitLog> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    conn.execute(
        "INSERT OR IGNORE INTO habit_logs (id, habit_id, logged_date, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, habit_id, date, ts],
    )?;
    let log = conn.query_row(
        "SELECT id, habit_id, logged_date, created_at FROM habit_logs
         WHERE habit_id = ?1 AND logged_date = ?2",
        params![habit_id, date],
        |row| {
            Ok(HabitLog {
                id: row.get(0)?,
                habit_id: row.get(1)?,
                logged_date: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )?;
    Ok(log)
}

pub fn unlog(conn: &Connection, habit_id: &str, date: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM habit_logs WHERE habit_id = ?1 AND logged_date = ?2",
        params![habit_id, date],
    )?;
    Ok(())
}

pub fn all_logs_for_range(conn: &Connection, start: &str, end: &str) -> AppResult<Vec<HabitLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, habit_id, logged_date, created_at FROM habit_logs
         WHERE logged_date >= ?1 AND logged_date <= ?2
         ORDER BY logged_date",
    )?;
    let logs = stmt
        .query_map(params![start, end], |row| {
            Ok(HabitLog {
                id: row.get(0)?,
                habit_id: row.get(1)?,
                logged_date: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(logs)
}

