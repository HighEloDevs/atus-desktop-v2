//! Chart image export commands.
//!
//! The webview cannot write files itself (`<a download>` does nothing in WKWebView), so the
//! frontend asks the user for a path with the dialog plugin and sends the encoded bytes here.

use std::path::Path;
use tauri::ipc::{InvokeBody, Request};

const PNG_MAGIC: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
const JPEG_MAGIC: &[u8] = &[0xFF, 0xD8, 0xFF];

/// Checks that `path` has an image extension and that `bytes` match that format.
///
/// The command only ever writes PNG or JPEG data, so a compromised webview cannot use it to
/// create arbitrary files.
///
/// # Errors
/// Returns a Portuguese message when the extension is not `png`/`jpg`/`jpeg`, or when the
/// content does not start with the signature of the format the extension announces.
pub(crate) fn validate_image(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase);
    let magic = match extension.as_deref() {
        Some("png") => PNG_MAGIC,
        Some("jpg" | "jpeg") => JPEG_MAGIC,
        _ => return Err("Escolha um arquivo com extensão .png, .jpg ou .jpeg.".into()),
    };
    if bytes.starts_with(magic) {
        Ok(())
    } else {
        Err("O conteúdo não corresponde ao formato da extensão escolhida.".into())
    }
}

/// Writes an encoded image to `path`, replacing any existing file.
///
/// # Errors
/// Returns a Portuguese message when validation fails or the file cannot be written.
pub(crate) fn write_image_to(path: &Path, bytes: &[u8]) -> Result<(), String> {
    validate_image(path, bytes)?;
    std::fs::write(path, bytes).map_err(|e| format!("Não foi possível gravar o arquivo: {e}"))
}

/// Saves a chart image chosen by the user.
///
/// The request body carries the raw image bytes (avoiding JSON-encoding a large array) and the
/// `path` header carries the destination, percent-encoded with `encodeURIComponent`.
#[tauri::command]
pub async fn export_image_write(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Dados da imagem ausentes.".into());
    };
    let encoded = request
        .headers()
        .get("path")
        .and_then(|value| value.to_str().ok())
        .ok_or("Caminho do arquivo ausente.")?;
    let path = percent_decode(encoded)?;
    write_image_to(Path::new(&path), bytes)
}

fn percent_decode(value: &str) -> Result<String, String> {
    let raw = value.as_bytes();
    let mut out = Vec::with_capacity(raw.len());
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' {
            let hex = raw
                .get(i + 1..i + 3)
                .and_then(|pair| std::str::from_utf8(pair).ok())
                .and_then(|pair| u8::from_str_radix(pair, 16).ok())
                .ok_or("Caminho do arquivo inválido.")?;
            out.push(hex);
            i += 3;
        } else {
            out.push(raw[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| "Caminho do arquivo inválido.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_png_and_jpeg_with_matching_signatures() {
        let directory = tempfile::tempdir().unwrap();
        let png = directory.path().join("grafico.PNG");
        let jpg = directory.path().join("grafico.jpeg");
        write_image_to(&png, &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 1]).unwrap();
        write_image_to(&jpg, &[0xFF, 0xD8, 0xFF, 0xE0]).unwrap();
        assert_eq!(std::fs::read(&jpg).unwrap(), [0xFF, 0xD8, 0xFF, 0xE0]);
        assert!(png.exists());
    }

    #[test]
    fn rejects_other_extensions_and_mismatched_content() {
        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("run.sh");
        let fake = directory.path().join("fake.png");
        assert!(
            write_image_to(&script, &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]).is_err()
        );
        assert!(write_image_to(&fake, b"not an image").is_err());
        assert!(!script.exists() && !fake.exists());
    }

    #[test]
    fn reports_unwritable_destinations() {
        let directory = tempfile::tempdir().unwrap();
        let missing = directory.path().join("missing").join("grafico.jpg");
        let error = write_image_to(&missing, &[0xFF, 0xD8, 0xFF]).unwrap_err();
        assert!(error.starts_with("Não foi possível gravar"));
    }

    #[test]
    fn decodes_percent_encoded_paths() {
        assert_eq!(
            percent_decode("%2FUsers%2Fana%2FMeus%20gr%C3%A1ficos%2Fa.png").unwrap(),
            "/Users/ana/Meus gráficos/a.png"
        );
        assert!(percent_decode("%zz").is_err());
        assert!(percent_decode("%C3").is_err());
    }
}
