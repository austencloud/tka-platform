# Kill the Bar — App-Forward In-App-Browser Path

**Status:** design, approved 2026-07-22
**Supersedes the relevant parts of:** `docs/architecture/in-app-browser-path.md`
(that doc's "iOS escape is impossible, manual only" conclusion was based on a
stale reading of `x-safari-https://`; see §5)
**Related:** `.claude/rules/never-hand-roll.md`, `no-checkboxes.md`,
`clickables-look-like-buttons.md`, `no-layout-shift.md`

---

## 1. Why

A real visitor tapped an Instagram DM link to `/create/construct` on 2026-07-20
(iOS, Instagram in-app webview). He hit a full-screen blocker telling him
sign-in was impossible, mashed a Copy Link button that lied about succeeding,
and rescued himself only by finding Instagram's own "Open in Safari" menu 43
seconds later. In real Safari he generated 4 sequences as a guest. The blocker
prevented work that would have succeeded.

Two workflows have since landed the groundwork: the persistent-blocker was
softened to a banner, the copy button was fixed to report real success/failure,
magic-link was made primary in webviews, and named-app detection got an
allowlist patch. This spec finishes the job and reframes it **app-forward** —
the endgame is a native app in the stores (`com.tkaflowarts.composer`,
Capacitor), so the escape target is ultimately the app, not the browser.

### The platform facts this design is built on

1. **Google bans OAuth inside embedded webviews** (`disallowed_useragent`,
   enforced Google-side since July 2023, still in effect 2026). Not our bug to
   fix. Google/Facebook sign-in *cannot* work in the IG webview, by Google's
   design.
2. **iOS cannot be force-escaped from a third-party webview** in the general
   case — Apple suppresses the OS handoff that Universal Links depend on. BUT
   `x-safari-https://` reportedly opens Safari directly on iOS 17+ (confirmed
   iOS 26 on multiple devices), failing only on iOS 16 and older. So a
   near-one-tap iOS escape is achievable on the phones most users carry, with a
   guided fallback where it isn't.
3. **Android CAN be escaped/routed in one tap** via `intent://` with a
   `browser_fallback_url`. The same mechanism opens the native app if installed
   or drops to the Play Store if not.
4. **The webview experience is already fully usable** for the core product:
   guest tier needs no account, and magic-link sign-in needs no popup, redirect,
   or same-browser completion (it bridges to the app/real browser). Only
   Google/Facebook OAuth is broken, and that is gated at the buttons.

### App status (2026-07-22)

The Composer app is **not yet published** — no store listings, and
`static/.well-known/apple-app-site-association` still carries the literal
placeholder `TEAMID.com.tkaflowarts.composer`. Publishing is intended ASAP.
Therefore the app-forward path is **designed in full but gated behind a single
`appLaunched` flag**, so store-launch is a one-line flip, not a component hunt.

---

## 2. Scope

### Phase A — ships now, independent of app status

1. **Kill the persistent banner.** The bar no longer appears on arrival. It is
   replaced by a compact, sign-in-intent-triggered note (§4). A visitor who
   never taps Google/Facebook never sees escape chrome at all — they use the app
   as a guest, exactly as intended.
2. **Delete the generic iOS heuristic.** `in-app-browser-detector.ts` currently
   flags any iOS UA lacking `Safari` (`:183`), then patches the Opera false
   positive with an `IOS_REAL_BROWSERS` allowlist. Remove the generic heuristic
   entirely; match **named apps only** (`Instagram`, `FBAN`, `FBAV`,
   `Messenger`, `Line/`, `TikTok`, etc. — the existing pattern list). This is
   the senior-recommended correction: named-app matching cannot false-positive a
   real browser, so the allowlist becomes unnecessary and is removed with it.
3. **Magic-link as the web→app identity bridge.** Already primary in webviews;
   this spec only reframes its copy so it reads as the bridge ("we email you a
   link — open it in Safari or the app and you are signed in there"). No new
   auth mechanics.
4. **iOS near-one-tap escape** (§5): `x-safari-https://` on iOS 17+, with the
   existing 1.5s visibility-timer failure detection and a pointed-menu fallback.
5. **Android one-tap escape** targeting the browser for now (the only real
   escape while the app is unpublished).

### Phase B — designed now, gated behind `appLaunched`, flipped at store launch

6. **`escape-target.ts`** — the single source of truth (§3). Every consumer asks
   it what the escape action, label, and URL are. Today it returns browser
   targets; when `appLaunched` flips, it returns app targets. Nothing else
   changes.
7. **Android smart app-link:**
   `intent://{host}{path}#Intent;scheme=https;package=com.tkaflowarts.composer;S.browser_fallback_url={playStoreUrl};end`
   — opens the app if installed, Play Store if not, one tap.
8. **iOS app path:** finish the AASA with the real Apple Team ID (manual step,
   §7) and an App Store "Get the app" link.
9. **`/q/` card → native app.** `AndroidManifest.xml` already declares
   `autoVerify` App Links for `/q/`, `/sequence/`, `/store/`; this completes the
   store fallback and the iOS side so scanning a physical LOOP card opens the
   app directly.

### Deferred — documented, NOT built this pass

- **Deferred deep linking** (a store install landing on the intended sequence).
  Android is clean and free via the Play Install Referrer; iOS is degraded
  post-ATT and needs an SDK (Branch/AppsFlyer). Do **not** add an SDK until
  there is install volume to justify it — the Android intent already covers the
  largest slice for free. Revisit when the app has traction.
- **Passkeys** as a real-browser auth enhancement. Not a webview primary
  (third-party webviews often do not expose the credential manager); magic-link
  stays the webview primary. Revisit alongside native-app auth polish.

---

## 3. The one architectural device: `escape-target.ts`

A new pure module, `src/lib/shared/auth/services/escape-target.ts`:

```ts
export type EscapeMethod =
  | "android_intent"      // fire intent://, watch for handoff
  | "ios_scheme"          // fire x-safari-https://, watch for handoff
  | "ios_instructions"    // pointed ••• menu guide + copy
  | "generic_instructions"; // desktop-client webviews (Discord/Slack/etc.)

export interface EscapeTarget {
  method: EscapeMethod;
  label: string;          // button text, e.g. "Open in Safari" / "Get the app"
  url: string | null;     // scheme/intent URL to fire, or null for guide-only
  isAppTarget: boolean;   // routing to the app vs the browser
}

export function resolveEscapeTarget(input: {
  platform: "ios" | "android" | "other";
  iosMajorVersion: number | null;   // parsed from UA; null if unknown
  appLaunched: boolean;             // the launch flag
  currentUrl: string;
}): EscapeTarget;
```

Rules the resolver encodes:

| platform | appLaunched | result |
|---|---|---|
| android | false | `android_intent` → browser intent + browser fallback, label "Open in Chrome" |
| android | true | `android_intent` → app intent (`package=`) + Play Store fallback, label "Open in the app" |
| ios ≥17 | false | `ios_scheme` → `x-safari-https://…`, label "Open in Safari" |
| ios ≥17 | true | `ios_scheme` first (Safari), then the app is reachable via the store/App Store link surfaced in the note; label "Open in Safari" |
| ios <17 or null | any | `ios_instructions` → pointed ••• guide + copy, no scheme fired (avoids the "invalid page" dialog on old iOS) |
| other | any | `generic_instructions` → named-menu guide + copy |

The `appLaunched` flag, the Play Store URL, and the App Store URL live in one
config object (env-backed, e.g. `PUBLIC_APP_LAUNCHED`, `PUBLIC_APP_STORE_URL`,
`PUBLIC_PLAY_STORE_URL`) so launch is a deploy-time flip with no code change.
A `?appLaunched=1` query override exercises Phase B before the real flag flips
(mirrors the existing `?forceIAB` test hook).

The resolver is a pure function of its inputs — unit-tested directly across the
platform × version × appLaunched matrix, with no DOM.

---

## 4. Trigger model — from arrival-blocker to intent-note

**Remove:** the arrival banner (`showingBanner = isInAppBrowser && !dismissed`
in `InAppBrowserPrompt.svelte`). Nothing escape-related renders on page load.

**Add:** a compact inline note owned by the auth surface, shown only when a
detected-in-app-browser visitor taps Google or Facebook — the exact point where
OAuth is about to fail. `SocialAuthCompact.svelte` already gates those buttons;
this wires the tap to reveal the note instead of (or alongside) the inline error
string.

The note is compact (not a full sheet, per decision 2026-07-22):

```
Google sign-in is blocked in this browser.
Use the email link above — or:
[ Open in Safari ]        ← primary, fires the escape target
Tap ••• then "Open in Browser"   ← pointed fallback text, always visible
[ Copy Link ]             ← secondary, the fixed copy control
```

- The `[ Open in Safari ]` / `[ Open in Chrome ]` / `[ Get the app ]` label and
  action come entirely from `resolveEscapeTarget()`.
- The note is a styled control block, not a bare text link
  (`clickables-look-like-buttons.md`): real buttons, 44px targets, visible
  affordance.
- No layout shift when the note appears — reserve its space or animate height
  from a measured value (`no-layout-shift.md`).
- No `<input type="checkbox">` anywhere (`no-checkboxes.md`); the copy-fallback
  field stays a `readonly` text input as already built.

**One escape surface, not two.** The compact note is the *only* escape surface.
The full-screen sheet and arrival banner in `InAppBrowserPrompt.svelte` are both
removed. The reusable escape machinery — the `x-safari-https://`/`intent://`
fire, the visibility failure-watcher, the pointed ••• guide, and the fixed
copy-fallback — is extracted into a small child component
(`InAppEscapeControls.svelte`) that the compact note renders inline and expands
in place on failure. Nothing opens a second full-screen layer; the note grows to
show the guide/copy when the escape scheme reports `stayed`. This keeps the
`SocialAuthCompact.svelte` host thin (it owns the trigger and reveal, not the
escape internals) and gives the copy/guide logic one home instead of two.

---

## 5. iOS escape — try-optimistic, measured

Corrects the prior doc. `x-safari-https://` is fired on **iOS 17+** only
(parsed from the UA, which already carries the version — seen as `iOS 18.7`,
`iOS 26.5` in production). On iOS 16 and older, or when the version can't be
parsed, skip the scheme and go straight to the pointed-menu guide — this avoids
the native "Cannot open this page because it is invalid" dialog that firing an
unsupported scheme produces.

Flow on a supported iOS:

1. Tap `[ Open in Safari ]` → fire `x-safari-https://{currentUrlWithoutScheme}`.
2. Reuse the existing failure watcher (`visibilitychange` + `pagehide` +
   1500ms timer). If the page hides, it worked → `inapp_browser_escape_result`
   `outcome: "left"`.
3. If still visible after 1500ms → `outcome: "stayed"`; the pointed-menu guide
   and Copy Link are already on screen in the compact note, so nothing new needs
   to appear.

**This is shipped as a measured bet, not a certainty.** The
`inapp_browser_escape_result` telemetry records the real-world hand-off rate. If
iOS success is high, it is effectively the one-tap the product wants; if Meta
tightens and it drops, the telemetry shows it and the fallback already caught
everyone. Decision to keep/pull the scheme is evidence-driven post-launch.

The pointed-menu guide points at Instagram's ••• control (top-right in IG's iOS
webview) with "Tap ••• then Open in Browser." Copy Link uses the already-fixed
`handleCopyUrl` (reports real success/failure, reveals a selectable field on
total failure).

---

## 6. Telemetry

Reuse the `inapp_browser_*` events the last workflow added. Add/extend:

- `inapp_browser_escape_attempted` — `{ method, platform, ios_major, app_launched, route }`
- `inapp_browser_escape_result` — `{ method, outcome: "left"|"stayed", route }`
  (the load-bearing metric — the real hand-off rate that decides §5's bet)
- `inapp_get_app_clicked` — `{ platform, app_launched, route }` (post-launch:
  app conversion from social traffic)
- `inapp_browser_signin_intent` — fired when the note is revealed by a
  Google/FB tap, so the funnel is: intent → escape attempted → escape result.

All go through `captureEvent` directly (arbitrary event name; no closed-union
registration needed).

---

## 7. Manual steps (flagged, not code)

1. **Apple Team ID** — replace `TEAMID` in
   `static/.well-known/apple-app-site-association` with the real Apple Developer
   Team ID before iOS Universal Links / the app path can work. Cannot be
   grepped or guessed; only Austen has it.
2. **Store listings + URLs** — set `PUBLIC_APP_STORE_URL` and
   `PUBLIC_PLAY_STORE_URL` to the live listings and flip `PUBLIC_APP_LAUNCHED=1`
   at launch. Until then the resolver returns browser targets and the app path
   is dormant.
3. **Android `assetlinks.json`** — confirm the SHA-256 signing-cert fingerprint
   matches the published app once it exists.

---

## 8. Files

**New:**
- `src/lib/shared/auth/services/escape-target.ts` — the resolver (pure).
- `src/lib/shared/auth/services/escape-target.test.ts` — matrix unit tests.
- `InAppEscapeControls.svelte` — the extracted escape machinery (scheme/intent
  fire, failure-watcher, pointed guide, copy-fallback). Rendered inline by the
  compact note; carries over the already-landed `handleCopyUrl` and layout fixes
  verbatim.

**Edited:**
- `in-app-browser-detector.ts` — drop the generic iOS heuristic + allowlist;
  add UA iOS-version parse; delegate escape resolution to `escape-target.ts`.
- `InAppBrowserPrompt.svelte` — **remove** the arrival banner and the
  full-screen sheet. Its escape internals move to `InAppEscapeControls.svelte`.
  If nothing else remains, the file is deleted and its mount point in
  `src/routes/+layout.svelte` removed; if a thin host is still useful, it keeps
  only the detection wiring.
- `SocialAuthCompact.svelte` — reveal the compact note (hosting
  `InAppEscapeControls`) on a webview Google/FB tap; fire
  `inapp_browser_signin_intent`. Stays thin — trigger and reveal only.
- `EmailLinkAuth.svelte` — bridge-framed copy (no mechanics change).
- Env/config wiring for `PUBLIC_APP_LAUNCHED` / store URLs.

**Config-only, launch-time:**
- `apple-app-site-association` (Team ID), env flags.

---

## 9. Testing

- **Resolver:** pure-function unit matrix — platform × iosMajorVersion ×
  appLaunched → expected `EscapeTarget`. No DOM.
- **`?forceIAB` matrix** still exercises the detector: `true` (real detection),
  `ios`, `android`, `other`.
- **`?appLaunched=1`** override exercises Phase B (app targets) before the real
  flag flips.
- **Manual on device:** iOS 17+ IG webview → `[ Open in Safari ]` opens Safari;
  iOS 16 → straight to pointed guide, no error dialog; Android → intent handoff;
  native app deep-link (the Capacitor carve-out must suppress all of this — the
  native shell is itself a WebView and must never see the note).
- **Regression guard:** a normal desktop/mobile browser must see **no** escape
  chrome — the named-app-only detection is what prevents the false positive that
  the deleted generic heuristic caused.

---

## 10. Non-goals

- No attempt to make Google/Facebook OAuth work in the webview. Google forbids
  it; the design routes around it.
- No deferred-deep-linking SDK this pass.
- No passkeys this pass.
- No change to normal-browser auth presentation — only the detected-in-app case
  changes.
