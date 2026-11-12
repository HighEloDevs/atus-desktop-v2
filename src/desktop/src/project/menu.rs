//! Native macOS project menu.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    App, Emitter, Manager, State,
};

const SAVE: &str = "atus-project-save";
const SAVE_AS: &str = "atus-project-save-as";

/// Maps a native menu identifier to its frontend action.
fn menu_action(id: &str) -> Option<&'static str> {
    match id {
        SAVE => Some("save"),
        SAVE_AS => Some("save-as"),
        _ => None,
    }
}

/// Native save menu items controlled by the active project.
pub struct ProjectMenu {
    save: MenuItem<tauri::Wry>,
    save_as: MenuItem<tauri::Wry>,
}

/// Installs the native File menu and save handlers on app.
/// Returns an error on menu failures and panics if the default File submenu is absent.
pub fn install(app: &mut App) -> tauri::Result<()> {
    let menu = Menu::default(app.handle())?;
    let items = menu.items()?;
    let file = items[1].as_submenu().expect("default macOS File menu");
    file.set_text("Arquivo")?;
    let save = MenuItem::with_id(app, SAVE, "Salvar projeto", false, Some("Cmd+S"))?;
    let save_as = MenuItem::with_id(app, SAVE_AS, "Salvar como…", false, Some("Cmd+Shift+S"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    file.insert_items(&[&save, &save_as, &separator], 0)?;
    app.set_menu(menu)?;
    app.manage(ProjectMenu { save, save_as });
    app.on_menu_event(|app, event| {
        let Some(action) = menu_action(event.id().as_ref()) else {
            return;
        };
        if let Some(window) = app.get_webview_window("main") {
            if let Err(error) = window.emit("project-menu-action", action) {
                eprintln!("Não foi possível acionar o menu Arquivo: {error}");
            }
        }
    });
    Ok(())
}

/// Enables or disables both project save commands.
/// Returns an error if either menu item cannot be updated.
#[tauri::command]
pub fn project_menu_enabled(menu: State<'_, ProjectMenu>, enabled: bool) -> Result<(), String> {
    menu.save
        .set_enabled(enabled)
        .map_err(|error| error.to_string())?;
    menu.save_as
        .set_enabled(enabled)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::menu_action;

    #[test]
    fn maps_only_supported_native_menu_commands() {
        assert_eq!(menu_action("atus-project-save"), Some("save"));
        assert_eq!(menu_action("atus-project-save-as"), Some("save-as"));
        assert_eq!(menu_action("unrelated"), None);
        assert_eq!(menu_action(""), None);
    }
}
