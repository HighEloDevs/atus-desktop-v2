//! Delivery of Finder open requests.

use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
/// The latest Finder project request awaiting delivery.
pub struct FinderRequest(Mutex<Option<PathBuf>>);

/// Records the last .atus file URL in urls and notifies the main window.
/// Replaces any pending request and ignores other URLs.
pub fn receive(app: &AppHandle, urls: Vec<tauri::Url>) {
    if let Some(path) = last_project_path(urls) {
        *app.state::<FinderRequest>().0.lock().unwrap() = Some(path);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("finder-project-requested", ());
            let _ = window.set_focus();
        }
    }
}

/// Returns the last local ATUS project in the URL list, if one exists.
pub(super) fn last_project_path(urls: Vec<tauri::Url>) -> Option<PathBuf> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .rfind(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("atus"))
        })
}

/// Removes and returns the pending Finder path, if present.
#[tauri::command]
pub fn take_finder_project(request: State<'_, FinderRequest>) -> Option<PathBuf> {
    request.0.lock().unwrap().take()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finder_selects_last_atus_file_and_ignores_other_urls() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join("first.atus");
        let last = temp.path().join("Análise.ATUS");
        let other = temp.path().join("ignore.txt");
        let urls = vec![
            tauri::Url::from_file_path(&first).unwrap(),
            tauri::Url::parse("https://example.org/unrelated.atus").unwrap(),
            tauri::Url::from_file_path(&last).unwrap(),
            tauri::Url::from_file_path(&other).unwrap(),
        ];
        assert_eq!(last_project_path(urls), Some(last));
        assert_eq!(
            last_project_path(vec![tauri::Url::from_file_path(other).unwrap()]),
            None
        );
        assert_eq!(last_project_path(Vec::new()), None);
    }
}
