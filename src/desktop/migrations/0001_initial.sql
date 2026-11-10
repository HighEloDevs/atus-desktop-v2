PRAGMA application_id = 1096045907;
PRAGMA user_version = 1;

CREATE TABLE project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE analyses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(id),
    position INTEGER NOT NULL,
    kind TEXT NOT NULL,
    state_json TEXT NOT NULL,
    UNIQUE (project_id, position)
);

CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL REFERENCES analyses(id),
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    UNIQUE (analysis_id, position)
);

CREATE TABLE data_points (
    dataset_id TEXT NOT NULL REFERENCES datasets(id),
    position INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    sx REAL,
    sy REAL,
    PRIMARY KEY (dataset_id, position)
);
