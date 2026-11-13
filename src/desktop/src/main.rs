#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Desktop entry point and native demonstration bridge.

mod background;
mod export;
mod project;
mod quick;
#[cfg(feature = "desktop-e2e")]
mod quick_e2e;

#[cfg(all(feature = "desktop-e2e", not(debug_assertions)))]
compile_error!("The desktop-e2e feature is only permitted in debug builds");

use project::commands::*;
#[cfg(feature = "desktop-e2e")]
use project::e2e::project_test_directory;
#[cfg(all(feature = "desktop-e2e", target_os = "macos"))]
use project::e2e::project_test_finder;
use project::manage::*;
#[cfg(target_os = "macos")]
use project::{finder::take_finder_project, menu::project_menu_enabled};
use serde::Serialize;
use tauri::Manager;

#[repr(C)]
struct NativeMockAnalysis {
    slope: f64,
    intercept: f64,
    r_squared: f64,
    x: [f64; 5],
    y: [f64; 5],
}

unsafe extern "C" {
    fn atus_mock_analysis() -> NativeMockAnalysis;
}

#[derive(Serialize)]
struct MockAnalysis {
    slope: f64,
    intercept: f64,
    r_squared: f64,
    x: [f64; 5],
    y: [f64; 5],
}

#[tauri::command]
fn get_mock_analysis() -> MockAnalysis {
    // The C ABI returns a fixed-size, owned value; it holds no pointers.
    let result = unsafe { atus_mock_analysis() };
    MockAnalysis {
        slope: result.slope,
        intercept: result.intercept,
        r_squared: result.r_squared,
        x: result.x,
        y: result.y,
    }
}

fn main() {
    // Must be the first plugin: a second launch only shows the running instance.
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            quick::spawn_show_main(app)
        }));
    #[cfg(feature = "desktop-e2e")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    #[cfg(target_os = "macos")]
    let builder = builder.manage(project::finder::FinderRequest::default());
    builder
        .manage(quick::PendingQuickAnalysis::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            project::menu::install(app)?;
            quick::install(app.handle())?;
            // Without a tray (for example Linux without an appindicator library) the app still
            // works; only the background entry points are missing.
            if let Err(error) = background::install_tray(app.handle()) {
                eprintln!("Não foi possível criar o ícone na bandeja: {error}");
            }
            Ok(())
        })
        .on_window_event(quick::on_window_event)
        .plugin(quick::shortcut_plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_mock_analysis,
            export::export_image_write,
            background::app_quit,
            quick::quick_submit,
            quick::quick_dismiss,
            quick::take_quick_analysis,
            project_create,
            project_open,
            project_save,
            project_save_as,
            project_list,
            project_available,
            project_details,
            project_list_archived,
            project_rename,
            project_archive,
            project_unarchive,
            project_delete,
            #[cfg(feature = "desktop-e2e")]
            project_test_directory,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_state,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_press_shortcut,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_tray_menu,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_second_launch,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_blur_quick,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_close_quick,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_set_clipboard,
            #[cfg(feature = "desktop-e2e")]
            quick_e2e::quick_test_close_main,
            #[cfg(all(feature = "desktop-e2e", target_os = "macos"))]
            project_test_finder,
            #[cfg(target_os = "macos")]
            project_menu_enabled,
            #[cfg(target_os = "macos")]
            take_finder_project
        ])
        .build(tauri::generate_context!())
        .expect("failed to build ATUS Desktop")
        .run(|app, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                // Opening a file while only the tray is left recreates the main window first; the
                // pending request stays until the new window takes it.
                if app.get_webview_window(quick::MAIN_LABEL).is_none() {
                    quick::spawn_show_main(app);
                }
                project::finder::receive(app, urls);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => quick::spawn_show_main(app),
            tauri::RunEvent::ExitRequested { code, api, .. } => {
                let has_main = app.get_webview_window(quick::MAIN_LABEL).is_some();
                if background::exit_needs_save(code, has_main) {
                    api.prevent_exit();
                    background::request_quit(app);
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_crosses_cpp_boundary() {
        let result = get_mock_analysis();
        assert_eq!(result.slope, 1.2);
        assert_eq!(result.intercept, 0.5);
        assert_eq!(result.r_squared, 0.994);
        assert_eq!(result.x, [0.0, 1.0, 2.0, 3.0, 4.0]);
        assert_eq!(result.y, [0.5, 1.8, 2.8, 4.2, 5.3]);
    }
}
