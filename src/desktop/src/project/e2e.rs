//! Helpers for the explicitly enabled desktop integration tests.

use std::path::{Path, PathBuf};

/// Resolves the explicitly configured isolated test project directory.
pub(super) fn test_project_directory() -> Result<PathBuf, String> {
    let path = std::env::var_os("ATUS_DESKTOP_E2E_PROJECT_DIR")
        .map(PathBuf::from)
        .ok_or("ATUS_DESKTOP_E2E_PROJECT_DIR é obrigatório no teste desktop")?;
    validate_test_directory(&path, &std::env::temp_dir())
}

/// Delivers a simulated Finder request for a file inside the isolated test directory.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn project_test_finder(app: tauri::AppHandle, path: PathBuf) -> Result<(), String> {
    let directory = super::commands::project_directory(&app)?;
    let url = validate_finder_test_path(&path, &directory)?;
    super::finder::receive(&app, vec![url]);
    Ok(())
}

#[cfg(target_os = "macos")]
fn validate_finder_test_path(path: &Path, directory: &Path) -> Result<tauri::Url, String> {
    let directory = directory
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let path = path.canonicalize().map_err(|error| error.to_string())?;
    if !path.is_file() || path.parent() != Some(directory.as_path()) {
        return Err("O arquivo de teste deve ficar no diretório isolado".into());
    }
    tauri::Url::from_file_path(&path).map_err(|_| "Caminho de teste inválido".to_owned())
}

pub(super) fn validate_test_directory(path: &Path, temp: &Path) -> Result<PathBuf, String> {
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

    #[cfg(target_os = "macos")]
    #[test]
    fn finder_test_rejects_files_outside_the_isolated_directory() {
        let isolated = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let inside_file = isolated.path().join("inside.atus");
        let outside_file = outside.path().join("outside.atus");
        std::fs::write(&inside_file, "").unwrap();
        std::fs::write(&outside_file, "").unwrap();
        assert!(super::validate_finder_test_path(&inside_file, isolated.path()).is_ok());
        assert!(super::validate_finder_test_path(&outside_file, isolated.path()).is_err());
        let link = isolated.path().join("link.atus");
        std::os::unix::fs::symlink(&outside_file, &link).unwrap();
        assert!(super::validate_finder_test_path(&link, isolated.path()).is_err());
    }
}

/// Returns the isolated project directory configured for desktop integration tests.
/// Fails if the test directory is missing or invalid.
#[cfg(feature = "desktop-e2e")]
#[tauri::command]
pub async fn project_test_directory(app: tauri::AppHandle) -> Result<PathBuf, String> {
    super::commands::project_directory(&app)
}
