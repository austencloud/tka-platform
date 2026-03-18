# Instant Gallery Loading — Design Spec

## Problem

The browse gallery shows skeleton loaders for 1-3+ seconds while waiting for a Firestore metadata query to return. The existing `GalleryOfflineCache` persists this data to IndexedDB but only serves it as an offline fallback — when online, users always wait for the network round-trip. Thumbnails themselves resolve quickly from a 4-tier cache (static manifest, IndexedDB, cloud CDN, local render), so the bottleneck is purely data availability.

## Solution

Stale-while-revalidate with app-boot prefetch and optimistic local index updates.

### Three layers working together:

1. **IndexedDB-first loading** — Always serve gallery metadata from IndexedDB cache before querying Firestore. The grid renders on the first frame.
2. **App-boot prefetch** — Fire the Firestore query at app startup via `requestIdleCallback`, so fresh data is in memory before the user even navigates to the gallery.
3. **Optimistic local index updates** — When the user saves/deletes/publishes a sequence, update the IndexedDB index immediately. The gallery reflects mutations instantly without any network dependency.

## Architecture

### New Service: `GalleryPrefetcher`

Registered in DI. Kicked off from the app shell on mount.

**Responsibilities:**

- On app boot: load IndexedDB cache into `PublicSequencesLoader`'s in-memory cache via a new `warmFromCache(sequences, sourceRefs)` method
- In parallel: fire Firestore query in background at idle priority
- When Firestore returns: diff against cached data, patch in-memory state if different, persist updated data to IndexedDB
- Subscribe to library mutation events and patch IndexedDB index in real-time

**Interface:**

```typescript
interface IGalleryPrefetcher {
  prefetch(): Promise<void>;
  readonly isWarmed: boolean;
  readonly isSyncing: boolean;
  readonly prefetchPromise: Promise<void> | null;
}
```

### Modified Service: `PublicSequencesLoader`

**New method:**

```typescript
warmFromCache(sequences: SequenceData[], sourceRefs: Map<string, string>): void
```

Populates the in-memory `cachedSequences` and `sourceRefCache` without triggering a Firestore fetch. Called by `GalleryPrefetcher` after reading IndexedDB.

**Modified `loadSequenceMetadata()`:**

Current flow:
```
if cachedSequences → return cached
if loadPromise → return promise
fetch from Firestore → cache → return
```

New flow:
```
if cachedSequences → return cached
if prefetcher has in-flight promise → await it → return cached
fetch from Firestore → cache → return
```

This prevents duplicate Firestore queries when the gallery opens while a prefetch is already running.

### Modified: `browse-state-factory.svelte.ts`

**`loadAllSequences()` changes:**

Current: sets `isLoading=true`, `sectionsReady=false`, awaits Firestore, sets `sectionsReady=true`.

New: if `PublicSequencesLoader` already has cached data (warmed by prefetcher), `loadSequenceMetadata()` returns synchronously from cache. `sectionsReady` flips to true on the first frame. No skeleton loaders appear.

The existing flow handles this naturally — `loadSequenceMetadata()` already returns immediately when `cachedSequences` is populated. The only change is that the cache is populated earlier (at boot instead of first gallery visit).

### Event System Completion

Fire events from `LibraryRepository` methods directly instead of relying on callers:

| Method | Event to fire |
|--------|--------------|
| `saveSequence()` | `LIBRARY_SEQUENCE_ADDED_EVENT` |
| `saveSequenceWithMetadata()` | `LIBRARY_SEQUENCE_ADDED_EVENT` |
| `deleteSequences()` (batch) | `LIBRARY_MUTATED_EVENT` per sequence |
| `updateSequence()` | `LIBRARY_MUTATED_EVENT` (reuse for updates) |
| `setVisibility()` | `LIBRARY_MUTATED_EVENT` |
| `toggleFavorite()` | `LIBRARY_MUTATED_EVENT` |

**Deduplication:** `LibrarySaveService.saveSequence()` currently fires the added event from its caller (`SaveToLibraryPanel`). Move the event firing into `LibraryRepository` and remove it from the caller to avoid double-firing.

### IndexedDB Patching on Events

The `GalleryPrefetcher` subscribes to library events and patches IndexedDB:

- **Added:** `db.galleryCache.put(newEntry)` — upsert the new sequence
- **Deleted:** `db.galleryCache.delete(sequenceId)` — remove the entry
- **Updated (metadata/visibility):** `db.galleryCache.put(updatedEntry)` — overwrite

These are single-row IndexedDB operations — sub-millisecond. Non-blocking, fire-and-forget with error logging.

### Library Tab: Same Pattern

`loadLibrarySequences()` in `browse-state-factory` already has a `libraryCache` in-memory array. Extend with:

- Persist library metadata to a separate IndexedDB table (`libraryCacheEntries`) on load
- Warm from IndexedDB on prefetch (same as community)
- Patch on library events (same listeners)

The `LibraryRepository.getSequences()` result maps directly to `SequenceData[]` so the same cache/warm pattern applies.

## Data Flow

### First-ever app launch (cold start)

```
App boots → requestIdleCallback
  → IndexedDB empty → no warm
  → Firestore query fires → returns metadata
  → Populate in-memory cache + persist to IndexedDB
User opens gallery
  → If prefetch finished: instant (from memory)
  → If prefetch still running: await it (1-2s, same as today)
  → Either way: no worse than current behavior
```

### Subsequent app launches (warm start — the common case)

```
App boots → requestIdleCallback
  → IndexedDB has cached data → warm in-memory cache (5-50ms)
  → Firestore query fires in background
User opens gallery (any time after ~50ms)
  → Data already in memory → sectionsReady=true immediately
  → Thumbnails resolve from 4-tier cache → images appear
  → No skeletons. Fully loaded gallery.
  → Background: Firestore returns, diffs, patches if needed (invisible)
```

### User saves a sequence, then opens gallery

```
Save completes → event fires
  → browse-state-factory patches in-memory arrays (existing behavior)
  → GalleryPrefetcher patches IndexedDB cache (new behavior)
User opens gallery
  → New sequence already present in memory and in IndexedDB
  → Appears instantly with no Firestore dependency
```

## Edge Cases

### Stale data visibility window

Between IndexedDB warm and Firestore sync completing, the user sees data from their last session. For community sequences, this could be hours old. This is acceptable because:

- The data is structurally identical in most sessions (same sequences, same sections)
- New community sequences appearing 2-3 seconds after gallery load (when sync finishes) is imperceptible — they just pop into their alphabetical position
- Deleted sequences that still appear briefly will show a "not found" state if tapped, then disappear on next sync

### Multiple devices

User saves on phone, opens gallery on desktop. The desktop's IndexedDB cache won't have the new sequence until the background Firestore sync runs. This is the same behavior as today — no regression. The sync just happens non-blockingly now.

### Cache corruption

If IndexedDB data is corrupted or the schema changes, `loadCached()` should catch errors and return empty. The prefetcher falls through to the Firestore path. Existing error handling in `GalleryOfflineCache` covers this.

### Prefetch vs. gallery race condition

If the user navigates to the gallery before `requestIdleCallback` fires (extremely fast navigation), the gallery's `loadAllSequences()` runs the normal Firestore path. The prefetcher detects that `cachedSequences` is already populated and skips its work. No conflict.

## Files to Create

| File | Purpose |
|------|---------|
| `services/contracts/IGalleryPrefetcher.ts` | Interface |
| `services/implementations/GalleryPrefetcher.ts` | Implementation |

## Files to Modify

| File | Change |
|------|--------|
| `PublicSequencesLoader.ts` | Add `warmFromCache()`, coordinate with prefetch promise |
| `browse-state-factory.svelte.ts` | No structural changes — benefits automatically from warmed cache |
| `LibraryRepository.ts` | Fire events from 6 mutation methods |
| `library-events.ts` | No changes needed (existing events sufficient) |
| `browse-container.ts` | Register `GalleryPrefetcher` |
| `MainApplication.svelte` (or app shell) | Kick off prefetch on mount |
| `SaveToLibraryPanel.svelte` | Remove event firing (moved to repository) |
| `SequenceViewerOrchestrator.svelte` | Remove event firing (moved to repository) |

## Testing Strategy

Per the earned-tests philosophy: the prefetch/cache pipeline is exactly the kind of "silent data corruption risk" that earns a test. If the cache warm produces wrong data, the gallery silently shows stale content.

**Test: IndexedDB round-trip fidelity** — persist mock PublicSequenceIndex docs, load them back, verify the SequenceData output matches what Firestore would produce. This is a pure data transform test with no UI.

**No tests for:** Event wiring (obvious when broken — sequence doesn't appear/disappear), prefetch timing (integration concern, not unit-testable meaningfully).

## What This Does NOT Change

- Thumbnail rendering pipeline (already excellent, 4-tier cache)
- Filter/sort logic (operates on in-memory arrays regardless of source)
- Firestore query structure (same query, just non-blocking now)
- Offline fallback (still works — IndexedDB cache is the same data)
- Section generation (sync operation, already fast)
