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
