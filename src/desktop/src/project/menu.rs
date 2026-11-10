use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    App, Emitter, Manager, State,
};

const SAVE: &str = "atus-project-save";
const SAVE_AS: &str = "atus-project-save-as";

pub struct ProjectMenu {
    save: MenuItem<tauri::Wry>,
    save_as: MenuItem<tauri::Wry>,
}

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
        let action = match event.id().as_ref() {
            SAVE => "save",
            SAVE_AS => "save-as",
            _ => return,
        };
        if let Some(window) = app.get_webview_window("main") {
            if let Err(error) = window.emit("project-menu-action", action) {
                eprintln!("Não foi possível acionar o menu Arquivo: {error}");
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn project_menu_enabled(menu: State<'_, ProjectMenu>, enabled: bool) -> Result<(), String> {
    menu.save
        .set_enabled(enabled)
        .map_err(|error| error.to_string())?;
    menu.save_as
        .set_enabled(enabled)
        .map_err(|error| error.to_string())
}
