//! Delivery of Finder open requests.

use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
/// The latest Finder project request awaiting delivery.
pub struct FinderRequest(Mutex<Option<PathBuf>>);

/// Records the last .atus file URL in urls and notifies the main window.
/// Replaces any pending request and ignores other URLs.
pub fn receive(app: &AppHandle, urls: Vec<tauri::Url>) {
    let path = urls
        .into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .rfind(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("atus"))
        });
    if let Some(path) = path {
        *app.state::<FinderRequest>().0.lock().unwrap() = Some(path);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("finder-project-requested", ());
            let _ = window.set_focus();
        }
    }
}

/// Removes and returns the pending Finder path, if present.
#[tauri::command]
pub fn take_finder_project(request: State<'_, FinderRequest>) -> Option<PathBuf> {
    request.0.lock().unwrap().take()
}
