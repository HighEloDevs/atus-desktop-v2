//! Application updates: look for a new release, download it in the background and install it
//! only when the person asks.
//!
//! The web content drives a small state machine through the commands in this module and listens
//! to [`STATE_EVENT`]. Nothing here runs on its own: the app never looks for updates until the
//! frontend asks, and the interface that asks arrives in a later change
//! (`docs/decisions/0013-auto-update.md`).
//!
//! The plugin does the network work, the signature check and the installation. Updates are
//! accepted only when their minisign signature matches the public key in `tauri.conf.json` and
//! names the announced version (`requireSignedVersion`).
//!
//! # Installing
//!
//! The frontend must save the open project **before** calling [`update_install`]; this module
//! does not wait for it:
//!
//! - **Windows** launches the installer and ends the process with `std::process::exit`, which
//!   bypasses the exit guard of [`crate::background`]. For a per-machine `.msi` the installer asks
//!   for administrator permission after the app has gone, so a refusal cannot be reported here.
//!   [`InstallAttempt`] records the attempt and the next launch reports a failure as
//!   [`ManualReason::PreviousAttemptFailed`].
//! - **macOS and Linux** replace the app and then restart it with [`AppHandle::restart`], whose
//!   exit request carries a code that the guard lets through (`background::exit_needs_save`).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::async_runtime::JoinHandle;
use tauri::utils::config::BundleType;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_updater::{Error as UpdaterError, Update, UpdaterExt};

/// Event sent to every window each time [`UpdateState`] changes. The payload is the new state.
pub const STATE_EVENT: &str = "update-state";

/// Where people download the installers when the app cannot update itself.
pub const RELEASES_URL: &str = "https://github.com/HighEloDevs/atus-desktop-v2/releases/latest";

/// How long a request to the releases may take before it is given up.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// File, inside the app data directory, that records an installation that has started.
const ATTEMPT_FILE: &str = "update-attempt.json";

/// Where the application was installed from, which decides how an update is applied.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum InstallFormat {
    /// macOS application bundle (also used for disk images).
    App,
    /// Windows NSIS installer, per user.
    Nsis,
    /// Windows MSI installer, per machine.
    Msi,
    /// Linux AppImage.
    AppImage,
    /// Debian package.
    Deb,
    /// RPM package.
    Rpm,
}

impl InstallFormat {
    /// Maps the bundle type the build recorded in the binary. `None` means an unknown origin.
    pub fn from_bundle(bundle: Option<BundleType>) -> Option<Self> {
        Some(match bundle? {
            BundleType::App | BundleType::Dmg => Self::App,
            BundleType::Nsis => Self::Nsis,
            BundleType::Msi => Self::Msi,
            BundleType::AppImage => Self::AppImage,
            BundleType::Deb => Self::Deb,
            BundleType::Rpm => Self::Rpm,
        })
    }

    /// Whether installing asks the system for administrator permission.
    pub fn needs_elevation(self) -> bool {
        matches!(self, Self::Msi | Self::Deb | Self::Rpm)
    }
}

/// Why this build cannot look for updates at all.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UnavailableReason {
    /// A debug build, such as `tauri dev`: it must never replace itself.
    DevelopmentBuild,
    /// The binary does not say how it was installed (for example a bare `cargo build --release`).
    UnknownInstallation,
}

/// Why an update has to be installed by hand.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ManualReason {
    /// The system refused the administrator permission the installation needs.
    PermissionDenied,
    /// The package manager or installer reported a failure.
    InstallFailed,
    /// The AppImage file cannot be replaced by this user.
    NotWritable,
    /// The previous launch started installing this version, but it is still not installed.
    PreviousAttemptFailed,
}

/// The step of an update that failed.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
    Check,
    Download,
    Install,
}

/// What the interface shows about updates. Serialized with a `kind` tag in camelCase, the contract
/// with the frontend.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UpdateState {
    /// Nothing has been checked yet.
    Idle,
    /// This build cannot be updated.
    Unavailable { reason: UnavailableReason },
    /// Asking the releases for a newer version.
    Checking,
    /// The installed version is the newest.
    UpToDate,
    /// A newer version exists; `notes` is its one-line summary.
    Available {
        version: String,
        notes: Option<String>,
    },
    /// Downloading; `total` is unknown when the server does not say.
    Downloading {
        version: String,
        downloaded: u64,
        total: Option<u64>,
    },
    /// Downloaded and verified, waiting for the person to install it.
    Ready { version: String },
    /// Installing. `started_at` is the Unix time in seconds, so the interface can tell when an
    /// installation is taking too long (for example while a password prompt is open).
    Installing { version: String, started_at: u64 },
    /// The update must be installed by hand from [`RELEASES_URL`].
    Manual {
        version: String,
        reason: ManualReason,
        url: String,
    },
    /// A step failed; checking again or downloading again is allowed.
    Error { stage: Stage, message: String },
}

/// A newer version announced by the releases.
#[derive(Clone, Debug, PartialEq)]
pub struct Found {
    pub version: String,
    pub notes: Option<String>,
}

/// Whether this installation can apply an update by itself.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Support {
    Automatic,
    Manual(ManualReason),
}

/// Decides whether this build may look for updates.
///
/// `debug_build` is true for builds with debug assertions, which only update in the integration
/// tests (`allow_debug`). `appimage_writable` is whether the running AppImage file can be
/// replaced, when known.
///
/// # Errors
/// Returns the reason updates are unavailable.
pub fn check_gate(
    debug_build: bool,
    allow_debug: bool,
    format: Option<InstallFormat>,
    appimage_writable: Option<bool>,
) -> Result<Support, UnavailableReason> {
    if debug_build && !allow_debug {
        return Err(UnavailableReason::DevelopmentBuild);
    }
    // Debug builds used by the integration tests have no recorded origin on Linux and Windows.
    let Some(format) = format.or(allow_debug.then_some(InstallFormat::App)) else {
        return Err(UnavailableReason::UnknownInstallation);
    };
    Ok(match (format, appimage_writable) {
        (InstallFormat::AppImage, Some(false)) => Support::Manual(ManualReason::NotWritable),
        _ => Support::Automatic,
    })
}

/// The state after a check, from the newest release found, whether this installation updates
/// itself, the version whose installation already failed once (if any) and the version already
/// downloaded and ready (if any).
///
/// Finding the version that is already `ready` keeps it ready, so a periodic check never throws
/// away a package that was downloaded.
pub fn state_after_check(
    found: Option<Found>,
    support: Support,
    failed_before: Option<&str>,
    ready: Option<&str>,
) -> UpdateState {
    let Some(found) = found else {
        return UpdateState::UpToDate;
    };
    let manual = |reason| UpdateState::Manual {
        version: found.version.clone(),
        reason,
        url: RELEASES_URL.to_owned(),
    };
    match support {
        Support::Manual(reason) => manual(reason),
        Support::Automatic if ready == Some(found.version.as_str()) => UpdateState::Ready {
            version: found.version,
        },
        Support::Automatic if failed_before == Some(found.version.as_str()) => {
            manual(ManualReason::PreviousAttemptFailed)
        }
        Support::Automatic => UpdateState::Available {
            version: found.version,
            notes: found.notes,
        },
    }
}

/// The state after a check that failed. While an update is already announced, downloaded or
/// waiting for a manual install, a failed periodic check changes nothing: the interface keeps
/// offering it instead of switching to an error.
pub fn state_after_failed_check(previous: &UpdateState, error: &UpdaterError) -> UpdateState {
    if previous.shows_checking() {
        UpdateState::Error {
            stage: Stage::Check,
            message: describe_error(error),
        }
    } else {
        previous.clone()
    }
}

/// How an installation failure is shown.
#[derive(Debug, PartialEq)]
pub enum InstallFailure {
    /// Install by hand.
    Manual(ManualReason),
    /// Show the message and allow trying again.
    Retry(String),
}

/// Sorts an installation error into "install by hand" or "try again".
pub fn classify_install_failure(
    format: Option<InstallFormat>,
    error: &UpdaterError,
) -> InstallFailure {
    let elevated = format.is_some_and(InstallFormat::needs_elevation);
    match error {
        UpdaterError::AuthenticationFailed => {
            InstallFailure::Manual(ManualReason::PermissionDenied)
        }
        UpdaterError::Io(io) if io.kind() == std::io::ErrorKind::PermissionDenied => {
            InstallFailure::Manual(ManualReason::PermissionDenied)
        }
        UpdaterError::DebInstallFailed | UpdaterError::PackageInstallFailed if elevated => {
            InstallFailure::Manual(ManualReason::InstallFailed)
        }
        other => InstallFailure::Retry(describe_error(other)),
    }
}

/// A message for people, in Portuguese, for an updater error.
pub fn describe_error(error: &UpdaterError) -> String {
    match error {
        UpdaterError::Reqwest(_) | UpdaterError::Network(_) | UpdaterError::EmptyEndpoints => {
            "Não foi possível falar com o GitHub. Confira a conexão e tente de novo.".to_owned()
        }
        UpdaterError::ReleaseNotFound => {
            "Não foi possível ler as informações da versão publicada. Tente de novo mais tarde."
                .to_owned()
        }
        UpdaterError::TargetNotFound(_) | UpdaterError::TargetsNotFound(_) => {
            "A versão publicada não tem um pacote para esta instalação.".to_owned()
        }
        UpdaterError::Minisign(_)
        | UpdaterError::Base64(_)
        | UpdaterError::SignatureUtf8(_)
        | UpdaterError::SignedVersionMismatch { .. }
        | UpdaterError::MissingSignedVersion => {
            "A assinatura da atualização não confere, então ela não foi instalada.".to_owned()
        }
        UpdaterError::PreviousAppNotRestored(path) => format!(
            "A atualização falhou e o ATUS anterior não pôde ser restaurado. Ele ficou em {}.",
            path.display()
        ),
        other => format!("Não foi possível atualizar: {other}"),
    }
}

/// Limits progress events: one per whole percent, or per 256 KiB when the size is unknown.
#[derive(Default)]
pub struct Throttle {
    last: Option<u64>,
}

impl Throttle {
    /// Whether this progress should be reported.
    pub fn should_emit(&mut self, downloaded: u64, total: Option<u64>) -> bool {
        let step = match total {
            Some(total) if total > 0 => downloaded.saturating_mul(100) / total,
            _ => downloaded / (256 * 1024),
        };
        if self.last == Some(step) {
            return false;
        }
        self.last = Some(step);
        true
    }
}

/// Why a command cannot run in the current state.
fn busy(what: &str) -> String {
    format!("Não é possível {what} agora: há outra etapa da atualização em andamento.")
}

impl UpdateState {
    /// Whether a check should be shown as `checking`. When an update is already announced,
    /// downloaded or waiting for a manual install, a new check runs quietly so that the interface
    /// does not flicker.
    pub fn shows_checking(&self) -> bool {
        !matches!(
            self,
            Self::Available { .. } | Self::Ready { .. } | Self::Manual { .. }
        )
    }

    /// A check may start unless another step is running.
    pub fn check_allowed(&self) -> Result<(), String> {
        match self {
            Self::Checking | Self::Downloading { .. } | Self::Installing { .. } => {
                Err(busy("procurar atualizações"))
            }
            _ => Ok(()),
        }
    }

    /// A download may start from an announced update or after a failed download or installation
    /// (the package is downloaded again, since installing consumed it).
    pub fn download_allowed(&self) -> Result<(), String> {
        match self {
            Self::Available { .. }
            | Self::Error {
                stage: Stage::Download | Stage::Install,
                ..
            } => Ok(()),
            Self::Downloading { .. } | Self::Installing { .. } => Err(busy("baixar")),
            _ => Err("Não há atualização para baixar.".to_owned()),
        }
    }

    /// Installing is only possible once the download finished and was verified.
    pub fn install_allowed(&self) -> Result<String, String> {
        match self {
            Self::Ready { version } => Ok(version.clone()),
            Self::Installing { .. } => Err(busy("instalar")),
            _ => Err("A atualização ainda não foi baixada.".to_owned()),
        }
    }
}

/// An installation that started and has not been confirmed yet.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct InstallAttempt {
    /// Version being installed.
    pub version: String,
    /// Unix time in seconds when it started.
    pub started_at: u64,
}

/// Parses an `M.m.p` version; releases never have a pre-release part.
fn parse_version(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.split('.').map(str::parse::<u64>);
    let version = (
        parts.next()?.ok()?,
        parts.next()?.ok()?,
        parts.next()?.ok()?,
    );
    parts.next().is_none().then_some(version)
}

/// What to do with a recorded attempt once the app starts again as `running`.
#[derive(Debug, PartialEq)]
pub enum Reconciled {
    /// The attempt took effect (or is obsolete): forget it.
    Done,
    /// The recorded version is still not installed.
    Failed { version: String },
}

/// Compares the recorded attempt with the version that is running now.
pub fn reconcile(attempt: &InstallAttempt, running: &str) -> Reconciled {
    match (parse_version(&attempt.version), parse_version(running)) {
        (Some(attempted), Some(running)) if running < attempted => Reconciled::Failed {
            version: attempt.version.clone(),
        },
        _ => Reconciled::Done,
    }
}

fn attempt_path(dir: &Path) -> PathBuf {
    dir.join(ATTEMPT_FILE)
}

/// Records that an installation is starting.
///
/// # Errors
/// Returns the I/O or serialization error.
// The integration-test build never records attempts: it must not write into the real app data.
#[cfg_attr(feature = "desktop-e2e", allow(dead_code))]
pub fn write_attempt(dir: &Path, attempt: &InstallAttempt) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let text = serde_json::to_string(attempt).map_err(|error| error.to_string())?;
    std::fs::write(attempt_path(dir), text).map_err(|error| error.to_string())
}

/// Reads the recorded attempt. A missing or unreadable file means there is none.
pub fn read_attempt(dir: &Path) -> Option<InstallAttempt> {
    serde_json::from_str(&std::fs::read_to_string(attempt_path(dir)).ok()?).ok()
}

/// Forgets the recorded attempt.
pub fn clear_attempt(dir: &Path) {
    let _ = std::fs::remove_file(attempt_path(dir));
}

/// Test-only replacements for the network endpoint and the installation.
#[cfg(feature = "desktop-e2e")]
#[derive(Default)]
pub struct E2eOverrides {
    /// Manifest URL and public key used instead of the ones in `tauri.conf.json`.
    pub endpoint: Mutex<Option<(String, String)>>,
    /// The package that "installing" received.
    pub installed: Mutex<Option<Vec<u8>>>,
}

/// Everything the commands share: the state, the update found and the downloaded package.
pub struct UpdateStore {
    state: Mutex<UpdateState>,
    update: Mutex<Option<Update>>,
    package: Mutex<Option<Vec<u8>>>,
    download: Mutex<Option<JoinHandle<()>>>,
    /// Version whose installation failed in a previous launch.
    failed_before: Mutex<Option<String>>,
    #[cfg(feature = "desktop-e2e")]
    pub e2e: E2eOverrides,
}

impl UpdateStore {
    fn new(failed_before: Option<String>) -> Self {
        Self {
            state: Mutex::new(UpdateState::Idle),
            update: Mutex::new(None),
            package: Mutex::new(None),
            download: Mutex::new(None),
            failed_before: Mutex::new(failed_before),
            #[cfg(feature = "desktop-e2e")]
            e2e: E2eOverrides::default(),
        }
    }

    fn state(&self) -> UpdateState {
        self.state.lock().unwrap().clone()
    }

    /// Forgets everything, so each integration test starts from a clean store.
    #[cfg(feature = "desktop-e2e")]
    pub fn reset(&self) {
        *self.state.lock().unwrap() = UpdateState::Idle;
        *self.update.lock().unwrap() = None;
        *self.package.lock().unwrap() = None;
        *self.failed_before.lock().unwrap() = None;
        *self.e2e.installed.lock().unwrap() = None;
        if let Some(task) = self.download.lock().unwrap().take() {
            task.abort();
        }
    }
}

/// Creates the store and reads what a previous launch left behind.
///
/// Call once, from `setup`. When the previous launch started installing a version that is still
/// not the running one, the next check reports it as [`ManualReason::PreviousAttemptFailed`]
/// instead of offering the same automatic installation again.
pub fn install<R: Runtime>(app: &AppHandle<R>) {
    let dir = app.path().app_data_dir().ok();
    let failed = dir.as_deref().and_then(|dir| {
        let attempt = read_attempt(dir)?;
        clear_attempt(dir);
        match reconcile(&attempt, &app.package_info().version.to_string()) {
            Reconciled::Failed { version } => Some(version),
            Reconciled::Done => None,
        }
    });
    app.manage(UpdateStore::new(failed));
}

fn set_state<R: Runtime>(app: &AppHandle<R>, state: UpdateState) -> UpdateState {
    *app.state::<UpdateStore>().state.lock().unwrap() = state.clone();
    // A window that is closing cannot receive it; the state is still stored for the next one.
    let _ = app.emit(STATE_EVENT, &state);
    state
}

/// The format this binary was installed from, from what the build recorded.
fn current_format() -> Option<InstallFormat> {
    InstallFormat::from_bundle(tauri::utils::platform::bundle_type())
}

/// Whether files can be created next to `file`.
///
/// The plugin replaces an AppImage by moving the running file away and writing a new one in its
/// place, so the directory is what must be writable; opening the running file for writing would
/// fail with "text file busy".
fn sibling_writable(file: &Path) -> bool {
    file.parent().is_some_and(|dir| {
        tempfile::Builder::new()
            .prefix(".atus-update-")
            .tempfile_in(dir)
            .is_ok()
    })
}

/// Whether the running AppImage can be replaced; `None` outside an AppImage.
fn appimage_writable() -> Option<bool> {
    let path = std::env::var_os("APPIMAGE")?;
    Some(sibling_writable(Path::new(&path)))
}

/// The updater for this app, with test overrides applied under `desktop-e2e`.
fn build_updater<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri_plugin_updater::Updater, UpdaterError> {
    let handle = app.clone();
    #[allow(unused_mut)]
    let mut builder = app
        .updater_builder()
        .timeout(REQUEST_TIMEOUT)
        // The Windows installer takes over once the app exits abruptly; drop the tray icon first,
        // or it lingers until the pointer moves over it.
        .on_before_exit(move || crate::background::remove_tray(&handle));
    #[cfg(feature = "desktop-e2e")]
    if let Some((endpoint, pubkey)) = app
        .state::<UpdateStore>()
        .e2e
        .endpoint
        .lock()
        .unwrap()
        .clone()
    {
        builder = builder
            .endpoints(vec![endpoint.parse().map_err(UpdaterError::UrlParse)?])?
            .pubkey(pubkey)
            // The test server is on this computer; a system proxy must not get in the way.
            .no_proxy();
    }
    builder.build()
}

/// Returns the current state without changing anything.
#[tauri::command]
pub fn update_status(store: State<'_, UpdateStore>) -> UpdateState {
    store.state()
}

/// Asks the releases for a newer version and updates the state.
///
/// # Errors
/// Returns a message when another step is running. Failures to reach the releases are reported
/// through the returned state (`Error` with stage `check`), not as an error.
#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    store: State<'_, UpdateStore>,
) -> Result<UpdateState, String> {
    store.state().check_allowed()?;
    let allow_debug = cfg!(feature = "desktop-e2e");
    let support = match check_gate(
        cfg!(debug_assertions),
        allow_debug,
        current_format(),
        appimage_writable(),
    ) {
        Ok(support) => support,
        Err(reason) => return Ok(set_state(&app, UpdateState::Unavailable { reason })),
    };
    let previous = store.state();
    if previous.shows_checking() {
        set_state(&app, UpdateState::Checking);
    }
    let checked = match build_updater(&app) {
        Ok(updater) => updater.check().await,
        Err(error) => Err(error),
    };
    let state = match checked {
        Ok(update) => {
            let found = update.as_ref().map(|update| Found {
                version: update.version.clone(),
                notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
            });
            let failed = store.failed_before.lock().unwrap().clone();
            let ready = match &previous {
                UpdateState::Ready { version } => Some(version.as_str()),
                _ => None,
            };
            let state = state_after_check(found, support, failed.as_deref(), ready);
            // The package that is ready stays; anything else found replaces what was held.
            if !matches!(state, UpdateState::Ready { .. }) {
                *store.update.lock().unwrap() = update;
                *store.package.lock().unwrap() = None;
            }
            state
        }
        Err(error) => state_after_failed_check(&previous, &error),
    };
    // A quiet check that changed nothing sends no event.
    if state == previous {
        return Ok(state);
    }
    Ok(set_state(&app, state))
}

/// Starts downloading the announced update in the background and returns at once; progress and
/// the result arrive through [`STATE_EVENT`].
///
/// # Errors
/// Returns a message when there is no announced update or another step is running.
#[tauri::command]
pub fn update_download(
    app: AppHandle,
    store: State<'_, UpdateStore>,
) -> Result<UpdateState, String> {
    store.state().download_allowed()?;
    let update = store
        .update
        .lock()
        .unwrap()
        .clone()
        .ok_or("Não há atualização para baixar.")?;
    let version = update.version.clone();
    let state = set_state(
        &app,
        UpdateState::Downloading {
            version: version.clone(),
            downloaded: 0,
            total: None,
        },
    );
    let task = tauri::async_runtime::spawn(run_download(app.clone(), update, version));
    *store.download.lock().unwrap() = Some(task);
    Ok(state)
}

async fn run_download<R: Runtime>(app: AppHandle<R>, update: Update, version: String) {
    let progress = app.clone();
    let progress_version = version.clone();
    let mut throttle = Throttle::default();
    let mut downloaded = 0u64;
    let result = update
        .download(
            move |chunk, total| {
                downloaded += chunk as u64;
                if throttle.should_emit(downloaded, total) {
                    set_state(
                        &progress,
                        UpdateState::Downloading {
                            version: progress_version.clone(),
                            downloaded,
                            total,
                        },
                    );
                }
            },
            || {},
        )
        .await;
    let store = app.state::<UpdateStore>();
    match result {
        Ok(bytes) => {
            *store.package.lock().unwrap() = Some(bytes);
            set_state(&app, UpdateState::Ready { version });
        }
        Err(error) => {
            set_state(
                &app,
                UpdateState::Error {
                    stage: Stage::Download,
                    message: describe_error(&error),
                },
            );
        }
    }
}

/// Stops a download in progress and goes back to the announced update.
///
/// # Errors
/// Returns a message when nothing is being downloaded.
#[tauri::command]
pub fn update_cancel_download(
    app: AppHandle,
    store: State<'_, UpdateStore>,
) -> Result<UpdateState, String> {
    let UpdateState::Downloading { version, .. } = store.state() else {
        return Err("Não há download em andamento.".to_owned());
    };
    if let Some(task) = store.download.lock().unwrap().take() {
        task.abort();
    }
    let notes = store
        .update
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|update| update.body.clone())
        .filter(|notes| !notes.trim().is_empty());
    Ok(set_state(&app, UpdateState::Available { version, notes }))
}

/// Installs the downloaded update and restarts the app. **Save the open project first.**
///
/// Returns at once with the `installing` state. On Windows the process ends when the installer
/// starts; on macOS and Linux the app restarts when the installation succeeds. A failure arrives
/// through [`STATE_EVENT`] as `manual` or `error`.
///
/// # Errors
/// Returns a message when the update has not been downloaded and verified.
#[tauri::command]
pub fn update_install(
    app: AppHandle,
    store: State<'_, UpdateStore>,
) -> Result<UpdateState, String> {
    let version = store.state().install_allowed()?;
    let update = store
        .update
        .lock()
        .unwrap()
        .clone()
        .ok_or("A atualização ainda não foi baixada.")?;
    let package = store
        .package
        .lock()
        .unwrap()
        .take()
        .ok_or("A atualização ainda não foi baixada.")?;
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    let dir = app.path().app_data_dir().ok();
    #[cfg(not(feature = "desktop-e2e"))]
    if let Some(dir) = &dir {
        // Without the record a failed installation could not be told apart from a cancelled one.
        write_attempt(
            dir,
            &InstallAttempt {
                version: version.clone(),
                started_at,
            },
        )?;
    }
    let state = set_state(
        &app,
        UpdateState::Installing {
            version: version.clone(),
            started_at,
        },
    );
    tauri::async_runtime::spawn_blocking(move || {
        let result = apply(&app, &update, &package);
        match result {
            Ok(()) => finish_install(&app),
            Err(error) => {
                if let Some(dir) = &dir {
                    clear_attempt(dir);
                }
                let state = match classify_install_failure(current_format(), &error) {
                    InstallFailure::Manual(reason) => UpdateState::Manual {
                        version,
                        reason,
                        url: RELEASES_URL.to_owned(),
                    },
                    InstallFailure::Retry(message) => UpdateState::Error {
                        stage: Stage::Install,
                        message,
                    },
                };
                set_state(&app, state);
            }
        }
    });
    Ok(state)
}

/// Hands the package to the plugin, or records it under the integration tests, which must never
/// replace the binary they run.
fn apply<R: Runtime>(
    app: &AppHandle<R>,
    update: &Update,
    package: &[u8],
) -> Result<(), UpdaterError> {
    #[cfg(feature = "desktop-e2e")]
    {
        update.verify(package)?;
        *app.state::<UpdateStore>().e2e.installed.lock().unwrap() = Some(package.to_vec());
        Ok(())
    }
    #[cfg(not(feature = "desktop-e2e"))]
    {
        let _ = app;
        update.install(package)
    }
}

/// What happens once the installation succeeded: restart on macOS and Linux.
fn finish_install<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(feature = "desktop-e2e")]
    {
        let _ = app;
    }
    #[cfg(not(feature = "desktop-e2e"))]
    {
        // Only reached on macOS and Linux: on Windows the plugin ended the process already.
        app.restart();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(version: &str) -> Option<Found> {
        Some(Found {
            version: version.to_owned(),
            notes: Some("Resumo.".to_owned()),
        })
    }

    #[test]
    fn formats_come_from_the_bundle_the_build_recorded() {
        let cases = [
            (BundleType::App, InstallFormat::App),
            (BundleType::Dmg, InstallFormat::App),
            (BundleType::Nsis, InstallFormat::Nsis),
            (BundleType::Msi, InstallFormat::Msi),
            (BundleType::AppImage, InstallFormat::AppImage),
            (BundleType::Deb, InstallFormat::Deb),
            (BundleType::Rpm, InstallFormat::Rpm),
        ];
        for (bundle, format) in cases {
            assert_eq!(InstallFormat::from_bundle(Some(bundle)), Some(format));
        }
        assert_eq!(InstallFormat::from_bundle(None), None);
    }

    #[test]
    fn only_msi_deb_and_rpm_ask_for_administrator_permission() {
        for format in [InstallFormat::Msi, InstallFormat::Deb, InstallFormat::Rpm] {
            assert!(format.needs_elevation());
        }
        for format in [
            InstallFormat::App,
            InstallFormat::Nsis,
            InstallFormat::AppImage,
        ] {
            assert!(!format.needs_elevation());
        }
    }

    #[test]
    fn debug_and_unmarked_builds_never_update_themselves() {
        use InstallFormat::*;
        assert_eq!(
            check_gate(true, false, Some(App), None),
            Err(UnavailableReason::DevelopmentBuild)
        );
        assert_eq!(
            check_gate(false, false, None, None),
            Err(UnavailableReason::UnknownInstallation)
        );
        assert_eq!(
            check_gate(false, false, Some(Deb), None),
            Ok(Support::Automatic)
        );
        // Integration tests run debug builds with no recorded origin.
        assert_eq!(check_gate(true, true, None, None), Ok(Support::Automatic));
    }

    #[test]
    fn an_appimage_that_cannot_be_replaced_is_updated_by_hand() {
        use InstallFormat::*;
        assert_eq!(
            check_gate(false, false, Some(AppImage), Some(false)),
            Ok(Support::Manual(ManualReason::NotWritable))
        );
        assert_eq!(
            check_gate(false, false, Some(AppImage), Some(true)),
            Ok(Support::Automatic)
        );
        assert_eq!(
            check_gate(false, false, Some(AppImage), None),
            Ok(Support::Automatic)
        );
        // A file that is not an AppImage is not affected by the AppImage check.
        assert_eq!(
            check_gate(false, false, Some(Nsis), Some(false)),
            Ok(Support::Automatic)
        );
    }

    #[test]
    fn an_appimage_can_be_replaced_only_when_its_directory_is_writable() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("ATUS.AppImage");
        std::fs::write(&file, "x").unwrap();
        assert!(sibling_writable(&file));
        // The probe file does not stay behind.
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
        assert!(!sibling_writable(
            &dir.path().join("missing").join("ATUS.AppImage")
        ));
        assert!(!sibling_writable(Path::new("/")));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o555)).unwrap();
            // An administrator can write anywhere, so there is nothing to assert for one.
            let administrator = tempfile::Builder::new().tempfile_in(dir.path()).is_ok();
            assert_eq!(sibling_writable(&file), administrator);
            std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    #[test]
    fn the_check_result_decides_the_state() {
        assert_eq!(
            state_after_check(None, Support::Automatic, None, None),
            UpdateState::UpToDate
        );
        assert_eq!(
            state_after_check(found("0.3.0"), Support::Automatic, None, None),
            UpdateState::Available {
                version: "0.3.0".to_owned(),
                notes: Some("Resumo.".to_owned())
            }
        );
        let manual = |reason| UpdateState::Manual {
            version: "0.3.0".to_owned(),
            reason,
            url: RELEASES_URL.to_owned(),
        };
        assert_eq!(
            state_after_check(
                found("0.3.0"),
                Support::Manual(ManualReason::NotWritable),
                None,
                None
            ),
            manual(ManualReason::NotWritable)
        );
        // The version that already failed to install is not offered again automatically...
        assert_eq!(
            state_after_check(found("0.3.0"), Support::Automatic, Some("0.3.0"), None),
            manual(ManualReason::PreviousAttemptFailed)
        );
        // ...but a newer one is.
        assert!(matches!(
            state_after_check(found("0.3.1"), Support::Automatic, Some("0.3.0"), None),
            UpdateState::Available { .. }
        ));
    }

    #[test]
    fn a_check_keeps_the_version_that_is_already_downloaded() {
        let ready = |version: &str| UpdateState::Ready {
            version: version.to_owned(),
        };
        // The same version stays ready, so the package is not thrown away...
        assert_eq!(
            state_after_check(found("0.3.0"), Support::Automatic, None, Some("0.3.0")),
            ready("0.3.0")
        );
        // ...a newer one replaces it...
        assert!(matches!(
            state_after_check(found("0.3.1"), Support::Automatic, None, Some("0.3.0")),
            UpdateState::Available { .. }
        ));
        // ...and nothing newer than the running version means there is nothing to install.
        assert_eq!(
            state_after_check(None, Support::Automatic, None, Some("0.3.0")),
            UpdateState::UpToDate
        );
    }

    #[test]
    fn a_failed_check_changes_nothing_while_an_update_is_already_offered() {
        let error = UpdaterError::Network("x".to_owned());
        let offered = [
            UpdateState::Available {
                version: "0.3.0".to_owned(),
                notes: None,
            },
            UpdateState::Ready {
                version: "0.3.0".to_owned(),
            },
            UpdateState::Manual {
                version: "0.3.0".to_owned(),
                reason: ManualReason::NotWritable,
                url: RELEASES_URL.to_owned(),
            },
        ];
        for state in offered {
            assert!(!state.shows_checking(), "{state:?}");
            assert_eq!(state_after_failed_check(&state, &error), state);
        }
        for state in [UpdateState::Idle, UpdateState::UpToDate] {
            assert!(state.shows_checking(), "{state:?}");
            assert!(matches!(
                state_after_failed_check(&state, &error),
                UpdateState::Error {
                    stage: Stage::Check,
                    ..
                }
            ));
        }
    }

    #[test]
    fn installation_failures_are_manual_or_retryable() {
        use InstallFormat::*;
        let denied = InstallFailure::Manual(ManualReason::PermissionDenied);
        assert_eq!(
            classify_install_failure(Some(Deb), &UpdaterError::AuthenticationFailed),
            denied
        );
        let io = UpdaterError::Io(std::io::Error::from(std::io::ErrorKind::PermissionDenied));
        assert_eq!(classify_install_failure(Some(App), &io), denied);
        assert_eq!(
            classify_install_failure(Some(Rpm), &UpdaterError::PackageInstallFailed),
            InstallFailure::Manual(ManualReason::InstallFailed)
        );
        assert_eq!(
            classify_install_failure(Some(Deb), &UpdaterError::DebInstallFailed),
            InstallFailure::Manual(ManualReason::InstallFailed)
        );
        // The same package failure on a format that never asks for permission is worth retrying.
        assert!(matches!(
            classify_install_failure(Some(AppImage), &UpdaterError::PackageInstallFailed),
            InstallFailure::Retry(_)
        ));
        assert!(matches!(
            classify_install_failure(None, &UpdaterError::BinaryNotFoundInArchive),
            InstallFailure::Retry(_)
        ));
    }

    #[test]
    fn error_messages_are_clear_and_in_portuguese() {
        let network = describe_error(&UpdaterError::Network("timeout".to_owned()));
        assert!(network.contains("conexão"), "{network}");
        assert_eq!(describe_error(&UpdaterError::EmptyEndpoints), network);
        assert!(describe_error(&UpdaterError::ReleaseNotFound).contains("informações"));
        assert!(describe_error(&UpdaterError::TargetNotFound("x".to_owned())).contains("pacote"));
        assert!(describe_error(&UpdaterError::MissingSignedVersion).contains("assinatura"));
        let signature = describe_error(&UpdaterError::SignedVersionMismatch {
            announced: "0.3.0".to_owned(),
            signed: "0.2.0".to_owned(),
        });
        assert!(signature.contains("não foi instalada"), "{signature}");
        let lost = describe_error(&UpdaterError::PreviousAppNotRestored(PathBuf::from(
            "/tmp/atus",
        )));
        assert!(lost.contains("/tmp/atus"), "{lost}");
        let other = describe_error(&UpdaterError::BinaryNotFoundInArchive);
        assert!(other.starts_with("Não foi possível atualizar"), "{other}");
    }

    #[test]
    fn progress_is_reported_once_per_percent() {
        let mut throttle = Throttle::default();
        assert!(throttle.should_emit(1, Some(1000)));
        assert!(!throttle.should_emit(9, Some(1000)));
        assert!(throttle.should_emit(10, Some(1000)));
        assert!(!throttle.should_emit(19, Some(1000)));
        assert!(throttle.should_emit(1000, Some(1000)));
        // Unknown or empty totals fall back to 256 KiB steps.
        let mut unknown = Throttle::default();
        assert!(unknown.should_emit(0, None));
        assert!(!unknown.should_emit(256 * 1024 - 1, None));
        assert!(unknown.should_emit(256 * 1024, None));
        assert!(Throttle::default().should_emit(5, Some(0)));
    }

    #[test]
    fn each_command_is_only_allowed_in_the_right_state() {
        let available = UpdateState::Available {
            version: "0.3.0".to_owned(),
            notes: None,
        };
        let downloading = UpdateState::Downloading {
            version: "0.3.0".to_owned(),
            downloaded: 1,
            total: None,
        };
        let ready = UpdateState::Ready {
            version: "0.3.0".to_owned(),
        };
        let installing = UpdateState::Installing {
            version: "0.3.0".to_owned(),
            started_at: 1,
        };
        let failed = |stage| UpdateState::Error {
            stage,
            message: "x".to_owned(),
        };
        for idle in [
            UpdateState::Idle,
            UpdateState::UpToDate,
            available.clone(),
            ready.clone(),
            failed(Stage::Check),
        ] {
            assert!(idle.check_allowed().is_ok(), "{idle:?}");
        }
        for running in [
            UpdateState::Checking,
            downloading.clone(),
            installing.clone(),
        ] {
            assert!(running
                .check_allowed()
                .unwrap_err()
                .contains("em andamento"));
        }
        assert!(available.download_allowed().is_ok());
        assert!(failed(Stage::Download).download_allowed().is_ok());
        // Installing consumed the package, so a failed installation downloads it again.
        assert!(failed(Stage::Install).download_allowed().is_ok());
        assert!(downloading
            .download_allowed()
            .unwrap_err()
            .contains("em andamento"));
        assert!(installing
            .download_allowed()
            .unwrap_err()
            .contains("em andamento"));
        for other in [UpdateState::Idle, ready.clone(), failed(Stage::Check)] {
            assert_eq!(
                other.download_allowed().unwrap_err(),
                "Não há atualização para baixar."
            );
        }
        assert_eq!(ready.install_allowed(), Ok("0.3.0".to_owned()));
        assert!(installing
            .install_allowed()
            .unwrap_err()
            .contains("em andamento"));
        for other in [UpdateState::Idle, available, downloading] {
            assert_eq!(
                other.install_allowed().unwrap_err(),
                "A atualização ainda não foi baixada."
            );
        }
    }

    #[test]
    fn the_state_serializes_as_the_frontend_contract() {
        let json = |state: &UpdateState| serde_json::to_value(state).unwrap();
        assert_eq!(
            json(&UpdateState::Idle),
            serde_json::json!({ "kind": "idle" })
        );
        assert_eq!(
            json(&UpdateState::Unavailable {
                reason: UnavailableReason::DevelopmentBuild
            }),
            serde_json::json!({ "kind": "unavailable", "reason": "developmentBuild" })
        );
        assert_eq!(
            json(&UpdateState::Downloading {
                version: "0.3.0".to_owned(),
                downloaded: 5,
                total: None
            }),
            serde_json::json!({ "kind": "downloading", "version": "0.3.0", "downloaded": 5, "total": null })
        );
        assert_eq!(
            json(&UpdateState::Installing {
                version: "0.3.0".to_owned(),
                started_at: 9
            }),
            serde_json::json!({ "kind": "installing", "version": "0.3.0", "startedAt": 9 })
        );
        assert_eq!(
            json(&UpdateState::Manual {
                version: "0.3.0".to_owned(),
                reason: ManualReason::PreviousAttemptFailed,
                url: RELEASES_URL.to_owned()
            }),
            serde_json::json!({ "kind": "manual", "version": "0.3.0", "reason": "previousAttemptFailed", "url": RELEASES_URL })
        );
        assert_eq!(
            json(&UpdateState::Error {
                stage: Stage::Install,
                message: "x".to_owned()
            }),
            serde_json::json!({ "kind": "error", "stage": "install", "message": "x" })
        );
        assert_eq!(
            json(&UpdateState::Checking),
            serde_json::json!({ "kind": "checking" })
        );
        assert_eq!(
            json(&UpdateState::UpToDate),
            serde_json::json!({ "kind": "upToDate" })
        );
    }

    #[test]
    fn an_attempt_is_a_failure_only_while_the_version_is_still_older() {
        let attempt = InstallAttempt {
            version: "0.10.0".to_owned(),
            started_at: 1,
        };
        assert_eq!(
            reconcile(&attempt, "0.9.9"),
            Reconciled::Failed {
                version: "0.10.0".to_owned()
            }
        );
        assert_eq!(reconcile(&attempt, "0.10.0"), Reconciled::Done);
        assert_eq!(reconcile(&attempt, "0.11.0"), Reconciled::Done);
        // A record the app cannot understand never blocks updates.
        let odd = InstallAttempt {
            version: "0.10.0-rc.1".to_owned(),
            started_at: 1,
        };
        assert_eq!(reconcile(&odd, "0.9.9"), Reconciled::Done);
        assert_eq!(reconcile(&attempt, "dev"), Reconciled::Done);
        assert_eq!(parse_version("1.2"), None);
        assert_eq!(parse_version("1.2.3.4"), None);
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
    }

    #[test]
    fn the_attempt_record_survives_a_round_trip_and_ignores_garbage() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("nested");
        assert_eq!(read_attempt(&nested), None);
        let attempt = InstallAttempt {
            version: "0.3.0".to_owned(),
            started_at: 42,
        };
        write_attempt(&nested, &attempt).unwrap();
        assert_eq!(read_attempt(&nested), Some(attempt));
        clear_attempt(&nested);
        assert_eq!(read_attempt(&nested), None);
        clear_attempt(&nested);
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(nested.join(ATTEMPT_FILE), "not json").unwrap();
        assert_eq!(read_attempt(&nested), None);
        // A path that cannot be a directory is reported, not ignored.
        let file = dir.path().join("file");
        std::fs::write(&file, "").unwrap();
        assert!(write_attempt(
            &file.join("inside"),
            &InstallAttempt {
                version: "0.3.0".to_owned(),
                started_at: 1
            }
        )
        .is_err());
    }
}
