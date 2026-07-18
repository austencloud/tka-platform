# Flow Arts Composer, Google Play Launch, Handoff (2026-07-18)

## Mission
Get the Android app **Flow Arts Composer** (`com.tkaflowarts.composer`) live on
Google Play **internal testing** so Austen can install it and hand it to people.
Austen's original block was screenshots he was never satisfied with across
device sizes; that pipeline is now fixed. iOS is deferred (Austen is not
enrolled in the Apple Developer Program, and chose Android-only for now). The
binary side is **done and verified**; what remains is content (screenshots +
copy) and Play Console clicks (done via the "Claude in Chrome" browser agent,
which Austen drives).

This handoff was written on a laptop; Austen is moving to his **desktop** (a
different machine). Everything in `main` + GitHub (secrets, CI, this doc)
transfers automatically. Session-local artifacts do NOT (see Gotchas).

## Done, verified

1. **Three CI-build bugs fixed and merged to `main`** (merge commit
   `e38b52b0d7` "merge: consolidate chore/native-build-asset-tolerance into
   main"). These were failing the Android, iOS, and web CI builds on main.
   - `svelte.config.js`: `handleHttpError` now tolerates missing synced-asset
     dirs (`/notation/`, `/thumbnails/`, `/Explore_thumbnails/`), same as the
     pre-existing `/pwa/` allowance. Evidence: `git show
     origin/main:svelte.config.js | grep -c "notation/"` -> 1.
   - `capacitor.config.ts`: `webDir` changed from stale `build/` to the real
     adapter output `.svelte-kit/cloudflare`. Evidence: `git show
     origin/main:capacitor.config.ts | grep webDir` -> `.svelte-kit/cloudflare`.
   - `.github/workflows/android-build.yml`: added a "Trim heavy assets" step
     that strips `models/`, `assets/museum`, `guides/`, `animations/`, and the
     SSR `_worker.js` before `cap sync` (338MB -> 119MB).

2. **Screenshot pipeline repaired** (was dead since ~February; verified on
   `origin/main`). Four breakages fixed:
   - `scripts/take-screenshots.ts`: dev-server probe was `http://`; now probes
     `https://` first then falls back (server is mkcert HTTPS/h2). Evidence:
     `git show origin/main:scripts/take-screenshots.ts | grep -c probeHttps` -> 3.
   - `tests/screenshots/screenshot.config.ts`: `baseURL` now protocol-adaptive
     (`useHttps` from `.cert/`) + `ignoreHTTPSErrors: true`. Evidence: grep on
     origin/main -> 3.
   - `tests/screenshots/capture.spec.ts`: bumped `SELECTOR_WAIT`/
     `LOADING_DISAPPEAR` to 25000 and replaced the flaky 300ms loading probe
     with a poll (`loadingDeadline`) for the vite dev on-demand-compile lag.
   - `@playwright/test@1.61.1` reinstalled (had been dropped from deps) and
     `npx playwright install chromium` run. Evidence: `@playwright/test` in
     `origin/main:package.json`.
   - Proof it works: a real capture of `compose--arrange` at **1290x2796** (the
     exact App Store 6.9" size). NOTE the capture showed the **logged-out guest
     state** (empty gallery, "Log in" modal) because the bot account does not
     exist. See Loose end #1.

3. **Signed AAB built, Play-acceptable size.** CI run `29631679747` (branch
   chore/native-build-asset-tolerance, now in main) succeeded all steps.
   Artifact `android-aab` (30-day retention). Downloaded copy on the laptop:
   `C:\Users\Austen\tka-android-build\app-release.aab`, **119MB**
   (125,690,115 bytes), signed with the `tka-upload` key. Evidence:
   `unzip -l app-release.aab | grep TKA-UPLO` -> `META-INF/TKA-UPLO.RSA` +
   `.SF` + valid `BundleConfig.pb` / `base/manifest/AndroidManifest.xml`.

4. **Installable universal APK** built via bundletool 1.17.2:
   `C:\Users\Austen\tka-android-build\app-flow-arts-composer.apk`, 127MB, signed.

5. **App verified running on Android.** Installed + launched on a Pixel-6 /
   API-34 emulator (SwiftShader software GL). Process stayed alive
   (`pidof` stable), `topResumedActivity=com.tkaflowarts.composer/.MainActivity`,
   logcat `Displayed .../.MainActivity +20s`. Rendered the real UI: TKA logo,
   "The Kinetic Alphabet, Notation for Flow Arts" hero, "Open Flow Arts
   Composer" button (screenshots on laptop: `tka-android-build\emulator-shot3.png`,
   `emulator-shot4.png`). The recurring "System UI isn't responding" dialogs
   were the EMULATOR's own system processes choking on software GL, not the app.

## Believed done, unverified

- **The app is functionally correct on a real device.** Only proven in an
  emulator, which is a poor host (no GPU) for this WebGL/Three.js-heavy app.
  Needs an install on Austen's real Android phone (hardware GL). The APK above
  sideloads: copy to phone, tap, allow "install unknown apps", Install.
- **`npm run check` / full typecheck was NOT run** on the screenshot-tooling
  edits (laptop RAM was down to ~1.8GB; a 5-8GB svelte-check would have paged
  the machine per `resource-budget.md`). The tooling ran successfully at
  runtime (captures produced), so it is functionally verified but not
  type-checked. Run one full check on the desktop.

## In flight
- Nothing of mine is uncommitted. All code is on `origin/main`.
- The working tree has OTHER sessions' changes (`MandalaSection.svelte`,
  `src/routes/test/landing-directions/`, `mandala-pick/`,
  `landing-directions-contract.test.ts`). NOT mine. Do not touch.
- `tests/screenshots/credentials.local.json` exists on the laptop (gitignored,
  holds the non-existent bot creds). Will not transfer; recreate on desktop.

## Loose ends (ranked)

1. **Re-shoot screenshots with Austen's REAL account.** The pipeline works but
   the `tka-screenshot-bot@test.com` account does not exist in Firebase, so
   every app screen captured as a logged-out guest (empty). Austen has an
   email/password login (he usually uses Google). Get his TKA email+password,
   put them in `tests/screenshots/credentials.local.json`
   (`{ "email": "...", "password": "..." }`, gitignored), then run
   `npm run screenshots` (needs his dev server on :5173, or `vite --port 5174`
   against a fresh build). The login flow is email/password only (cannot drive
   Google sign-in): `capture.spec.ts` -> `loginWithCredentials`. Optional
   polish: a Sharp compositor (Sharp is already a dep) to normalize captures to
   exact per-store canvas sizes with device frames + a caption headline.
   iPhone-16-Pro-Max capture is already exactly 1290x2796 (App Store 6.9").

2. **Get Austen's sign-off on the store copy** (drafted below, already
   ai-bust-clean). Then it goes into the Play listing.

3. **Play Console finish (browser agent, Austen runs it).** Generate a single
   copy-paste "Claude in Chrome" prompt (Phase-2) that:
   - Uploads `app-release.aab` to the **Internal testing** track and creates a
     release.
   - **Renames the app** from "TKA Composer" to "Flow Arts Composer" (the draft
     app currently has the wrong display name; the AAB itself is already
     labeled "Flow Arts Composer").
   - Fills the store listing (title/short/full description + release notes from
     the copy below) and uploads the screenshots + the existing feature graphic
     (`static/branding/feature-graphic.png`).
   - Completes the outstanding **App content** declarations: Ads, Target
     audience and content, **Data safety**, Government apps, Financial features,
     Health apps. (Privacy policy, Sign-in details, Content ratings are already
     done, per the browser audit on 2026-07-17.)
   - Data safety needs FACTUAL confirmation from Austen before answering (do not
     guess; wrong Data-safety answers can get an app pulled). Known stack:
     Firebase Auth (email), Firestore (user-created sequences), PostHog
     analytics (`posthog-js`). Confirm crash reporting, ad IDs, and exact
     collected fields with Austen.

4. **Get a fresh AAB on the desktop.** Either
   `gh run download 29631679747 -n android-aab` (30-day retention), or
   re-dispatch a clean build from main: `gh workflow run android-build.yml
   --ref main`, watch with `gh run watch <id> --exit-status`, then
   `gh run download <id> -n android-aab`. CI signs it from the GitHub secrets,
   so no local keystore is required.

5. **Follow-up spec (not blocking launch): stream the trimmed heavy assets from
   CDN for native.** The lean build 404s on `models/` (3D scenes), `museum`,
   and guide PDFs because they were stripped to fit under 200MB. On the web
   they are served from the site origin; for native, point the loaders at the
   absolute CDN URL (e.g. `https://tkaflowarts.com/models/...`) so the ocean
   scene etc. stream on demand, or use Play Asset Delivery. Write a design spec.

6. **iOS (deferred).** When Austen enrolls in the Apple Developer Program, wire
   code signing + a TestFlight upload step into `.github/workflows/ios-build.yml`
   (it currently builds an UNSIGNED IPA and has an `upload_to_testflight` input
   with no upload step). Needs an App Store Connect API key as GitHub secrets.

## Store copy (drafted, ai-bust-clean, awaiting Austen's ok)

**Title (18/30):** Flow Arts Composer

**Short description (60/80):** Choreograph flow arts sequences with staff and
prop notation.

**Full description:**
> Flow Arts Composer is a choreography toolbox for spinners. Build movement
> sequences for staves, fans, and other props, write them down in a real
> notation system, and watch them play back before you pick up your props.
>
> At the center is The Kinetic Alphabet. It notates prop movement the way sheet
> music notates sound: every start position, hand path, and turn gets a symbol.
> Learn to read it and a sequence stops living only in your muscle memory. It
> becomes something you can save, study, take apart, and hand to another spinner
> who has never seen you move.
>
> You can build a sequence by hand one step at a time, or generate one and edit
> from there. Every sequence plays back as an animated pictograph, so you see
> the shape of the movement first. There is a library to browse when you want
> ideas, a guide and concept lessons when you want to actually learn the system,
> and a share button that turns any sequence into a link or a scannable code
> that opens straight into the app.
>
> Staves come first, because that is what the notation was designed around.
> Fans, clubs, and buugeng work too.
>
> Free to use. Sign in to keep your library synced across devices, or start as
> a guest and look around.
>
> Found a bug or a gap? The in-app feedback button reaches the developer
> directly.

**Release notes (v1.0.0):**
> First release of Flow Arts Composer for Android. Build and notate flow arts
> sequences, play them back as animated pictographs, browse the library, and
> learn The Kinetic Alphabet. Sign in to sync your work across devices.

(Poi is deliberately omitted from the prop list per the TKA framing rule.)

## Decisions already made (Austen, 2026-07-18, do not re-litigate)
- **Android only for now.** Not enrolled in Apple Developer Program; iOS is a
  later, separate effort.
- **App name is "Flow Arts Composer"** (not the draft's "TKA Composer"). The
  strings.xml + capacitor.config already say "Flow Arts Composer"; only the
  Play listing name is wrong.
- **Lean core AAB** for the first build: strip the heavy 3D/museum/guide assets
  now, stream them from the CDN in a fast-follow. (The 3D scenes are not gone;
  they just should not ship inside a 340MB APK. See Loose end #5.)
- Play account is a **Personal** account **SUBJECT** to the 12-tester / 14-day
  closed-testing gate before public production (dashboard shows "0 testers
  opted in"). So: internal testing is installable tomorrow; PUBLIC production
  is 14+ days out regardless. Google account: austencloud@gmail.com.

## Gotchas (cannot be derived from code)
- **Session-local artifacts live only on the LAPTOP** and will not be on the
  desktop:
  - `C:\Users\Austen\tka-keystore\` — the upload keystore (`tka-upload.jks`),
    `keystore.properties` (holds the password), and the base64. **This is the
    app's signing identity forever; Austen must copy this folder to the desktop
    and back it up.** It is ALSO in GitHub repo secrets `KEYSTORE_BASE64`,
    `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`tka-upload`), `KEY_PASSWORD`, so CI
    rebuilds are signed on any machine without the local file. Do NOT put the
    password in git.
  - `C:\Users\Austen\tka-android-build\` — the AAB, APK, emulator screenshots.
    Regenerable via CI (Loose end #4).
  - `C:\tka-platform\.tools\` — portable JDK 21, Android SDK (AVD `tka_test`),
    bundletool. Gitignored. Regenerable if the desktop needs a local
    emulator/keytool.
- **`npm run build` outputs to `.svelte-kit/cloudflare`, not `build/`** (adapter
  is `@sveltejs/adapter-cloudflare`). The app has 25 `+server.ts` API routes, so
  a pure static adapter would fail the build; the Capacitor shell ships the
  cloudflare client bundle + app shell and those API routes simply do not run in
  the native shell (core is client-side Firebase, which is fine).
- **The emulator is a bad daily test bed** for this app (software GL -> constant
  system ANRs). Use a real phone (hardware GL). First emulator boot with
  `-gpu auto` crashed (host GPU); `-gpu swiftshader_indirect` was stable but
  slow. Screencap to `/data/local/tmp/` (not `/sdcard/`, permission denied on
  API 34).
- **Do NOT commit credentials/passwords** to the repo (bot creds, keystore
  password, any real login).
- **Play is 200MB max download**, hard. Bigger needs Play Asset Delivery or CDN
  streaming (Loose end #5). This is why the build is trimmed.
- The "Claude in Chrome" browser agent runs in Austen's logged-in Chrome debug
  profile at `C:\Users\Austen\.chrome-tka-debug` (launch with
  `--remote-debugging-port=9222`). It already did the Phase-1 Play/Apple audit
  on 2026-07-17.
