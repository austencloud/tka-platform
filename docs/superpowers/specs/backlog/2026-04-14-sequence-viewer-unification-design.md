---
status: backlog
value: 4
effort: M
score: 12
remaining: "Route consolidation — merge /p/ and /sequence/ into one shell"
last_triaged: 2026-04-26
---
# Sequence Viewer Unification

## Goal

Collapse the guest and signed-in viewer experiences into a single UI, replace the generic "Get App" button with intent-preserving auth flows, and consolidate the two duplicated route wrappers (`/sequence/[id]` and `/p/[code]`) into one shared shell.

The design target is: a person who scans a printed QR code sees the same viewer as someone who opened the sequence inside the app. When they try to do something that requires an account (save, favorite, publish, remix), the action they attempted is preserved across sign-in and fires automatically afterward — they never have to click the thing twice.

## Current State

There are three hosts that all render the same `SequenceViewerOrchestrator`:

| Host | File | Purpose |
|------|------|---------|
| `/sequence/[id]` route | `src/routes/sequence/[id]/+page.svelte` | Shareable deep links |
| `/p/[code]` route | `src/routes/p/[code]/+page.svelte` | QR-code short-code resolver |
| Drawer host | `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | In-app viewer (Browse gallery → drawer) |

All playback features — play/pause, BPM, step, fullscreen, 3D viewer, practice mode, export — live in the shared orchestrator and work identically. The "divergence" users perceive is entirely driven by feature gating inside `ViewerFooter.svelte`:

- `ViewerFooter.svelte:197, 314, 451` branch on `isLoggedIn`. Save, Favorite, Publish, Remix, Delete all live inside the `{#if isLoggedIn}` block.
- The `{:else}` branch shows a single **Get App** button (`ViewerFooter.svelte:348–358, 503–511`) handled by `handleGetApp()` in `SequenceViewerOrchestrator.svelte:1566–1579`.
- `handleGetApp()` attempts an Android intent URI, then falls back to `window.open(url, "_blank")`. It does **not** link to any app store. Its real job is escaping in-app webviews (Instagram, Facebook, TikTok) so auth can work.

Drift between the two routes (from git history):

- `/p/[code]` never received commit `a183cd88d9` — the mobile `Viewer3DFullscreen` overlay and `initialRenderMode` prop wiring (`/sequence/[id]/+page.svelte:85, 554–569`).
- `/p/+layout@.svelte` is bare (16 lines, no theme background). `/sequence/+layout.svelte` renders the theme canvas.
- `/p/[code]/+page.svelte:414` has a no-op `updateUrlParam` — URL state (`?bpm=`, `?t=`, `?view=`) doesn't persist on QR routes.
- `/p/[code]/+page.svelte:52` cross-imports `RouteViewerHeader` from the sibling route. The two files are ~90% identical.

## Goals / Non-Goals

**In scope:**

1. Remove the `{#if isLoggedIn}` / `{:else}` split from `ViewerFooter.svelte`. All action buttons shown to everyone.
2. A pending-action queue that captures intent pre-auth and replays it post-auth.
3. An inline sign-in sheet triggered by gated button clicks.
4. Webview detection and a contextual "Open in browser" fallback that preserves the pending action across the browser jump.
5. Consolidate the two route files into one shared shell. Backfill the `/p/[code]` drift (theme background, mobile 3D fullscreen, opt-in URL param persistence).
6. Rename `handleGetApp` → `handleOpenInBrowser` and restrict to webview-only.

**Out of scope (separate specs):**

- **Deferred deep linking** (intent survives a browser → App Store → app install jump). Post-Firebase-Dynamic-Links landscape needs its own design spec.
- **Short code governance** (character set, collision handling, deletion/tombstone behavior, visually-ambiguous characters, per-deck namespaces). Printed QR codes are irreversible; governance deserves its own focus.
- **Capacitor wrapping and Universal Link / App Link manifests.** Covered in `2026-04-13-capacitor-integration-design.md`. This spec assumes those ship alongside.
- **Guest access tier mechanics** (8-beat limit, etc. from `project_guest_access_tier.md`). That's a product-tier question; this spec is about UX unification of an already-shared viewer.

## Architecture

Three new pieces, one deletion, one consolidation.

### New: Pending-action queue

A single in-memory + URL-backed queue that captures "what did the user just try to do." Exactly one entry at a time — newer writes replace older ones. Authored as a DI service following the project's service-naming conventions (`PendingActionQueue` implementing `IPendingActionQueue`).

**Shape:**

```ts
type PendingAction =
  | { type: 'save'; sequenceId: string; ts: number }
  | { type: 'favorite'; sequenceId: string; ts: number }
  | { type: 'publish'; sequenceId: string; ts: number }
  | { type: 'remix'; sequenceId: string; ts: number }
  | { type: 'sendTo'; sequenceId: string; ts: number };
```

**Lifecycle:**

1. **Enqueue from click.** A guest clicks a gated button. The footer handler calls `pendingActionQueue.enqueue({ type, sequenceId })`, writes `?pending=<type>` to the URL (shallow navigation, no reload), and opens the sign-in sheet.
2. **Enqueue from URL.** On mount, the orchestrator reads `?pending=<type>` and enqueues it. This is how the pending action survives a webview → real-browser jump.
3. **Replay on auth.** `authState.isAuthenticated` subscriber: when it flips from false to true and the queue is non-empty, execute the action (dispatch to the existing save/favorite/publish/remix handlers), clear the queue, remove the `?pending=` param.
4. **Expiry.** Entries older than 10 minutes are dropped on read. A pending action from yesterday has no business firing today.
5. **Dismissal clears it.** If the user dismisses the sign-in sheet, the queue clears and the URL param is removed. Re-opening it requires another click.

**Storage:** In-memory runes state plus the URL param. Not localStorage — localStorage survives too long and creates ghost actions. The URL param is the only persistence, and only because webviews need to hand off to real browsers.

### New: Inline sign-in sheet

A single `SignInSheet.svelte` component, bottom sheet on mobile, centered modal on desktop. Triggered by the pending-action queue. Dismissable by backdrop tap, Escape, or a close button.

**Contents:**

- Title: context-specific copy derived from the pending action type. "Sign in to save this to your library." / "Sign in to favorite this sequence." / "Sign in to publish." Never just "Sign in" with no context.
- One primary button: Google one-tap (Firebase `signInWithPopup` on desktop, Google Identity Services one-tap on mobile web, the existing `authState.signInWithGoogle` pipeline).
- A secondary tertiary link: "Other options" expands to email/password and Apple (whatever the app supports today; do not add new providers in this spec).
- No "continue as guest" — that's the default state they're already in.

**Dismissable, not blocking.** The point is conversion, not coercion. If they close the sheet, they're back on the viewer, nothing lost, they can replay by clicking the same button again.

### New: Webview detection + "Open in browser" path

A small `WebviewDetector` service. UA-based detection for Instagram, Facebook, TikTok, LinkedIn, Twitter/X, Pinterest, Snapchat in-app browsers. Not comprehensive — doesn't need to be. False negatives degrade gracefully (sign-in popup just fails, user retries in browser). False positives are worse (annoying redirect for someone in real Chrome), so the detector errs toward false-negative.

When `webviewDetector.isInAppWebview` is true AND the sign-in sheet is about to appear:

1. Sheet copy switches: "Saving works best in your browser. We'll open this sequence in Chrome so you can sign in — your save will happen automatically."
2. Primary button becomes "Continue in browser" (not "Sign in with Google").
3. Click fires the existing `handleOpenInBrowser()` (renamed from `handleGetApp`) which uses the Android intent URI and `window.open` fallback — but critically, the URL it opens now includes `?pending=<type>` so the real browser picks it up on load.

### Rename: `handleGetApp` → `handleOpenInBrowser`

Same implementation (Android intent URI + `window.open` fallback). New name accurately describes what it does. Callers: only the webview branch of the sign-in sheet. The standalone "Get App" button in the footer is **deleted** — webview-only escape is not a primary footer action.

### Deletion: `{#if isLoggedIn}` branch in `ViewerFooter.svelte`

Remove the auth branching at `ViewerFooter.svelte:197, 314, 451`. Save, Favorite, Publish, Remix, Delete render for everyone. Delete is still owner-gated — `canDelete` stays, but it's based on ownership, not generic "is logged in."

The Get App button at `ViewerFooter.svelte:348–358, 503–511` is deleted outright — no replacement in the footer.

### Consolidation: Route shell

One new component `src/lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte` containing the ~90% shared body of `/sequence/[id]/+page.svelte` and `/p/[code]/+page.svelte`. It takes the resolved sequence and its metadata as props and renders the orchestrator with all the shared plumbing — `ViewerSplitPane`, `ViewerFooter`, `ExportVideoDrawer`, `ExportImagePanel`, `VideoPreviewPanel`, `PracticeProgressIndicator`, `ChoreoCardContextMenuHost`, `CardSettingsModal`, mobile `Viewer3DFullscreen`, and the IAB banner padding.

Each route file becomes a thin resolver:

- `/sequence/[id]/+page.svelte`: decodes the URL-encoded ID, loads the sequence, passes it to `SequenceViewerRoute`. Wires `updateUrlParam` for persistence.
- `/p/[code]/+page.svelte`: resolves the short code via Firebase, loads the sequence, passes it to `SequenceViewerRoute`. Wires `updateUrlParam` identically — the "QR viewers don't need URL persistence" intentional no-op is removed (see "Drift fixes" below).

`RouteViewerHeader.svelte` moves out of `/sequence/[id]/` and into `src/lib/shared/sequence-viewer/components/` since both routes use it.

## Drift Fixes

Applied during consolidation. After the shared shell lands, these just work everywhere:

1. **Theme background on `/p/[code]`.** `/p/+layout@.svelte` gets the same theme canvas as `/sequence/+layout.svelte`. Either switch `/p` to use the shared layout or inline the theme canvas markup.
2. **Mobile `Viewer3DFullscreen` + `initialRenderMode`.** Lives in the shared shell; both routes get it for free.
3. **URL param persistence on `/p/[code]`.** `?bpm=`, `?t=`, `?view=` persist on short-code routes too. The earlier "QR viewers don't need state persistence" rationale doesn't hold up: if someone scans a card, scrubs to beat 4, and reloads, they expect to land back on beat 4.

## Data Flow

```
Guest clicks Save
  │
  ▼
ViewerFooter.onSaveClick()
  │
  ├─ if (authState.isAuthenticated) → existing save path (unchanged)
  │
  └─ else
     pendingActionQueue.enqueue({type: 'save', sequenceId})
     URL: ?pending=save  (shallow nav)
     signInSheet.open({reason: 'save'})
      │
      ├─ user signs in
      │   │
      │   ▼
      │  authState.isAuthenticated flips true
      │   │
      │   ▼
      │  pendingActionQueue subscriber fires
      │   → saveHandler(sequenceId)
      │   → queue.clear()
      │   → remove ?pending= from URL
      │   → toast "Saved to your library"
      │
      ├─ user dismisses sheet
      │   → queue.clear(), URL cleaned
      │
      └─ webview branch
          signInSheet shows "Open in browser" copy
          click → handleOpenInBrowser(url + ?pending=save)
          real browser loads /p/[code]?pending=save
          orchestrator mounts, reads ?pending=save, enqueues
          signInSheet auto-opens in normal-browser mode
          (then proceeds down the "user signs in" branch)
```

## DI Wiring

New services and their containers:

| Service | Interface | Container |
|---------|-----------|-----------|
| `PendingActionQueue` | `IPendingActionQueue` | New `viewer-auth-container.ts` |
| `WebviewDetector` | `IWebviewDetector` | `viewer-auth-container.ts` |

Both registered in the composition root (`src/lib/shared/di/index.ts`) and consumed by the orchestrator and the sign-in sheet via `container.items`.

The sign-in sheet itself is a component; it gets the services from the DI container, not as props.

## Testing

Silent-bug surface for this feature is high (intent preservation can break without anyone noticing until they try to save something). Tests worth writing:

1. **PendingActionQueue replay.** Enqueue `{type: 'save', sequenceId: 'X'}`, flip auth state to authenticated, assert `saveHandler` was called with `'X'`, assert queue is empty, assert URL param cleared.
2. **PendingActionQueue expiry.** Enqueue with `ts = now - 11min`, flip auth state, assert handler was NOT called and queue is empty.
3. **URL param bootstrap.** Mount orchestrator with `?pending=favorite`, assert queue contains a favorite action for the current sequence.
4. **Dismissal clears queue.** Open sheet, dismiss, assert queue empty and URL clean.
5. **WebviewDetector UA matrix.** Table-driven test covering Instagram, Facebook, TikTok, Twitter/X, LinkedIn, Pinterest, Snapchat UA strings → `isInAppWebview === true`. Chrome, Safari, Firefox, Edge → `false`.
6. **Pending-action survives webview handoff.** Simulate: orchestrator detects webview, user clicks "Open in browser", mock `window.open` gets called with URL containing `?pending=save`. On the "real browser" side, remount and assert the queue is populated.

Manual verification:

- Sign in as guest (use existing `?guest=1` preview flag), click Save, confirm sheet appears, sign in, confirm toast.
- Dismiss sheet mid-flow, confirm no stale action fires when signing in later through normal means.
- Open a `/p/[code]` URL in Instagram's in-app browser on a real phone, click Save, follow the "Open in browser" flow, confirm save happens in Chrome.
- Reload `/p/[code]?t=4` — confirm playback resumes at beat 4.
- Open `/p/[code]` on mobile — confirm theme background renders and the 3D fullscreen toggle appears.

## Rollout

Single atomic change, no feature flag. The pending-action queue and sign-in sheet either work or don't — there's no meaningful "half-on" state, and a flag would force us to maintain both code paths during the rollout window. The `?guest=1` debug flag stays (useful for previewing the now-unified experience).

The `{:else}` branch deletion, the Get App button removal, the handler rename, and the route consolidation all land together. Existing printed QR codes (`/p/[code]` URLs) continue to work — the route still exists, it just routes through the new shared shell.

## Open Questions

1. **Copy for each pending-action type.** "Sign in to save this to your library" vs. "Sign in to keep this" — needs one pass from someone who writes product copy. Not blocking the spec.
2. **Remix and Send-to flows.** These already have more complex payloads (remix source, recipient selection). Confirmed this spec's queue shape covers them — remix just needs the source sequence ID; send-to's recipient is selected post-auth anyway.
3. **Does the sign-in sheet replace the existing login modal, or sit alongside it?** Prefer replacing — one modal for auth across the app. Check with what the Account/Settings flow currently uses. If it's divergent, leave that migration out of this spec and only use `SignInSheet.svelte` in the viewer for now.

## Files Changed

**New:**

- `src/lib/shared/sequence-viewer/services/contracts/IPendingActionQueue.ts`
- `src/lib/shared/sequence-viewer/services/implementations/PendingActionQueue.ts`
- `src/lib/shared/sequence-viewer/services/contracts/IWebviewDetector.ts`
- `src/lib/shared/sequence-viewer/services/implementations/WebviewDetector.ts`
- `src/lib/shared/sequence-viewer/components/SignInSheet.svelte`
- `src/lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte`
- `src/lib/shared/di/containers/viewer-auth-container.ts`

**Modified:**

- `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` — delete auth branching, delete Get App button
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — rename `handleGetApp` → `handleOpenInBrowser`, wire pending-action queue bootstrap, hook sign-in sheet
- `src/routes/sequence/[id]/+page.svelte` — trim to resolver, delegate to `SequenceViewerRoute`
- `src/routes/p/[code]/+page.svelte` — trim to resolver, delegate to `SequenceViewerRoute`, wire real `updateUrlParam`
- `src/routes/p/+layout@.svelte` — add theme canvas (or route through shared layout)
- `src/lib/shared/di/index.ts` — register viewer-auth-container
- `src/lib/shared/di/container-types.ts` — add viewer-auth items to `IAppContainerItems`

**Moved:**

- `src/routes/sequence/[id]/RouteViewerHeader.svelte` → `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte`

**Deleted:**

- The `{:else}` branch and Get App markup in `ViewerFooter.svelte` (no standalone file deletion)
