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

fn project_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "desktop-e2e")]
    {
        let _ = app;
        let path = std::env::var_os("ATUS_DESKTOP_E2E_PROJECT_DIR")
            .map(PathBuf::from)
            .ok_or("ATUS_DESKTOP_E2E_PROJECT_DIR é obrigatório no teste desktop")?;
        return validate_test_directory(&path, &std::env::temp_dir());
    }
    #[cfg(not(feature = "desktop-e2e"))]
    app.path()
        .document_dir()
        .map(|path| path.join("ATUS").join("projects"))
        .map_err(|e| e.to_string())
}

#[cfg(feature = "desktop-e2e")]
fn validate_test_directory(path: &Path, temp: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() || !path.is_dir() {
        return Err("Diretório de teste deve existir e ser absoluto".into());
    }
    let path = path.canonicalize().map_err(|error| error.to_string())?;
    let temp = temp.canonicalize().map_err(|error| error.to_string())?;
    if path == temp || !path.starts_with(&temp) {
        return Err("Diretório de teste deve ficar dentro do diretório temporário".into());
    }
    Ok(path)
}

#[cfg(all(test, feature = "desktop-e2e"))]
mod e2e_directory_tests {
    use super::validate_test_directory;
    use std::path::Path;

    #[test]
    fn accepts_only_existing_subdirectories_of_the_temporary_directory() {
        let temp = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        std::fs::create_dir(&project).unwrap();
        assert_eq!(
            validate_test_directory(&project, temp.path()).unwrap(),
            project.canonicalize().unwrap()
        );
        assert!(validate_test_directory(temp.path(), temp.path()).is_err());
        assert!(validate_test_directory(other.path(), temp.path()).is_err());
        assert!(validate_test_directory(Path::new("relative"), temp.path()).is_err());
        assert!(validate_test_directory(&temp.path().join("missing"), temp.path()).is_err());
        #[cfg(unix)]
        {
            let link = temp.path().join("outside-link");
            std::os::unix::fs::symlink(other.path(), &link).unwrap();
            assert!(validate_test_directory(&link, temp.path()).is_err());
        }
    }
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

/// Returns the isolated project directory configured for desktop integration tests.
/// Fails if the test directory is missing or invalid.
#[cfg(feature = "desktop-e2e")]
#[tauri::command]
pub async fn project_test_directory(app: tauri::AppHandle) -> Result<PathBuf, String> {
    project_directory(&app)
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
