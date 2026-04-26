# Tauri Desktop App — Design Spec

**Date:** 2026-04-26
**Status:** Draft
**Approach:** Thin Shell (Approach A) — Tauri wraps existing SvelteKit static build

---

## Summary

Package TKA Composer as a native desktop app using Tauri v2. Full offline experience with all 53k+ deck sequences bundled. Admin-mode bypass for the desktop build — no sign-in required, all features unlocked. Auto-sync when online. Auto-updates via GitHub Releases. Targets Windows and macOS (macOS built via CI).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Tauri v2 | ~5MB binary, OS-native webview, Rust backend. Lighter than Electron by 20x. |
| Platforms | Windows + macOS | Windows for Austen, macOS for community. Linux deferred. macOS built via GitHub Actions (no physical Mac needed). |
| Architecture | Thin shell (Approach A) | All logic stays in JS/Svelte. Rust handles only OAuth callback, resource access, updater hooks. ~200 lines of Rust. |
| Auth (online) | System browser OAuth | `tauri-plugin-oauth` opens real browser for Google sign-in. Token returns via localhost callback. `signInWithCredential` completes in webview. |
| Auth (offline) | Admin bypass | Desktop build detects Tauri context → sets `role: "admin"`, `isAdmin: true` locally. No Firebase auth needed. All features unlocked. |
| Data bundling | Full bundle (~100MB) | All 53k deck sequences exported from Firestore, shipped as Tauri resources. Seeded into Dexie on first launch. |
| Sync | Auto-sync when online | Existing `trackWrite()` fire-and-forget pattern. Pending Dexie writes sync to Firestore on reconnection. |
| Updates | GitHub Releases | Tauri built-in updater. Ed25519 signed. CI generates `latest.json` + binaries on version tags. |
| Identity | "TKA Composer" | Same name, icon, branding as web and mobile. |

## Project Structure

```
tka-platform/
├── src-tauri/                    ← NEW: Tauri Rust backend
│   ├── Cargo.toml                ← Rust dependencies (tauri, tauri-plugin-oauth, etc.)
│   ├── tauri.conf.json           ← App config: window, bundle, updater, resources
│   ├── capabilities/
│   │   └── default.json          ← Permission scopes (fs read, http, shell open, oauth)
│   ├── icons/                    ← App icons (all sizes, generated from TKA icon)
│   └── src/
│       ├── main.rs               ← Entry point, plugin registration (~30 lines)
│       ├── lib.rs                ← Tauri command exports (~20 lines)
│       └── oauth.rs              ← Local OAuth callback server (~80 lines)
├── data/
│   └── sequences/                ← NEW: Deck sequence JSON bundle (~100MB)
│       ├── rotated-halved-l1.json
│       ├── rotated-quartered-l1.json
│       ├── mirrored-halved-l1.json
│       └── ... (13 deck files)
├── scripts/
│   └── export-deck-bundle.cjs    ← NEW: Exports all decks from Firestore to data/sequences/
├── src/                          ← Existing SvelteKit app
├── static/                       ← Existing static assets (arrow placements, etc.)
├── svelte.config.js              ← Already adapter-static with SPA fallback ✓
├── capacitor.config.ts           ← Existing mobile config (untouched)
└── package.json                  ← Add tauri:dev, tauri:build scripts
```

## Tauri Configuration

### tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/nicbarker/tauri-v2-json-schema/main/schema.json",
  "productName": "TKA Composer",
  "version": "0.1.0",
  "identifier": "com.tkaflowarts.composer",
  "build": {
    "beforeDevCommand": "pnpm dev -- --port 5174",
    "beforeBuildCommand": "cross-env DISABLE_PWA=true pnpm build",
    "devUrl": "http://localhost:5174",
    "frontendDist": "../build"
  },
  "app": {
    "windows": [
      {
        "title": "TKA Composer",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": true,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [
      "../data/sequences/**"
    ],
    "createUpdaterArtifacts": true,
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "GENERATE_AT_SETUP",
      "endpoints": [
        "https://github.com/austencloud/tka-platform/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Capabilities (permissions)

```json
{
  "identifier": "default",
  "description": "TKA Composer desktop capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "fs:allow-resource-read-recursive",
    "http:default",
    "shell:allow-open",
    "notification:default",
    "updater:default",
    "window-state:default"
  ]
}
```

## Platform Detection

Extend existing `PlatformDetector` to recognize Tauri:

```typescript
// In PlatformDetector.ts — add desktop detection
function detectPlatform(): "ios" | "android" | "web" | "desktop" {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return "desktop";
  }
  // ... existing Capacitor detection
}
```

All platform-conditional code uses this single detection point. Desktop-specific behaviors:
- Skip PWA install prompts
- Skip Capacitor plugin imports
- Use Tauri notification plugin instead of Firebase Cloud Messaging
- Use Tauri updater instead of service worker update flow

## Auth Flow

### Online (first launch or when connected)

```
User clicks "Sign In" → tauri-plugin-oauth starts local server on localhost:9876
→ System browser opens Google OAuth URL with redirect_uri=http://localhost:9876/callback
→ User authenticates in real browser
→ Google redirects to localhost:9876/callback?code=...
→ Tauri captures the auth code, sends to webview via event
→ Frontend exchanges code via signInWithCredential
→ Firebase session established, persists in IndexedDB
→ Future launches: Firebase refresh token auto-renews (no re-auth needed)
```

### Offline / Admin Bypass

```
App launches → PlatformDetector returns "desktop"
→ Auth initializer checks: if desktop, set local state immediately:
   { role: "admin", isAdmin: true, initialized: true, loading: false }
→ All premium gates pass (hasRolePrivilege checks ROLE_HIERARCHY)
→ All data served from Dexie (seeded from bundle)
→ No network calls attempted until online detected
→ When online: Firebase auth reconciles (Austen's account IS admin)
```

The admin bypass is a local state override, not a security bypass. The desktop build is not publicly distributed. Firebase security rules still protect server-side data.

## Data Pipeline

### Export Script (build-time)

New script: `scripts/export-deck-bundle.cjs`

Connects to Firestore via Firebase Admin SDK, queries all 13 deck collections, writes JSON files to `data/sequences/`. Each file contains all sequences for one deck configuration.

```
node scripts/export-deck-bundle.cjs
→ Connects to Firestore (requires GOOGLE_APPLICATION_CREDENTIALS)
→ For each deck in decks collection:
   → Query all sequences in decks/{deckId}/sequences
   → Write to data/sequences/{loopType}-{slice}-l{level}.json
→ Output: ~13 JSON files, ~100MB total
```

Run manually when deck data changes (not on every build). Output committed to repo or stored as a build artifact.

### First-Launch Seeding

On first desktop launch (or after app update with new data version):

```
DesktopDataSeeder service:
1. Check Dexie for metadata: { bundleVersion: string }
2. If missing or outdated:
   a. Read bundled JSON files via Tauri resource API
   b. Parse and bulk-insert into Dexie sequences table
   c. Show progress indicator ("Loading sequence library... 34/53,281")
   d. Write metadata: { bundleVersion: APP_VERSION }
3. If current: skip (instant launch)
```

Estimated seeding time: 5-15 seconds for 53k records (IndexedDB bulk insert is fast).

### Auto-Sync (Online)

When online connectivity detected:

**Upstream (local → cloud):** Any sequences created or modified locally (in Dexie) get synced to Firestore via existing `trackWrite()` pattern. This already works — the fire-and-forget sync is built into `LibrarySaveService`.

**Downstream (cloud → local):** New sequences added to decks in Firestore since last sync get pulled into Dexie. Implemented via a lightweight sync timestamp check on app launch when online.

**Conflict resolution:** Last-write-wins with `updatedAt` timestamp. Existing pattern in the codebase. No merge conflicts for sequence data (sequences are atomic documents).

## Auto-Updater

### Build Pipeline

GitHub Actions workflow triggered on version tags (`v*`):

```yaml
# .github/workflows/tauri-release.yml
name: Tauri Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: macos-latest
            target: [aarch64-apple-darwin, x86_64-apple-darwin]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: cross-env DISABLE_PWA=true pnpm build
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "TKA Composer ${{ github.ref_name }}"
          releaseBody: "Desktop release"
```

### Update Flow (Runtime)

```
App launch → Tauri updater plugin checks GitHub Releases endpoint
→ Compares current version vs latest.json version
→ If newer: downloads installer in background
→ Shows non-intrusive notification: "Update available — restart to install"
→ User clicks restart → Tauri applies update, relaunches
```

Ed25519 key pair generated during initial setup. Public key in `tauri.conf.json`, private key in GitHub secrets.

## Package.json Scripts

```json
{
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:icons": "tauri icon static/pwa/icon-512x512.png",
    "export:deck-bundle": "node scripts/export-deck-bundle.cjs"
  }
}
```

## Rust Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-oauth = "2"
tauri-plugin-fs = "2"
tauri-plugin-http = "2"
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
tauri-plugin-window-state = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## What Changes in the Existing Codebase

Minimal changes — the design intentionally avoids modifying existing code paths:

| File | Change |
|------|--------|
| `src/lib/shared/platform/PlatformDetector.ts` | Add `"desktop"` detection via `__TAURI_INTERNALS__` |
| `src/lib/shared/auth/state/authState.svelte.ts` | Add desktop admin bypass in auth initializer |
| `src/lib/shared/auth/firebase.ts` | Conditional: skip popup resolver on desktop (use credential flow) |
| `package.json` | Add `@tauri-apps/api`, `@tauri-apps/plugin-*` deps + scripts |
| `.gitignore` | Add `src-tauri/target/` (Rust build artifacts) |

No changes to: components, services, Dexie schema, Capacitor config, vite.config.ts, svelte.config.js, or any feature module.

## New Files

| File | Purpose |
|------|---------|
| `src-tauri/` (directory) | Entire Tauri backend |
| `src/lib/shared/desktop/DesktopDataSeeder.ts` | First-launch Dexie seeding from bundled resources |
| `src/lib/shared/desktop/TauriAuthBridge.ts` | OAuth callback → Firebase credential bridge |
| `src/lib/shared/desktop/TauriUpdateChecker.ts` | Update notification UI integration |
| `scripts/export-deck-bundle.cjs` | Firestore → JSON export for deck sequences |
| `.github/workflows/tauri-release.yml` | CI/CD for Windows + macOS builds |
| `data/sequences/` | Bundled deck sequence JSON files |

## Security Considerations

- **Admin bypass is local-only.** Desktop build sets admin role in client state. Firebase security rules still enforce server-side permissions. A malicious actor with the desktop binary can't escalate privileges on Firestore.
- **Ed25519 update signing.** Prevents MITM attacks on the update channel. Private key in GitHub secrets, never in the repo.
- **OAuth callback on localhost:9876.** Only listens during active auth flow, shuts down after receiving the callback. Standard pattern used by Spotify, Discord, etc.
- **Bundled data is read-only.** Tauri resource files can't be modified by the webview. Data flows: resources → Dexie (read-write) → Firestore (sync).
- **WebView2 scheme pinning.** Set `useHttpsScheme` in tauri.conf.json on day one and never change — IndexedDB is origin-scoped, changing the scheme loses all local data.

## Out of Scope

- Linux builds (deferred — add later via CI matrix)
- Push notifications on desktop (use Tauri native notifications instead of FCM)
- Delta updates (Tauri doesn't support them — full binary replacement)
- Offline thumbnail generation (thumbnails cached on view when online, placeholder when offline)
- Poi Lab integration (not built yet on web either)
