//! Commands for the explicitly enabled desktop integration tests of the updater.
//!
//! The tests serve a manifest and a package signed with a throwaway key from a local server, so
//! the build under test must trust that key and look at that server instead of GitHub. The
//! package is never installed: "installing" only records the bytes it received, because a test
//! must not replace the binary it runs. They only exist with the `desktop-e2e` feature.

use crate::update::UpdateStore;
use tauri::State;

/// Points the updater at a test server and trusts a test key, and clears any previous state.
///
/// `endpoint` is the URL of the manifest and `pubkey` the base64 minisign public key, as written
/// in `plugins.updater.pubkey`.
#[tauri::command]
pub fn update_test_configure(store: State<'_, UpdateStore>, endpoint: String, pubkey: String) {
    store.reset();
    *store.e2e.endpoint.lock().unwrap() = Some((endpoint, pubkey));
}

/// The package that the last installation received, if any.
#[tauri::command]
pub fn update_test_installed(store: State<'_, UpdateStore>) -> Option<Vec<u8>> {
    store.e2e.installed.lock().unwrap().clone()
}
