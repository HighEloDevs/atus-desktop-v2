//! Project management commands: details, rename, archive and delete.

use super::commands::{list_projects_in, project_directory};
use super::store;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const ARCHIVE_DIRECTORY: &str = "archived";
const MAX_NAME_CHARS: usize = 120;

/// File-level information shown in the project tables.
#[derive(Serialize, Debug, PartialEq)]
pub struct ProjectDetails {
    path: PathBuf,
    /// Stored project name, or the file stem when the file cannot be read.
    name: String,
    /// Last modification in milliseconds since the Unix epoch.
    modified: Option<u64>,
    size: u64,
    archived: bool,
    available: bool,
    /// Why the project could not be read, when it could not.
    error: Option<String>,
}

fn is_archived(path: &Path) -> bool {
    path.parent()
        .and_then(|parent| parent.file_name())
        .is_some_and(|name| name == ARCHIVE_DIRECTORY)
}

fn details_for(path: &Path) -> ProjectDetails {
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default();
    let metadata = std::fs::metadata(path).ok().filter(|m| m.is_file());
    let modified = metadata
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64);
    let (name, error) = match &metadata {
        None => (stem, None),
        Some(_) => match store::read_project(path) {
            Ok(snapshot) => (snapshot.name, None),
            Err(error) => (stem, Some(error.to_string())),
        },
    };
    ProjectDetails {
        path: path.to_path_buf(),
        name,
        modified,
        size: metadata.as_ref().map_or(0, |m| m.len()),
        archived: is_archived(path),
        available: metadata.is_some(),
        error,
    }
}

/// Describes each path; an unreadable or missing file yields an entry instead of failing the list.
#[tauri::command]
pub async fn project_details(paths: Vec<PathBuf>) -> Vec<ProjectDetails> {
    paths.iter().map(|path| details_for(path)).collect()
}

/// Lists canonical .atus paths in the archive folder next to the default projects.
#[tauri::command]
pub async fn project_list_archived(app: tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    list_projects_in(&project_directory(&app)?.join(ARCHIVE_DIRECTORY))
}

/// Validates a user-provided project name and returns it trimmed.
/// Rejects empty names, path separators, reserved characters and over-long names.
pub(super) fn validate_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Informe um nome para o projeto.".into());
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(format!("Use no máximo {MAX_NAME_CHARS} caracteres."));
    }
    if name
        .chars()
        .any(|c| c.is_control() || "/\\:*?\"<>|".contains(c))
        || name.starts_with('.')
        || name.ends_with('.')
    {
        return Err("O nome não pode ter / \\ : * ? \" < > |, controles, nem começar ou terminar com ponto.".into());
    }
    Ok(name.to_owned())
}

fn check_atus(path: &Path) -> Result<(), String> {
    if !path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("atus"))
    {
        return Err("Selecione um arquivo com extensão .atus.".into());
    }
    if !path.is_file() {
        return Err("O arquivo do projeto não foi encontrado.".into());
    }
    Ok(())
}

fn exists_error(error: &std::io::Error) -> bool {
    error.kind() == std::io::ErrorKind::AlreadyExists
}

/// Moves `from` to `to` without replacing an existing file.
fn move_without_overwrite(from: &Path, to: &Path) -> Result<(), std::io::Error> {
    if to.exists() {
        return Err(std::io::ErrorKind::AlreadyExists.into());
    }
    std::fs::rename(from, to)
}

/// Renames a project: updates the stored name and the file name together.
/// Returns the new canonical path. Fails without changes when the target exists, and restores
/// the previous stored name if the file cannot be moved.
#[tauri::command]
pub async fn project_rename(path: PathBuf, new_name: String) -> Result<PathBuf, String> {
    rename_project(&path, &new_name)
}

pub(super) fn rename_project(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    check_atus(path)?;
    let name = validate_name(new_name)?;
    let previous = store::read_project(path).map_err(|e| e.to_string())?.name;
    let target = path.with_file_name(format!("{name}.atus"));
    if target == path {
        if previous != name {
            store::write_name(path, &name).map_err(|e| e.to_string())?;
        }
        return Ok(path.to_path_buf());
    }
    // On case-insensitive disks a case-only rename resolves to the same file.
    let same_file = target.exists() && target.canonicalize().ok() == path.canonicalize().ok();
    if target.exists() && !same_file {
        return Err("Já existe um projeto com esse nome nesta pasta.".into());
    }
    store::write_name(path, &name).map_err(|e| e.to_string())?;
    let moved = if same_file {
        std::fs::rename(path, &target)
    } else {
        move_without_overwrite(path, &target)
    };
    if let Err(error) = moved {
        let _ = store::write_name(path, &previous);
        return Err(if exists_error(&error) {
            "Já existe um projeto com esse nome nesta pasta.".into()
        } else {
            error.to_string()
        });
    }
    Ok(target.canonicalize().unwrap_or(target))
}

/// Picks a free `<stem>.atus`, `<stem> (2).atus`, … inside `directory`.
fn free_target(directory: &Path, stem: &str) -> Result<PathBuf, String> {
    for number in 1..=10_000 {
        let file = if number == 1 {
            format!("{stem}.atus")
        } else {
            format!("{stem} ({number}).atus")
        };
        let candidate = directory.join(file);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("Não há um nome disponível na pasta de destino.".into())
}

/// Moves a project between the default folder and its `archived` subfolder, adding a numeric
/// suffix on name collisions, and keeps the stored name in sync with the new file name.
fn relocate(path: &Path, directory: &Path) -> Result<PathBuf, String> {
    check_atus(path)?;
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let stem = path
        .file_stem()
        .ok_or("Nome de arquivo inválido")?
        .to_string_lossy()
        .into_owned();
    let current = path.canonicalize().map_err(|e| e.to_string())?;
    let target = free_target(directory, &stem)?;
    move_without_overwrite(&current, &target).map_err(|e| e.to_string())?;
    let name = target
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or(stem);
    if let Err(error) = store::write_name(&target, &name) {
        let _ = std::fs::rename(&target, &current);
        return Err(error.to_string());
    }
    Ok(target.canonicalize().unwrap_or(target))
}

pub(super) fn archive_in(path: &Path, root: &Path) -> Result<PathBuf, String> {
    if is_archived(path) {
        return Err("O projeto já está arquivado.".into());
    }
    relocate(path, &root.join(ARCHIVE_DIRECTORY))
}

pub(super) fn unarchive_in(path: &Path, root: &Path) -> Result<PathBuf, String> {
    if !is_archived(path) {
        return Err("O projeto não está arquivado.".into());
    }
    relocate(path, root)
}

/// Moves a project to the `archived` folder. Returns the new canonical path.
#[tauri::command]
pub async fn project_archive(app: tauri::AppHandle, path: PathBuf) -> Result<PathBuf, String> {
    archive_in(&path, &project_directory(&app)?)
}

/// Restores an archived project to the default projects folder. Returns the new path.
#[tauri::command]
pub async fn project_unarchive(app: tauri::AppHandle, path: PathBuf) -> Result<PathBuf, String> {
    unarchive_in(&path, &project_directory(&app)?)
}

/// Moves a project file to the system trash. Fails for non-.atus or missing files.
#[tauri::command]
pub async fn project_delete(path: PathBuf) -> Result<(), String> {
    check_atus(&path)?;
    trash::delete(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::test_support::empty_project;

    fn create(directory: &Path, name: &str) -> PathBuf {
        let path = directory.join(format!("{name}.atus"));
        let mut snapshot = empty_project();
        snapshot.name = name.into();
        store::create_project(&path, &snapshot).unwrap();
        path
    }

    #[test]
    fn rename_updates_stored_name_and_file_together() {
        let dir = tempfile::tempdir().unwrap();
        let path = create(dir.path(), "antigo");
        let renamed = rename_project(&path, "  Pêndulo simples ").unwrap();
        assert_eq!(renamed.file_name().unwrap(), "Pêndulo simples.atus");
        assert!(!path.exists());
        assert_eq!(
            store::read_project(&renamed).unwrap().name,
            "Pêndulo simples"
        );
    }

    #[test]
    fn rename_refuses_existing_target_without_changes() {
        let dir = tempfile::tempdir().unwrap();
        let a = create(dir.path(), "a");
        let b = create(dir.path(), "b");
        let error = rename_project(&a, "b").unwrap_err();
        assert!(error.contains("Já existe"));
        assert_eq!(store::read_project(&a).unwrap().name, "a");
        assert_eq!(store::read_project(&b).unwrap().name, "b");
    }

    #[test]
    fn rename_rejects_invalid_names() {
        let dir = tempfile::tempdir().unwrap();
        let path = create(dir.path(), "a");
        for name in ["", "   ", "x/y", "a:b", ".oculto", "fim.", &"n".repeat(121)] {
            assert!(rename_project(&path, name).is_err(), "{name:?}");
        }
        assert!(path.exists());
    }

    #[test]
    fn rename_to_same_name_is_a_noop() {
        let dir = tempfile::tempdir().unwrap();
        let path = create(dir.path(), "a");
        assert_eq!(rename_project(&path, "a").unwrap(), path);
    }

    #[test]
    fn rename_allows_case_only_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = create(dir.path(), "queda");
        let renamed = rename_project(&path, "Queda").unwrap();
        assert_eq!(renamed.file_name().unwrap(), "Queda.atus");
        assert_eq!(store::read_project(&renamed).unwrap().name, "Queda");
    }

    #[test]
    fn rename_requires_an_existing_atus_file() {
        let dir = tempfile::tempdir().unwrap();
        assert!(rename_project(&dir.path().join("x.atus"), "y").is_err());
        let other = dir.path().join("x.txt");
        std::fs::write(&other, "x").unwrap();
        assert!(rename_project(&other, "y").is_err());
    }

    #[test]
    fn archive_and_unarchive_round_trip_with_collision_suffix() {
        let root = tempfile::tempdir().unwrap();
        let path = create(root.path(), "ohm");
        let archived = archive_in(&path, root.path()).unwrap();
        assert!(is_archived(&archived) && !path.exists());
        let again = create(root.path(), "ohm");
        let second = archive_in(&again, root.path()).unwrap();
        assert_eq!(second.file_name().unwrap(), "ohm (2).atus");
        assert_eq!(store::read_project(&second).unwrap().name, "ohm (2)");
        let restored = unarchive_in(&archived, root.path()).unwrap();
        assert!(!is_archived(&restored) && restored.exists());
        assert!(archive_in(&second, root.path()).is_err());
        assert!(unarchive_in(&restored, root.path()).is_err());
    }

    #[test]
    fn details_report_name_size_archive_state_and_tolerate_bad_files() {
        let root = tempfile::tempdir().unwrap();
        let good = create(root.path(), "bom");
        let archived = archive_in(&create(root.path(), "velho"), root.path()).unwrap();
        let broken = root.path().join("quebrado.atus");
        std::fs::write(&broken, "not sqlite").unwrap();
        let missing = root.path().join("sumiu.atus");
        let details =
            tauri::async_runtime::block_on(project_details(vec![good, archived, broken, missing]));
        assert_eq!(details[0].name, "bom");
        assert!(details[0].available && details[0].size > 0 && details[0].modified.is_some());
        assert!(details[1].archived);
        assert!(details[2].available && details[2].error.is_some());
        assert_eq!(details[2].name, "quebrado");
        assert!(!details[3].available && details[3].modified.is_none());
    }
}
