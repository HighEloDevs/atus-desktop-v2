//! Project persistence and platform integration.

pub mod commands;
#[cfg(target_os = "macos")]
pub mod finder;
#[cfg(target_os = "macos")]
pub mod menu;
mod migrations;
pub mod model;
pub mod store;

#[cfg(test)]
mod tests {
    use super::model::{Analysis, Dataset, Point, ProjectSnapshot};
    use super::store::{create_project, read_project};

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
        use super::store::write_project;
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
    fn empty_project() -> ProjectSnapshot {
        ProjectSnapshot {
            id: "project".into(),
            name: "Experimento".into(),
            created_at: "2026-11-10T00:00:00Z".into(),
            updated_at: "2026-11-10T00:00:00Z".into(),
            analyses: vec![],
        }
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
    fn migration_backs_up_v1_and_preserves_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        let snapshot = empty_project();
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection
            .execute_batch(super::migrations::INITIAL_SCHEMA)
            .unwrap();
        connection
            .execute(
                "INSERT INTO project VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    snapshot.id,
                    snapshot.name,
                    snapshot.created_at,
                    snapshot.updated_at
                ],
            )
            .unwrap();
        drop(connection);
        super::migrations::migrate(&path).unwrap();
        super::migrations::migrate(&path).unwrap();
        assert_eq!(read_project(&path).unwrap(), snapshot);
        let backups: Vec<_> = std::fs::read_dir(directory.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("project.atus.backup-v1-")
            })
            .collect();
        assert_eq!(backups.len(), 1);
        let backup = rusqlite::Connection::open(backups[0].path()).unwrap();
        let version: i32 = backup
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn stale_save_and_creation_cannot_overwrite_existing_project() {
        use super::store::write_checked;
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
    fn future_and_failed_migrations_preserve_original() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        create_project(&path, &empty_project()).unwrap();
        for version in [99, 1] {
            let connection = rusqlite::Connection::open(&path).unwrap();
            connection
                .pragma_update(None, "user_version", version)
                .unwrap();
            drop(connection);
            let original = std::fs::read(&path).unwrap();
            // At v1 the conflicting index makes the migration fail after the backup.
            assert!(super::migrations::migrate(&path).is_err());
            assert_eq!(std::fs::read(&path).unwrap(), original);
        }
    }

    #[test]
    fn project_commands_save_copy_and_reopen_without_the_original() {
        use super::commands::{project_open, project_save, project_save_as};
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("original.atus");
        let copy = directory.path().join("Cópia.atus");
        let snapshot = empty_project();
        create_project(&original, &snapshot).unwrap();
        let mut edited = snapshot.clone();
        edited.analyses.push(Analysis {
            id: "analysis".into(),
            kind: "analysis".into(),
            state: serde_json::json!({"editingText": "1;"}),
            datasets: vec![],
        });
        let reopened = tauri::async_runtime::block_on(async {
            project_save(original.clone(), snapshot, edited.clone())
                .await
                .unwrap();
            project_save_as(copy.clone(), edited.clone()).await.unwrap();
            std::fs::remove_file(original).unwrap();
            project_open(copy.clone()).await.unwrap()
        });
        edited.name = "Cópia".into();
        let response = serde_json::to_value(reopened).unwrap();
        assert_eq!(response["snapshot"], serde_json::to_value(edited).unwrap());
    }

    #[test]
    fn project_commands_reject_invalid_extensions_without_creating_files() {
        use super::commands::{project_open, project_save, project_save_as};
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("experiment.txt");
        let snapshot = empty_project();
        tauri::async_runtime::block_on(async {
            assert!(project_open(path.clone())
                .await
                .err()
                .unwrap()
                .contains(".atus"));
            assert!(
                project_save(path.clone(), snapshot.clone(), snapshot.clone())
                    .await
                    .unwrap_err()
                    .contains(".atus")
            );
            assert!(project_save_as(path.clone(), snapshot)
                .await
                .err()
                .unwrap()
                .contains(".atus"));
        });
        assert!(!path.exists());
    }

    #[test]
    fn save_as_does_not_overwrite_an_existing_project() {
        use super::commands::project_save_as;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("existing.atus");
        let original = empty_project();
        create_project(&path, &original).unwrap();
        let mut changed = original.clone();
        changed.name = "Outro conteúdo".into();
        let error = tauri::async_runtime::block_on(project_save_as(path.clone(), changed))
            .err()
            .expect("saving over an existing project must fail");
        assert!(error.contains("Já existe"));
        assert_eq!(read_project(&path).unwrap(), original);
    }

    #[test]
    fn save_as_accepts_uppercase_extension_and_sets_project_name() {
        use super::commands::project_save_as;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("Medições.ATUS");
        let saved = tauri::async_runtime::block_on(project_save_as(path.clone(), empty_project()))
            .ok()
            .expect("uppercase extension should be accepted");
        let response = serde_json::to_value(saved).unwrap();
        assert_eq!(response["snapshot"]["name"], "Medições");
        assert_eq!(read_project(&path).unwrap().name, "Medições");
    }

    #[test]
    fn project_availability_requires_an_existing_file() {
        use super::commands::project_available;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("experiment.atus");
        assert!(!tauri::async_runtime::block_on(project_available(
            path.clone()
        )));
        assert!(!tauri::async_runtime::block_on(project_available(
            directory.path().to_path_buf()
        )));
        std::fs::write(&path, b"not necessarily a valid project").unwrap();
        assert!(tauri::async_runtime::block_on(project_available(path)));
    }

    #[test]
    fn opening_corrupt_project_preserves_original_bytes() {
        use super::commands::project_open;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("corrupt.atus");
        let contents = b"this is not a SQLite database";
        std::fs::write(&path, contents).unwrap();
        assert!(tauri::async_runtime::block_on(project_open(path.clone())).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), contents);
    }
}
