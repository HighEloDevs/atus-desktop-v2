//! Versioned SQLite schema migrations.

use super::store::{ProjectError, APPLICATION_ID, SCHEMA_VERSION};
use rusqlite::{Connection, OpenFlags, TransactionBehavior};
use std::path::Path;

pub(super) const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial.sql");
const VERSION_2: &str = include_str!("../../migrations/0002_index_analysis_kind.sql");

pub(super) fn initialize(connection: &Connection) -> Result<(), ProjectError> {
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.execute_batch(INITIAL_SCHEMA)?;
    connection.execute_batch(VERSION_2)?;
    Ok(())
}

/// Migrates a supported project at path to the current schema, creating a backup for v1.
/// Returns an error for incompatible files or failed backup, migration, or validation.
pub fn migrate(path: &Path) -> Result<(), ProjectError> {
    let probe = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let id: i32 = probe.pragma_query_value(None, "application_id", |row| row.get(0))?;
    let version: i32 = probe.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if id != APPLICATION_ID {
        return Err("Este arquivo não é um projeto ATUS".into());
    }
    if version == SCHEMA_VERSION {
        return Ok(());
    }
    if version != 1 {
        return Err("Versão do projeto incompatível com este ATUS".into());
    }
    drop(probe);

    let mut connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let version: i32 = tx.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version == SCHEMA_VERSION {
        return Ok(());
    }
    if version != 1 {
        return Err("Versão do projeto incompatível com este ATUS".into());
    }
    let backup = tempfile::Builder::new()
        .prefix(&format!(
            "{}.backup-v1-",
            path.file_name().unwrap_or_default().to_string_lossy()
        ))
        .tempfile_in(path.parent().ok_or("Pasta do projeto indisponível")?)?;
    let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut destination = Connection::open(backup.path())?;
    {
        let copy = rusqlite::backup::Backup::new(&source, &mut destination)?;
        copy.run_to_completion(128, std::time::Duration::from_millis(10), None)?;
    }
    drop(destination);
    backup.as_file().sync_all()?;
    backup.keep()?;
    tx.execute_batch(VERSION_2)?;
    let integrity: String = tx.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err("Falha ao validar a migração do projeto".into());
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::store::{create_project, read_project};
    use crate::project::test_support::empty_project;

    #[test]
    fn migration_backs_up_v1_and_preserves_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        let snapshot = empty_project();
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection.execute_batch(INITIAL_SCHEMA).unwrap();
        connection
            .execute(
                "INSERT INTO project VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    snapshot.id,
                    snapshot.name,
                    snapshot.created_at,
                    snapshot.updated_at
                ],
            )
            .unwrap();
        drop(connection);
        migrate(&path).unwrap();
        migrate(&path).unwrap();
        assert_eq!(read_project(&path).unwrap(), snapshot);
        let backups: Vec<_> = std::fs::read_dir(directory.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("project.atus.backup-v1-")
            })
            .collect();
        assert_eq!(backups.len(), 1);
        let backup = rusqlite::Connection::open(backups[0].path()).unwrap();
        let version: i32 = backup
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn future_and_failed_migrations_preserve_original() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("project.atus");
        create_project(&path, &empty_project()).unwrap();
        for version in [99, 1] {
            let connection = rusqlite::Connection::open(&path).unwrap();
            connection
                .pragma_update(None, "user_version", version)
                .unwrap();
            drop(connection);
            let original = std::fs::read(&path).unwrap();
            // At v1 the conflicting index makes the migration fail after the backup.
            assert!(migrate(&path).is_err());
            assert_eq!(std::fs::read(&path).unwrap(), original);
        }
    }

    #[test]
    fn migration_rejects_unrelated_sqlite_without_altering_it() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("other.atus");
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('preserve');",
        )
        .unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        let error = migrate(&path).unwrap_err().to_string();
        assert!(error.contains("não é um projeto ATUS"));
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
}
