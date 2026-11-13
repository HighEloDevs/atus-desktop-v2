//! Quick analysis: the global shortcut, the small entry window and the hand-off of its equation
//! and data to the main window.
//!
//! The quick window is created hidden at startup so the shortcut only has to show it. When the
//! person submits, the payload is validated and kept in [`PendingQuickAnalysis`]; the main window
//! is shown (or recreated) and notified, and it takes the payload with
//! [`take_quick_analysis`]. Keeping the payload here, instead of only sending it in the event,
//! means a main window that is still loading does not lose it, and a second `take` returns
//! nothing.

use crate::project::model::Point;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    plugin::TauriPlugin, AppHandle, Emitter, Manager, Runtime, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Label of the quick analysis window.
pub const QUICK_LABEL: &str = "quick";
/// Label of the main application window, as declared in `tauri.conf.json`.
pub const MAIN_LABEL: &str = "main";
/// Event sent to the main window when a quick analysis waits to be taken.
pub const REQUESTED_EVENT: &str = "quick-analysis-requested";
/// Event sent to the quick window each time it is shown.
pub const SHOWN_EVENT: &str = "quick-analysis-shown";

/// Longest accepted equation, in characters. Real models are far shorter.
const MAX_EQUATION_CHARS: usize = 500;

/// Equation and points submitted from the quick window.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct QuickAnalysis {
    /// Fit model in the syntax of the analysis screen, for example `a*x + b`. May be empty.
    pub equation: String,
    /// Measurements in input order; uncertainties are optional.
    pub points: Vec<Point>,
}

/// The submitted quick analysis that the main window has not taken yet.
#[derive(Default)]
pub struct PendingQuickAnalysis(Mutex<Option<QuickAnalysis>>);

impl PendingQuickAnalysis {
    /// Stores an analysis, replacing any one that was not taken.
    pub fn store(&self, analysis: QuickAnalysis) {
        *self.0.lock().unwrap() = Some(analysis);
    }

    /// Removes and returns the pending analysis, if any.
    pub fn take(&self) -> Option<QuickAnalysis> {
        self.0.lock().unwrap().take()
    }
}

/// Checks that a submitted analysis can open as a project.
///
/// The equation is optional: an empty one opens the project with the data only.
///
/// # Errors
/// Returns a Portuguese message when the equation is too long, when there are no
/// points, when a value is not finite or when an uncertainty is negative.
pub fn validate(analysis: &QuickAnalysis) -> Result<(), String> {
    if analysis.equation.trim().chars().count() > MAX_EQUATION_CHARS {
        return Err("A função de ajuste é longa demais.".into());
    }
    if analysis.points.is_empty() {
        return Err("Cole ao menos um ponto.".into());
    }
    let valid = analysis.points.iter().all(|point| {
        let uncertainty = |value: Option<f64>| value.is_none_or(|v| v.is_finite() && v >= 0.0);
        point.x.is_finite() && point.y.is_finite() && uncertainty(point.sx) && uncertainty(point.sy)
    });
    if !valid {
        return Err("Os dados devem ser finitos e as incertezas não podem ser negativas.".into());
    }
    Ok(())
}

/// The system-wide shortcut: Control+Command+B on macOS, Control+Windows+B elsewhere.
pub fn shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SUPER), Code::KeyB)
}

/// Builds the global-shortcut plugin that toggles the quick window on [`shortcut`].
pub fn shortcut_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, pressed, event| {
            if pressed == &shortcut() && event.state() == ShortcutState::Pressed {
                toggle(app);
            }
        })
        .build()
}

/// Creates the hidden quick window and registers the shortcut.
///
/// A shortcut that another app already owns is reported on stderr and does not stop the app:
/// the quick window stays reachable from the tray.
///
/// # Errors
/// Fails when the window cannot be created.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    build_window(app)?;
    if let Err(error) = app.global_shortcut().register(shortcut()) {
        eprintln!("Não foi possível registrar o atalho da análise rápida: {error}");
    }
    Ok(())
}

fn build_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    WebviewWindowBuilder::new(app, QUICK_LABEL, WebviewUrl::App("index.html".into()))
        .title("Análise rápida")
        .inner_size(720.0, 540.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .shadow(true)
        .always_on_top(true)
        // Appears on the desktop (macOS Space) the person is on, instead of jumping back to the
        // one where the window was created. No effect on Windows.
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .visible(false)
        .center()
        .build()
}

/// Shows and focuses the quick window, recreating it if it was destroyed.
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    let window = match app.get_webview_window(QUICK_LABEL) {
        Some(window) => window,
        None => match build_window(app) {
            Ok(window) => window,
            Err(error) => {
                eprintln!("Não foi possível abrir a análise rápida: {error}");
                return;
            }
        },
    };
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit(SHOWN_EVENT, ());
}

/// Hides the quick window, keeping its state loaded for the next time.
pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(QUICK_LABEL) {
        let _ = window.hide();
    }
}

/// Hides the quick window when it is visible and focused; shows it otherwise.
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let open = app.get_webview_window(QUICK_LABEL).is_some_and(|window| {
        window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
    });
    if open {
        hide(app);
    } else {
        show(app);
    }
}

/// Shows and focuses the main window, recreating it from the configuration when it was closed.
///
/// # Errors
/// Fails when the main window is missing from the configuration or cannot be created.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    let window = match app.get_webview_window(MAIN_LABEL) {
        Some(window) => window,
        None => {
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == MAIN_LABEL)
                .cloned()
                .ok_or(tauri::Error::WindowNotFound)?;
            WebviewWindowBuilder::from_config(app, &config)?.build()?
        }
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    Ok(window)
}

/// Receives the quick window form, hides it and hands the analysis to the main window.
///
/// # Errors
/// Returns a Portuguese message when the analysis is invalid (see [`validate`]) or when the main
/// window cannot be shown.
#[tauri::command]
pub fn quick_submit(
    app: AppHandle,
    pending: State<'_, PendingQuickAnalysis>,
    analysis: QuickAnalysis,
) -> Result<(), String> {
    validate(&analysis)?;
    pending.store(analysis);
    hide(&app);
    let window =
        show_main(&app).map_err(|error| format!("Não foi possível abrir o ATUS: {error}"))?;
    let _ = window.emit(REQUESTED_EVENT, ());
    Ok(())
}

/// Removes and returns the submitted analysis that waits for the main window, if any.
#[tauri::command]
pub fn take_quick_analysis(pending: State<'_, PendingQuickAnalysis>) -> Option<QuickAnalysis> {
    pending.take()
}

/// Hides the quick window without submitting (Esc or the close button).
#[tauri::command]
pub fn quick_dismiss(app: AppHandle) {
    hide(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(x: f64, y: f64, sx: Option<f64>, sy: Option<f64>) -> Point {
        Point { x, y, sx, sy }
    }

    fn analysis(equation: &str, points: Vec<Point>) -> QuickAnalysis {
        QuickAnalysis {
            equation: equation.into(),
            points,
        }
    }

    #[test]
    fn accepts_points_with_and_without_uncertainties() {
        let points = vec![
            point(1.0, 2.0, None, Some(0.1)),
            point(2.0, 4.1, Some(0.0), None),
        ];
        assert_eq!(validate(&analysis(" a*x + b ", points)), Ok(()));
    }

    #[test]
    fn accepts_an_empty_equation_but_not_missing_points() {
        let points = vec![point(1.0, 2.0, None, None)];
        assert_eq!(validate(&analysis("  ", points.clone())), Ok(()));
        assert_eq!(
            validate(&analysis(&"x".repeat(MAX_EQUATION_CHARS + 1), points)),
            Err("A função de ajuste é longa demais.".into())
        );
        assert_eq!(
            validate(&analysis("a*x", vec![])),
            Err("Cole ao menos um ponto.".into())
        );
    }

    #[test]
    fn rejects_non_finite_values_and_negative_uncertainties() {
        for bad in [
            point(f64::NAN, 1.0, None, None),
            point(1.0, f64::INFINITY, None, None),
            point(1.0, 1.0, Some(-0.1), None),
            point(1.0, 1.0, None, Some(f64::NAN)),
        ] {
            assert!(validate(&analysis("a*x", vec![bad])).is_err());
        }
    }

    #[test]
    fn pending_analysis_is_taken_once_and_replaced_by_newer_submissions() {
        let pending = PendingQuickAnalysis::default();
        assert_eq!(pending.take(), None);
        pending.store(analysis("a*x", vec![point(1.0, 1.0, None, None)]));
        let newer = analysis("a*x + b", vec![point(2.0, 3.0, None, None)]);
        pending.store(newer.clone());
        assert_eq!(pending.take(), Some(newer));
        assert_eq!(pending.take(), None);
    }

    #[test]
    fn payload_accepts_points_without_uncertainty_fields() {
        let parsed: QuickAnalysis =
            serde_json::from_str(r#"{"equation":"a*x","points":[{"x":1,"y":2}]}"#).unwrap();
        assert_eq!(parsed.points, vec![point(1.0, 2.0, None, None)]);
    }

    #[test]
    fn shortcut_is_control_super_b() {
        assert_eq!(
            shortcut(),
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SUPER), Code::KeyB)
        );
    }
}
