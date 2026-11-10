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
}
