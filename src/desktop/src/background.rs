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

/// Key hint shown next to **Análise rápida** in the tray menu.
///
/// Only macOS menus accept Cmd in an accelerator. On Windows the parser rejects it and the whole
/// tray fails to build, so other systems show the item without a hint.
fn quick_accelerator() -> Option<&'static str> {
    cfg!(target_os = "macos").then_some("Ctrl+Cmd+B")
}

/// Identifier of the tray icon.
const TRAY_ID: &str = "atus";

/// Whether the tray icon exists. Used by the desktop integration tests.
#[cfg(feature = "desktop-e2e")]
pub fn has_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.tray_by_id(TRAY_ID).is_some()
}

/// Removes the tray icon. Used right before the process ends abruptly (the Windows installer),
/// so that the system does not keep a stale icon.
pub fn remove_tray<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.remove_tray_by_id(TRAY_ID);
}

/// Installs the tray icon and its menu, treating every failure as "no tray".
///
/// On Linux the tray library loads `libayatana-appindicator3` at run time and panics, instead of
/// returning an error, when it is missing. The panic is caught here so that an app on such a
/// system still starts, only without the tray.
///
/// # Errors
/// Returns a message when the menu or the tray icon cannot be created.
pub fn install_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| build_tray(app)))
        .map_err(|_| "a biblioteca da bandeja não está disponível".to_owned())?
        .map_err(|error| error.to_string())
}

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let accelerator = quick_accelerator();
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, MENU_QUICK, "Análise rápida", true, accelerator)?,
            &MenuItem::with_id(app, MENU_OPEN, "Abrir ATUS", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, MENU_QUIT, "Sair do ATUS", true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("ATUS")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| on_menu_event(app, event.id().as_ref()));
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Runs the action of a tray menu item. Unknown ids are ignored.
pub fn on_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match tray_action(id) {
        Some(TrayAction::Quick) => quick::show(app),
        Some(TrayAction::Open) => quick::spawn_show_main(app),
        Some(TrayAction::Quit) => request_quit(app),
        None => {}
    }
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
    fn only_macos_shows_a_key_hint_because_other_menus_reject_super() {
        assert_eq!(quick_accelerator().is_some(), cfg!(target_os = "macos"));
    }

    #[test]
    fn only_system_exit_requests_with_a_main_window_wait_for_saving() {
        assert!(exit_needs_save(None, true));
        assert!(!exit_needs_save(None, false));
        assert!(!exit_needs_save(Some(0), true));
        assert!(!exit_needs_save(Some(0), false));
    }

    #[test]
    fn a_restart_for_an_update_is_never_held_back_by_the_save_guard() {
        // `AppHandle::restart` asks to exit with this code after the frontend already saved.
        assert!(!exit_needs_save(Some(tauri::RESTART_EXIT_CODE), true));
    }
}
