# Service Worker Update Flow — Design

**Date:** 2026-07-02
**Status:** Design (approved, pre-implementation)
**Scope:** One feature — a user-facing "new version available → reload" flow for the hand-rolled service worker. Tight by design.

---

## Problem

`static/sw.js` calls `self.skipWaiting()` in its `install` handler (line 23) and
`self.clients.claim()` in `activate` (line 94). Together these make a new deploy
**activate silently over an already-open tab**: the moment the new SW installs,
it takes control of the running page and begins serving the new, content-hashed
`/_app/immutable/*` chunks — while the page in front of the user is still running
the *old* bundle from memory.

The failure this produces: the old page lazy-loads a route chunk it did not
preload. That chunk's hashed filename existed in the old deploy but not the new
one, so the new SW's `cacheFirst` rule for `/_app/immutable/` misses and the
network 404s. The result is a broken route (blank panel, dead navigation) until
the user manually hard-reloads — with no signal telling them to.

Silent `skipWaiting()` on an update is therefore actively worse than doing
nothing: it swaps the asset-serving layer out from under live code. The standard
remedy is to let the new SW **wait**, tell the user, and reload only on their
click.

## Goals

- A new deploy never hijacks an open tab. The new SW installs and waits.
- The user sees a persistent, dismissible prompt when an update is ready, with a
  Reload button that applies it cleanly (fresh code + fresh caches, one reload).
- First-ever install is unaffected — the SW still activates immediately and
  starts working with no reload prompt (there is no old code to protect).
- The update-detection logic is isolated and unit-testable, not inlined into
  `hooks.client.ts`.

## Non-Goals (explicitly out of scope)

- **Offline write queue / sync outbox.** Already handled by Firestore
  `persistentLocalCache` + `persistentMultipleTabManager` (`firebase.ts:356-372`).
  Every library write (`saveSequence` / `updateSequence` / `deleteSequence` /
  favorites / visibility / batch ops) goes through `trackWrite` → Firestore,
  which queues in IndexedDB offline and replays on reconnect
  (`sync-status-state.handleOnline` → `waitForPendingWrites`). Building a
  hand-rolled `SyncOperation` outbox would duplicate the SDK and violate
  `never-hand-roll.md`. Not built here.
- Auto-applying updates without user consent. The user decides when to reload
  (they may be mid-edit).
- Precache/cache-strategy changes. The existing offline kit is untouched.

## Architecture — three small seams

### Seam 1 — `static/sw.js`: stop the silent takeover

- **Remove** `self.skipWaiting()` from the `install` handler (line 23).
- **Add** a `message` listener:
  ```js
  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  });
  ```
  This is the exact pattern already present in `static/legacy-sw.js:431` — an
  internal precedent, not an invention.
- **Keep** `self.clients.claim()` in `activate`.

Resulting lifecycle:

- **First install** (no existing controller): install completes → nothing to
  wait behind → activates immediately → `clients.claim()` takes control. SW works
  at once, no reload, no prompt.
- **Update** (a controller already exists): new SW installs → enters the
  **waiting** state instead of activating → open tab keeps running old code
  intact until the user opts in.

### Seam 2 — `src/lib/shared/offline/services/sw-update-manager.ts` (NEW)

Grep confirms no existing SW-update module; registration today is a bare
`.register()` at `hooks.client.ts:200`. Inlining lifecycle logic there is
untestable, so extract a small factory:

```ts
export interface SwUpdateManagerDeps {
  registration: ServiceWorkerRegistration;
  onUpdateReady: (apply: () => void) => void; // UI-agnostic callback
  reload?: () => void;   // injectable for tests; defaults to location.reload
}
export function createSwUpdateManager(deps: SwUpdateManagerDeps): () => void;
```

Responsibilities:

1. **Detect a waiting update.**
   - If `registration.waiting` is already set at construction **and** a
     controller exists → the update is ready now → call `onUpdateReady`.
   - Otherwise listen for `updatefound` → grab `registration.installing` →
     listen for its `statechange` → when it reaches `installed` **and**
     `navigator.serviceWorker.controller` exists (an update, not first install)
     → call `onUpdateReady`.
2. **Apply on request.** The `apply` function handed to `onUpdateReady` posts
   `{ type: "SKIP_WAITING" }` to `registration.waiting`.
3. **Reload once.** Listen for `controllerchange` on
   `navigator.serviceWorker`; guard with a `refreshing` boolean so the reload
   fires exactly once even if the event double-fires.
4. **Discover new deploys on a long-lived tab.** On `visibilitychange` →
   `document.visibilityState === "visible"` → `registration.update()`. Cheap,
   no timer to leak. (A background `setInterval` is intentionally omitted —
   visibility-driven checks cover the real case: a tab left open, returned to
   after a deploy.)

Returns a disposer that removes its listeners.

`hooks.client.ts` shrinks to: register → on success,
`createSwUpdateManager({ registration, onUpdateReady: showUpdateToast })`. The
manager has **zero UI dependency** — the toast is injected — so it unit-tests
against a mocked `ServiceWorkerRegistration`.

### Seam 3 — toast action button (extend the primitive)

`toast-state.svelte.ts` and `ToastContainer.svelte` already render a queue of
dismissible toasts and already support a persistent toast (`duration: 0` skips
the auto-dismiss timer, `toast-state.svelte.ts:62`). They have **no
action-button support**. Extend, do not fork (mirrors how `FilterChipBase` gained
`size`):

- `toast-state.svelte.ts`: add an optional field to `Toast` and
  `ShowToastOptions`:
  ```ts
  interface ToastAction { label: string; onClick: () => void; }
  // Toast, ShowToastOptions: action?: ToastAction;
  ```
  `showToast` copies it onto the queued toast. No new convenience method is
  required — the update prompt calls the options form directly.
- `ToastContainer.svelte`: when `toast.action` is present, render a real
  `<button>` after the message with the action label. It must look like a button
  (background/border, padding, hover state per `clickables-look-like-buttons.md`)
  and carry `accessible-touch-target` for the 44px floor. Clicking runs
  `toast.action.onClick()` then `removeToast(toast.id)`.

The update prompt is then:

```ts
showToast({
  message: "New version available",
  type: "info",
  duration: 0,           // persistent
  action: { label: "Reload", onClick: applyUpdate },
});
```

**Accessibility note:** the update toast is not urgent. `ToastContainer` renders
`role="alert"` (assertive) for the whole queue today. For this non-urgent prompt,
the plan will confirm whether an action-bearing toast should announce as
`role="status"` (polite) instead, without regressing the assertive announcement
that errors/warnings rely on. Resolve during implementation; default to keeping
`role="alert"` if per-toast role adds meaningful complexity.

## End-to-end flow

1. A deploy ships. The open tab checks for a new SW on its next `visibilitychange`
   (or navigation).
2. New SW installs, precaches the new boot chunks + SVG set (unchanged install
   logic), and **waits**.
3. `sw-update-manager` detects the waiting worker → `onUpdateReady` → persistent
   info toast with a **Reload** button.
4. User clicks Reload → `apply()` posts `SKIP_WAITING` → the waiting SW calls
   `self.skipWaiting()` → activates → `activate` purges stale caches and
   `clients.claim()`s.
5. `controllerchange` fires → single guarded `location.reload()` → the page comes
   back on the new code with fresh caches.

If the user dismisses the toast instead, nothing breaks — the old code keeps
running against the old (still-cached) chunks; the prompt reappears on the next
visibility check or naturally on the next full navigation.

## SvelteKit `updated` store — resolved, no conflict

SvelteKit ships an `updated` store that can hard-reload on navigation when it
detects a new `version.json`. Checked and settled:

- `svelte.config.js` sets **no** `kit.version.pollInterval` → polling defaults to
  off.
- No file under `src/` imports or reads the `updated` store (all `updated`
  matches are unrelated local variables).

So SvelteKit's built-in update path is dormant. This SW flow is the sole
update-detection mechanism; there is no competing reload to reconcile. (Were
`updated` ever enabled later, the two are complementary — SW owns the explicit
prompt + cache refresh, `updated` only reloads mid-navigation — but no
reconciliation is needed today.)

## Testing

Extend the existing SW harness suite (`tests/helpers/sw-harness.ts`,
`tests/unit/sw-offline-behavior.test.ts`) and add a manager unit test.

- **Flip** `sw-offline-behavior.test.ts:56`: install must **no longer** call
  `self.skipWaiting()`. The assertion inverts (this is the behavioral change the
  whole feature hinges on — the test that previously locked in the old bug now
  locks in the fix).
- **Add** (sw.js): dispatching a `message` event with `{type:"SKIP_WAITING"}`
  calls `self.skipWaiting()`; other message types do not.
- **Add** (`sw-update-manager.test.ts`) with a mocked `ServiceWorkerRegistration`
  + mocked `navigator.serviceWorker`:
  - `updatefound` → installing worker reaches `installed` **with** a controller
    present → `onUpdateReady` fires.
  - Same sequence with **no** controller (first install) → `onUpdateReady` does
    **not** fire.
  - `registration.waiting` already set at construction (+ controller) →
    `onUpdateReady` fires immediately.
  - `apply()` posts `{type:"SKIP_WAITING"}` to `registration.waiting`.
  - `controllerchange` triggers the injected `reload` exactly once, even if the
    event fires twice.

## Files

| File | Change | never-hand-roll justification |
|---|---|---|
| `static/sw.js` | Edit — drop install `skipWaiting()`, add `message`→`skipWaiting` | Pattern reused from `legacy-sw.js:431` |
| `src/lib/shared/offline/services/sw-update-manager.ts` | **New** | Grep found no SW-update module; extracted for isolation + testability |
| `src/hooks.client.ts` | Edit — wire manager into the prod registration block | Reuses existing registration site (`:199-204`) |
| `src/lib/shared/toast/state/toast-state.svelte.ts` | Edit — add optional `action` | Extends the shared toast primitive; not forked |
| `src/lib/shared/toast/components/ToastContainer.svelte` | Edit — render action button | Same renderer; reuses `accessible-touch-target`, design tokens |
| `tests/unit/sw-offline-behavior.test.ts` | Edit — flip install assertion, add message test | Existing harness |
| `tests/unit/sw-update-manager.test.ts` | **New** | Unit-tests the new manager |

## Verification (before "done")

- `npm run check` clean.
- New + flipped unit tests green (`npm run test`).
- `npm run verify:offline` still 6/6 on a fresh build (feature must not regress
  the offline kit).
- Manual runtime proof of the update prompt is deferred to a real deploy against
  a controlled tab (documented, not claimed as verified from code) — the unit
  tests cover the lifecycle logic; the visible toast + reload is confirmed on the
  next production deploy.
