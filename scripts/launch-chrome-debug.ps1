<#
  launch-chrome-debug.ps1

  Starts a REAL, persistent Chrome with remote debugging on port 9222 so the
  chrome-devtools MCP server can ATTACH to it (configured with
  --browserUrl=http://127.0.0.1:9222) instead of spawning an isolated
  automation instance.

  Why this exists:
    - The MCP-launched Chrome carries --enable-automation, which shows the
      "Chrome is being controlled by automated test software" banner AND makes
      Google / Firebase sign-in refuse credentials. Attaching to a Chrome we
      launch ourselves (WITHOUT that flag) is a normal browser — sign-in works,
      cookies persist, no banner.
    - This profile is dedicated + persistent: sign in ONCE and stay signed in
      across sessions. It runs alongside your everyday Chrome (separate
      --user-data-dir), and current Chrome REQUIRES a non-default user-data-dir
      to expose the debug port anyway.

  Usage:
    pwsh scripts/launch-chrome-debug.ps1            # opens localhost:5173
    pwsh scripts/launch-chrome-debug.ps1 -Url https://tkaflowarts.com

  Then start (or restart) Claude Code; the chrome-devtools tools drive THIS
  window, logged in as you.
#>
param(
  [int]$Port = 9222,
  [string]$UserDataDir = "$env:USERPROFILE\.chrome-tka-debug",
  [string]$Url = "http://localhost:5173"
)

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  Write-Error "Chrome not found at $chrome"
  exit 1
}

# Already serving the debug port? Report and exit — don't spawn a second one.
try {
  $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$Port/json/version"
  Write-Host "Debug Chrome already running on port $Port." -ForegroundColor Green
  Write-Host $r.Content
  exit 0
} catch { }

New-Item -ItemType Directory -Force -Path $UserDataDir | Out-Null

# NOTE: deliberately NO --enable-automation / --headless. This is a real,
# user-facing Chrome window.
Start-Process -FilePath $chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=$UserDataDir",
  "--no-first-run",
  "--no-default-browser-check",
  $Url
)

# Confirm the port comes up.
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$Port/json/version"
    Write-Host "Debug Chrome ready on port $Port (profile: $UserDataDir)" -ForegroundColor Green
    Write-Host $r.Content
    exit 0
  } catch { }
}

Write-Warning "Launched Chrome but port $Port did not respond in time. Check that no other Chrome is using this profile."
exit 1
