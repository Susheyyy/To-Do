use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{Project, Section};

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn load_sections(conn: &Connection, project_id: &str) -> AppResult<Vec<Section>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name FROM sections
         WHERE project_id = ?1 AND deleted_at IS NULL
         ORDER BY position, created_at",
    )?;
    let sections = stmt
        .query_map([project_id], |row| {
            Ok(Section {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(sections)
}

pub fn create(conn: &Connection, name: &str, color: Option<String>) -> AppResult<Project> {
    if name.trim().is_empty() {
        return Err(AppError::Invalid("project name is required".into()));
    }
    let id = Uuid::new_v4().to_string();
    let ts = now();
    conn.execute(
        "INSERT INTO projects (id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, name.trim(), color, ts],
    )?;
    Ok(Project {
        id,
        name: name.trim().to_string(),
        color,
        sections: Vec::new(),
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color FROM projects
         WHERE deleted_at IS NULL
         ORDER BY position, created_at",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    rows.into_iter()
        .map(|(id, name, color)| {
            let sections = load_sections(conn, &id)?;
            Ok(Project { id, name, color, sections })
        })
        .collect()
}

pub fn soft_delete(conn: &Connection, id: &str) -> AppResult<()> {
    let ts = now();
    let changed = conn.execute(
        "UPDATE projects SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, ts],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("project {id}")));
    }
    Ok(())
}

pub fn create_section(conn: &Connection, project_id: &str, name: &str) -> AppResult<Section> {
    if name.trim().is_empty() {
        return Err(AppError::Invalid("section name is required".into()));
    }
    let exists: Option<String> = conn
        .query_row(
            "SELECT id FROM projects WHERE id = ?1 AND deleted_at IS NULL",
            [project_id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_none() {
        return Err(AppError::NotFound(format!("project {project_id}")));
    }
    let id = Uuid::new_v4().to_string();
    let ts = now();
    conn.execute(
        "INSERT INTO sections (id, project_id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, project_id, name.trim(), ts],
    )?;
    Ok(Section {
        id,
        project_id: project_id.to_string(),
        name: name.trim().to_string(),
    })
}


pub fn find(conn: &Connection, id: &str) -> AppResult<Option<Project>> {
    let row = conn
        .query_row(
            "SELECT id, name, color FROM projects WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()?;
    match row {
        None => Ok(None),
        Some((project_id, name, color)) => {
            let sections = load_sections(conn, &project_id)?;
            Ok(Some(Project {
                id: project_id,
                name,
                color,
                sections,
            }))
        }
    }
}

pub fn restore(conn: &Connection, id: &str, snapshot: Option<&Project>) -> AppResult<()> {
    let ts = now();
    match snapshot {
        None => {
            conn.execute(
                "UPDATE projects SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
                params![id, ts],
            )?;
        }
        Some(project) => {
            conn.execute(
                "INSERT INTO projects (id, name, color, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?4)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    color = excluded.color,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL",
                params![project.id, project.name, project.color, ts],
            )?;
            conn.execute(
                "UPDATE sections SET deleted_at = ?2, updated_at = ?2
                 WHERE project_id = ?1 AND deleted_at IS NULL",
                params![project.id, ts],
            )?;
            for section in &project.sections {
                conn.execute(
                    "INSERT INTO sections (id, project_id, name, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)
                     ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        project_id = excluded.project_id,
                        updated_at = excluded.updated_at,
                        deleted_at = NULL",
                    params![section.id, section.project_id, section.name, ts],
                )?;
            }
        }
    }
    Ok(())
}