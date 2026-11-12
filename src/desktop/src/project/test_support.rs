//! Shared fixtures for unit tests.

use super::model::{Analysis, Dataset, Point, ProjectSnapshot};

/// A project without analyses.
pub fn empty_project() -> ProjectSnapshot {
    ProjectSnapshot {
        id: "project".into(),
        name: "Experimento".into(),
        created_at: "2026-11-10T00:00:00Z".into(),
        updated_at: "2026-11-10T00:00:00Z".into(),
        analyses: vec![],
    }
}

/// A project with one analysis and one dataset holding `point`.
pub fn project_with_point(point: Point) -> ProjectSnapshot {
    let mut snapshot = empty_project();
    snapshot.analyses.push(Analysis {
        id: "analysis".into(),
        kind: "analysis".into(),
        state: serde_json::json!({}),
        datasets: vec![Dataset {
            id: "dataset".into(),
            name: "measurement".into(),
            state: serde_json::json!({}),
            points: vec![point],
        }],
    });
    snapshot
}

/// A project with one analysis, one dataset and the single point (1, 2).
pub fn single_point_project() -> ProjectSnapshot {
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
