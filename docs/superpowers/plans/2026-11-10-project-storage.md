# Project Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create portable versioned `.atus` SQLite projects with reliable automatic and manual saving, opening, saving as, and a unified recent-project list.

**Architecture:** Rust owns file access, SQLite transactions, migration, locking and the recent index; React owns the editable project snapshot and coordinates serialized saves through Tauri commands. Each file is self-contained; the local recent index is disposable. SQLite schema version and application format identification are checked before a file is changed.

**Tech Stack:** Tauri 2, Rust, bundled `rusqlite`, `serde`/`serde_json`, React/TypeScript, Tauri dialog and path APIs, Vitest for frontend behavior, Cargo tests.

**Spec:** `docs/superpowers/specs/2026-11-10-project-storage-design.md`

## Global Constraints

- UI text is Portuguese; identifiers, paths and code are English. Support macOS and Windows.
- The mock fit remains explicitly simulated; no scientific computation is introduced.
- Never replace the active session until opening succeeds; never silently overwrite, migrate, or discard unsaved work.
- Legacy JSON import, histogram, multiplot and the real scientific engine are separate work.
- Backup location beside the project is provisional: confirm it before implementing migrations if the user objects; keep unique backups and do not overwrite them.
- Use a single portable `.atus` after close; do not depend on a WAL or uncheckpointed sidecars to copy it.

## Review Focus

- Incomplete equation, parameter or table drafts survive closing and reopening; test in Task 2 and Task 6.
- Old save finishing after an edit cannot mark the new edit saved; test in Task 5.
- A future version or unrelated SQLite file is inspected without mutation; test in Task 1.
- `Save As` fails or destination exists: preserve current session and original, request overwrite confirmation; test in Task 3.
- Two instances or an external change cannot silently overwrite one another; test in Task 3.

## File structure and contract

- `src/desktop/src/project/` owns storage (`store.rs`), migrations (`migrations.rs`), lifecycle and locking (`session.rs`), recent discovery (`recent.rs`), and serializable types (`model.rs`); register commands in `src/desktop/src/main.rs`.
- `src/frontend/src/features/projects/` owns the Tauri client, project state/save coordinator and recent list; adapt `App.tsx`, `AnalysisPage.tsx`, and chart/fit state to a serializable snapshot.
- Rust and TypeScript share a documented JSON snapshot contract, versioned independently of SQLite schema. Initial snapshot contains project id/name; ordered analyses with selected series; each series has its ID, name, ordered points with optional sx/sy, visual settings, fit input strings/options and optional mock result/curve; chart settings and recoverable raw table draft. Do not serialize React setters, DOM, transient errors or focus. Keep the source revision on a saved result so edits mark it stale.
- SQLite v1: `project(id, name, created_at, updated_at)`, `analyses(id, project_id, position, kind, state_json)`, `datasets(id, analysis_id, position, name, state_json)`, `data_points(dataset_id, position, x, y, sx, sy)`. `state_json` holds domain-versioned visual/fit settings and recoverable drafts; point and series order is explicit. Define foreign keys and integrity constraints; use a fixed SQLite `application_id` reserved for ATUS and `user_version` for schema version. Store times in UTC ISO 8601. Snapshot JSON and schema details must be recorded in a new ADR before implementation is considered complete.

### Task 1: SQLite format and migration foundation

**Files:** Create `src/desktop/src/project/{mod.rs,model.rs,store.rs,migrations.rs}` and tests in the same module; modify `src/desktop/Cargo.toml` and `src/desktop/src/main.rs`.

**Interfaces:** `ProjectSnapshot` is the snapshot above; `create_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError>`, `read_project(path: &Path) -> Result<ProjectSnapshot, ProjectError>`, and `write_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError>`. Migration runner takes a path and expected target version.

- [ ] Write Cargo tests for an empty project and multiple ordered series with uncertainty `None` versus `Some(0.0)`; assert exact snapshot equality after reopening. Include fit draft text and mock marker.
- [ ] Run `cargo test --manifest-path src/desktop/Cargo.toml project` and verify the tests fail for missing implementation.
- [ ] Implement schema v1, bundled SQLite, foreign keys, format ID and transactional snapshot read/write. Open existing files without create flags; reject unknown format, corruption and future versions without changing them.
- [ ] Add tests with a test-only old-schema fixture and a failing migration: check ordered upgrades, uniquely named side-by-side backup, unchanged source on failure, integrity validation and idempotent reopening. No production v0-to-v1 migration is claimed until a real older `.atus` format exists.
- [ ] Implement migration registry, safe SQLite backup to a temporary copy and validated replacement; preserve the original if any step fails. Use rollback journal or a verified checkpoint/close strategy for portable files.
- [ ] Run `cargo test --manifest-path src/desktop/Cargo.toml project` and verify all project tests pass.

### Task 2: Serializable analysis snapshot

**Files:** Create `src/frontend/src/features/projects/project-model.ts` and tests under `src/frontend/tests/unit/`; modify `AnalysisPage.tsx`, `useChartSettings.ts`, and fit components as required; add Vitest and a test script in `package.json`.

**Interfaces:** `ProjectSnapshot`, `createEmptyProject(): ProjectSnapshot`, and `toAnalysisState(snapshot: ProjectSnapshot)` / `fromAnalysisState(state): ProjectSnapshot`, with exact fields matching Task 1. Supply pure state objects and callbacks instead of serializing hook return values.

- [ ] Write a round-trip test with two series, nonzero and absent uncertainties, chart configuration, an unfinished table draft, invalid equation text and a mock result. Assert every persisted field and the mock marker are unchanged, and an edit invalidates the result revision.
- [ ] Run the new focused Vitest command and confirm failure before implementation.
- [ ] Extract serializable state from scattered React hooks, preserving user-visible behavior and draft text. Create a blank analysis by default and keep the project state independent of transient UI state.
- [ ] Run focused Vitest, `npm run build`, and `npm run lint` from `src/frontend`; all must pass.

### Task 3: Native project lifecycle and conflict protection

**Files:** Create `src/desktop/src/project/session.rs`; modify `src/desktop/src/main.rs`, Tauri capabilities and dependencies; create frontend `features/projects/project-client.ts`.

**Interfaces:** Tauri commands `create_project`, `open_project`, `save_project`, `save_project_as`, `close_project` return typed success/error results; the session contains current canonical path, project ID and revision token. Use native dialogs for open/save selection and OS Documentos resolution.

- [ ] Add Cargo tests for atomic unique creation, read-only/corrupt/future files, write failure, existing Save As target and failed copy. Verify original bytes and active session survive every failure.
- [ ] Add tests using two independent sessions and an externally modified file. The second save must return a conflict and preserve both the file on disk and unsaved snapshot. Lock ownership and disk revision/fingerprint must both be checked; explain unsupported filesystem locking failures to the user rather than proceeding without protection.
- [ ] Implement exclusive creation, advisory project lock, on-disk revision validation, serialized native writes and safe Save As via a verified temporary file in the destination directory. Acquire the new session only after successful copy; do not overwrite an existing destination without explicit confirmation.
- [ ] Expose commands and dialogs with narrowly scoped capabilities. Verify paths use the platform Documents directory, and errors are structured for Portuguese actionable messages.
- [ ] Run `cargo test --manifest-path src/desktop/Cargo.toml` and frontend build; verify all pass.

### Task 4: Discovery and recent projects

**Files:** Create `src/desktop/src/project/recent.rs`, `src/frontend/src/features/projects/RecentProjects.tsx`; modify `App.tsx` and native command registration.

**Interfaces:** `list_projects() -> ProjectList { entries, warnings }`; `record_recent(path)`, `remove_recent(path)` and `locate_recent(old_path, new_path)` update an atomic local index in the app data directory. Each entry contains path, display name, availability and optional last access.

- [ ] Write tests with a temporary Documents directory and index: combine direct `.atus` files with external recent entries, deduplicate equivalent paths, sort recents descending followed by discovered entries in deterministic name/path order, and keep missing external entries.
- [ ] Test corrupt index recovery, unavailable/default directory, removed recent still present in the default folder, and locating an invalid file without changing the index.
- [ ] Implement discovery without mutating candidates, canonicalize existing paths according to platform and normalize missing paths conservatively; report read failures without blocking manual open. Record successful open and Save As only.
- [ ] Implement the unified home list with accessible open, locate and remove actions, unavailable state, loading and error messages; removing from recents never deletes a project file.
- [ ] Run Cargo tests and focused frontend tests, then build and lint.

### Task 5: Save coordinator and lifecycle

**Files:** Create `src/frontend/src/features/projects/save-coordinator.ts` and focused tests; integrate with `App.tsx` and `AnalysisPage.tsx`.

**Interfaces:** coordinator `update(snapshot)`, `saveNow(): Promise<SaveResult>`, `flush(): Promise<SaveResult>` and `dispose()`; track monotonic in-memory revisions and expose `pending | saving | saved | error`. Debounce edits by 500 ms; a manual save bypasses debounce.

- [ ] With fake timers and deferred save promises, test batching, manual save, editing during an in-flight save, failure/retry and `flush`; older success must not mark a newer revision saved.
- [ ] Implement one in-flight save per session, queue latest snapshot, and retain pending data on errors. Show accessible Portuguese status and actionable retry, Save As and conflict messages.
- [ ] Intercept navigation, new/open project, window close and app exit. Await `flush`; on failure offer retry, Save As, explicit discard or cancel. Only discard after explicit selection.
- [ ] Run focused tests and build. Exercise window-close behavior in a packaged desktop app on both supported platforms; record results and any platform limitations.

### Task 6: End-to-end verification and documentation

**Files:** Create integration fixtures/tests under `src/desktop/tests/` and `src/frontend/tests/integration/`; modify `AGENTS.md`, `README.md`; add `docs/decisions/0003-project-storage.md`.

**Interfaces:** Use Tasks 1–5 APIs; document exact schema, application ID, snapshot version, migration policy, backup naming and conflict behavior in the ADR.

- [ ] Add an integration fixture covering create → edit → autosave/manual save → close → reopen with imported series, chart settings, unfinished drafts and simulated results. Assert no dependency on original imported file.
- [ ] Add interruption/failure tests where feasible with controlled fault injection, checking SQLite integrity and last committed snapshot. Verify future/corrupt inputs leave active session unchanged.
- [ ] Document migrations, supported recovery actions and backup location; update AGENTS.md with actual structure and behavior, clearly distinguishing mock results and legacy import pending.
- [ ] Run `cargo test --manifest-path src/desktop/Cargo.toml`, `npm run test`, `npm run build`, `npm run lint`, and `npm run format:check` from the relevant directories. Record results and manually exercise creation, file dialogs, recovery, recent entries and window close on macOS and Windows. Do not claim platform coverage for an environment not tested.
