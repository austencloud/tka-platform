use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

const LANDING_HTML: &str = r##"<!DOCTYPE html>
<html><head><title>Flow Arts Composer</title>
<style>
body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
.card{text-align:center;padding:2rem;border-radius:12px;background:#16213e;box-shadow:0 4px 20px rgba(0,0,0,.3)}
h1{color:#4ecca3;margin-bottom:.5rem}
p{color:#a0a0a0}
.spinner{width:40px;height:40px;margin:0 auto 1rem;border:3px solid #2a2a4a;border-top-color:#4ecca3;border-radius:50%;animation:spin .8s linear infinite}
.done{border-color:#4ecca3;animation:none}
.done::after{content:'\2713';display:flex;align-items:center;justify-content:center;height:100%;color:#4ecca3;font-size:1.5rem}
.fail{border-color:#e74c3c;animation:none}
.fail::after{content:'\2717';display:flex;align-items:center;justify-content:center;height:100%;color:#e74c3c;font-size:1.5rem}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
</style></head>
<body><div class="card">
<div class="spinner" id="icon"></div>
<h1 id="title">Signing in...</h1>
<p id="msg">Completing authentication...</p>
</div>
<script>
var hash = window.location.hash.substring(1);
var params = new URLSearchParams(hash);
var idToken = params.get("id_token");
if (idToken) {
  fetch("/token?id_token=" + encodeURIComponent(idToken))
    .then(function() {
      document.getElementById("icon").className = "spinner done";
      document.getElementById("title").textContent = "Signed In!";
      document.getElementById("msg").textContent = "Returning to Flow Arts Composer...";
      setTimeout(function() { try { window.close(); } catch(e) {} }, 1500);
    });
} else {
  document.getElementById("icon").className = "spinner fail";
  document.getElementById("title").textContent = "Error";
  document.getElementById("title").style.color = "#e74c3c";
  document.getElementById("msg").textContent = "No authentication token received. Please try again.";
}
</script></body></html>"##;

#[derive(Clone, serde::Serialize)]
struct OAuthPayload {
    id_token: String,
}

#[tauri::command]
pub async fn start_oauth_server(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let done = Arc::new(Mutex::new(false));

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if *done.lock().unwrap() {
                break;
            }
            let Ok(mut stream) = stream else { continue };
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);

            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("");

            if path.starts_with("/token?") {
                let id_token = url::form_urlencoded::parse(
                    path.split('?').nth(1).unwrap_or("").as_bytes(),
                )
                .find(|(k, _)| k == "id_token")
                .map(|(_, v)| v.into_owned());

                if let Some(token) = id_token {
                    println!("[DesktopOAuth] Token received, emitting event...");
                    let _ = app.emit("oauth-callback", OAuthPayload { id_token: token });

                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                        println!("[DesktopOAuth] Focused main window");
                    }

                    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nok";
                    let _ = stream.write_all(response.as_bytes());
                    *done.lock().unwrap() = true;
                }
            } else {
                println!("[DesktopOAuth] Serving landing page");
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
                    LANDING_HTML
                );
                let _ = stream.write_all(response.as_bytes());
            }
        }
        println!("[DesktopOAuth] Server shutting down");
    });

    Ok(port)
}
