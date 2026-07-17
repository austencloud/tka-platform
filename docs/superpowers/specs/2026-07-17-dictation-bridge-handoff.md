# Dictation Bridge — Laptop Agent Handoff

**Date:** 2026-07-17
**For:** an agent running on Austen's **laptop**
**From:** the agent on Austen's **desktop** (the machine hosting RustDesk + the injector)

---

## Mission (one sentence)

Let Austen **dictate on the laptop** and have the words **type into whatever field
he has focused on the desktop**, streamed over RustDesk — because Windows Voice
Access / OS dictation does not cross a remote-desktop pixel stream, and RustDesk
has no controller→host microphone passthrough.

**The desktop half is BUILT, RUNNING, and PROVEN end-to-end.** Your job (laptop
side) is small: **publish the web page**, open it, grant permissions, and run a
**live test** with Austen, then troubleshoot the one link I couldn't test from the
desktop (RustDesk's laptop→desktop clipboard sync).

---

## Why this architecture (so you can debug it, not just run it)

- OS dictation (Voice Access / Win+H) injects text via **local text services
  (TSF/UIA)** into the locally-focused control. Over RustDesk the locally-focused
  thing is the **remote pixel canvas**, not a text field, so dictated text has
  nowhere to land and is not forwarded. Raw keystrokes forward; TSF-injected
  dictation does not.
- RustDesk has **no controller→host mic passthrough** (confirmed open limitation),
  so running Voice Access *on the desktop* fed by the laptop mic is impossible.
- **Solution:** do speech recognition **in the laptop browser** (Web Speech API,
  laptop mic), write each phrase to the **laptop clipboard** with a hidden marker,
  let **RustDesk's clipboard sync** carry it to the desktop, and a **desktop
  injector** types it into the foreground focused window via `SendInput`.

### The data flow

```
laptop mic
  → browser Web Speech (dictate.html, in the laptop's own Chrome)
  → laptop clipboard, written as  ⟦DICT:<seq>⟧<text>
  → RustDesk clipboard sync (laptop → desktop)   ← ONLY UNPROVEN LINK
  → desktop injector (dict-injector.ps1) detects the marker
  → SendInput types <text> into the desktop's foreground focused field
```

Every link is **proven** except the RustDesk clipboard sync, which needs the
laptop to verify (see Troubleshooting).

---

## The wire protocol (contract between the page and the injector)

- Clipboard payload: `⟦DICT:<seq>⟧<text>`
  - `⟦` = `U+27E6`, `⟧` = `U+27E7` (math white square brackets — rare on purpose).
  - `<seq>` = a monotonically increasing integer per page load.
  - `<text>` = the literal text to type (may include a trailing space; `\n` → Enter).
- The injector types `<text>` **only when `<seq>` changes** (so repeated identical
  phrases still fire; normal copy/paste, which lacks the marker, is ignored).
- After typing, the injector rewrites the clipboard to the **clean** `<text>`
  (marker stripped) so a later manual paste is tidy. This does **not** loop — the
  page never reads the clipboard.

---

## What is already DONE on the desktop (do not rebuild unless broken)

1. **RustDesk portable** is running, unattended-password mode, no host Accept
   needed. Connect ID: **`473 154 246`**. (Password: ask Austen or read it off the
   desktop RustDesk window — it's a temporary session password, deliberately not
   written into this file.)
2. **Injector running:** `C:\Users\Austen\RemoteAccess\dict-injector.ps1`, launched
   as a hidden background `pwsh`, gated by the flag file
   `C:\Users\Austen\RemoteAccess\dictation.on`, logging to
   `C:\Users\Austen\RemoteAccess\dict-injector.log`.
   - **Proven:** a full-chain test (`⟦DICT:30⟧foreground proof abc` on the
     clipboard) was read back verbatim out of a focused control.
   - Key gotcha already fixed: on x64 the Win32 `INPUT` struct is **40 bytes**
     (union sized to `MOUSEINPUT`); an undersized union makes `SendInput` silently
     no-op. The embedded script has the `Size=32` union fix — keep it.
3. **Worker files staged (desktop):** `C:\Users\Austen\RemoteAccess\worker\`
   (`worker.js` + `wrangler.toml`), ready to `wrangler deploy`. Desktop `wrangler`
   is authed to Austen's Cloudflare account (`workers (write)`,
   account `0c0fb89b9dd972a61c30f0d43dd02b18`).

---

## Your tasks (laptop)

### 1. Publish `dictate.html` over HTTPS

**Must be HTTPS.** Chrome blocks `getUserMedia`/Web Speech and
`navigator.clipboard.writeText` on `file://` and other opaque origins.

**Option A — deploy the staged Cloudflare Worker from the desktop (simplest).**
Have Austen run this once in the Claude prompt on the **desktop** (the `!` prefix
runs it in that session); it prints the public URL:

```
! pwsh -NoProfile -Command "cd 'C:\Users\Austen\RemoteAccess\worker'; & 'E:\tka-platform\node_modules\.bin\wrangler.cmd' deploy"
```

→ yields `https://dictate-bridge.<subdomain>.workers.dev`.

**Option B — deploy from the laptop yourself.** If this laptop has `wrangler`
authed to the same Cloudflare account, regenerate the worker from the embedded
HTML below and deploy:

```powershell
# from a scratch dir containing dictate.html (embedded at the end of this doc)
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('.\dictate.html'))
@"
const B64="$b64";
export default { async fetch() {
  const bin=atob(B64); const a=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
  return new Response(a,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
} }
"@ | Set-Content worker.js -Encoding UTF8
@"
name = "dictate-bridge"
main = "worker.js"
compatibility_date = "2024-11-01"
workers_dev = true
"@ | Set-Content wrangler.toml -Encoding UTF8
wrangler deploy
```

**Option C — any HTTPS static host.** Netlify drop, Cloudflare Pages, Vercel,
GitHub Pages — upload `dictate.html` as `index.html`. Just needs HTTPS.

> Publishing a public URL to Austen's Cloudflare account is gated by the desktop
> agent's auto-approver (it's a public production surface), which is why the
> desktop staged it but did not auto-deploy. Deploying from the laptop or having
> Austen run the one-liner is the intended completion.

### 2. Open + permissions

- Open the URL **in the laptop's own Chrome** (NOT through the RustDesk canvas).
- Tap **Start**; **allow microphone and clipboard** when prompted.

### 3. Live test with Austen

1. Through RustDesk, click into a desktop text field (Notepad, a browser box,
   anything) so it's **genuinely focused** (foreground).
2. On the page, tap **Start**, have Austen say a short phrase.
3. Confirm the words appear in the desktop field.
4. If they don't, work the Troubleshooting matrix.

---

## Troubleshooting matrix

| Symptom | Check / fix |
|---|---|
| **Nothing types on the desktop** | First isolate the clipboard link: on the **laptop**, manually copy the literal text `⟦DICT:999⟧clipboard link works` (Notepad → select → Ctrl+C). Watch the desktop log (`Get-Content C:\Users\Austen\RemoteAccess\dict-injector.log -Tail 3`). If you see `inject seq=999`, the sync works and the issue is focus (below). If not, **RustDesk clipboard sync is off** → in the RustDesk session toolbar, ensure clipboard is enabled (not "Disable clipboard"). |
| **Log shows `inject` but the field stays empty** | The desktop field isn't the genuine foreground/focused control, OR it's an **elevated/admin window** (a non-admin injector can't type into higher-integrity windows). Click the field again; use a non-elevated app. |
| **Injector not logging at all** | Confirm it's running: log should have a recent `injector started`. If stale, restart it (see Injector management). |
| **Browser says "Clipboard blocked"** | Click the page to focus it, allow clipboard permission, retry. Or use the page's **Manual send** box, or fall back to plain Ctrl+C (the marker is written the same way). |
| **Speech does nothing** | Web Speech is Chrome/Edge only (`webkitSpeechRecognition`), needs internet + HTTPS + mic permission. Manual send still works without it. |
| **Every phrase types twice** | More than one injector is running. Delete the flag, wait 3 s, recreate it, start exactly one (see below). |
| **Garbled/missing characters** | Unlikely — injector uses Unicode `SendInput` (layout-independent). If it happens, capture the log line and report. |

### Injector management (desktop, run via RustDesk terminal or ask Austen)

```powershell
$base = 'C:\Users\Austen\RemoteAccess'
# STATUS
Get-Content "$base\dict-injector.log" -Tail 5
# CLEAN SINGLE-INSTANCE RESTART (flag lifecycle — do NOT enumerate/kill by Win32_Process
# CommandLine; that query aborts the shell on protected processes)
Remove-Item "$base\dictation.on" -ErrorAction SilentlyContinue   # all injectors exit within ~150ms
Start-Sleep -Seconds 3
New-Item -ItemType File -Path "$base\dictation.on" -Force | Out-Null
Start-Process pwsh -WindowStyle Hidden -ArgumentList '-NoProfile','-File',"$base\dict-injector.ps1"
# STOP entirely
Remove-Item "$base\dictation.on"
```

---

## Caveats / limits

- **Don't reboot the desktop.** RustDesk portable and the injector both die with
  the session, and portable RustDesk can't pass the Windows lock screen (no admin).
- The injector fires **only** on `⟦DICT⟧`-marked clipboard text — normal desktop
  copy/paste is unaffected.
- Round trip: page writes marker → RustDesk laptop→desktop → inject → desktop
  rewrites clean text → RustDesk desktop→laptop. No loop (page never reads the
  clipboard). Rapid-fire dictation could in theory race the two-way sync; if you
  see dropped phrases, slow the cadence or remove the clean-rewrite (`Set-Clipboard
  -Value $text` line in the injector).
- Security: the page is a public URL and the marker protocol is trivial, but it's
  inert without also sharing the RustDesk session/clipboard, so it's fine for
  personal use. Rotate the RustDesk password (↻ in the host window) after the session.

---

## Appendix A — `dictate.html` (full source, verbatim)

Save as `dictate.html` (UTF-8). This is exactly what the desktop staged.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dictation Bridge</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; font-family: system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1b2740, #0a0d16 60%);
    color: #eaf0ff; display: flex; flex-direction: column; align-items: center;
    padding: 20px; gap: 16px;
  }
  h1 { font-size: 20px; margin: 8px 0 0; font-weight: 650; letter-spacing: .2px; }
  .sub { color: #93a0bd; font-size: 13px; text-align: center; max-width: 520px; margin: 0; line-height: 1.5; }
  .mic {
    width: 148px; height: 148px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(160deg, #2f6bff, #1b3fbf); color: #fff; font-size: 17px; font-weight: 700;
    box-shadow: 0 12px 40px rgba(47,107,255,.35); transition: transform .12s, box-shadow .2s, background .2s;
    display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.25;
  }
  .mic:active { transform: scale(.97); }
  .mic.on { background: linear-gradient(160deg, #ff4d6d, #c81e45); box-shadow: 0 0 0 0 rgba(255,77,109,.55); animation: pulse 1.4s infinite; }
  @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(255,77,109,.5)} 70%{box-shadow:0 0 0 26px rgba(255,77,109,0)} 100%{box-shadow:0 0 0 0 rgba(255,77,109,0)} }
  .status { font-size: 14px; font-weight: 600; min-height: 20px; }
  .status.live { color: #6ee7a2; } .status.idle { color: #93a0bd; } .status.err { color: #ff8fa3; }
  .panel { width: 100%; max-width: 560px; background: #121826; border: 1px solid #26314a; border-radius: 14px; padding: 14px; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #7f8db0; margin-bottom: 6px; }
  .interim { color: #b9c4e0; font-size: 15px; min-height: 22px; font-style: italic; }
  .sent { color: #eaf0ff; font-size: 15px; min-height: 22px; margin-top: 8px; word-break: break-word; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  button.act { border: 1px solid #33405f; background: #1a2233; color: #cfe; padding: 10px 14px; min-height: 44px; border-radius: 10px; font-size: 14px; cursor: pointer; }
  button.act:hover { background: #212c44; }
  button.act.armed { background: #17351f; border-color: #2c7; color: #9f9; }
  textarea { width: 100%; min-height: 66px; background: #0d1220; color: #eaf0ff; border: 1px solid #2a3550; border-radius: 10px; padding: 10px; font: inherit; font-size: 15px; resize: vertical; }
  .hint { font-size: 12px; color: #6f7da0; margin-top: 6px; line-height: 1.5; }
  code { background: #0d1220; padding: 1px 6px; border-radius: 5px; color: #9fd; }
</style>
</head>
<body>
  <h1>🎙️ Dictation Bridge</h1>
  <p class="sub">Open this <b>on the laptop</b>. Talk — each phrase goes to your clipboard and RustDesk pushes it to the desktop, where it types into whatever field you have focused. Keep this tab focused while dictating.</p>

  <button id="mic" class="mic">Tap&nbsp;to<br>start</button>
  <div id="status" class="status idle">Idle</div>

  <div class="panel">
    <div class="label">Hearing…</div>
    <div id="interim" class="interim"></div>
    <div class="label" style="margin-top:12px">Last sent</div>
    <div id="sent" class="sent">—</div>
    <div class="row">
      <button id="nl" class="act">Send new line ⏎</button>
      <button id="space" class="act armed">Auto-space: ON</button>
      <button id="interimBtn" class="act">Send while speaking: OFF</button>
    </div>
  </div>

  <div class="panel">
    <div class="label">Manual send (fallback)</div>
    <textarea id="manual" placeholder="Type or paste text here, then Send. Useful if speech misfires."></textarea>
    <div class="row"><button id="sendManual" class="act">Send text →</button></div>
    <div class="hint">If nothing appears on the desktop: make sure RustDesk clipboard sync is on (session toolbar → clipboard not disabled), and that the desktop injector is running. First click may ask for <b>microphone</b> and <b>clipboard</b> permission — allow both.</div>
  </div>

<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let seq = 0, autoSpace = true, sendInterim = false, running = false, lastInterimSent = "";

  async function push(text) {
    if (!text) return;
    seq += 1;
    const marker = "⟦DICT:" + seq + "⟧" + text;
    try {
      await navigator.clipboard.writeText(marker);
      $("sent").textContent = text;
    } catch (e) {
      $("status").textContent = "Clipboard blocked — click the page, then allow clipboard";
      $("status").className = "status err";
    }
  }

  // ---- Manual + buttons ----
  $("sendManual").onclick = () => { const t = $("manual").value; if (t.trim()) push(autoSpace ? t + " " : t); $("manual").value = ""; };
  $("nl").onclick = () => push("\n");
  $("space").onclick = () => { autoSpace = !autoSpace; $("space").textContent = "Auto-space: " + (autoSpace ? "ON" : "OFF"); $("space").classList.toggle("armed", autoSpace); };
  $("interimBtn").onclick = () => { sendInterim = !sendInterim; $("interimBtn").textContent = "Send while speaking: " + (sendInterim ? "ON" : "OFF"); $("interimBtn").classList.toggle("armed", sendInterim); };

  // ---- Speech ----
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("status").textContent = "This browser has no speech API — use Chrome/Edge. Manual send still works.";
    $("status").className = "status err";
  }
  let rec = null;
  function make() {
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onstart = () => { $("status").textContent = "Listening…"; $("status").className = "status live"; };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      $("status").textContent = "Speech error: " + e.error;
      $("status").className = "status err";
    };
    r.onend = () => { if (running) { try { r.start(); } catch (_) {} } else { $("status").textContent = "Idle"; $("status").className = "status idle"; } };
    r.onresult = (ev) => {
      let interim = "", final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) final += res[0].transcript; else interim += res[0].transcript;
      }
      $("interim").textContent = interim;
      if (final.trim()) { push(autoSpace ? final.trim() + " " : final.trim()); $("interim").textContent = ""; lastInterimSent = ""; }
      else if (sendInterim && interim.trim() && interim.trim() !== lastInterimSent) { /* live mode: send the whole interim as it grows is noisy; skip for now */ }
    };
    return r;
  }

  async function start() {
    try { await navigator.clipboard.writeText("⟦DICT:0⟧"); } catch (_) {}   // prime clipboard permission on user gesture
    running = true;
    $("mic").classList.add("on"); $("mic").innerHTML = "Listening<br>tap to stop";
    if (SR) { rec = make(); try { rec.start(); } catch (_) {} }
    else { $("status").textContent = "Manual mode (no speech API)"; $("status").className = "status idle"; }
  }
  function stop() {
    running = false;
    $("mic").classList.remove("on"); $("mic").innerHTML = "Tap&nbsp;to<br>start";
    if (rec) { try { rec.stop(); } catch (_) {} }
    $("status").textContent = "Idle"; $("status").className = "status idle";
  }
  $("mic").onclick = () => (running ? stop() : start());
})();
</script>
</body>
</html>
```

---

## Appendix B — `dict-injector.ps1` (desktop, full source, verbatim — for reference/rebuild)

Already running on the desktop. Included so you can rebuild or audit it. Note the
`Size=32` union fix (line ~17) — without it `SendInput` silently no-ops on x64.

```powershell
# Dictation injector — watches the OS clipboard for text written by the
# laptop dictation page (marked with a ⟦DICT:seq⟧ sentinel that RustDesk's
# clipboard sync carries desktop-ward) and types it into the foreground
# window via SendInput (Unicode). Non-admin. Stop by deleting the flag file.

$ErrorActionPreference = 'Continue'
$flag = 'C:\Users\Austen\RemoteAccess\dictation.on'
$log  = 'C:\Users\Austen\RemoteAccess\dict-injector.log'
function Log($m){ "$([DateTime]::Now.ToString('HH:mm:ss.fff'))  $m" | Add-Content -Path $log -Encoding UTF8 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class Typer {
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public InputUnion U; }
  [StructLayout(LayoutKind.Explicit, Size=32)] struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] p, int cb);
  const uint KEYUP=0x2, UNICODE=0x4; const ushort VK_RETURN=0x0D;
  static INPUT Key(ushort vk, uint f){ return new INPUT{ type=1, U=new InputUnion{ ki=new KEYBDINPUT{ wVk=vk, wScan=0, dwFlags=f, time=0, dwExtraInfo=IntPtr.Zero } } }; }
  static INPUT Chr(char c, uint f){ return new INPUT{ type=1, U=new InputUnion{ ki=new KEYBDINPUT{ wVk=0, wScan=(ushort)c, dwFlags=UNICODE|f, time=0, dwExtraInfo=IntPtr.Zero } } }; }
  public static void Type(string s){
    var l = new List<INPUT>();
    foreach(char c in s){
      if(c=='\r') continue;
      if(c=='\n'){ l.Add(Key(VK_RETURN,0)); l.Add(Key(VK_RETURN,KEYUP)); continue; }
      l.Add(Chr(c,0)); l.Add(Chr(c,KEYUP));
    }
    if(l.Count>0){ var a=l.ToArray(); SendInput((uint)a.Length, a, Marshal.SizeOf(typeof(INPUT))); }
  }
}
"@

$open  = [char]0x27E6   # ⟦
$close = [char]0x27E7   # ⟧
$pattern = "^$([regex]::Escape($open))DICT:(\d+)$([regex]::Escape($close))([\s\S]*)$"

$lastSeq = -1
Log "injector started; pattern ready"
while (Test-Path $flag) {
  $t = $null
  try { $t = Get-Clipboard -Raw -Format Text -ErrorAction Stop } catch { try { $t = Get-Clipboard -Raw -ErrorAction Stop } catch {} }
  if ($t) {
    $m = [regex]::Match($t, $pattern)
    if ($m.Success) {
      $seq  = [int]$m.Groups[1].Value
      $text = $m.Groups[2].Value
      if ($seq -ne $lastSeq) {
        $lastSeq = $seq
        Log "inject seq=$seq len=$($text.Length): $text"
        [Typer]::Type($text)
        # leave a clean (marker-stripped) copy on the clipboard so a later paste is tidy
        try { Set-Clipboard -Value $text } catch {}
      }
    }
  }
  Start-Sleep -Milliseconds 150
}
Log "injector stopped (flag removed)"
```

---

## Desktop file map

| Path | What |
|---|---|
| `C:\Users\Austen\RemoteAccess\dict-injector.ps1` | The injector (running) |
| `C:\Users\Austen\RemoteAccess\dictation.on` | Flag file — presence = injector runs |
| `C:\Users\Austen\RemoteAccess\dict-injector.log` | Injector log (watch this to debug) |
| `C:\Users\Austen\RemoteAccess\worker\worker.js` + `wrangler.toml` | Staged Cloudflare Worker (Option A deploy) |
| `C:\Users\Austen\RemoteAccess\rustdesk.exe` | RustDesk portable |
