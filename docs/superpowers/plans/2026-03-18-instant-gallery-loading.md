# Instant Gallery Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate browse gallery skeleton loaders by serving metadata from IndexedDB cache on first frame, prefetching at app boot, and keeping the cache in sync via optimistic local updates.

**Architecture:** Stale-while-revalidate. `GalleryPrefetcher` warms `PublicSequencesLoader`'s in-memory cache from IndexedDB at app boot, then syncs from Firestore in the background. Library mutation events keep both caches current without network round-trips.

**Tech Stack:** Svelte 5, TypeScript, ITI (DI), Dexie (IndexedDB), Firebase Firestore, CustomEvent DOM API

**Spec:** `docs/superpowers/specs/2026-03-18-instant-gallery-loading-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/features/browse/shared/services/contracts/IGalleryPrefetcher.ts` | Interface for gallery prefetch service |
| `src/lib/features/browse/shared/services/implementations/GalleryPrefetcher.ts` | Orchestrates IndexedDB warm + background Firestore sync + event-driven cache patching |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/library/library-events.ts` | Add `LIBRARY_SEQUENCE_UPDATED_EVENT`, `notifyLibrarySequenceUpdated()`, `onLibrarySequenceUpdated()` |
| `src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts` | Add `warmFromCache()` and `setLoadPromise()` methods |
| `src/lib/features/browse/sequences/display/services/contracts/IBrowseLoader.ts` | Add `warmFromCache()` and `refreshFromFirestore()` to interface |
| `src/lib/shared/di/containers/browse-container.ts` | Register `GalleryPrefetcher` in DI |
| `src/lib/shared/di/container-types.ts` | Add prefetcher type to container items (if needed) |
| `src/routes/+layout.svelte` | Kick off prefetch in `initAppMode()` after DI container is ready |
| `src/lib/features/library/services/implementations/LibraryRepository.ts` | Fire events from 6 mutation methods |
| `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte` | Remove `notifyLibrarySequenceAdded()` call (moved to repository) |
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Remove `notifyLibraryMutated()` call (moved to repository) |
| `tests/unit/library/library-events.test.ts` | Add tests for new updated event |

---

## Task 1: Add Updated Event to Library Events

**Files:**
- Modify: `src/lib/shared/library/library-events.ts`
- Modify: `tests/unit/library/library-events.test.ts`

- [ ] **Step 1: Add the new event constant, notifier, and listener to library-events.ts**

After the existing `notifyLibrarySequenceAdded` / `onLibrarySequenceAdded` block, add:

```typescript
export const LIBRARY_SEQUENCE_UPDATED_EVENT = "tka:library-sequence-updated";

/**
 * Call this after updating a sequence's metadata (tags, notes, visibility, favorite).
 * Listeners can patch their caches with the changed fields without a Firestore round-trip.
 */
export function notifyLibrarySequenceUpdated(
  sequenceId: string,
  updates: Record<string, unknown>
): void {
  window.dispatchEvent(
    new CustomEvent(LIBRARY_SEQUENCE_UPDATED_EVENT, {
      detail: { sequenceId, updates },
    })
  );
}

/**
 * Listen for sequence metadata updates. Returns cleanup function.
 */
export function onLibrarySequenceUpdated(
  handler: (sequenceId: string, updates: Record<string, unknown>) => void
): () => void {
  const listener = (e: Event) => {
    const { sequenceId, updates } = (
      e as CustomEvent<{ sequenceId: string; updates: Record<string, unknown> }>
    ).detail;
    handler(sequenceId, updates);
  };
  window.addEventListener(LIBRARY_SEQUENCE_UPDATED_EVENT, listener);
  return () =>
    window.removeEventListener(LIBRARY_SEQUENCE_UPDATED_EVENT, listener);
}
```

Update the file header's EVENTS list to include the new event.

- [ ] **Step 2: Add tests for the new event**

In `tests/unit/library/library-events.test.ts`, add a new describe block after the existing ones:

```typescript
import {
  // ... existing imports
  notifyLibrarySequenceUpdated,
  onLibrarySequenceUpdated,
  LIBRARY_SEQUENCE_UPDATED_EVENT,
} from "../../../src/lib/shared/library/library-events";

describe("notifyLibrarySequenceUpdated", () => {
  it("dispatches an event named 'tka:library-sequence-updated'", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    notifyLibrarySequenceUpdated("seq-1", { tags: ["new"] });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: LIBRARY_SEQUENCE_UPDATED_EVENT })
    );
  });

  it("delivers sequenceId and updates to the handler", () => {
    const handler = vi.fn();
    const cleanup = onLibrarySequenceUpdated(handler);
    const updates = { visibility: "public" };

    notifyLibrarySequenceUpdated("seq-abc", updates);

    expect(handler).toHaveBeenCalledWith("seq-abc", updates);
    cleanup();
  });

  it("stops delivering after cleanup", () => {
    const handler = vi.fn();
    const cleanup = onLibrarySequenceUpdated(handler);

    notifyLibrarySequenceUpdated("seq-1", { tags: [] });
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    notifyLibrarySequenceUpdated("seq-2", { tags: [] });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/library/library-events.test.ts`
Expected: All tests pass including new ones.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/library/library-events.ts tests/unit/library/library-events.test.ts
git commit -m "feat: add LIBRARY_SEQUENCE_UPDATED_EVENT for metadata change notifications"
```

---

## Task 2: Add `warmFromCache()` and `refreshFromFirestore()` to PublicSequencesLoader

**Files:**
- Modify: `src/lib/features/browse/sequences/display/services/contracts/IBrowseLoader.ts`
- Modify: `src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts`

- [ ] **Step 1: Read the IBrowseLoader interface**

Read `src/lib/features/browse/sequences/display/services/contracts/IBrowseLoader.ts` to see existing method signatures.

- [ ] **Step 2: Add new methods to IBrowseLoader interface**

Add to the interface:

```typescript
/** Populate in-memory cache from IndexedDB without triggering Firestore. */
warmFromCache(sequences: SequenceData[], sourceRefs: Map<string, string>): void;

/** Force a Firestore fetch regardless of in-memory cache state. Updates cache + persists to IndexedDB. */
refreshFromFirestore(): Promise<SequenceData[]>;
```

- [ ] **Step 3: Implement in PublicSequencesLoader**

Add these methods to `PublicSequencesLoader`:

```typescript
warmFromCache(sequences: SequenceData[], sourceRefs: Map<string, string>): void {
  if (this.cachedSequences) return; // Already warmed or loaded — don't overwrite
  this.cachedSequences = sequences;
  for (const [key, value] of sourceRefs) {
    this.sourceRefCache.set(key, value);
  }
}

/**
 * Force a fresh Firestore fetch regardless of cache state.
 * Used by the prefetcher to sync in the background after warming from IndexedDB.
 * Updates the in-memory cache and persists to IndexedDB offline cache.
 */
async refreshFromFirestore(): Promise<SequenceData[]> {
  const sequences = await this.fetchPublicSequences();
  this.cachedSequences = sequences;

  // Persist to offline cache for next session
  if (this.galleryOfflineCache) {
    this.persistToOfflineCache().catch((err) =>
      console.warn("[PublicSequencesLoader] Offline cache persist failed:", err)
    );
  }

  return sequences;
}
```

Note: `fetchPublicSequences()` is already a private method that queries Firestore. `refreshFromFirestore()` bypasses the cache check that `loadSequenceMetadata()` uses. It also needs `fetchPublicSequences` to remain accessible — since both methods are on the same class, this works.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/sequences/display/services/contracts/IBrowseLoader.ts src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts
git commit -m "feat: add warmFromCache and refreshFromFirestore to PublicSequencesLoader"
```

---

## Task 3: Create GalleryPrefetcher Service

**Files:**
- Create: `src/lib/features/browse/shared/services/contracts/IGalleryPrefetcher.ts`
- Create: `src/lib/features/browse/shared/services/implementations/GalleryPrefetcher.ts`

- [ ] **Step 1: Create the interface**

```typescript
// src/lib/features/browse/shared/services/contracts/IGalleryPrefetcher.ts

export interface IGalleryPrefetcher {
  /** Warm from IndexedDB, then sync from Firestore in background. */
  prefetch(): Promise<void>;

  /** True once IndexedDB cache has been loaded into memory. */
  readonly isWarmed: boolean;

  /** True while Firestore background sync is in progress. */
  readonly isSyncing: boolean;

  /** The in-flight prefetch promise, if any. Awaitable by gallery to avoid duplicate queries. */
  readonly prefetchPromise: Promise<void> | null;
}
```

- [ ] **Step 2: Create the implementation**

```typescript
// src/lib/features/browse/shared/services/implementations/GalleryPrefetcher.ts

/**
 * GalleryPrefetcher
 *
 * Runs at app boot to warm the browse gallery's in-memory cache from IndexedDB,
 * then syncs fresh data from Firestore in the background. Subscribes to library
 * mutation events to keep the IndexedDB cache current between sessions.
 *
 * The result: when the user opens the gallery, data is already in memory.
 * No skeleton loaders. No Firestore wait.
 */

import type { IGalleryPrefetcher } from "../contracts/IGalleryPrefetcher";
import type { IBrowseLoader } from "../../../../sequences/display/services/contracts/IBrowseLoader";
import type { IGalleryOfflineCache } from "$lib/shared/offline/services/contracts/IGalleryOfflineCache";
import {
  onLibraryMutated,
  onLibrarySequenceAdded,
  onLibrarySequenceUpdated,
} from "$lib/shared/library/library-events";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { db } from "$lib/shared/persistence/database/TKADatabase";

export class GalleryPrefetcher implements IGalleryPrefetcher {
  private _isWarmed = false;
  private _isSyncing = false;
  private _prefetchPromise: Promise<void> | null = null;
  private eventCleanups: (() => void)[] = [];

  constructor(
    private readonly loader: IBrowseLoader,
    private readonly offlineCache: IGalleryOfflineCache
  ) {}

  get isWarmed(): boolean {
    return this._isWarmed;
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  get prefetchPromise(): Promise<void> | null {
    return this._prefetchPromise;
  }

  async prefetch(): Promise<void> {
    if (this._prefetchPromise) return this._prefetchPromise;

    this._prefetchPromise = this.doPrefetch();
    try {
      await this._prefetchPromise;
    } finally {
      this._prefetchPromise = null;
    }
  }

  private async doPrefetch(): Promise<void> {
    // Phase 1: Warm from IndexedDB (fast — local disk)
    try {
      const hasCache = await this.offlineCache.hasCachedData();
      if (hasCache) {
        const cached = await this.offlineCache.loadCached();
        if (cached.sequences.length > 0) {
          this.loader.warmFromCache(cached.sequences, cached.sourceRefs);
          this._isWarmed = true;
        }
      }
    } catch (error) {
      console.warn("[GalleryPrefetcher] IndexedDB warm failed:", error);
    }

    // Phase 2: Background Firestore sync (non-blocking)
    this.backgroundSync();

    // Phase 3: Subscribe to mutation events for real-time IndexedDB patching
    this.subscribeToMutationEvents();
  }

  private backgroundSync(): void {
    this._isSyncing = true;

    // If we warmed from cache, loadSequenceMetadata() would just return
    // the stale cached data. Use refreshFromFirestore() to force a fresh
    // Firestore query that updates the in-memory cache and persists to IndexedDB.
    //
    // If cache was empty (first launch), this is the initial Firestore fetch.
    // Either way, the gallery gets fresh data.
    const syncPromise = this._isWarmed
      ? this.loader.refreshFromFirestore()
      : this.loader.loadSequenceMetadata();

    syncPromise
      .then(() => {
        this._isSyncing = false;
      })
      .catch((error) => {
        console.warn("[GalleryPrefetcher] Background sync failed:", error);
        this._isSyncing = false;
      });
  }

  private subscribeToMutationEvents(): void {
    // Delete: remove from IndexedDB cache
    this.eventCleanups.push(
      onLibraryMutated((sequenceId) => {
        db.galleryCache.delete(sequenceId).catch((err) =>
          console.warn("[GalleryPrefetcher] Failed to delete from cache:", err)
        );
      })
    );

    // Add: upsert into IndexedDB cache.
    // The galleryCache table stores PublicSequenceIndex-shaped data, but the
    // SequenceData from the event has compatible fields. The converter in
    // GalleryOfflineCache.loadCached() reads whatever fields are present, so
    // extra fields (like `steps`, `isFavorite`) are harmlessly ignored.
    this.eventCleanups.push(
      onLibrarySequenceAdded((sequence: SequenceData) => {
        const entry = {
          id: sequence.id,
          data: JSON.parse(JSON.stringify(sequence)),
          cachedAt: Date.now(),
        };
        db.galleryCache.put(entry).catch((err) =>
          console.warn("[GalleryPrefetcher] Failed to add to cache:", err)
        );
      })
    );

    // Update: merge changed fields into existing IndexedDB entry
    this.eventCleanups.push(
      onLibrarySequenceUpdated(
        (sequenceId: string, updates: Record<string, unknown>) => {
          db.galleryCache
            .get(sequenceId)
            .then((existing) => {
              if (!existing) return;
              const merged = { ...existing.data, ...updates };
              return db.galleryCache.put({
                ...existing,
                data: merged,
                cachedAt: Date.now(),
              });
            })
            .catch((err) =>
              console.warn(
                "[GalleryPrefetcher] Failed to update cache:",
                err
              )
            );
        }
      )
    );
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/shared/services/contracts/IGalleryPrefetcher.ts src/lib/features/browse/shared/services/implementations/GalleryPrefetcher.ts
git commit -m "feat: add GalleryPrefetcher for IndexedDB-first gallery loading"
```

---

## Task 4: Register GalleryPrefetcher in DI Container

**Files:**
- Modify: `src/lib/shared/di/containers/browse-container.ts`

- [ ] **Step 1: Read the full browse-container.ts**

Understand current tier structure and imports.

- [ ] **Step 2: Add import and registration**

Add import at top:
```typescript
import { GalleryPrefetcher } from "$lib/features/browse/shared/services/implementations/GalleryPrefetcher";
```

Add a new tier after the `galleryOfflineCache` is available (tier 2 area) but after `browseLoader` is registered:

```typescript
// In tier2 or as a new tier after tier2:
galleryPrefetcher: () => new GalleryPrefetcher(ctx.browseLoader, ctx.galleryOfflineCache),
```

The exact placement depends on the tier structure — `GalleryPrefetcher` needs `browseLoader` (tier 2) and `galleryOfflineCache` (tier 0). So it goes in tier 2's `.add()` or as a new tier after tier 2.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/browse-container.ts
git commit -m "feat: register GalleryPrefetcher in browse DI container"
```

---

## Task 5: Kick Off Prefetch at App Boot

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add prefetch call in initAppMode()**

After the DI container is loaded and `containerReady = true` is set (around line 152), add:

```typescript
// Prefetch gallery data so it's ready before the user navigates there.
// Uses requestIdleCallback to avoid competing with the active module's load.
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => {
    try {
      const prefetcher = container.items.galleryPrefetcher;
      if (prefetcher && typeof prefetcher.prefetch === "function") {
        prefetcher.prefetch().catch((err: unknown) =>
          console.warn("[Layout] Gallery prefetch failed:", err)
        );
      }
    } catch (err) {
      console.warn("[Layout] Gallery prefetcher not available:", err);
    }
  });
} else {
  // Safari <16.4 fallback — setTimeout with 0 delay
  setTimeout(() => {
    try {
      const prefetcher = container.items.galleryPrefetcher;
      if (prefetcher && typeof prefetcher.prefetch === "function") {
        prefetcher.prefetch().catch((err: unknown) =>
          console.warn("[Layout] Gallery prefetch failed:", err)
        );
      }
    } catch (err) {
      console.warn("[Layout] Gallery prefetcher not available:", err);
    }
  }, 0);
}
```

Place this AFTER `containerReady = true` but BEFORE the `Promise.all` for UI component imports (line 229). The prefetch should start as early as possible but yield to whatever the user needs first.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: prefetch gallery data at app boot via requestIdleCallback"
```

---

## Task 6: Wire Events into LibraryRepository

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`
- Modify: `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Read LibraryRepository.ts to find all 6 mutation methods**

Read the file and locate:
- `saveSequence()`
- `saveSequenceWithMetadata()`
- `deleteSequences()` (batch)
- `updateSequence()`
- `setVisibility()`
- `toggleFavorite()`

Note: `deleteSequence()` (single) may already fire an event from its caller. Check.

- [ ] **Step 2: Add imports to LibraryRepository.ts**

```typescript
import {
  notifyLibraryMutated,
  notifyLibrarySequenceAdded,
  notifyLibrarySequenceUpdated,
} from "$lib/shared/library/library-events";
```

- [ ] **Step 3: Add event firing to each mutation method**

For each method, add the event call AFTER the Firestore write succeeds (inside the try block, after the await):

**`saveSequence()`** — after the Firestore write:
```typescript
notifyLibrarySequenceAdded(savedSequenceData);
```

**`saveSequenceWithMetadata()`** — after the Firestore write:
```typescript
notifyLibrarySequenceAdded(savedSequenceData);
```

**`deleteSequence()`** (singular) — after the Firestore delete:
```typescript
notifyLibraryMutated(sequenceId);
```

Note: `SequenceViewerOrchestrator.svelte` currently calls `notifyLibraryMutated()` after calling `deleteSequence()`. Since we're moving the event into the repository, remove the call from the orchestrator (Step 5).

**`deleteSequences()`** (batch) — after each successful delete:
```typescript
for (const id of deletedIds) {
  notifyLibraryMutated(id);
}
```

**`updateSequence()`** — after the Firestore write:
```typescript
notifyLibrarySequenceUpdated(sequenceId, updates);
```

**`setVisibility()`** — after the Firestore write:
```typescript
notifyLibrarySequenceUpdated(sequenceId, { visibility });
```

**`toggleFavorite()`** — after the toggle:
```typescript
notifyLibrarySequenceUpdated(sequenceId, { isFavorite: newValue });
```

The exact variable names and positions depend on the actual method signatures — read the code carefully before inserting.

- [ ] **Step 4: Remove event firing from SaveToLibraryPanel.svelte**

In `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte`, find and remove:
- The import of `notifyLibrarySequenceAdded` (line 34)
- The call to `notifyLibrarySequenceAdded({...})` (around line 373)

This event is now fired from `LibraryRepository` automatically.

- [ ] **Step 5: Remove event firing from SequenceViewerOrchestrator.svelte**

In `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`, find and remove:
- The import of `notifyLibraryMutated` (line 178)
- The call to `notifyLibraryMutated(sequence.id)` (around line 1174)

This event is now fired from `LibraryRepository` automatically.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors. Unused import warnings may appear — remove them.

- [ ] **Step 7: Run existing library-events tests**

Run: `npx vitest run tests/unit/library/library-events.test.ts`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts src/lib/features/create/shared/components/SaveToLibraryPanel.svelte src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat: fire library events from repository instead of individual callers"
```

---

## Task 7: Full Build Verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit any remaining fixes**

If any fixes were needed, commit them with appropriate messages.

---

## Verification Checklist

After implementation, verify these behaviors:

1. **Warm start:** Open app, wait 1 second, navigate to gallery. Should show data immediately with no skeleton loaders.
2. **Cold start (first ever):** Clear IndexedDB, open app, navigate to gallery. Should behave like today (Firestore fetch, skeletons) but persist data for next time.
3. **Save + browse:** Save a sequence in Create, navigate to gallery. Sequence should appear without a page refresh.
4. **Delete + browse:** Delete a sequence from the viewer, go back to gallery. Sequence should be gone.
5. **Tab switch:** Switch between Community and My Library tabs. Community should be instant (prefetched). Library may still show a brief load on first visit (Phase 2 deferred).
