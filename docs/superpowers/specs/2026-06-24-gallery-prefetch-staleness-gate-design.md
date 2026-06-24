# Gallery Prefetch — Staleness Gate + Bounded Idle Callback

**Date:** 2026-06-24
**Status:** Design approved, pending implementation plan
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
normal boot it still re-pulls the whole gallery even when nothing changed since
the last sync. Cost: ~461 Firestore reads + a multi-MB download per boot, per
user — real bandwidth, real Firestore read billing, real main-thread time
competing with the foreground.

### Defect 2 — boot-window idle starvation (the latency)

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
