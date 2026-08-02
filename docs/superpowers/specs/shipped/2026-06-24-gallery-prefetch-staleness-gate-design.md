# Gallery Prefetch — Staleness Gate + Bounded Idle Callback

**Date:** 2026-06-24
**Status:** Implemented + runtime-verified 2026-06-24. See **Verification & Corrections** at the end — verification corrected two claims in this spec (the prefetch is app-mode-only; the idle-starvation evidence was measured on the wrong page).
**Author:** Claude (Opus 4.8) with Austen

## Problem

The app warms the Browse gallery at boot via a `requestIdleCallback` in the root
layout's `onMount`. Two perf defects were found while verifying PR #17
(`perf(boot): back off speculative work on constrained connections`):

### Defect 1 — full collection re-download every boot (the waste)

`GalleryPrefetcher.doPrefetch()` Phase 2 calls `backgroundSync()` →
`PublicSequencesLoader.refreshFromFirestore()` →
`getDocs(query(publicSequences, orderBy("word")))`. That pulls the **entire**
`publicSequences` collection (461 docs at time of writing) on **every boot**,
unconditionally — no freshness check, no throttle, no incremental watermark.

PR #17 only skips this on *constrained* connections (`skipNetworkSync`). On every
normal **app-mode** boot it still re-pulls the whole gallery even when nothing
changed since the last sync. Cost: ~461 Firestore reads + a multi-MB download per
boot, per user — real bandwidth, real Firestore read billing, real main-thread
time competing with the foreground. (The prefetch runs only in app mode, not on
the marketing landing routes — see Verification & Corrections.)

### Defect 2 — boot-window idle starvation (the latency)

> **Corrected after verification:** the measurements below were taken on the
> landing route `/`, where the prefetch does **not** run (app-mode only). They do
> not characterize the prefetch's actual scheduling. Fix ② (`{ timeout: 2000 }`)
> was kept as a harmless precautionary bound for slow devices, not as a
> proven-necessary fix. See Verification & Corrections.

The prefetch is scheduled with `requestIdleCallback(prefetchBrowseData)` — **no
`timeout`**. During the boot/load window the main thread is saturated (module
graph, hydration, DI), so the no-timeout idle callback is deferred 8–27s
(measured: boot A idle fires `[1044, 8284, …]`, boot B `[1468, 28151, …]`). The
gallery's "instant Browse, no skeleton" promise doesn't hold if the user opens
Browse in the first ~25s. (Post-settle there is no starvation — idle fires
~243×/10s, max gap 127ms — so this is strictly a boot-window problem.)

### Evidence

- `lastSyncedAt` in IndexedDB (`TKADatabase` → `galleryCacheMeta`) read on a
  foreground `:5173` boot: did not advance for 23s, then advanced once the late
  idle callback fired (`syncedDuringThisBoot: true`, age 13s) — confirms the
  chain works but fires late and always full.
- Source: `public-sequences-loader.ts:221` `refreshFromFirestore()` has no
  staleness gate; `gallery-prefetcher.ts` Phase 2 calls `backgroundSync()`
  whenever `!skipNetworkSync`.

## Goals

1. Stop re-downloading the whole gallery on every boot when the local cache is
   already fresh.
2. Bound the boot-window delay before the prefetch runs.

## Non-Goals

- Incremental sync (`where updatedAt > lastSyncedAt` + delta-merge + delete
  handling). Higher value but needs a Firestore composite index and merge logic
  — deferred to a follow-up. The TTL gate captures ~90% of the benefit at a
  fraction of the risk.
- Changing the on-demand Browse-open load path (`loadSequenceMetadata`). It
  already returns the warmed in-memory cache; untouched.
- Touching the glyph-preload idle callback (`+layout.svelte:236`). It is also
  starved during boot, but the deferral is intentional (avoid racing first
  paint) and bounding it is out of scope here. Flagged, not changed.

## Design

### ① TTL freshness gate

File: `src/lib/features/browse/shared/services/gallery-prefetcher.ts`.

Add a freshness check the boot sync must pass, in addition to the existing
`skipNetworkSync` (constrained-connection) gate:

```ts
private static readonly SYNC_TTL_MS = 15 * 60 * 1000; // 15 min

/**
 * True when the local gallery cache is old enough that a fresh Firestore sync
 * is worth the bandwidth. False when the cache was synced within the TTL — in
 * that case the boot sync is skipped, avoiding a redundant full re-download of
 * the publicSequences collection. Fails safe to true (sync) when the cache
 * metadata can't be read.
 */
private async isSyncStale(): Promise<boolean> {
  try {
    const { lastSyncedAt } = await this.offlineCache.getStats();
    if (lastSyncedAt == null) return true;      // never synced → must sync
    return Date.now() - lastSyncedAt >= GalleryPrefetcher.SYNC_TTL_MS;
  } catch {
    return true;                                 // can't read meta → fail safe
  }
}
```

Phase 2 of `doPrefetch()` changes from:

```ts
if (!skipNetworkSync) {
  this.backgroundSync();
}
```

to:

```ts
// Phase 2: Background Firestore sync. Skipped on a constrained connection
// (PR #17), AND skipped when the cache was synced within SYNC_TTL_MS —
// re-pulling the whole publicSequences collection every boot is wasted
// bandwidth and Firestore reads when nothing changed since the last sync.
if (!skipNetworkSync && (await this.isSyncStale())) {
  this.backgroundSync();
}
```

Phase 1 (IndexedDB warm) and Phase 3 (mutation-event subscription) remain
unconditional. `doPrefetch` is already `async`, so awaiting `isSyncStale()` is
free.

`getStats()` already exists on `GalleryOfflineCache`
(`gallery-offline-cache.ts:121`) and returns `{ count, lastSyncedAt: number |
null }`, reading `galleryCacheMeta` → `gallery-cache-meta`. `lastSyncedAt` is
written by `persist()` on every successful Firestore fetch, so it is the
authoritative freshness watermark.

### ② Bounded idle callback

File: `src/routes/+layout.svelte` (the prefetch scheduling, ~line 303).

```ts
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(prefetchBrowseData, { timeout: 2000 });
} else {
  setTimeout(prefetchBrowseData, 0);
}
```

`{ timeout: 2000 }` forces the callback to run within 2s even if the thread
never goes idle, bounding the boot-window starvation. The `setTimeout` fallback
(browsers without `requestIdleCallback`) is unchanged.

## Interaction with PR #17

Composes cleanly. The boot sync now runs only when **both** the connection is
unconstrained **and** the cache is stale: `!skipNetworkSync && isSyncStale()`. A
constrained connection still skips regardless of freshness; a fresh cache still
skips regardless of connection.

## Testing

### Unit (`gallery-prefetcher.ts`)

Test `isSyncStale()` against a mocked `offlineCache.getStats()`:

| `lastSyncedAt` | Expected | Meaning |
|---|---|---|
| `null` | `true` | never synced → sync |
| `Date.now()` (fresh) | `false` | within TTL → skip |
| `Date.now() - 16 * 60 * 1000` (stale) | `true` | past TTL → sync |
| `getStats()` throws | `true` | fail safe → sync |

Mirror the existing unit-test style added by PR #17
(`tests/unit/network-conditions.test.ts`).

### Runtime verification (`:5173`, Chrome DevTools)

- **Fresh cache** (`lastSyncedAt` within 15 min): reload, instrument
  Firestore-request timing; confirm **no** post-idle `publicSequences` sync fires
  and `lastSyncedAt` does **not** advance (sync correctly skipped).
- **Stale cache**: clear `galleryCacheMeta` (or set `lastSyncedAt` back >15 min),
  reload; confirm the sync fires and `lastSyncedAt` advances to ~now.
- **Bounded callback**: confirm the prefetch idle callback fires within ~2s of
  boot even with the background animation running.

The `+layout.svelte` one-word change isn't unit-tested (Svelte `onMount` config);
covered by the runtime check above.

## Risk

Low.

- Gallery still warms from IndexedDB instantly on every boot (Phase 1 unchanged).
- The user's own library edits stay live via the Phase 3 mutation subscription.
- Worst case: another user's brand-new public sequence appears in the gallery up
  to 15 min late on a returning visitor. Acceptable for a community gallery.
- On-demand Browse open is unaffected (returns the warmed in-memory cache).
- `isSyncStale()` fails safe to `true` (sync) on any read error, so a cache-meta
  problem degrades to current behavior, never to "never syncs".

## Files

| File | Change |
|---|---|
| `src/lib/features/browse/shared/services/gallery-prefetcher.ts` | Add `SYNC_TTL_MS`, `isSyncStale()`, gate Phase 2 |
| `src/routes/+layout.svelte` | Add `{ timeout: 2000 }` to prefetch idle callback |
| `tests/unit/gallery-prefetch-staleness.test.ts` (new) | Unit tests for `isSyncStale()` |

No new dependencies, no schema change.

## Verification & Corrections (2026-06-24)

Implemented and runtime-verified the same day. Verification corrected two claims
made earlier in this spec; recorded here for historical accuracy.

### What was verified (and how)

The gate runs in **app mode only** — `detectSiteMode()` (`src/config/domains.ts`)
returns `landing` for `/` and `/landing` (and the public-path prefixes), and the
gallery prefetch lives in the app-mode branch of `+layout.svelte`'s `onMount`.
The marketing landing route never schedules it. To exercise it, app mode was
forced with `?mode=app` on an isolated dev server, and a temporary diagnostic
log printed the gate decision. Three states confirmed:

| Cache state | `isSyncStale` | `backgroundSync` | `lastSyncedAt` |
|---|---|---|---|
| empty (cold) | `true` | fires | set to now |
| fresh (< 15 min) | `false` | skipped | unchanged |
| stale (> 15 min) | `true` | fires | advanced to now |

Captured log lines: `…skipNetworkSync=false isSyncStale=false → backgroundSync=false`
(fresh) and `…isSyncStale=true → backgroundSync=true` (stale/cold). The temporary
log was reverted after verification.

### Correction 1 — the prefetch is app-mode only

This spec's Problem section implied the prefetch runs on "every boot." It runs on
every **app-mode** boot (e.g. `/create`, `/browse`, `/train`), never on the
marketing landing routes. The TTL gate's value stands: users reloading app routes
repeatedly were re-downloading the whole gallery each time.

### Correction 2 — the idle-starvation evidence was off-page

The original "8–27s idle starvation" measurements were taken on `/`, where the
prefetch is not scheduled at all — so they do not describe the prefetch's real
timing. In app mode on a warm dev server the prefetch fired at ~3.5s with idle
callbacks arriving every ~1s (no severe starvation observed). Fix ②
(`{ timeout: 2000 }`) was kept as a cheap, harmless upper bound that matters most
on slow devices during app boot (PR #17's audience), but it is **not** an
evidence-backed fix on tested hardware.

### Correction 3 — the originating symptom was not a bug

The "27h-stale `lastSyncedAt` on prod `/`" that triggered this work is expected
landing-mode behavior (the prefetch never runs on `/`), not a defect. The
investigation still surfaced the genuine win (the app-mode every-boot full
re-download), which is what fix ① addresses.
