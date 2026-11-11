//! Regression tests for damaged project schemas and data.

use super::model::{Analysis, Dataset, Point, ProjectSnapshot};
use super::store::{create_project, read_project};

fn snapshot() -> ProjectSnapshot {
    ProjectSnapshot {
        id: "p".into(),
        name: "Example".into(),
        created_at: "2026-01-01".into(),
        updated_at: "2026-01-01".into(),
        analyses: vec![Analysis {
            id: "a".into(),
            kind: "analysis".into(),
            state: serde_json::json!({}),
            datasets: vec![Dataset {
                id: "d".into(),
                name: "Data".into(),
                state: serde_json::json!({}),
                points: vec![Point {
                    x: 1.0,
                    y: 2.0,
                    sx: None,
                    sy: None,
                }],
            }],
        }],
    }
}

#[test]
fn missing_data_table_is_reported_without_changing_the_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("damaged.atus");
    create_project(&path, &snapshot()).unwrap();
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
    create_project(&path, &snapshot()).unwrap();
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute("UPDATE data_points SET x='invalid'", [])
        .unwrap();
    drop(conn);
    let before = std::fs::read(&path).unwrap();
    assert!(read_project(&path).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), before);
}
