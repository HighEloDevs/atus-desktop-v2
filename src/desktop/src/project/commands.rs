//! Tauri project file commands.

use super::{migrations, model::ProjectSnapshot, store};
use serde::Serialize;
use std::path::{Path, PathBuf};
#[cfg(not(feature = "desktop-e2e"))]
use tauri::Manager;

#[derive(Serialize)]
/// An opened project and its canonical path.
pub struct OpenProject {
    path: PathBuf,
    snapshot: ProjectSnapshot,
}

pub(super) fn project_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "desktop-e2e")]
    {
        let _ = app;
        return super::e2e::test_project_directory();
    }
    #[cfg(not(feature = "desktop-e2e"))]
    app.path()
        .document_dir()
        .map(|path| path.join("ATUS").join("projects"))
        .map_err(|e| e.to_string())
}

fn check_extension(path: &Path) -> Result<(), String> {
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("atus"))
    {
        Ok(())
    } else {
        Err("Selecione um arquivo com extensão .atus.".into())
    }
}

/// Creates an initial snapshot under Documents/ATUS/projects with an available name.
/// Returns the opened project or an error if creation fails.
#[tauri::command]
pub async fn project_create(
    app: tauri::AppHandle,
    snapshot: ProjectSnapshot,
) -> Result<OpenProject, String> {
    let directory = project_directory(&app)?;
    create_project_in(&directory, snapshot)
}

/// Creates a project in the given directory using the first available name.
pub(super) fn create_project_in(
    directory: &Path,
    mut snapshot: ProjectSnapshot,
) -> Result<OpenProject, String> {
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    for number in 1..=10_000 {
        let name = if number == 1 {
            "Projeto sem título".to_owned()
        } else {
            format!("Projeto sem título ({number})")
        };
        let path = directory.join(format!("{name}.atus"));
        snapshot.name = name;
        match store::create_project(&path, &snapshot) {
            Ok(()) => {
                return Ok(OpenProject {
                    path: path.canonicalize().unwrap_or(path),
                    snapshot,
                })
            }
            Err(error)
                if error
                    .downcast_ref::<std::io::Error>()
                    .is_some_and(|e| e.kind() == std::io::ErrorKind::AlreadyExists) =>
            {
                continue
            }
            Err(error) => return Err(error.to_string()),
        }
    }
    Err("Não há um nome disponível para criar o projeto.".into())
}

/// Opens the project at path, applying supported migrations.
/// Returns the canonical path and snapshot or an error for invalid or inaccessible files.
#[tauri::command]
pub async fn project_open(path: PathBuf) -> Result<OpenProject, String> {
    check_extension(&path)?;
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    migrations::migrate(&path).map_err(|e| e.to_string())?;
    let snapshot = store::read_project(&path).map_err(|e| e.to_string())?;
    Ok(OpenProject { path, snapshot })
}

/// Saves snapshot at path if the disk still matches previous.
/// Returns an error if validation, conflict detection, or writing fails.
#[tauri::command]
pub async fn project_save(
    path: PathBuf,
    previous: ProjectSnapshot,
    snapshot: ProjectSnapshot,
) -> Result<(), String> {
    check_extension(&path)?;
    store::write_checked(&path, &previous, &snapshot).map_err(|e| e.to_string())
}

/// Creates a project copy at path without overwriting an existing file.
/// Returns the new path and snapshot or an error.
#[tauri::command]
pub async fn project_save_as(
    path: PathBuf,
    mut snapshot: ProjectSnapshot,
) -> Result<OpenProject, String> {
    check_extension(&path)?;
    snapshot.name = path
        .file_stem()
        .ok_or("Nome de arquivo inválido")?
        .to_string_lossy()
        .into_owned();
    // Reserve the destination without overwriting an existing file.
    store::create_project(&path, &snapshot).map_err(|error| {
        if error
            .downcast_ref::<std::io::Error>()
            .is_some_and(|e| e.kind() == std::io::ErrorKind::AlreadyExists)
        {
            "Já existe um arquivo nesse local. Escolha outro nome ou pasta.".into()
        } else {
            error.to_string()
        }
    })?;
    Ok(OpenProject {
        path: path.canonicalize().unwrap_or(path),
        snapshot,
    })
}

/// Lists canonical .atus paths in the default project directory.
/// Returns an empty list if the directory is absent, or an error if it cannot be read.
#[tauri::command]
pub async fn project_list(app: tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    let directory = project_directory(&app)?;
    list_projects_in(&directory)
}

/// Lists project files from a directory, returning an empty list when it is absent.
pub(super) fn list_projects_in(directory: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let mut paths = Vec::new();
    for entry in entries {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.is_file() && check_extension(&path).is_ok() {
            paths.push(path.canonicalize().map_err(|e| e.to_string())?);
        }
    }
    paths.sort();
    paths.dedup();
    Ok(paths)
}

/// Returns whether path currently refers to an accessible file.
#[tauri::command]
pub async fn project_available(path: PathBuf) -> bool {
    path.is_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{Analysis, Point};
    use crate::project::store::{create_project, read_project};
    use crate::project::test_support::{empty_project, project_with_point};

    #[test]
    fn project_commands_save_copy_and_reopen_without_the_original() {
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
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("corrupt.atus");
        let contents = b"this is not a SQLite database";
        std::fs::write(&path, contents).unwrap();
        assert!(tauri::async_runtime::block_on(project_open(path.clone())).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), contents);
    }

    #[test]
    fn save_as_reports_missing_parent_and_preserves_existing_project() {
        let directory = tempfile::tempdir().unwrap();
        let original_path = directory.path().join("original.atus");
        let original = empty_project();
        create_project(&original_path, &original).unwrap();
        let destination = directory.path().join("missing").join("copy.atus");
        assert!(tauri::async_runtime::block_on(project_save_as(
            destination.clone(),
            original.clone()
        ))
        .is_err());
        assert!(!destination.exists());
        assert_eq!(read_project(&original_path).unwrap(), original);
    }

    #[test]
    fn save_as_with_invalid_data_preserves_destination_and_source() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.atus");
        let destination = directory.path().join("copy.atus");
        let valid = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: None,
            sy: None,
        });
        create_project(&source, &valid).unwrap();
        let mut invalid = valid.clone();
        invalid.analyses[0].datasets[0].points[0].sy = Some(-1.0);
        assert!(
            tauri::async_runtime::block_on(project_save_as(destination.clone(), invalid)).is_err()
        );
        assert!(!destination.exists());
        assert_eq!(read_project(&source).unwrap(), valid);
    }

    #[test]
    fn project_directory_listing_filters_and_sorts_project_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path();
        assert!(list_projects_in(&path.join("missing")).unwrap().is_empty());
        std::fs::write(path.join("z.ATUS"), "").unwrap();
        std::fs::write(path.join("a.atus"), "").unwrap();
        std::fs::write(path.join("other.txt"), "").unwrap();
        std::fs::create_dir(path.join("folder.atus")).unwrap();
        assert_eq!(
            list_projects_in(path).unwrap(),
            vec![
                path.join("a.atus").canonicalize().unwrap(),
                path.join("z.ATUS").canonicalize().unwrap()
            ]
        );
    }

    #[test]
    fn project_creation_assigns_available_name_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        let snapshot = project_with_point(Point {
            x: 1.0,
            y: 2.0,
            sx: None,
            sy: None,
        });
        let first = create_project_in(dir.path(), snapshot.clone()).unwrap();
        let second = create_project_in(dir.path(), snapshot).unwrap();
        let first = serde_json::to_value(first).unwrap();
        let second = serde_json::to_value(second).unwrap();
        assert_ne!(first["path"], second["path"]);
        assert_eq!(first["snapshot"]["name"], "Projeto sem título");
        assert_eq!(second["snapshot"]["name"], "Projeto sem título (2)");
        assert!(std::path::Path::new(first["path"].as_str().unwrap()).is_file());
        assert!(std::path::Path::new(second["path"].as_str().unwrap()).is_file());
    }

    #[test]
    fn listing_a_file_as_a_directory_returns_an_error_without_modification() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("not-a-directory");
        std::fs::write(&path, b"preserve").unwrap();
        assert!(list_projects_in(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"preserve");
    }
}
