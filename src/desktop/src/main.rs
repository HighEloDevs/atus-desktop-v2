#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Desktop entry point and native demonstration bridge.

mod project;

#[cfg(all(feature = "desktop-e2e", not(debug_assertions)))]
compile_error!("The desktop-e2e feature is only permitted in debug builds");

use project::commands::*;
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
    let builder = tauri::Builder::default();
    #[cfg(feature = "desktop-e2e")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    #[cfg(target_os = "macos")]
    let builder = builder
        .manage(project::finder::FinderRequest::default())
        .setup(|app| {
            project::menu::install(app)?;
            Ok(())
        });
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_mock_analysis,
            project_create,
            project_open,
            project_save,
            project_save_as,
            project_list,
            project_available,
            #[cfg(target_os = "macos")]
            project_menu_enabled,
            #[cfg(target_os = "macos")]
            take_finder_project
        ])
        .build(tauri::generate_context!())
        .expect("failed to build ATUS Desktop")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                project::finder::receive(app, urls.clone());
            }
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    api.prevent_exit();
                    if let Err(error) = window.close() {
                        eprintln!("Não foi possível solicitar o fechamento da janela: {error}");
                    }
                }
            }
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
