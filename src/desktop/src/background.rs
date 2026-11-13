//! Background lifecycle: the tray icon and the rules that keep ATUS running after its main
//! window closes, so the quick analysis shortcut keeps working.
//!
//! Closing the main window destroys it (after the frontend saves the project) but the hidden
//! quick window keeps the process alive. Quitting is explicit: the tray **Sair** item or the
//! system quit command ask the main window to save through [`QUIT_EVENT`], and the frontend then
//! calls [`app_quit`].

use crate::quick;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};

/// Event sent to the main window when the app should quit after saving.
pub const QUIT_EVENT: &str = "app-quit-requested";

const MENU_QUICK: &str = "quick";
const MENU_OPEN: &str = "open";
const MENU_QUIT: &str = "quit";

/// What a tray menu item does.
#[derive(Debug, PartialEq)]
enum TrayAction {
    Quick,
    Open,
    Quit,
}

fn tray_action(id: &str) -> Option<TrayAction> {
    match id {
        MENU_QUICK => Some(TrayAction::Quick),
        MENU_OPEN => Some(TrayAction::Open),
        MENU_QUIT => Some(TrayAction::Quit),
        _ => None,
    }
}

/// Installs the tray icon and its menu.
///
/// # Errors
/// Fails when the menu or the tray icon cannot be created.
pub fn install_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let accelerator = if cfg!(target_os = "macos") {
        "Ctrl+Cmd+B"
    } else {
        "Ctrl+Super+B"
    };
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, MENU_QUICK, "Análise rápida", true, Some(accelerator))?,
            &MenuItem::with_id(app, MENU_OPEN, "Abrir ATUS", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, MENU_QUIT, "Sair do ATUS", true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("atus")
        .tooltip("ATUS")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match tray_action(event.id().as_ref()) {
            Some(TrayAction::Quick) => quick::show(app),
            Some(TrayAction::Open) => {
                if let Err(error) = quick::show_main(app) {
                    eprintln!("Não foi possível abrir a janela principal: {error}");
                }
            }
            Some(TrayAction::Quit) => request_quit(app),
            None => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Asks the main window to save and quit, or quits at once when there is no main window.
pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    match app.get_webview_window(quick::MAIN_LABEL) {
        Some(window) => {
            let _ = window.show();
            let _ = window.set_focus();
            if window.emit(QUIT_EVENT, ()).is_err() {
                app.exit(0);
            }
        }
        None => app.exit(0),
    }
}

/// Whether an exit request must wait for the main window to save first.
///
/// `code` is `None` for requests from the system (for example Cmd+Q) and `Some` for
/// [`AppHandle::exit`], which only runs after the frontend agreed to quit.
pub fn exit_needs_save(code: Option<i32>, has_main_window: bool) -> bool {
    code.is_none() && has_main_window
}

/// Quits the app. The frontend calls it after the open project is saved.
#[tauri::command]
pub fn app_quit(app: AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_menu_ids_map_to_actions() {
        assert_eq!(tray_action(MENU_QUICK), Some(TrayAction::Quick));
        assert_eq!(tray_action(MENU_OPEN), Some(TrayAction::Open));
        assert_eq!(tray_action(MENU_QUIT), Some(TrayAction::Quit));
        assert_eq!(tray_action("other"), None);
    }

    #[test]
    fn only_system_exit_requests_with_a_main_window_wait_for_saving() {
        assert!(exit_needs_save(None, true));
        assert!(!exit_needs_save(None, false));
        assert!(!exit_needs_save(Some(0), true));
        assert!(!exit_needs_save(Some(0), false));
    }
}
