//! `tka-assets` URI scheme: serves the offline asset bundle from the app's
//! resource directory.
//!
//! The desktop build ships every 3D scene, character, texture, decoder runtime
//! and animation the product loads at runtime under `<resources>/assets/`.
//! The frontend rewrites asset URLs (see `desktop-asset-url.ts`) to
//! `https://tka-assets.localhost/<path>` on Windows and
//! `tka-assets://localhost/<path>` on macOS, and this handler answers them
//! straight from disk. No network is involved at any point.

use std::borrow::Cow;
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime, UriSchemeContext};

pub const SCHEME: &str = "tka-assets";
const BUNDLE_DIRECTORY: &str = "assets";

fn respond(status: StatusCode, body: Cow<'static, [u8]>, content_type: &str) -> Response<Cow<'static, [u8]>> {
    let length = body.len();
    respond_with_length(status, body, content_type, length)
}

/// A HEAD response carries the real file size while sending no body.
fn respond_with_length(
    status: StatusCode,
    body: Cow<'static, [u8]>,
    content_type: &str,
    content_length: usize,
) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, content_length)
        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
        .body(body)
        .expect("static response headers are valid")
}

/// Turn a request path into a bundle-relative path, rejecting anything that
/// tries to climb out of the bundle directory.
fn bundle_relative_path(request_path: &str) -> Option<PathBuf> {
    let decoded = percent_encoding::percent_decode_str(request_path)
        .decode_utf8()
        .ok()?;
    let trimmed = decoded.trim_start_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    let mut relative = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(part) => relative.push(part),
            _ => return None,
        }
    }
    Some(relative)
}

fn bundle_root<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().resource_dir().ok().map(|dir| dir.join(BUNDLE_DIRECTORY))
}

pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Cow<'static, [u8]>> {
    if request.method() == tauri::http::Method::OPTIONS {
        return respond(StatusCode::NO_CONTENT, Cow::Borrowed(&[]), "text/plain");
    }

    let Some(relative) = bundle_relative_path(request.uri().path()) else {
        return respond(StatusCode::BAD_REQUEST, Cow::Borrowed(b"bad path"), "text/plain");
    };
    let Some(root) = bundle_root(ctx.app_handle()) else {
        return respond(
            StatusCode::INTERNAL_SERVER_ERROR,
            Cow::Borrowed(b"resource directory unavailable"),
            "text/plain",
        );
    };

    let file_path = root.join(&relative);
    match fs::read(&file_path) {
        Ok(bytes) => {
            let mime = mime_guess::from_path(&file_path)
                .first_raw()
                .unwrap_or("application/octet-stream");
            let length = bytes.len();
            let body = if request.method() == tauri::http::Method::HEAD {
                Cow::Borrowed(&[][..])
            } else {
                Cow::Owned(bytes)
            };
            respond_with_length(StatusCode::OK, body, mime, length)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            respond(StatusCode::NOT_FOUND, Cow::Borrowed(b"not bundled"), "text/plain")
        }
        Err(_) => respond(
            StatusCode::INTERNAL_SERVER_ERROR,
            Cow::Borrowed(b"read failed"),
            "text/plain",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::bundle_relative_path;
    use std::path::PathBuf;

    #[test]
    fn decodes_and_normalizes_bundle_paths() {
        assert_eq!(
            bundle_relative_path("/models/forest/forest%20a.glb"),
            Some(PathBuf::from("models/forest/forest a.glb"))
        );
        assert_eq!(
            bundle_relative_path("r2/models/x.glb.bin"),
            Some(PathBuf::from("r2/models/x.glb.bin"))
        );
    }

    #[test]
    fn rejects_traversal_and_empty_paths() {
        assert_eq!(bundle_relative_path("/../secrets"), None);
        assert_eq!(bundle_relative_path("/models/../../x"), None);
        assert_eq!(bundle_relative_path("/"), None);
        assert_eq!(bundle_relative_path(""), None);
    }
}
