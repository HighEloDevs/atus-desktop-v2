//! Regression tests for native project menu action selection.
use super::menu_action;

#[test]
fn maps_only_supported_native_menu_commands() {
    assert_eq!(menu_action("atus-project-save"), Some("save"));
    assert_eq!(menu_action("atus-project-save-as"), Some("save-as"));
    assert_eq!(menu_action("unrelated"), None);
    assert_eq!(menu_action(""), None);
}
