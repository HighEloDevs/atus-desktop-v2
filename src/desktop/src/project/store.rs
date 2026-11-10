use super::model::{Analysis, Dataset, Point, ProjectSnapshot};
use rusqlite::{params, Connection, OpenFlags};
use std::path::Path;

pub(super) const APPLICATION_ID: i32 = 0x41545553;
pub(super) const SCHEMA_VERSION: i32 = 2;
pub type ProjectError = Box<dyn std::error::Error + Send + Sync>;

fn validate(conn: &Connection) -> Result<(), ProjectError> {
    let id: i32 = conn.pragma_query_value(None, "application_id", |row| row.get(0))?;
    let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if id != APPLICATION_ID || version != SCHEMA_VERSION {
        return Err("Formato ATUS inválido ou versão incompatível".into());
    }
    let integrity: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err("Projeto corrompido".into());
    }
    Ok(())
}

fn validate_snapshot(snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    for point in snapshot
        .analyses
        .iter()
        .flat_map(|a| &a.datasets)
        .flat_map(|d| &d.points)
    {
        if !point.x.is_finite()
            || !point.y.is_finite()
            || point.sx.is_some_and(|v| !v.is_finite() || v < 0.0)
            || point.sy.is_some_and(|v| !v.is_finite() || v < 0.0)
        {
            return Err(
                "Os dados devem ser finitos e as incertezas não podem ser negativas".into(),
            );
        }
    }
    Ok(())
}

pub fn create_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    validate_snapshot(snapshot)?;
    let directory = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let temporary = tempfile::NamedTempFile::new_in(directory)?;
    {
        let mut conn =
            Connection::open_with_flags(temporary.path(), OpenFlags::SQLITE_OPEN_READ_WRITE)?;
        conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA application_id=1096045907; PRAGMA user_version=2;
        CREATE TABLE project(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE analyses(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id), position INTEGER NOT NULL, kind TEXT NOT NULL, state_json TEXT NOT NULL, UNIQUE(project_id, position));
        CREATE TABLE datasets(id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analyses(id), position INTEGER NOT NULL, name TEXT NOT NULL, state_json TEXT NOT NULL, UNIQUE(analysis_id, position));
        CREATE TABLE data_points(dataset_id TEXT NOT NULL REFERENCES datasets(id), position INTEGER NOT NULL, x REAL NOT NULL, y REAL NOT NULL, sx REAL, sy REAL, PRIMARY KEY(dataset_id, position)); CREATE INDEX analyses_by_kind ON analyses(kind);")?;
        save(&mut conn, snapshot)?;
    }
    temporary.as_file().sync_all()?;
    temporary
        .persist_noclobber(path)
        .map_err(|error| error.error)?;
    Ok(())
}

#[cfg(test)]
pub fn write_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    validate_snapshot(snapshot)?;
    let mut conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    validate(&conn)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    save(&mut conn, snapshot)
}

pub fn write_checked(
    path: &Path,
    previous: &ProjectSnapshot,
    snapshot: &ProjectSnapshot,
) -> Result<(), ProjectError> {
    validate_snapshot(snapshot)?;
    let mut conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    validate(&tx)?;
    if load(&tx)? != *previous {
        return Err(
            "O projeto mudou no disco. Use Salvar como para preservar suas alterações.".into(),
        );
    }
    replace(&tx, snapshot)?;
    tx.commit()?;
    Ok(())
}

fn save(conn: &mut Connection, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    let tx = conn.transaction()?;
    replace(&tx, snapshot)?;
    tx.commit()?;
    Ok(())
}

fn replace(tx: &Connection, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    tx.execute_batch(
        "DELETE FROM data_points; DELETE FROM datasets; DELETE FROM analyses; DELETE FROM project;",
    )?;
    tx.execute(
        "INSERT INTO project VALUES (?1,?2,?3,?4)",
        params![
            snapshot.id,
            snapshot.name,
            snapshot.created_at,
            snapshot.updated_at
        ],
    )?;
    for (i, a) in snapshot.analyses.iter().enumerate() {
        tx.execute(
            "INSERT INTO analyses VALUES (?1,?2,?3,?4,?5)",
            params![
                a.id,
                snapshot.id,
                i as i64,
                a.kind,
                serde_json::to_string(&a.state)?
            ],
        )?;
        for (j, d) in a.datasets.iter().enumerate() {
            tx.execute(
                "INSERT INTO datasets VALUES (?1,?2,?3,?4,?5)",
                params![
                    d.id,
                    a.id,
                    j as i64,
                    d.name,
                    serde_json::to_string(&d.state)?
                ],
            )?;
            for (k, p) in d.points.iter().enumerate() {
                tx.execute(
                    "INSERT INTO data_points VALUES (?1,?2,?3,?4,?5,?6)",
                    params![d.id, k as i64, p.x, p.y, p.sx, p.sy],
                )?;
            }
        }
    }
    Ok(())
}

pub fn read_project(path: &Path) -> Result<ProjectSnapshot, ProjectError> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let tx = conn.unchecked_transaction()?;
    validate(&tx)?;
    load(&tx)
}

fn load(conn: &Connection) -> Result<ProjectSnapshot, ProjectError> {
    let (id, name, created_at, updated_at) = conn.query_row(
        "SELECT id,name,created_at,updated_at FROM project",
        [],
        |r| Ok((r.get::<_, String>(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;
    let mut stmt = conn
        .prepare("SELECT id,kind,state_json FROM analyses WHERE project_id=?1 ORDER BY position")?;
    let rows = stmt.query_map([&id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })?;
    let mut analyses = Vec::new();
    for row in rows {
        let (aid, kind, state) = row?;
        let mut ds = conn.prepare(
            "SELECT id,name,state_json FROM datasets WHERE analysis_id=?1 ORDER BY position",
        )?;
        let dataset_rows = ds.query_map([&aid], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?;
        let mut datasets = Vec::new();
        for dr in dataset_rows {
            let (did, name, state) = dr?;
            let mut ps = conn.prepare(
                "SELECT x,y,sx,sy FROM data_points WHERE dataset_id=?1 ORDER BY position",
            )?;
            let points = ps
                .query_map([&did], |r| {
                    Ok(Point {
                        x: r.get(0)?,
                        y: r.get(1)?,
                        sx: r.get(2)?,
                        sy: r.get(3)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            datasets.push(Dataset {
                id: did,
                name,
                state: serde_json::from_str(&state)?,
                points,
            });
        }
        analyses.push(Analysis {
            id: aid,
            kind,
            state: serde_json::from_str(&state)?,
            datasets,
        });
    }
    Ok(ProjectSnapshot {
        id,
        name,
        created_at,
        updated_at,
        analyses,
    })
}
