# Snappy Boot — Optimistic Reload & Per-Module Skeletons

> Kill the three-loader relay on warm reload. Render from cached state immediately, reconcile in the background, and replace the module spinner with real-layout skeletons.

**Date:** 2026-06-18
**Status:** Design approved, pending spec review

## Problem

On every reload of `/app`, the user sees three loading screens in sequence:

1. **Boot splash** — `src/app.html:813-832` (`#app-loading`). Logo + progress bar. Shown for the entire init chain, dismissed when `window.__tkaLoadProgress(100)` is called from `src/routes/+layout.svelte:332`.
2. **"Warming up" spinner** — `src/lib/shared/application/components/MainApplication.svelte:478-483` (`.auth-loading`). Gated on `authLoading && !_mainInterfaceShown` (`:111`). Waits for Firebase auth to resolve.
3. **"Loading {Module}" bar** — `src/lib/shared/modules/ModuleRenderer.svelte:295-312`. Per-module lazy `import()`; the in-memory `moduleCache` (`:59`) is wiped on reload, so the chunk re-evaluates every load.

### Root cause

This is a **perceived-performance / boot-sequencing** problem, not a download problem. The needed state is already on disk on a warm reload:

- **JS bytes** — the live service worker (`static/sw.js`, `tka-v2`) cache-firsts `/_app/immutable/`, fonts, and 3D assets (`static/sw.js:60-79`). Chunks are not re-downloaded.
- **Auth session** — Firebase Auth restores the session from IndexedDB before `onAuthStateChanged` fires (`src/lib/shared/auth/state/auth-state.svelte.ts:248-293`).
- **Settings / active module** — persisted to localStorage (`navigation-state.svelte.ts:155` writes `CURRENT_MODULE_KEY`; `module-state.ts:341`; settings via localStorage).

But the boot chain `await`s server confirmation **before first paint**. In `src/routes/+layout.svelte`: DI (`:209`), Firestore (`:305`, 5s timeout), auth (`:314`, 10s timeout), then in `MainApplication.svelte`: app state (`:229`), settings (`:295`), theme (`:297`), gamification (`:319`) — all serial, all blocking. The data is on disk; the UI waits for the network anyway. That is the "false edging."

### Scope boundary

The 2026-05-05 load-performance spec (`docs/superpowers/specs/2026-05-05-load-performance-optimization-design.md`) owns download size, the service worker, and bundle splitting — that work already cached the bytes. **This spec does not touch any of that.** This spec only removes the blocking `await`s on warm reload and replaces the module spinner with skeletons.

## Design decisions (locked)

- **Boot strategy:** Optimistic, reconcile silently. Render instantly from the last-known cached state; if Firebase confirms a different session, update tier/badge in place with no loader. Acceptable because the app is guest-first ("play with everything, pay to take it home") — worst case is a sub-second badge flicker on the rare reconcile.
- **Module load UX:** Per-module layout skeleton. The content region shows a skeleton matching the real module layout (Create → workspace frame, Browse → card-grid shimmer), filling in as the chunk evaluates.
- **Keep-alive scope:** Unchanged. Only museum stays persistently mounted (`keep-alive-controller.ts`). Skeletons handle every other module; no new persistent-DOM memory cost.
- **First-ever cold load:** Unchanged. With no boot snapshot, the current blocking path + splash runs. Only warm reload / revisit is optimized.

## Architecture

Three coordinated workstreams. No new caching infrastructure — the caches already exist; we stop blocking on them.

### Workstream 1 — Optimistic boot gate (kills loader #2, shrinks #1)

**Boot snapshot.** A single synchronously-readable localStorage record consolidating the state needed for first paint:

```ts
// localStorage key: "tka-boot-snapshot"
interface BootSnapshot {
  uid: string | null;        // last-known authenticated uid (null = guest)
  tier: "guest" | "free" | "scribe";
  theme: string;             // theme id for instant CSS application
  activeModule: string;      // last CURRENT_MODULE_KEY value
  version: number;           // schema version; mismatch → ignore snapshot, cold path
}
```

- Written on every successful boot completion (after auth + settings reconcile), debounced. A focused module owns it: `src/lib/shared/application/services/boot-snapshot.ts` (pure functions `readBootSnapshot()` / `writeBootSnapshot()` — no class, per `service-naming` and `code-style`).
- Read **synchronously** at the top of the boot path. If present and `version` matches, take the optimistic path; otherwise the cold path.

**Optimistic path:**

1. Apply `theme` synchronously (CSS vars) before first paint — no flash of default theme.
2. Render the app shell + `MainInterface` immediately, seeded with `{ uid, tier, activeModule }` from the snapshot. Do **not** `await authState.initialize()` before first paint.
3. Kick off in the background, unblocked: Firebase auth confirm, Firestore init, settings load, gamification.
4. On each background resolve, reconcile into reactive state in place. A tier change updates the badge; it does not remount `MainInterface` or show a spinner.
5. Remove the `.auth-loading` spinner block (`MainApplication.svelte:478-483`) and the `_mainInterfaceShown` module-level flag (`:111-118`). Snapshot presence is the new "already shown" signal.

**Reconcile safety:** if the confirmed session differs from the snapshot (expired, signed out elsewhere, signed in elsewhere), the reactive auth state updates and dependent UI (tier badges, premium gates) re-derives. The tier/capability model lives in `src/lib/shared/auth/domain/access-tier.ts` (a domain concept, not a badge-only flag). The design assumes gated actions derive their enable/disable from that reactive tier, so an optimistic-then-corrected tier closes any gap as soon as the real session resolves. **Planning must read `access-tier.ts` to confirm enforcement is reactive at the action layer**, and **verification must prove it**: a stale "scribe" snapshot reconciling to "guest" must not leave any premium action invocable during the optimistic gap. If enforcement turns out to be badge-only anywhere, that path needs a reactive guard added as part of this work.

### Workstream 2 — Splash handoff (loader #1 only for true cold load)

- Re-point the splash dismissal: call `__tkaLoadProgress(100)` the moment the optimistic shell paints (end of the synchronous optimistic render), not after the auth/settings chain.
- `src/app.html` splash logic stays for the cold path (no snapshot) — it still covers the genuine first-load download with its progress bar.
- Warm reload: snapshot + SW-cached bytes present → the splash is a sub-frame flash at most (it may not paint at all if the shell mounts within the first frame).
- No change to the splash's resource-tracking progress phases; only the **dismissal trigger** moves earlier on the optimistic path.

### Workstream 3 — Per-module layout skeletons (kills loader #3 flash)

- Replace the generic `.module-loading` IndeterminateBar (`ModuleRenderer.svelte:295-312`) with a skeleton chosen by module key, read synchronously from the persisted `CURRENT_MODULE_KEY` so the correct skeleton appears on the first frame.
- **Skeleton registry:** `src/lib/shared/modules/skeletons/` with a map `{ [moduleKey]: SkeletonComponent }` and a `SharedShellSkeleton` fallback.
  - `CreateSkeleton.svelte` — workspace frame (matches StandardWorkspaceLayout: toolbar bar + beat-grid region).
  - `BrowseSkeleton.svelte` — section sidebar + card-grid shimmer.
  - Default landing module skeleton (whichever module is the default landing — confirm during planning).
  - `SharedShellSkeleton.svelte` — header bar + content shimmer, used for the remaining ~25 modules.
- Skeletons obey `no-layout-shift.md`: each reserves the real layout's box (same grid/flex structure, fixed media boxes) so the real content fills in without reflowing siblings.
- The skeleton shows during chunk re-eval. Because the SW serves bytes instantly, eval is the only cost — typically sub-300ms for light modules; the skeleton covers it seamlessly. Museum keeps its existing `.museum-skeleton` (`ModuleRenderer.svelte:333-354`) and keep-alive.

## Components & boundaries

| Unit | Path | Responsibility | Depends on |
|---|---|---|---|
| Boot snapshot store | `src/lib/shared/application/services/boot-snapshot.ts` | Read/write the synchronous boot record | localStorage only |
| Optimistic boot wiring | `src/routes/+layout.svelte`, `MainApplication.svelte` | Branch cold vs optimistic; background reconcile | boot-snapshot, authState, settings |
| Splash handoff | `src/app.html`, `+layout.svelte` | Dismiss splash on optimistic shell paint | `__tkaLoadProgress` |
| Skeleton registry | `src/lib/shared/modules/skeletons/index.ts` | Map module key → skeleton component | — |
| Module skeletons | `src/lib/shared/modules/skeletons/*.svelte` | Real-layout placeholders | design tokens (`styling`) |
| ModuleRenderer integration | `src/lib/shared/modules/ModuleRenderer.svelte` | Render skeleton-by-key instead of generic bar | skeleton registry |

Each skeleton is independently understandable and testable: it renders a static layout from design tokens, takes no props beyond optional sizing, depends on nothing runtime.

## Out of scope

- Bundle/download size, service worker, code-splitting — owned by 2026-05-05 load-perf spec.
- Keep-alive expansion beyond museum.
- First-ever cold-load behavior.
- Edge SSR / adapter migration (Phase C of the load-perf spec).

## Verification plan

Chrome DevTools MCP (read-only trace + network), with explicit verbal permission for any interactive step:

1. **No spinner relay on warm reload.** Reload `/app` warm, capture a Performance trace. Assert: no `.auth-loading` frame rendered; module content shows a skeleton (not the IndeterminateBar spinner) during eval; the shell's first contentful paint precedes resolution of the background auth network call (network waterfall vs paint marker).
2. **Theme applied pre-paint.** Assert no flash of default theme on optimistic reload.
3. **Reconcile is silent + safe.** Seed a stale `scribe` snapshot, force the real session to `guest`. Assert: tier badge updates in place with no loader/remount; and no premium action is invocable during the optimistic-to-confirmed gap (capability-flag enforcement holds).
4. **Cold path intact.** Clear the snapshot, reload. Assert the splash + progress bar still cover the genuine download and the app boots correctly.
5. **No layout shift.** For Create and Browse, assert CLS ~0 as the skeleton swaps to real content (skeleton box matches real layout box).

## Phasing

Single implementation plan, but ordered so each workstream is independently shippable and verifiable:

1. Boot snapshot store + optimistic gate (W1) — biggest perceived win, removes loader #2.
2. Splash handoff (W2) — small, depends on W1's optimistic-paint marker.
3. Skeleton registry + Create/Browse/default skeletons + shared fallback + ModuleRenderer integration (W3) — removes loader #3 flash.
