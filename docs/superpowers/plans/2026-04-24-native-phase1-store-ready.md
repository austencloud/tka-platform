# Native Mobile Phase 1 — Store-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get TKA Composer published in Google Play Store and Apple App Store with OTA live updates via Capgo, verified App Links / Universal Links, and Smart App Banner on the web viewer — all before the first Choreo Card print run.

**Architecture:** Dual-deploy from single SvelteKit codebase. Web deploys to Cloudflare Pages (existing). Native builds via Capacitor 8.3 to Android AAB / iOS IPA, uploaded to stores. Capgo handles OTA updates for the web layer inside the native shell. The v1 Capacitor foundation (plugins, PlatformDetector, NativeInitializer, haptics) is already built.

**Tech Stack:** Capacitor 8.3.0 (installed), @capgo/capacitor-updater (new), GitHub Actions CI/CD, Play App Signing, Xcode archive

**Spec:** `docs/superpowers/specs/2026-04-24-native-mobile-integration-design.md`

---

## Prerequisites (Manual — Not Code Tasks)

These require human action before the code tasks can complete:

- [ ] **Google Play Developer account** — $25 one-time fee at https://play.google.com/console/signup. Required before Task 6 can upload.
- [ ] **Apple Developer Program** — $99/year at https://developer.apple.com/programs/enroll/. Required before Task 7 can sign. TestFlight works immediately after enrollment.
- [ ] **Capgo account** — Free tier at https://capgo.app. Required for Task 4. Get API key from dashboard.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `android/app/src/main/AndroidManifest.xml` | Fix deep link path `/p/` → `/q/` |
| Modify | `src/app.html` | Fix stale `/p/` refs, add Smart App Banner |
| Modify | `static/pwa/manifest.webmanifest` | Fix app ID to `com.tkaflowarts.composer` |
| Create | `static/.well-known/apple-app-site-association` | iOS Universal Links verification |
| Modify | `capacitor.config.ts` | Add Capgo updater plugin config |
| Modify | `package.json` | Add Capgo dep + upload script |
| Create | `.github/workflows/android-build.yml` | Android AAB build + upload artifact |
| Modify | `.github/workflows/ios-build.yml` | Minor: add signed build path when certs ready |
| Modify | `.github/workflows/web-ci.yml` | Fix: pnpm instead of npm, Node 24 |
| Modify | `android/app/build.gradle` | Add signing config for release builds |

---

## Task 1: Fix Stale `/p/` References

Three files still reference the old `/p/` route that was renamed to `/q/` in commit `244e6cc48e`.

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml:38`
- Modify: `src/app.html:51,108`

- [ ] **Step 1: Fix AndroidManifest deep link prefix**

In `android/app/src/main/AndroidManifest.xml`, replace line 38:

```xml
<!-- OLD -->
<data android:pathPrefix="/p/" />

<!-- NEW -->
<data android:pathPrefix="/q/" />
```

The full intent-filter block should read:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" />
    <data android:host="tkaflowarts.com" />
    <data android:pathPrefix="/q/" />
    <data android:pathPrefix="/sequence/" />
    <data android:pathPrefix="/store/" />
</intent-filter>
```

- [ ] **Step 2: Fix app.html landing detection**

In `src/app.html`, line 51, find the `isLanding` check:

```javascript
// OLD
var isLanding = p === '/' || p === '/landing' || p.startsWith('/embed') || p.startsWith('/p/') || p.startsWith('/sequence/') ...

// NEW — replace /p/ with /q/
var isLanding = p === '/' || p === '/landing' || p.startsWith('/embed') || p.startsWith('/q/') || p.startsWith('/sequence/') ...
```

- [ ] **Step 3: Fix app.html speculation rules**

In `src/app.html`, line 108, find the speculation rules exclusion:

```javascript
// OLD
{ not: { href_matches: '/p/*' } },

// NEW
{ not: { href_matches: '/q/*' } },
```

- [ ] **Step 4: Verify no remaining /p/ references**

```bash
grep -rn '"/p/"' src/app.html android/app/src/main/AndroidManifest.xml
```

Expected: No matches.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml src/app.html
git commit -m "fix: update stale /p/ route references to /q/ in AndroidManifest and app.html"
```

---

## Task 2: Fix PWA Manifest + Add Smart App Banner

**Files:**
- Modify: `static/pwa/manifest.webmanifest:19-22`
- Modify: `src/app.html` (add meta tag in `<head>`)

- [ ] **Step 1: Fix related_applications app ID**

In `static/pwa/manifest.webmanifest`, replace the Play Store entry:

```json
{
  "platform": "play",
  "url": "https://play.google.com/store/apps/details?id=com.tkaflowarts.composer",
  "id": "com.tkaflowarts.composer"
}
```

Old values were `com.tkacomposer.app` — this must match the actual Capacitor appId.

- [ ] **Step 2: Add Smart App Banner meta tag**

In `src/app.html`, add after the existing `<meta name="apple-mobile-web-app-title">` tag (around line 146):

```html
<!-- Smart App Banner: prompts iOS users to open/install native app -->
<!-- Replace XXXXXXXXXX with actual App Store ID after Apple Developer enrollment -->
<!-- <meta name="apple-itunes-app" content="app-id=XXXXXXXXXX"> -->
```

This is commented out until the Apple Developer enrollment completes and we have an App Store ID. Uncomment after first TestFlight upload assigns the ID.

- [ ] **Step 3: Commit**

```bash
git add static/pwa/manifest.webmanifest src/app.html
git commit -m "fix: correct Play Store app ID in PWA manifest, add Smart App Banner placeholder"
```

---

## Task 3: Create Apple App Site Association

This file enables Universal Links — when an iOS user with the app installed taps a `tkaflowarts.com/q/...` link, iOS opens the app instead of Safari.

**Files:**
- Create: `static/.well-known/apple-app-site-association`

- [ ] **Step 1: Create the AASA file**

Create `static/.well-known/apple-app-site-association` (no file extension — Apple requires this exact name):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "TEAMID.com.tkaflowarts.composer"
        ],
        "components": [
          { "/": "/q/*", "comment": "QR code resolver" },
          { "/": "/sequence/*", "comment": "Shared sequences" },
          { "/": "/store/*", "comment": "Merch store" }
        ]
      }
    ]
  }
}
```

Replace `TEAMID` with your actual Apple Developer Team ID after enrollment. The file works with a placeholder — Apple only fetches it when the app is published.

- [ ] **Step 2: Verify Cloudflare serves it correctly**

After deploying, the file must be served at `https://tkaflowarts.com/.well-known/apple-app-site-association` with `Content-Type: application/json`. Cloudflare Pages serves static files from `static/` at the root — verify after deploy:

```bash
curl -I https://tkaflowarts.com/.well-known/apple-app-site-association
```

Expected: `200 OK`, `Content-Type: application/json` (or `application/octet-stream` — both work for Apple).

- [ ] **Step 3: Commit**

```bash
git add static/.well-known/apple-app-site-association
git commit -m "feat: add Apple App Site Association for Universal Links"
```

---

## Task 4: Install and Configure Capgo OTA

Capgo enables over-the-air updates — push web-layer changes to native app users without store review.

**Files:**
- Modify: `package.json` (add dependency + script)
- Modify: `capacitor.config.ts` (add plugin config)

- [ ] **Step 1: Install Capgo updater**

```bash
pnpm add @capgo/capacitor-updater
```

- [ ] **Step 2: Add Capgo plugin config**

In `capacitor.config.ts`, add to the `plugins` object:

```typescript
const config: CapacitorConfig = {
	appId: "com.tkaflowarts.composer",
	appName: "TKA Composer",
	webDir: "build",
	server: {
		androidScheme: "https",
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: true,
			launchShowDuration: 3000,
			backgroundColor: "#0b1d2a",
			androidScaleType: "CENTER_CROP",
		},
		StatusBar: {
			style: "DARK",
			backgroundColor: "#0b1d2a",
		},
		Keyboard: {
			resize: "none",
			style: "dark",
		},
		PushNotifications: {
			presentationOptions: ["badge", "sound", "alert"],
		},
		CapacitorUpdater: {
			autoUpdate: true,
		},
	},
};
```

- [ ] **Step 3: Add Capgo upload script to package.json**

Add to the `"scripts"` section:

```json
"capgo:upload": "npx @capgo/cli bundle upload"
```

- [ ] **Step 4: Sync native projects**

```bash
pnpm run build:native
```

Expected: Build completes, `cap sync` copies updated config to `android/`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml capacitor.config.ts android/
git commit -m "feat: install Capgo OTA updater for live web-layer updates"
```

---

## Task 5: Create Android CI/CD Workflow

**Files:**
- Create: `.github/workflows/android-build.yml`
- Modify: `android/app/build.gradle` (add signing config)

- [ ] **Step 1: Generate upload keystore**

Run locally (one-time, do NOT commit the keystore):

```bash
keytool -genkey -v -keystore tka-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias tka-upload
```

Follow prompts (name: "Austen Cloud", org: "TKA"). Move keystore to a safe location outside the repo.

- [ ] **Step 2: Add signing config to build.gradle**

In `android/app/build.gradle`, add a `signingConfigs` block inside `android {}`:

```groovy
android {
    namespace = "com.tkaflowarts.composer"
    compileSdk = rootProject.ext.compileSdkVersion

    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: "tka-upload"
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }

    defaultConfig {
        applicationId "com.tkaflowarts.composer"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
}
```

- [ ] **Step 3: Add GitHub secrets**

In the GitHub repo settings → Secrets → Actions, add:
- `KEYSTORE_BASE64` — base64-encoded keystore file (`base64 -w 0 tka-upload-key.jks`)
- `KEYSTORE_PASSWORD` — keystore password
- `KEY_ALIAS` — `tka-upload`
- `KEY_PASSWORD` — key password

- [ ] **Step 4: Create Android build workflow**

Create `.github/workflows/android-build.yml`:

```yaml
name: Android Build

on:
  workflow_dispatch:
  push:
    tags:
      - "v*"

jobs:
  build-android:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "17"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create .env from .env.example
        run: cp .env.example .env

      - name: Build web app (PWA disabled)
        env:
          DISABLE_PWA: "true"
        run: pnpm run build

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Decode keystore
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
        run: echo "$KEYSTORE_BASE64" | base64 -d > android/app/release.keystore

      - name: Build release AAB
        working-directory: android
        env:
          KEYSTORE_PATH: release.keystore
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: ./gradlew bundleRelease

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-aab
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/android-build.yml android/app/build.gradle
git commit -m "ci: add Android release build workflow with signing"
```

---

## Task 6: Update Web CI Workflow

The existing `web-ci.yml` uses `npm` but the project uses `pnpm`, and targets Node 22 instead of 24.

**Files:**
- Modify: `.github/workflows/web-ci.yml`

- [ ] **Step 1: Update web-ci.yml**

Replace the full contents of `.github/workflows/web-ci.yml`:

```yaml
name: Web App CI

on:
  push:
    branches: [main]
    paths-ignore:
      - "desktop/**"
      - "docs/**"
      - "*.md"
  pull_request:
    branches: [main]
    paths-ignore:
      - "desktop/**"
      - "docs/**"
      - "*.md"

jobs:
  validate:
    name: Lint, Type Check, Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create .env from .env.example
        run: cp .env.example .env

      - name: Type check (svelte-check)
        run: pnpm run check

      - name: Unit tests (Vitest)
        run: pnpm run test -- --run

      - name: Build
        run: pnpm run build
```

Note: Removed `npm run lint` — check if a `lint` script exists in package.json. If not, the step would fail.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/web-ci.yml
git commit -m "ci: update web CI to use pnpm and Node 24"
```

---

## Task 7: Sync and Verify Full Build Pipeline

**Files:** None — verification only.

- [ ] **Step 1: TypeScript check**

```bash
pnpm run check
```

Expected: No new type errors from our changes.

- [ ] **Step 2: Build web**

```bash
pnpm run build
```

Expected: Build succeeds. Verify `build/.well-known/apple-app-site-association` exists in output.

- [ ] **Step 3: Build native**

```bash
cross-env DISABLE_PWA=true pnpm run build && npx cap sync android
```

Expected: Sync completes. Console shows "√ copy android" and "√ update android".

- [ ] **Step 4: Verify AndroidManifest in synced output**

```bash
grep -n "pathPrefix" android/app/src/main/AndroidManifest.xml
```

Expected: Shows `/q/`, `/sequence/`, `/store/` — no `/p/`.

- [ ] **Step 5: Verify assetlinks.json is served**

After deploying to Cloudflare Pages:

```bash
curl -s https://tkaflowarts.com/.well-known/assetlinks.json | python -m json.tool
```

Expected: Returns the JSON with `com.tkaflowarts.composer` package name and SHA-256 fingerprints.

- [ ] **Step 6: Run unit tests**

```bash
pnpm run test -- --run
```

Expected: All tests pass. None of our changes touched test-covered code.

---

## Task 8: Version Bumping Protocol

Before each store submission, version numbers must be incremented.

**Files:**
- Modify: `android/app/build.gradle:11-12` (versionCode + versionName)
- Modify: `package.json:3` (version field)

- [ ] **Step 1: Establish version convention**

```
package.json version:    "1.0.0"  (semver, matches store listing)
android versionCode:     1        (monotonic integer, must increment every upload)
android versionName:     "1.0.0"  (human-readable, matches package.json)
iOS version:             from package.json (Capacitor reads it automatically)
```

- [ ] **Step 2: Update for first release**

In `package.json`, update version:

```json
"version": "1.0.0",
```

In `android/app/build.gradle`, verify:

```groovy
versionCode 1
versionName "1.0.0"
```

- [ ] **Step 3: Add version bump script**

Add to `package.json` scripts:

```json
"version:bump": "node -e \"const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));const [M,m,P]=p.version.split('.').map(Number);p.version=M+'.'+m+'.'+(P+1);fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n');console.log('Bumped to '+p.version)\""
```

- [ ] **Step 4: Commit**

```bash
git add package.json android/app/build.gradle
git commit -m "chore: establish version 1.0.0 for first store release"
```

---

## Task 9: Store Submission Checklist

This task is a manual checklist — no code changes, but must be completed before cards print.

### Google Play Store

- [ ] **Step 1: Create app listing in Play Console**
  - App name: "TKA Composer"
  - Category: Education → Arts & Design
  - Default language: English (United States)

- [ ] **Step 2: Complete store listing**
  - Short description (80 chars): "Create, animate, and share flow arts sequences with TKA notation."
  - Full description: Adapt from `APP_SEO_CONFIG.description` in `src/config/domains.ts`
  - Screenshots: 2 phone + 1 tablet minimum (capture from running app)
  - Feature graphic: 1024x500 PNG
  - App icon: already at `android/app/src/main/res/mipmap-*/ic_launcher.png`

- [ ] **Step 3: Privacy policy**
  - URL: `https://tkaflowarts.com/privacy`

- [ ] **Step 4: Content rating**
  - Complete IARC questionnaire (takes 5 minutes)
  - Expected rating: Everyone

- [ ] **Step 5: Upload AAB**
  - Download from GitHub Actions artifact (android-build workflow)
  - Upload to Internal Testing track first
  - Promote to Production after testing

- [ ] **Step 6: Enable Play App Signing**
  - Let Google manage the app signing key
  - Upload key in the AAB is the upload key (from Task 5)

### Apple App Store

- [ ] **Step 7: Create app in App Store Connect**
  - Bundle ID: `com.tkaflowarts.composer`
  - SKU: `tka-composer`
  - Primary language: English (U.S.)

- [ ] **Step 8: Update AASA with real Team ID**
  - Replace `TEAMID` in `static/.well-known/apple-app-site-association` with actual Team ID
  - Commit and deploy

- [ ] **Step 9: TestFlight beta**
  - Trigger iOS build workflow (GitHub Actions)
  - Download IPA artifact
  - Upload via Xcode or `xcrun altool` (requires Apple ID app-specific password)
  - Add internal testers (up to 100, no review needed)

- [ ] **Step 10: Uncomment Smart App Banner**
  - After App Store ID is assigned, uncomment the meta tag in `app.html`
  - Replace `XXXXXXXXXX` with actual ID

- [ ] **Step 11: Submit for review**
  - Screenshots, description, privacy policy (same content as Play Store)
  - App Review typically 1-3 days

---

## Summary

| Task | What | Effort |
|------|------|--------|
| 1 | Fix stale `/p/` → `/q/` in AndroidManifest + app.html | Tiny |
| 2 | Fix PWA manifest app ID + Smart App Banner placeholder | Tiny |
| 3 | Create Apple App Site Association for Universal Links | Small |
| 4 | Install + configure Capgo OTA updater | Small |
| 5 | Android CI/CD with signing | Medium |
| 6 | Fix web CI (pnpm + Node 24) | Tiny |
| 7 | Full build pipeline verification | Verification |
| 8 | Version bumping protocol | Small |
| 9 | Store submission (manual) | Manual, ~2 hours each |

**After this plan completes:** App is in both stores. OTA live updates are wired. App Links and Universal Links are verified. Smart App Banner prompts web users to install. Cards can be printed safely — every QR scan will either open the native app (if installed) or the web viewer (if not), with a prompt to install.

**Next phase:** Phase 2 (offline storage, native share, native Google sign-in, per-card tracking) — delivered via Capgo OTA updates, spec at `docs/superpowers/specs/2026-04-24-native-mobile-integration-design.md`.
