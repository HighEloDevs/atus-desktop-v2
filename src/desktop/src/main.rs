#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod project;

use serde::Serialize;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_mock_analysis])
        .run(tauri::generate_context!())
        .expect("failed to run ATUS Desktop");
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
