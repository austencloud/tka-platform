# Tauri Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package TKA Composer as a native desktop app with full offline support, admin bypass, bundled sequences, and auto-updates.

**Architecture:** Tauri v2 thin shell wrapping existing SvelteKit adapter-static build. All app logic stays in JS/Svelte. Rust handles OAuth callback, resource access, and updater hooks. Desktop detected via `__TAURI_INTERNALS__`, triggers admin bypass and Dexie seeding from bundled data.

**Tech Stack:** Tauri v2, Rust, SvelteKit (existing), Dexie (existing), Firebase (existing), GitHub Actions CI

**Spec:** `docs/superpowers/specs/2026-04-26-tauri-desktop-app-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/tauri.conf.json` | App window, bundle, updater, resources config |
| `src-tauri/capabilities/default.json` | Permission scopes |
| `src-tauri/src/main.rs` | Entry point + plugin registration |
| `src-tauri/src/lib.rs` | Tauri command exports |
| `src-tauri/build.rs` | Tauri build script |
| `src/lib/shared/desktop/isDesktop.ts` | Single-point desktop detection |
| `src/lib/shared/desktop/DesktopInitializer.ts` | Desktop lifecycle init (window state, updater, data seeder) |
| `src/lib/shared/desktop/getDesktopInitializer.ts` | Lazy singleton factory |
| `src/lib/shared/desktop/DesktopDataSeeder.ts` | Bulk-insert bundled sequences into Dexie on first launch |
| `src/lib/shared/desktop/TauriAuthBridge.ts` | System browser OAuth → Firebase credential bridge |
| `scripts/export-deck-bundle.cjs` | Firestore → JSON export for deck bundle |
| `.github/workflows/desktop-build.yml` | CI for Windows + macOS Tauri builds |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/platform/services/contracts/IPlatformDetector.ts` | Add `isDesktop` and `"desktop"` to platform union |
| `src/lib/shared/platform/services/implementations/PlatformDetector.ts` | Add desktop detection via `__TAURI_INTERNALS__` |
| `src/lib/shared/auth/state/authState.svelte.ts` | Add desktop admin bypass in `initializeAuthListener` |
| `src/routes/+layout.svelte` | Add desktop initializer call alongside native initializer |
| `package.json` | Add `@tauri-apps/api`, `@tauri-apps/plugin-*` deps + scripts |
| `.gitignore` | Add `src-tauri/target/`, `data/sequences/` |

---

## Task 1: Install Tauri CLI and scaffold project

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/icons/` (generated)
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Tauri CLI and JS dependencies**

```bash
pnpm add -D @tauri-apps/cli
pnpm add @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-shell @tauri-apps/plugin-notification @tauri-apps/plugin-updater @tauri-apps/plugin-window-state @tauri-apps/plugin-http
```

- [ ] **Step 2: Verify Rust toolchain is installed**

```bash
rustc --version
cargo --version
```

Expected: version output. If missing, install via `rustup`: https://rustup.rs/

- [ ] **Step 3: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "tka-composer"
version = "0.1.0"
description = "TKA Composer Desktop"
authors = ["Austen Cloud"]
edition = "2021"

[lib]
name = "tka_composer_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
tauri-plugin-window-state = "2"
tauri-plugin-http = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

- [ ] **Step 4: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 5: Create `src-tauri/src/lib.rs`**

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TKA Composer");
}
```

- [ ] **Step 6: Create `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tka_composer_lib::run()
}
```

- [ ] **Step 7: Create `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/nicbarker/tauri-v2-json-schema/main/schema.json",
  "productName": "TKA Composer",
  "version": "0.1.0",
  "identifier": "com.tkaflowarts.composer.desktop",
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
        "resizable": true,
        "useHttpsScheme": true
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
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  }
}
```

- [ ] **Step 8: Create `src-tauri/capabilities/default.json`**

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

- [ ] **Step 9: Generate icons from existing TKA icon**

```bash
pnpm tauri icon static/pwa/icon-512x512.png
```

This generates all required icon sizes into `src-tauri/icons/`.

- [ ] **Step 10: Add scripts to `package.json`**

Add these to the `"scripts"` section:

```json
"tauri:dev": "tauri dev",
"tauri:build": "tauri build",
"tauri:icons": "tauri icon static/pwa/icon-512x512.png",
"export:deck-bundle": "node scripts/export-deck-bundle.cjs"
```

- [ ] **Step 11: Update `.gitignore`**

Append:

```
# Tauri
src-tauri/target/
data/sequences/
```

- [ ] **Step 12: Verify Tauri dev builds and opens a window**

```bash
pnpm tauri:dev
```

Expected: Rust compiles (first build takes 2-5 minutes), then a native window opens showing TKA Composer at `http://localhost:5174`. The app should render normally inside the webview.

- [ ] **Step 13: Commit**

```bash
git add src-tauri/ package.json .gitignore pnpm-lock.yaml
git commit -m "feat(desktop): scaffold Tauri v2 project with plugin config"
```

---

## Task 2: Platform detection — add desktop support

**Files:**
- Modify: `src/lib/shared/platform/services/contracts/IPlatformDetector.ts`
- Modify: `src/lib/shared/platform/services/implementations/PlatformDetector.ts`
- Create: `src/lib/shared/desktop/isDesktop.ts`

- [ ] **Step 1: Create `src/lib/shared/desktop/isDesktop.ts`**

```typescript
import { browser } from "$app/environment";

export function isDesktop(): boolean {
  return browser && "__TAURI_INTERNALS__" in window;
}
```

- [ ] **Step 2: Update `IPlatformDetector` interface**

In `src/lib/shared/platform/services/contracts/IPlatformDetector.ts`, replace the full file:

```typescript
export interface IPlatformDetector {
  readonly isNative: boolean;
  readonly isDesktop: boolean;
  readonly isIOS: boolean;
  readonly isAndroid: boolean;
  readonly isWeb: boolean;
  readonly platform: "ios" | "android" | "web" | "desktop";
}
```

- [ ] **Step 3: Update `PlatformDetector` implementation**

In `src/lib/shared/platform/services/implementations/PlatformDetector.ts`, replace the full file:

```typescript
import { Capacitor } from "@capacitor/core";
import type { IPlatformDetector } from "../contracts/IPlatformDetector";
import { isDesktop } from "../../../desktop/isDesktop";

export class PlatformDetector implements IPlatformDetector {
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  get isDesktop(): boolean {
    return isDesktop();
  }

  get isIOS(): boolean {
    return Capacitor.getPlatform() === "ios";
  }

  get isAndroid(): boolean {
    return Capacitor.getPlatform() === "android";
  }

  get isWeb(): boolean {
    return !this.isDesktop && Capacitor.getPlatform() === "web";
  }

  get platform(): "ios" | "android" | "web" | "desktop" {
    if (this.isDesktop) return "desktop";
    return Capacitor.getPlatform() as "ios" | "android" | "web";
  }
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm run check
```

Expected: no new errors. If any consumers of `IPlatformDetector.platform` don't handle `"desktop"`, fix the exhaustive switch/if chains.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/platform/ src/lib/shared/desktop/isDesktop.ts
git commit -m "feat(desktop): add desktop platform detection via __TAURI_INTERNALS__"
```

---

## Task 3: Auth — desktop admin bypass

**Files:**
- Modify: `src/lib/shared/auth/state/authState.svelte.ts`

- [ ] **Step 1: Add desktop bypass in `initializeAuthListener`**

In `src/lib/shared/auth/state/authState.svelte.ts`, find the `initializeAuthListener` function (line 246). Add the desktop bypass BEFORE the `onAuthStateChanged` listener setup. Insert after `await authReady;` (line 291) and before `cleanupAuthListener = onAuthStateChanged(` (line 293):

```typescript
  // Desktop admin bypass: when running in Tauri, grant admin access immediately
  // without waiting for Firebase auth. This enables full offline functionality.
  // When online, Firebase reconciles (Austen's account IS admin, so no conflict).
  const { isDesktop } = await import("$lib/shared/desktop/isDesktop");
  if (isDesktop()) {
    _state = {
      user: null,
      loading: false,
      initialized: true,
      isAdmin: true,
      role: "admin",
    };

    // Still set up the auth listener for when we go online — it will
    // reconcile with the real Firebase user and won't downgrade admin
    // because Austen's account has admin custom claims.
  }
```

- [ ] **Step 2: Prevent desktop auth from downgrading admin role**

In the same file, in the `onAuthStateChanged` callback where `_state` is set (around line 407), wrap the state update to preserve desktop admin when user is null (offline):

Find:
```typescript
      _state = {
        user,
        loading: false,
        initialized: true,
        isAdmin,
        role,
      };
```

Replace with:
```typescript
      // On desktop, preserve admin status even when user is null (offline).
      // When Firebase connects and returns the real user, use their claims.
      const desktopAdminFallback = isDesktopEnv && !user;
      _state = {
        user,
        loading: false,
        initialized: true,
        isAdmin: desktopAdminFallback ? true : isAdmin,
        role: desktopAdminFallback ? "admin" : role,
      };
```

Add `isDesktopEnv` variable at the top of `initializeAuthListener`, right after the desktop bypass block:

```typescript
  const isDesktopEnv = isDesktop();
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm run check
```

Expected: clean.

- [ ] **Step 4: Verify in Tauri dev mode**

```bash
pnpm tauri:dev
```

Expected: App opens, immediately shows as initialized (no loading spinner), admin features accessible without sign-in. Check browser devtools console for the auth state log messages.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/state/authState.svelte.ts
git commit -m "feat(desktop): admin bypass — full access without sign-in on Tauri"
```

---

## Task 4: Desktop initializer + layout integration

**Files:**
- Create: `src/lib/shared/desktop/DesktopInitializer.ts`
- Create: `src/lib/shared/desktop/getDesktopInitializer.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create `src/lib/shared/desktop/DesktopInitializer.ts`**

```typescript
import { isDesktop } from "./isDesktop";

export class DesktopInitializer {
  async initialize(): Promise<void> {
    if (!isDesktop()) return;

    await Promise.all([
      this.initWindowState(),
      this.initUpdater(),
    ]);
  }

  private async initWindowState(): Promise<void> {
    // Window state plugin remembers size/position across launches — no code needed,
    // the Tauri plugin handles it automatically via the registration in lib.rs.
  }

  private async initUpdater(): Promise<void> {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        console.log(`[Desktop] Update available: ${update.version}`);
        // Download in background — user will be prompted to restart
        await update.downloadAndInstall();
      }
    } catch (err) {
      // Offline or updater endpoint unreachable — silently skip
      console.warn("[Desktop] Update check skipped:", err);
    }
  }
}
```

- [ ] **Step 2: Create `src/lib/shared/desktop/getDesktopInitializer.ts`**

```typescript
import { browser } from "$app/environment";
import { DesktopInitializer } from "./DesktopInitializer";

let instance: DesktopInitializer | null = null;

export function getDesktopInitializer(): DesktopInitializer {
  if (!browser) throw new Error("getDesktopInitializer() is browser-only");
  return (instance ??= new DesktopInitializer());
}
```

- [ ] **Step 3: Add desktop initializer call in `+layout.svelte`**

In `src/routes/+layout.svelte`, find the native initializer block (around line 300-305):

```typescript
    // Initialize native Capacitor plugins (status bar, keyboard, splash, lifecycle).
    // No-op on web - the isNative check inside returns immediately.
    const { getNativeInitializer } = await import("$lib/shared/platform/getNativeInitializer");
    getNativeInitializer().initialize().catch((err: unknown) =>
      console.warn("[Layout] Native init skipped:", err)
    );
```

Add immediately after that block:

```typescript
    // Initialize desktop Tauri features (window state, updater, data seeder).
    // No-op on web/mobile - the isDesktop check inside returns immediately.
    const { getDesktopInitializer } = await import("$lib/shared/desktop/getDesktopInitializer");
    getDesktopInitializer().initialize().catch((err: unknown) =>
      console.warn("[Layout] Desktop init skipped:", err)
    );
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm run check
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/desktop/ src/routes/+layout.svelte
git commit -m "feat(desktop): desktop initializer with window state + auto-updater"
```

---

## Task 5: Data export script — Firestore to JSON bundle

**Files:**
- Create: `scripts/export-deck-bundle.cjs`
- Create: `data/sequences/.gitkeep`

- [ ] **Step 1: Create `data/sequences/` directory**

```bash
mkdir -p data/sequences
touch data/sequences/.gitkeep
```

- [ ] **Step 2: Create `scripts/export-deck-bundle.cjs`**

```javascript
#!/usr/bin/env node
/**
 * Export Deck Bundle
 *
 * Exports all deck sequences from Firestore to JSON files for Tauri desktop bundling.
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a Firebase service account key.
 *
 * Usage:
 *   node scripts/export-deck-bundle.cjs
 *   node scripts/export-deck-bundle.cjs --dry-run
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const dryRun = process.argv.includes("--dry-run");
const outDir = path.resolve(__dirname, "../data/sequences");

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS env var not set.");
  console.error("Point it to your Firebase service account key JSON file.");
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function exportAllDecks() {
  console.log("Fetching deck list from Firestore...");
  const decksSnapshot = await db.collection("decks").get();
  console.log(`Found ${decksSnapshot.size} decks.`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let totalSequences = 0;
  const manifest = [];

  for (const deckDoc of decksSnapshot.docs) {
    const deckData = deckDoc.data();
    const deckId = deckDoc.id;
    const deckName = deckData.name || deckId;

    console.log(`\nExporting deck: ${deckName} (${deckId})`);

    const seqSnapshot = await db
      .collection("decks")
      .doc(deckId)
      .collection("sequences")
      .get();

    const sequences = [];
    for (const seqDoc of seqSnapshot.docs) {
      const data = seqDoc.data();
      // Strip Firestore Timestamps — convert to ISO strings for JSON serialization
      const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === "object" && value._seconds !== undefined) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));
      cleaned.id = seqDoc.id;
      sequences.push(cleaned);
    }

    totalSequences += sequences.length;
    console.log(`  → ${sequences.length} sequences`);

    // Generate filename from deck metadata
    const filename = `${deckId}.json`;
    const filePath = path.join(outDir, filename);

    const bundle = {
      deckId,
      deckName,
      metadata: {
        loopType: deckData.loopType || null,
        slice: deckData.slice || null,
        level: deckData.level || null,
        gridMode: deckData.gridMode || null,
        exportedAt: new Date().toISOString(),
        count: sequences.length,
      },
      sequences,
    };

    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(bundle));
      const sizeMB = (Buffer.byteLength(JSON.stringify(bundle)) / 1024 / 1024).toFixed(1);
      console.log(`  → Wrote ${filePath} (${sizeMB} MB)`);
    } else {
      console.log(`  → [dry-run] Would write ${filePath}`);
    }

    manifest.push({
      deckId,
      deckName,
      filename,
      count: sequences.length,
      loopType: deckData.loopType,
      slice: deckData.slice,
      level: deckData.level,
    });
  }

  // Write manifest file for the seeder to enumerate
  const manifestPath = path.join(outDir, "_manifest.json");
  if (!dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify({ decks: manifest, totalSequences, exportedAt: new Date().toISOString() }, null, 2));
    console.log(`\nManifest written to ${manifestPath}`);
  }

  console.log(`\nDone. ${totalSequences} sequences across ${decksSnapshot.size} decks.`);
  if (dryRun) console.log("(dry run — no files written)");
}

exportAllDecks().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Install firebase-admin as dev dependency**

```bash
pnpm add -D firebase-admin
```

- [ ] **Step 4: Test the export script (dry run)**

```bash
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json node scripts/export-deck-bundle.cjs --dry-run
```

Expected: lists all decks and sequence counts without writing files. If you don't have a service account key, generate one from Firebase Console → Project Settings → Service Accounts → Generate New Private Key.

- [ ] **Step 5: Run the actual export**

```bash
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json node scripts/export-deck-bundle.cjs
```

Expected: JSON files written to `data/sequences/`, manifest file at `data/sequences/_manifest.json`. Total ~100MB across ~13 files.

- [ ] **Step 6: Commit**

```bash
git add scripts/export-deck-bundle.cjs data/sequences/.gitkeep
git commit -m "feat(desktop): add Firestore deck export script for offline bundle"
```

Note: the actual `data/sequences/*.json` files are gitignored (too large for git). They're build artifacts.

---

## Task 6: Desktop data seeder — bulk-insert bundled sequences into Dexie

**Files:**
- Create: `src/lib/shared/desktop/DesktopDataSeeder.ts`
- Modify: `src/lib/shared/desktop/DesktopInitializer.ts`

- [ ] **Step 1: Create `src/lib/shared/desktop/DesktopDataSeeder.ts`**

```typescript
import { db } from "$lib/shared/persistence/database/TKADatabase";

const BUNDLE_VERSION_KEY = "desktop-bundle-version";

interface DeckManifest {
  decks: Array<{
    deckId: string;
    deckName: string;
    filename: string;
    count: number;
  }>;
  totalSequences: number;
  exportedAt: string;
}

interface DeckBundle {
  deckId: string;
  deckName: string;
  sequences: Array<Record<string, unknown>>;
}

export class DesktopDataSeeder {
  async seedIfNeeded(appVersion: string): Promise<void> {
    const existing = await db.settings.get(BUNDLE_VERSION_KEY);
    if (existing && (existing as Record<string, unknown>).bundleVersion === appVersion) {
      return; // Already seeded this version
    }

    console.log("[DesktopDataSeeder] Seeding bundled sequence data...");
    await this.seed(appVersion);
  }

  private async seed(appVersion: string): Promise<void> {
    const { resolveResource } = await import("@tauri-apps/api/path");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");

    // Read manifest to enumerate deck files
    const manifestPath = await resolveResource("data/sequences/_manifest.json");
    const manifestJson = await readTextFile(manifestPath);
    const manifest: DeckManifest = JSON.parse(manifestJson);

    let seeded = 0;
    const total = manifest.totalSequences;

    for (const deck of manifest.decks) {
      const deckPath = await resolveResource(`data/sequences/${deck.filename}`);
      const deckJson = await readTextFile(deckPath);
      const bundle: DeckBundle = JSON.parse(deckJson);

      // Bulk-insert in batches of 500 to avoid blocking the UI thread
      const BATCH_SIZE = 500;
      for (let i = 0; i < bundle.sequences.length; i += BATCH_SIZE) {
        const batch = bundle.sequences.slice(i, i + BATCH_SIZE);
        await db.sequences.bulkPut(batch as any);
        seeded += batch.length;

        // Yield to the event loop so the UI stays responsive
        if (seeded % 2000 === 0) {
          console.log(`[DesktopDataSeeder] Progress: ${seeded}/${total}`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    // Record that we've seeded this version
    await db.settings.put({
      id: BUNDLE_VERSION_KEY,
      bundleVersion: appVersion,
    } as any);

    console.log(`[DesktopDataSeeder] Done. Seeded ${seeded} sequences.`);
  }
}
```

- [ ] **Step 2: Integrate seeder into `DesktopInitializer.ts`**

Replace the full file:

```typescript
import { isDesktop } from "./isDesktop";
import { DesktopDataSeeder } from "./DesktopDataSeeder";

export class DesktopInitializer {
  private seeder = new DesktopDataSeeder();

  async initialize(): Promise<void> {
    if (!isDesktop()) return;

    await Promise.all([
      this.initWindowState(),
      this.initUpdater(),
      this.initDataSeeder(),
    ]);
  }

  private async initWindowState(): Promise<void> {
    // Window state plugin remembers size/position across launches — no code needed,
    // the Tauri plugin handles it automatically via the registration in lib.rs.
  }

  private async initUpdater(): Promise<void> {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        console.log(`[Desktop] Update available: ${update.version}`);
        await update.downloadAndInstall();
      }
    } catch (err) {
      console.warn("[Desktop] Update check skipped:", err);
    }
  }

  private async initDataSeeder(): Promise<void> {
    try {
      const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
      await this.seeder.seedIfNeeded(appVersion);
    } catch (err) {
      console.error("[Desktop] Data seeding failed:", err);
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm run check
```

Expected: clean. The `@tauri-apps/plugin-fs` and `@tauri-apps/api/path` imports will resolve from the packages installed in Task 1.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/desktop/
git commit -m "feat(desktop): data seeder — bulk-inserts bundled sequences into Dexie on first launch"
```

---

## Task 7: Auth bridge — system browser OAuth for desktop

**Files:**
- Create: `src/lib/shared/desktop/TauriAuthBridge.ts`

- [ ] **Step 1: Create `src/lib/shared/desktop/TauriAuthBridge.ts`**

```typescript
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "$lib/shared/auth/firebase";

/**
 * Opens the system browser for Google OAuth, receives the token back via
 * a deep link or localhost callback, and completes Firebase auth.
 *
 * This is needed because signInWithPopup doesn't work in Tauri's webview
 * (Google blocks OAuth in non-browser embedded contexts).
 */
export async function signInWithDesktopOAuth(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-shell");

  // Build the Google OAuth URL
  const clientId = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
  const redirectUri = "http://localhost:9876/callback";
  const scope = "email profile";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("prompt", "select_account");

  // Open in system browser
  await open(authUrl.toString());

  // Listen for the callback via Tauri event (emitted by Rust-side OAuth handler)
  const { listen } = await import("@tauri-apps/api/event");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("OAuth timed out")), 120_000);

    listen<{ id_token: string }>("oauth-callback", async (event) => {
      clearTimeout(timeout);
      try {
        const credential = GoogleAuthProvider.credential(event.payload.id_token);
        await signInWithCredential(auth, credential);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
```

Note: The Rust-side OAuth callback server (to handle `localhost:9876/callback`) is deferred to a future task — for now, the desktop admin bypass means auth is optional. When online, the existing Firebase auth flow via the webview may work for email/password; the system browser OAuth is for Google specifically. The `clientId` should be read from your Firebase config at runtime — replace the placeholder during implementation.

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/desktop/TauriAuthBridge.ts
git commit -m "feat(desktop): auth bridge for system browser Google OAuth"
```

---

## Task 8: CI/CD — GitHub Actions for Windows + macOS builds

**Files:**
- Create: `.github/workflows/desktop-build.yml`

- [ ] **Step 1: Generate updater key pair**

```bash
pnpm tauri signer generate -w ~/.tauri/tka-composer.key
```

This generates a private key at `~/.tauri/tka-composer.key` and prints the public key. Save the public key — it goes in `tauri.conf.json`.

- [ ] **Step 2: Add the public key to `tauri.conf.json`**

Add to the `"plugins"` section of `src-tauri/tauri.conf.json`:

```json
  "plugins": {
    "updater": {
      "pubkey": "THE_PUBLIC_KEY_FROM_STEP_1",
      "endpoints": [
        "https://github.com/austencloud/tka-platform/releases/latest/download/latest.json"
      ]
    }
  }
```

Also add to `"bundle"`:

```json
    "createUpdaterArtifacts": true
```

- [ ] **Step 3: Add private key to GitHub secrets**

Go to https://github.com/austencloud/tka-platform/settings/secrets/actions and add:
- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/tka-composer.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you set (if any)

- [ ] **Step 4: Create `.github/workflows/desktop-build.yml`**

```yaml
name: Desktop Build
on:
  workflow_dispatch:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            args: ''
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.28.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - run: pnpm install

      - name: Create .env from example
        run: cp .env.example .env

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'TKA Composer ${{ github.ref_name }}'
          releaseBody: 'Desktop release — see web changelog for details.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/desktop-build.yml src-tauri/tauri.conf.json
git commit -m "ci(desktop): add GitHub Actions workflow for Windows + macOS Tauri builds"
```

---

## Task 9: Build verification — full end-to-end test

**Files:** None (verification only)

- [ ] **Step 1: Build the SvelteKit app**

```bash
cross-env DISABLE_PWA=true pnpm build
```

Expected: builds successfully to `build/` directory.

- [ ] **Step 2: Build the Tauri app**

```bash
pnpm tauri:build
```

Expected: Rust compiles in release mode (3-10 minutes), produces installer in `src-tauri/target/release/bundle/`. On Windows: `.msi` and `.exe` in `nsis/`. On macOS: `.dmg` in `dmg/`.

- [ ] **Step 3: Run the built installer**

On Windows: run the `.msi` or `.exe` from `src-tauri/target/release/bundle/nsis/`.

Expected: installer runs, app installs, launches. You see TKA Composer in a native window with full functionality, admin access without sign-in.

- [ ] **Step 4: Verify offline behavior**

Disconnect from internet. Close and reopen the app.

Expected: app launches, all locally-seeded sequences browsable, create module works, no error spinners. Firebase operations silently fail (fire-and-forget pattern).

- [ ] **Step 5: Verify online sync**

Reconnect to internet. Navigate around the app.

Expected: Firebase reconnects automatically, any pending writes sync, browse gallery populates with fresh data.

- [ ] **Step 6: Commit any fixes discovered during verification**

```bash
git add -u
git commit -m "fix(desktop): adjustments from end-to-end build verification"
```

---

## Task Order & Dependencies

```
Task 1 (scaffold) → Task 2 (platform detection) → Task 3 (admin bypass)
                  → Task 4 (desktop initializer)
                  → Task 5 (export script) → Task 6 (data seeder)
                  → Task 7 (auth bridge)
                  → Task 8 (CI/CD)
                                                 → Task 9 (verification)
```

Tasks 2-4 are sequential (each depends on the prior). Tasks 5-8 are independent of each other but all depend on Task 1. Task 9 depends on all others.

Parallelizable: Tasks 5, 7, and 8 can run in parallel after Task 1.
