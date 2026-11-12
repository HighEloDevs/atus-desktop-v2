use super::*;

/// Replaces project contents in a transaction.
/// Returns an error for invalid data, incompatible files, or failed writes.
pub fn write_project(path: &Path, snapshot: &ProjectSnapshot) -> Result<(), ProjectError> {
    validate_snapshot(snapshot)?;
    let mut conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    validate(&conn)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    save(&mut conn, snapshot)
}
