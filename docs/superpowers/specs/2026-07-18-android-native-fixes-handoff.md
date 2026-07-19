# Android Native App — Play Launch Fixes, Handoff (2026-07-18)

## Mission
Continue getting **Flow Arts Composer** (`com.tkaflowarts.composer`) usable as a
real Android app for Google Play internal testing. This session (on the
**desktop**, `E:\tka-platform`) fixed the four things that made the native shell
broken-on-first-open, and wired native Google sign-in. Picks up from
[2026-07-18-android-play-store-launch-handoff.md](file:///E:/tka-platform/docs/superpowers/specs/2026-07-18-android-play-store-launch-handoff.md)
(the binary/screenshot/Play-Console handoff — still valid; read it too).

Test device this session: Austen's **Galaxy Z Fold 6** (`SM-F956U`, serial
`RFCY30FJN5D`, Android 16), driven over adb (USB) from the desktop.

## Done — verified

1. **Client hydration restored in the native shell** (commit `562bc2707e`).
   Root cause: adapter-cloudflare serves `$env/dynamic/public` from the Worker
   (`GET /_app/env.js`); the native shell has no Worker and the asset-trim step
   deletes `_worker.js`, so the client's dynamic import of `/_app/env.js` 404'd
   and **all** hydration died (the app only ever *rendered* prerendered HTML —
   never interactive). Fix: `scripts/generate-native-env.mjs` writes a static
   `_app/env.js` from `PUBLIC_*` vars (same `export const env={…}` shape
   SvelteKit's builder emits), wired into `.github/workflows/android-build.yml`
   after the trim step.
   Evidence: on-device logcat went from `TypeError: Failed to fetch dynamically
   imported module: https://localhost/_app/env.js` (pre-fix) to `Capacitor:
   Handling local request: https://localhost/_app/env.js` (served, 200) post-fix.

2. **Native boots into the app, not the marketing landing** (commit `562bc2707e`).
   `NativeInitializer.handleDeepLink` bailed on `target === "/"`, so an icon-tap
   sat on `/`. Fix: on cold start with no deep link, `goto('/create',
   {replaceState:true})`; splash hides after that nav (no landing flash).
   Evidence: webview devtools URL was `https://localhost/` pre-fix,
   `https://localhost/create/construct` post-fix (read via `adb forward` to the
   `webview_devtools_remote_<pid>` socket + `curl localhost:<port>/json`).

3. **Safe-area / edge-to-edge: content clears the status bar + camera cutout**
   (commit `78684ad04e`). targetSdk 36 (Android 16) enforces edge-to-edge; the
   pre-15 opt-out is gone, and legacy `StatusBar.setOverlaysWebView(false)`
   doesn't reserve space. Fix: adopt the Capacitor **System Bars** core plugin
   (`capacitor.config.ts` → `SystemBars: { insetsHandling: 'css' }`) which
   injects `--safe-area-inset-*`, and reserve the top strip on `.main-interface`
   (`src/lib/shared/MainInterface.svelte`) via `padding-top:
   var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`. Mobile has no top
   nav (primary nav is the bottom bar), so that's where the cutout was eating
   content. 0 on desktop / pre-15 Android → no double-pad.
   Evidence: on-device screenshot of the Z Fold cover display (968×2376, 95px
   top cutout) shows the status bar (time/battery) clear and app content padded
   below the cutout. Screencap: `adb exec-out screencap -p -d
   4630947194243491972` (must pass `-d` for the specific display, else the
   multi-display warning corrupts the PNG stream).

4. **Native Firebase project wiring for Google sign-in** (all done via Firebase
   MCP against project `the-kinetic-alphabet`; uncommitted code, see In flight):
   - Created Android app `1:664225703033:android:1f68146814735f2cf760a8`.
   - Registered the **desktop** debug keystore SHA-1
     `FE:DB:ED:7A:44:58:26:1A:82:81:B7:3B:F2:2F:F1:35:B3:FD:E8:14` → Firebase
     auto-created the Android OAuth client.
   - Wrote `android/app/google-services.json` (includes the client_type 3 web
     client = serverClientId the plugin needs).
   - Installed `@capacitor-firebase/authentication@8.3.0`; `cap sync` registered
     `:capacitor-firebase-authentication` in the gradle project.
   Evidence: `BUILD SUCCESSFUL`; APK grew 313,837,849 → 318,316,607 bytes (+the
   Google SDK); logcat shows the `FirebaseAuthentication` plugin class loaded.

## Believed done — unverified

- **Native Google sign-in end-to-end.** Code + config + Firebase wiring are all
  in place and the debug APK is installed on the Z Fold, but the actual
  account-picker → signed-in flow was **not** completed: the phone screen was
  off (Always-On Display, charging) and completing it needs Austen's real Google
  account tap. Verification needed: wake phone → open app → **Continue with
  Google** → pick account → confirm the **native** picker appears (no browser,
  no `auth/missing-initial-state`) and it signs in.
  Note: a startup logcat line `java.lang.Exception: No user is signed in` from
  `FirebaseAuthenticationPlugin.handleIdTokenChange` is **benign** — expected
  under `skipNativeAuth: true` (the native SDK has no user; the JS SDK holds it).
- **`npm run check` / full typecheck** was NOT run this session (another
  session's `svelte-check` was running the whole time; resource-budget rule caps
  one machine-wide). The changes vite-compiled cleanly in the native build. Run
  one full check.

## In flight (uncommitted → being committed with this handoff)

The native Google auth code lands in the same commit as this doc:
- `capacitor.config.ts` — `FirebaseAuthentication { skipNativeAuth: true,
  providers: ['google.com'] }` block (SystemBars block already committed in
  `78684ad04e`).
- `src/lib/shared/auth/services/authenticator.ts` — native branch in
  `signInWithGoogle()`: `isNative()` → `FirebaseAuthentication.signInWithGoogle()`
  → `result.credential.idToken` → existing `signInWithGoogleCredential(idToken)`.
- `android/app/google-services.json` (new, tracked — not gitignored).
- `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`
  (cap-sync output registering the plugin; CI's `cap sync` regenerates these
  anyway).
- `package.json`, `pnpm-lock.yaml` — `@capacitor/{core,android,cli}@8.4.2` +
  `@capacitor-firebase/authentication@8.3.0`. **These must land together with
  `authenticator.ts`, or the CF Pages web build fails to resolve the plugin
  import.** `package.json` also carries another session's unrelated
  `vite --host 0.0.0.0 → --host ::` dev-script change that could not be
  separated in the shared file — flagged in the commit message.

NOT mine, left untouched in the working tree (other sessions): `static/_headers`
(see Gotchas — it breaks web builds), `.codex/*`, `AGENTS.md`, `launchers/*`,
`src/routes/landing/components/HeroCarouselSection.svelte`, `landing-videos.ts`,
`src/routes/test/landing-directions/*`, `scripts/batch-upload-instagram-videos.js`.

## Loose ends (ranked)

1. **Verify native Google sign-in on the Z Fold** (see Believed done). If it
   fails, logcat-filter `FirebaseAuthentication` while tapping.
2. **Laptop debug keystore SHA-1.** Each machine's `~/.android/debug.keystore`
   is unique. Only the **desktop's** debug SHA is registered in Firebase. If the
   laptop builds a debug APK, native Google sign-in will fail there until the
   **laptop's** debug SHA-1 is also registered: `keytool -list -v -keystore
   ~/.android/debug.keystore -alias androiddebugkey -storepass android` → add via
   Firebase console or MCP `firebase_create_android_sha(app_id="1:664225703033:
   android:1f68146814735f2cf760a8", sha_hash=…)`.
3. **Play production Google sign-in SHA-1.** Register the **Play App Signing**
   SHA-1 (Play Console → Setup → App signing) AND the upload-key SHA-1 in
   Firebase, or Google sign-in fails in the shipped app.
4. **`static/_headers` breaks every `npm run build`** (see Gotchas). Relocate to
   project root or remove before any web deploy.
5. **Fresh CI AAB with all these fixes.** The Play-track AAB (run `29631679747`)
   predates every fix in this handoff. After this push:
   `gh workflow run android-build.yml --ref main` → `gh run watch <id>
   --exit-status` → `gh run download <id> -n android-aab`. CI now generates
   `_app/env.js` and processes `google-services.json`.
6. **Facebook sign-in still hits the webview redirect wall in native**
   (`signInWithFacebook` → `signInWithPopup`). Either wire it through the same
   plugin (`providers: ['facebook.com']`, needs a Facebook app + Android key
   hash) or hide the Facebook button in native.
7. **Run one full `npm run check`.**
8. Everything in the original Play handoff still applies: real-account
   screenshots, store-copy sign-off, Play Console App-content declarations.

## Decisions already made (Austen — do not re-litigate)
- **Wire native Google auth fully now** (2026-07-18) — chose this over hiding
  social auth or deferring.
- Android-only; app name "Flow Arts Composer"; lean-core AAB (heavy 3D/museum/
  guide assets streamed from CDN, stripped from the bundle) — all per the
  original Play handoff.

## Gotchas (cannot be derived from code)
- **`static/_headers` (another session, untracked) breaks `npm run build`**:
  adapter-cloudflare errors "The _headers file should be placed in the project
  root rather than the static directory". This session worked around it for the
  native build by moving it aside with a trap-guaranteed restore
  (`scratchpad/native-build-guarded.sh`). It is untracked so it will NOT be
  pushed, but it breaks any local/CI web build until relocated.
- **Native builds on the desktop**: JDK is Android Studio's JBR at
  `C:\Program Files\Android\Android Studio1\jbr` (the `Android Studio` one
  without the `1` has a broken `jvm.cfg`). SDK at
  `C:\Users\Austen\AppData\Local\Android\Sdk` (adb + keytool live there).
  Build chain: `pnpm run build` → trim (`rm -rf .svelte-kit/cloudflare/{models,
  assets/museum,guides,animations}` + `rm _worker.js/_routes.json/_headers/
  _redirects`) → `node scripts/generate-native-env.mjs` → `npx cap sync android`
  → `android/gradlew assembleDebug`. Debug APK self-signs with
  `~/.android/debug.keystore` → sideloadable, and matches the SHA registered in
  Firebase.
- **The debug APK is ~313–318 MB** (unshrunk). Fine for sideload; Play still
  gets the ~119 MB CI release AAB.
- **Z Fold 6 is a multi-display device.** `screencap` without `-d` prints a
  "[Warning] Multiple…" line into stdout that corrupts the PNG. Use
  `adb exec-out screencap -p -d 4630947194243491972` (the cover display; the
  main/inner display is `4630946165277524611`). Cover display cutout inset =
  95px top.
- **Screen doze**: the phone dozes on the charger (AOD). `adb shell input
  keyevent KEYCODE_WAKEUP` + `am start` to get a live frame.
- **Phone drops off adb during long builds.** If `adb devices` is empty:
  `adb reconnect` then `adb wait-for-device`, or have Austen replug USB / re-check
  wireless debugging.
- **Git Bash mangles remote adb paths** (`/data/local/tmp/...` → a Windows
  path). Use `adb exec-out` piping to a local file, not `screencap FILE` + `pull`.
- **Firebase MCP** is authenticated as austencloud@gmail.com against project
  `the-kinetic-alphabet` (billing on). SHA registration + `google-services.json`
  retrieval + app creation all worked via MCP this session — no console needed
  for those.
