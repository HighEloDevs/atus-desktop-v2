//! Commands for the explicitly enabled desktop integration tests of the quick analysis.
//!
//! A WebDriver cannot press a system-wide shortcut, click the tray icon or write the system
//! clipboard, so these commands drive the same functions those entry points call, and report the
//! native state that the web content cannot see. They only exist with the `desktop-e2e` feature.

use crate::{background, quick};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Native state that the integration tests assert on.
#[derive(Serialize)]
pub struct QuickState {
    /// The quick window exists (it is created hidden at startup).
    quick_exists: bool,
    quick_visible: bool,
    quick_focused: bool,
    /// The main window exists; it is destroyed when the person closes it.
    main_exists: bool,
    main_visible: bool,
    /// The system accepted the global shortcut registration.
    shortcut_registered: bool,
    /// The tray icon was created.
    tray: bool,
}

/// Reports the quick analysis windows, the shortcut registration and the tray icon.
#[tauri::command]
pub fn quick_test_state(app: AppHandle) -> QuickState {
    let quick = app.get_webview_window(quick::QUICK_LABEL);
    let main = app.get_webview_window(quick::MAIN_LABEL);
    QuickState {
        quick_exists: quick.is_some(),
        quick_visible: quick
            .as_ref()
            .is_some_and(|w| w.is_visible().unwrap_or(false)),
        quick_focused: quick
            .as_ref()
            .is_some_and(|w| w.is_focused().unwrap_or(false)),
        main_exists: main.is_some(),
        main_visible: main
            .as_ref()
            .is_some_and(|w| w.is_visible().unwrap_or(false)),
        shortcut_registered: app.global_shortcut().is_registered(quick::shortcut()),
        tray: background::has_tray(&app),
    }
}

/// Runs what the global shortcut handler runs when the shortcut is pressed.
#[tauri::command]
pub fn quick_test_press_shortcut(app: AppHandle) {
    quick::toggle(&app);
}

/// Runs what the tray **Abrir ATUS** item runs. `async` for the same reason as `quick_submit`.
///
/// # Errors
/// Returns the failure to show or recreate the main window.
#[tauri::command]
pub async fn quick_test_tray_open(app: AppHandle) -> Result<(), String> {
    quick::show_main(&app)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Runs what the tray **Sair do ATUS** item runs.
#[tauri::command]
pub fn quick_test_tray_quit(app: AppHandle) {
    background::request_quit(&app);
}

/// Replaces the system clipboard text, so the quick window has something to read.
///
/// # Errors
/// Returns the clipboard failure.
#[tauri::command]
pub fn quick_test_set_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|error| error.to_string())
}

/// Closes the main window the way its close button does (the frontend saves first).
///
/// # Errors
/// Returns a message when there is no main window or it cannot be asked to close.
#[tauri::command]
pub fn quick_test_close_main(app: AppHandle) -> Result<(), String> {
    app.get_webview_window(quick::MAIN_LABEL)
        .ok_or("A janela principal não existe")?
        .close()
        .map_err(|error| error.to_string())
}
