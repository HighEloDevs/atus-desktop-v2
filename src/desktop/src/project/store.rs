//! Transactional project persistence.

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

/// Creates an initial SQLite project from snapshot at the unused path.
/// Returns an error for invalid data, existing files, or failed writes.
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
        super::migrations::initialize(&conn)?;
        save(&mut conn, snapshot)?;
    }
    temporary.as_file().sync_all()?;
    temporary
        .persist_noclobber(path)
        .map_err(|error| error.error)?;
    Ok(())
}

/// Saves snapshot atomically only when disk contents still match previous.
/// Returns an error for conflicts, invalid data, or failed transactions.
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

/// Reads and validates a snapshot from path.
/// Returns an error for incompatible, corrupt, or inaccessible files.
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::test_support::{empty_project, project_with_point, single_point_project};

    /// Replaces project contents in a transaction.
    /// Returns an error for invalid data, incompatible files, or failed writes.
    fn write_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
        validate_snapshot(snapshot)?;
        let mut conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
        validate(&conn)?;
        conn.pragma_update(None, "foreign_keys", true)?;
        save(&mut conn, snapshot)
    }

    #[test]
    fn project_round_trip_preserves_order_uncertainties_and_drafts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("example.atus");
        let snapshot = ProjectSnapshot {
            id: "project".into(),
            name: "Experimento".into(),
            created_at: "2026-11-10T00:00:00Z".into(),
            updated_at: "2026-11-10T00:00:00Z".into(),
            analyses: vec![Analysis {
                id: "analysis".into(),
                kind: "analysis".into(),
                state: serde_json::json!({"tableDraft": "1;", "chart": {"title": "x"}}),
                datasets: vec![
                    Dataset {
                        id: "first".into(),
                        name: "A".into(),
                        state: serde_json::json!({"equation": "a*", "result": {"kind": "mock"}}),
                        points: vec![
                            Point {
                                x: 1.0,
                                y: 2.0,
                                sx: None,
                                sy: Some(0.0),
                            },
                            Point {
                                x: 1.0,
                                y: 3.0,
                                sx: Some(0.5),
                                sy: None,
                            },
                        ],
                    },
                    Dataset {
                        id: "second".into(),
                        name: "B".into(),
                        state: serde_json::json!({}),
                        points: vec![],
                    },
                ],
            }],
        };
        create_project(&path, &snapshot).unwrap();
        assert_eq!(read_project(&path).unwrap(), snapshot);
    }

    #[test]
    fn opening_unrelated_database_does_not_change_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("unrelated.atus");
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES ('keep');",
        )
        .unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        assert!(read_project(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn opening_missing_file_does_not_create_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing.atus");
        assert!(read_project(&path).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn rejects_nonfinite_numbers_before_creating_a_project() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("invalid.atus");
        let snapshot = ProjectSnapshot {
            id: "p".into(),
            name: "p".into(),
            created_at: "".into(),
            updated_at: "".into(),
            analyses: vec![Analysis {
                id: "a".into(),
                kind: "analysis".into(),
                state: serde_json::json!({}),
                datasets: vec![Dataset {
                    id: "d".into(),
                    name: "d".into(),
                    state: serde_json::json!({}),
                    points: vec![Point {
                        x: f64::INFINITY,
                        y: 1.0,
                        sx: None,
                        sy: None,
                    }],
                }],
            }],
        };
        assert!(create_project(&path, &snapshot).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn failed_save_preserves_previously_committed_project() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("project.atus");
        let original = ProjectSnapshot {
            id: "p".into(),
            name: "original".into(),
            created_at: "".into(),
            updated_at: "".into(),
            analyses: vec![],
        };
        create_project(&path, &original).unwrap();
        let invalid = ProjectSnapshot {
            analyses: vec![
                Analysis {
                    id: "duplicate".into(),
                    kind: "analysis".into(),
                    state: serde_json::json!({}),
                    datasets: vec![],
                },
                Analysis {
                    id: "duplicate".into(),
                    kind: "analysis".into(),
                    state: serde_json::json!({}),
                    datasets: vec![],
                },
            ],
            ..original.clone()
        };
        assert!(write_project(&path, &invalid).is_err());
        assert_eq!(read_project(&path).unwrap(), original);
    }

    #[test]
    fn new_projects_apply_all_sql_migrations_without_creating_a_backup() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        create_project(&path, &empty_project()).unwrap();
        let connection = rusqlite::Connection::open(&path).unwrap();
        let index_exists: bool = connection.query_row(
            "SELECT EXISTS (SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'analyses_by_kind')",
            [],
            |row| row.get(0),
        ).unwrap();
        assert!(index_exists);
        assert!(read_project(&path).is_ok());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn stale_save_and_creation_cannot_overwrite_existing_project() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        let original = empty_project();
        create_project(&path, &original).unwrap();
        let mut first = original.clone();
        first.name = "Primeira edição".into();
        write_checked(&path, &original, &first).unwrap();
        assert!(write_checked(&path, &original, &original).is_err());
        assert!(create_project(&path, &original).is_err());
        assert_eq!(read_project(&path).unwrap(), first);
    }

    #[test]
    fn invalid_measurements_never_replace_existing_project() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("measurement.atus");
        let original = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: Some(0.1),
            sy: Some(0.2),
        });
        create_project(&path, &original).unwrap();
        let invalid_points = [
            Point {
                x: f64::NAN,
                y: 2.0,
                sx: None,
                sy: None,
            },
            Point {
                x: 1.0,
                y: f64::INFINITY,
                sx: None,
                sy: None,
            },
            Point {
                x: 1.0,
                y: 2.0,
                sx: Some(-0.1),
                sy: None,
            },
            Point {
                x: 1.0,
                y: 2.0,
                sx: None,
                sy: Some(-0.1),
            },
            Point {
                x: 1.0,
                y: 2.0,
                sx: Some(f64::NAN),
                sy: None,
            },
            Point {
                x: 1.0,
                y: 2.0,
                sx: None,
                sy: Some(f64::INFINITY),
            },
        ];
        for point in invalid_points {
            let changed = project_with_point(point);
            assert!(write_checked(&path, &original, &changed).is_err());
            assert_eq!(read_project(&path).unwrap(), original);
        }
    }

    #[test]
    fn invalid_json_in_saved_analysis_or_dataset_is_rejected_without_rewriting() {
        for table in ["analyses", "datasets"] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("invalid-state.atus");
            create_project(
                &path,
                &project_with_point(Point {
                    x: 1.0,
                    y: 2.0,
                    sx: None,
                    sy: None,
                }),
            )
            .unwrap();
            let connection = rusqlite::Connection::open(&path).unwrap();
            connection
                .execute(&format!("UPDATE {table} SET state_json = ?1"), ["{invalid"])
                .unwrap();
            drop(connection);
            let before = std::fs::read(&path).unwrap();
            assert!(read_project(&path).is_err());
            assert_eq!(std::fs::read(&path).unwrap(), before);
        }
    }

    #[test]
    fn failed_initial_creation_does_not_leave_a_partial_project() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("duplicate.atus");
        let mut snapshot = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: Some(0.0),
            sy: Some(0.0),
        });
        snapshot.analyses.push(snapshot.analyses[0].clone());
        assert!(create_project(&path, &snapshot).is_err());
        assert!(!path.exists());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 0);
    }

    #[test]
    fn checked_save_rolls_back_on_duplicate_dataset_and_can_retry() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("retry.atus");
        let original = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: Some(0.0),
            sy: None,
        });
        create_project(&path, &original).unwrap();
        let mut invalid = original.clone();
        invalid.analyses[0]
            .datasets
            .push(original.analyses[0].datasets[0].clone());
        assert!(write_checked(&path, &original, &invalid).is_err());
        assert_eq!(read_project(&path).unwrap(), original);
        let mut valid = original.clone();
        valid.name = "Recovered".into();
        write_checked(&path, &original, &valid).unwrap();
        assert_eq!(read_project(&path).unwrap(), valid);
    }

    #[test]
    fn checked_save_removes_deleted_analyses_and_points_without_resurrection() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("remove.atus");
        let mut original = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: None,
            sy: None,
        });
        let mut second = original.analyses[0].clone();
        second.id = "other-analysis".into();
        second.datasets[0].id = "other-dataset".into();
        original.analyses.push(second);
        create_project(&path, &original).unwrap();
        let mut updated = original.clone();
        updated.analyses.remove(0);
        updated.analyses[0].datasets[0].points.clear();
        write_checked(&path, &original, &updated).unwrap();
        assert_eq!(read_project(&path).unwrap(), updated);
        let conn = rusqlite::Connection::open(&path).unwrap();
        let rows: i64 = conn
            .query_row("SELECT count(*) FROM data_points", [], |row| row.get(0))
            .unwrap();
        assert_eq!(rows, 0);
    }

    #[test]
    fn invalid_schema_version_is_rejected_without_changing_project_contents() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("future.atus");
        let original = empty_project();
        create_project(&path, &original).unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
            .unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        assert!(read_project(&path).is_err());
        assert!(write_checked(&path, &original, &original).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn missing_project_record_is_rejected_without_overwriting_remaining_data() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("missing-record.atus");
        let original = empty_project();
        create_project(&path, &original).unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute("DELETE FROM project", []).unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        assert!(read_project(&path).is_err());
        assert!(write_checked(&path, &original, &original).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn missing_data_table_is_reported_without_changing_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("damaged.atus");
        create_project(&path, &single_point_project()).unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch("DROP TABLE data_points;").unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        assert!(read_project(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn invalid_point_type_is_reported_without_changing_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("damaged.atus");
        create_project(&path, &single_point_project()).unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute("UPDATE data_points SET x='invalid'", [])
            .unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        assert!(read_project(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
}
