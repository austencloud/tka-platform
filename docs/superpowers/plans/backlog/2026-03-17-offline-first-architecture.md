# Offline-First Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browse gallery and pictograph rendering work offline after a single successful load, enabling the festival QR code scenario.

**Architecture:** An `OfflineCacheOrchestrator` DI service coordinates proactive caching of gallery metadata (Dexie), prop SVGs (Workbox precache), and thumbnails (existing `ThumbnailLocalCache`). A `GalleryOfflineCache` service handles Dexie persistence for the gallery, injected into `PublicSequencesLoader` for seamless online/offline switching.

**Tech Stack:** SvelteKit, Svelte 5 runes, ITI DI, Dexie.js (IndexedDB), Workbox (via @vite-pwa/sveltekit), Firebase Firestore

**Spec:** `docs/superpowers/specs/2026-03-17-offline-first-architecture-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/offline/domain/offline-cache-types.ts` | Type definitions: `OfflineCachePhase`, `OfflineCacheProgress`, `OfflineCacheStats`, `GalleryCacheEntry` |
| `src/lib/shared/offline/services/contracts/IGalleryOfflineCache.ts` | Interface for Dexie gallery persistence |
| `src/lib/shared/offline/services/implementations/GalleryOfflineCache.ts` | Dexie read/write for `galleryCache` table |
| `src/lib/shared/offline/services/contracts/IOfflineCacheOrchestrator.ts` | Interface for cache orchestration |
| `src/lib/shared/offline/services/implementations/OfflineCacheOrchestrator.ts` | Coordinates gallery cache + thumbnail prefetch |
| `src/lib/shared/offline/state/offline-cache-state.svelte.ts` | Reactive state factory wrapping orchestrator |
| `src/lib/shared/offline/context/offline-cache-context.ts` | Svelte context set/get for offline cache state |
| `src/lib/shared/di/containers/offline-container.ts` | ITI container for offline services |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/persistence/database/TKADatabase.ts` | Add `galleryCache` table (DB version 6) |
| `src/lib/shared/persistence/domain/constants/DATABASE_CONSTANTS.ts` | Add `GALLERY_CACHE` table name + index |
| `src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts` | Inject `IGalleryOfflineCache`, add offline fallback |
| `src/lib/shared/di/containers/browse-container.ts` | Pass `GalleryOfflineCache` to `PublicSequencesLoader` |
| `src/lib/shared/di/index.ts` | Wire offline container |
| `src/lib/shared/di/container-types.ts` | Add offline container types to `IAppContainerItems` |
| `vite.config.ts` | Verify/add prop SVGs to Workbox precache |
| `src/lib/shared/settings/components/tabs/profile/StorageSection.svelte` | Add "Download for offline" button + cache stats |
| `src/lib/features/browse/shared/components/BrowseModule.svelte` | Initialize offline cache state, set context |

---

## Task 1: Database Schema — Add `galleryCache` Table

**Files:**
- Modify: `src/lib/shared/persistence/domain/constants/DATABASE_CONSTANTS.ts`
- Modify: `src/lib/shared/persistence/database/TKADatabase.ts`
- Create: `src/lib/shared/offline/domain/offline-cache-types.ts`

- [ ] **Step 1: Create the types file**

Create `src/lib/shared/offline/domain/offline-cache-types.ts`:

```typescript
/**
 * Offline Cache Types
 *
 * Types for the proactive offline caching system.
 */

import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";

/** A cached gallery sequence entry in Dexie */
export interface GalleryCacheEntry {
  /** Same ID as Firestore doc */
  id: string;
  /** The Firestore doc stored as-is */
  data: PublicSequenceIndex;
  /** When this entry was cached */
  cachedAt: number;
}

/** Metadata about the gallery cache for staleness tracking */
export interface GalleryCacheMeta {
  id: "gallery-cache-meta";
  lastSyncedAt: number;
  sequenceCount: number;
}

export type OfflineCachePhase = "idle" | "caching" | "ready" | "error";

export interface OfflineCacheProgress {
  cached: number;
  total: number;
  currentTask: string;
}

export interface OfflineCacheStats {
  gallerySequenceCount: number;
  galleryLastSyncedAt: number | null;
  thumbnailsCached: number;
  thumbnailsSizeBytes: number;
  propSvgsCached: boolean;
  isOfflineReady: boolean;
}
```

- [ ] **Step 2: Add table name and index to DATABASE_CONSTANTS.ts**

In `src/lib/shared/persistence/domain/constants/DATABASE_CONSTANTS.ts`, add to `TABLE_NAMES`:

```typescript
// Offline cache tables (v6)
GALLERY_CACHE: "galleryCache",
```

Add to `TABLE_INDEXES`:

```typescript
[TABLE_NAMES.GALLERY_CACHE]: "id, data.word, data.ownerId, cachedAt",
```

- [ ] **Step 3: Bump DB version and add table to TKADatabase.ts**

In `src/lib/shared/persistence/database/TKADatabase.ts`:

Add import:
```typescript
import type { GalleryCacheEntry } from "$lib/shared/offline/domain/offline-cache-types";
```

Add table declaration after `compositions`:
```typescript
// Offline cache tables (v6)
galleryCache!: EntityTable<GalleryCacheEntry, "id">;
```

Bump `DATABASE_VERSION` from `5` to `6` in `DATABASE_CONSTANTS.ts`.

Update the version comment in `DATABASE_CONSTANTS.ts` (lines 20-24, where versions 2-5 are documented):
```typescript
* Version 6: Added galleryCache and galleryCacheMeta tables for offline browse gallery
```

Also add `GALLERY_CACHE_META` to `TABLE_NAMES` and `TABLE_INDEXES`:
```typescript
GALLERY_CACHE_META: "galleryCacheMeta",
// ...
[TABLE_NAMES.GALLERY_CACHE_META]: "id",
```

And in `TKADatabase.ts`, add the meta table:
```typescript
galleryCacheMeta!: EntityTable<GalleryCacheMeta, "id">;
```

Add both `db.galleryCache` and `db.galleryCacheMeta` to the `clearAllData()` transaction array and `.clear()` calls.

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No TypeScript errors related to database changes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/offline/domain/offline-cache-types.ts \
  src/lib/shared/persistence/domain/constants/DATABASE_CONSTANTS.ts \
  src/lib/shared/persistence/database/TKADatabase.ts
git commit -m "feat(offline): add galleryCache Dexie table for offline browse gallery"
```

---

## Task 2: GalleryOfflineCache Service

**Files:**
- Create: `src/lib/shared/offline/services/contracts/IGalleryOfflineCache.ts`
- Create: `src/lib/shared/offline/services/implementations/GalleryOfflineCache.ts`

- [ ] **Step 1: Create the interface**

Create `src/lib/shared/offline/services/contracts/IGalleryOfflineCache.ts`:

```typescript
/**
 * IGalleryOfflineCache
 *
 * Persists public gallery sequence metadata to Dexie for offline access.
 * Called by PublicSequencesLoader after a successful Firestore fetch.
 * On offline, provides cached data so the gallery renders without network.
 */

import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/** Converts a PublicSequenceIndex doc into a SequenceData for gallery display. */
export type GallerySequenceConverter = (data: PublicSequenceIndex, id: string) => SequenceData;

export interface IGalleryOfflineCache {
  /** Set the converter used by loadCached() to map PublicSequenceIndex → SequenceData. */
  setConverter(fn: GallerySequenceConverter): void;

  /** Persist raw Firestore docs to Dexie. Called after a successful fetch. */
  persist(docs: PublicSequenceIndex[]): Promise<void>;

  /** Load cached docs, returning SequenceData[] for gallery consumption.
   *  Note: returns sourceRefs Map (intentional expansion beyond spec) because
   *  PublicSequencesLoader needs it to restore its sourceRefCache for full-data lookups. */
  loadCached(): Promise<{
    sequences: SequenceData[];
    sourceRefs: Map<string, string>;
    lastSyncedAt: number | null;
  }>;

  /** Remove all cached gallery data. */
  clear(): Promise<void>;

  /** Get cache stats for the settings panel. */
  getStats(): Promise<{ count: number; lastSyncedAt: number | null }>;

  /** Whether any cached data exists. */
  hasCachedData(): Promise<boolean>;
}
```

- [ ] **Step 2: Create the implementation**

Create `src/lib/shared/offline/services/implementations/GalleryOfflineCache.ts`:

```typescript
/**
 * GalleryOfflineCache
 *
 * Persists PublicSequenceIndex documents to Dexie's galleryCache table.
 * On loadCached(), converts back to SequenceData[] via the same mapping
 * that PublicSequencesLoader uses for online data.
 */

import { db } from "$lib/shared/persistence/database/TKADatabase";
import type { IGalleryOfflineCache } from "../contracts/IGalleryOfflineCache";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GalleryCacheEntry, GalleryCacheMeta } from "../../domain/offline-cache-types";

export class GalleryOfflineCache implements IGalleryOfflineCache {
  /**
   * Converter function injected from PublicSequencesLoader context.
   * Converts PublicSequenceIndex → SequenceData using the same mapping
   * the loader uses for online data, keeping the conversion in one place.
   */
  private converter: ((data: PublicSequenceIndex, id: string) => SequenceData) | null = null;

  /** Set the converter function. Called during DI wiring. */
  setConverter(fn: (data: PublicSequenceIndex, id: string) => SequenceData): void {
    this.converter = fn;
  }

  async persist(docs: PublicSequenceIndex[]): Promise<void> {
    const now = Date.now();
    const entries: GalleryCacheEntry[] = docs.map((doc) => ({
      id: doc.id,
      data: doc,
      cachedAt: now,
    }));

    await db.transaction("rw", [db.galleryCache, db.galleryCacheMeta], async () => {
      // Replace all cached entries (full refresh)
      await db.galleryCache.clear();
      await db.galleryCache.bulkPut(entries);

      // Update staleness metadata in dedicated table
      await db.galleryCacheMeta.put({
        id: "gallery-cache-meta",
        lastSyncedAt: now,
        sequenceCount: docs.length,
      });
    });
  }

  async loadCached(): Promise<{
    sequences: SequenceData[];
    sourceRefs: Map<string, string>;
    lastSyncedAt: number | null;
  }> {
    const [entries, meta] = await Promise.all([
      db.galleryCache.toArray(),
      db.galleryCacheMeta.get("gallery-cache-meta"),
    ]);

    if (entries.length === 0) {
      return { sequences: [], sourceRefs: new Map(), lastSyncedAt: null };
    }

    const sourceRefs = new Map<string, string>();
    const sequences: SequenceData[] = [];

    for (const entry of entries) {
      const doc = entry.data;

      // Build sourceRef cache
      if (doc.sourceRef) {
        sourceRefs.set(doc.word, doc.sourceRef);
        if (doc.name && doc.name !== doc.word) {
          sourceRefs.set(doc.name, doc.sourceRef);
        }
      }

      // Convert to SequenceData
      if (this.converter) {
        sequences.push(this.converter(doc, entry.id));
      }
    }

    return {
      sequences,
      sourceRefs,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
    };
  }

  async clear(): Promise<void> {
    await db.transaction("rw", [db.galleryCache, db.galleryCacheMeta], async () => {
      await db.galleryCache.clear();
      await db.galleryCacheMeta.clear();
    });
  }

  async getStats(): Promise<{ count: number; lastSyncedAt: number | null }> {
    const [count, meta] = await Promise.all([
      db.galleryCache.count(),
      db.galleryCacheMeta.get("gallery-cache-meta"),
    ]);
    return { count, lastSyncedAt: meta?.lastSyncedAt ?? null };
  }

  async hasCachedData(): Promise<boolean> {
    const count = await db.galleryCache.count();
    return count > 0;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/offline/services/contracts/IGalleryOfflineCache.ts \
  src/lib/shared/offline/services/implementations/GalleryOfflineCache.ts
git commit -m "feat(offline): add GalleryOfflineCache service for Dexie persistence"
```

---

## Task 3: Wire GalleryOfflineCache into PublicSequencesLoader

**Files:**
- Modify: `src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts`
- Modify: `src/lib/shared/di/containers/browse-container.ts`

- [ ] **Step 1: Make `mapPublicIndexToSequenceData` accessible and add offline fallback to PublicSequencesLoader**

In `PublicSequencesLoader.ts`:

Add import:
```typescript
import type { IGalleryOfflineCache } from "$lib/shared/offline/services/contracts/IGalleryOfflineCache";
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";
```

Add constructor parameter and property:
```typescript
export class PublicSequencesLoader implements IBrowseLoader {
  private cachedSequences: SequenceData[] | null = null;
  private loadPromise: Promise<SequenceData[]> | null = null;
  private sourceRefCache: Map<string, string> = new Map();
  private galleryOfflineCache: IGalleryOfflineCache | null;

  constructor(galleryOfflineCache?: IGalleryOfflineCache) {
    this.galleryOfflineCache = galleryOfflineCache ?? null;

    // Give the offline cache our converter so it can map PublicSequenceIndex → SequenceData
    if (this.galleryOfflineCache) {
      this.galleryOfflineCache.setConverter(
        (data, id) => this.mapPublicIndexToSequenceData(data, id)
      );
    }
  }
```

Modify `loadSequenceMetadata()` to add offline fallback:
```typescript
async loadSequenceMetadata(): Promise<SequenceData[]> {
  if (this.cachedSequences) {
    return this.cachedSequences;
  }

  if (this.loadPromise) {
    return this.loadPromise;
  }

  this.loadPromise = this.fetchWithOfflineFallback();

  try {
    this.cachedSequences = await this.loadPromise;
    return this.cachedSequences;
  } catch (error) {
    const errorHandler = container.items.errorHandler as IErrorHandler;
    errorHandler.showUserError({
      message: "Couldn't load the gallery",
      technicalDetails: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      severity: "error",
      context: {
        module: "browse",
        action: "load-gallery",
      },
    });
    throw error;
  } finally {
    this.loadPromise = null;
  }
}

private async fetchWithOfflineFallback(): Promise<SequenceData[]> {
  // Try online first
  if (networkStatusState.isOnline) {
    try {
      const sequences = await this.fetchPublicSequences();

      // Persist to offline cache in background (don't block return)
      if (this.galleryOfflineCache) {
        this.persistToOfflineCache(sequences).catch((err) =>
          console.warn("[PublicSequencesLoader] Offline cache persist failed:", err)
        );
      }

      return sequences;
    } catch (error) {
      // Online but fetch failed — try offline cache
      console.warn("[PublicSequencesLoader] Firestore fetch failed, trying offline cache:", error);
    }
  }

  // Offline or fetch failed — try Dexie cache
  if (this.galleryOfflineCache) {
    const hasCache = await this.galleryOfflineCache.hasCachedData();
    if (hasCache) {
      const cached = await this.galleryOfflineCache.loadCached();
      // Restore sourceRef cache from offline data
      for (const [key, value] of cached.sourceRefs) {
        this.sourceRefCache.set(key, value);
      }
      return cached.sequences;
    }
  }

  // No cache available — throw to trigger error modal
  throw new Error("No network connection and no cached gallery data available");
}

private async persistToOfflineCache(sequences: SequenceData[]): Promise<void> {
  // We need the raw PublicSequenceIndex docs, not the converted SequenceData.
  // Re-fetch from the last Firestore snapshot isn't ideal. Instead, we store
  // during fetchPublicSequences() by collecting the raw docs.
  // This requires a small refactor — see step below.
}
```

**Important refactor to `fetchPublicSequences()`:** We need to capture the raw `PublicSequenceIndex` docs during the fetch so we can persist them. Modify `fetchPublicSequences()`:

```typescript
private lastFetchedDocs: PublicSequenceIndex[] = [];

private async fetchPublicSequences(): Promise<SequenceData[]> {
  const firestore = await getFirestoreInstance();
  const publicSeqRef = collection(firestore, getPublicSequencesPath());
  const q = query(publicSeqRef, orderBy("word", "asc"));
  const snapshot = await getDocs(q);

  const sequences: SequenceData[] = [];
  this.lastFetchedDocs = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as PublicSequenceIndex;
    this.lastFetchedDocs.push({ ...data, id: docSnap.id } as PublicSequenceIndex);
    sequences.push(this.mapPublicIndexToSequenceData(data, docSnap.id));

    if (data.sourceRef) {
      this.sourceRefCache.set(data.word, data.sourceRef);
      if (data.name && data.name !== data.word) {
        this.sourceRefCache.set(data.name, data.sourceRef);
      }
    }
  });

  return sequences;
}

private async persistToOfflineCache(_sequences: SequenceData[]): Promise<void> {
  if (!this.galleryOfflineCache || this.lastFetchedDocs.length === 0) return;
  await this.galleryOfflineCache.persist(this.lastFetchedDocs);
}
```

- [ ] **Step 2: Update browse-container.ts to inject GalleryOfflineCache**

In `src/lib/shared/di/containers/browse-container.ts`, add to the container wiring so `PublicSequencesLoader` receives the `GalleryOfflineCache`:

```typescript
import { GalleryOfflineCache } from "$lib/shared/offline/services/implementations/GalleryOfflineCache";

// Add galleryOfflineCache as a tier 0 service (no dependencies):
const tier0 = createContainer().add({
  galleryOfflineCache: () => new GalleryOfflineCache(),
  // ... other tier 0 services
});

// Then in the tier where browseLoader is created, inject it:
browseLoader: (ctx) => new PublicSequencesLoader(ctx.galleryOfflineCache),
```

This makes `galleryOfflineCache` accessible via `browseContainer.items.galleryOfflineCache` for the offline container to reference in Task 5.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts \
  src/lib/shared/di/containers/browse-container.ts
git commit -m "feat(offline): add offline fallback to PublicSequencesLoader via GalleryOfflineCache"
```

---

## Task 4: OfflineCacheOrchestrator Service

**Files:**
- Create: `src/lib/shared/offline/services/contracts/IOfflineCacheOrchestrator.ts`
- Create: `src/lib/shared/offline/services/implementations/OfflineCacheOrchestrator.ts`

- [ ] **Step 1: Create the interface**

Create `src/lib/shared/offline/services/contracts/IOfflineCacheOrchestrator.ts`:

```typescript
/**
 * IOfflineCacheOrchestrator
 *
 * Coordinates proactive caching for offline use.
 * Manages gallery metadata persistence (via GalleryOfflineCache)
 * and thumbnail prefetching (via ThumbnailLocalCache).
 */

import type { OfflineCacheStats } from "../../domain/offline-cache-types";

export interface IOfflineCacheOrchestrator {
  /** Start background caching (gallery + thumbnails). Call after gallery loads. */
  startBackgroundCache(): Promise<void>;

  /** User-triggered full download. Caches everything at full speed. */
  downloadForOffline(): Promise<void>;

  /** Cancel in-progress caching. */
  cancel(): void;

  /** Get cache stats for settings panel. */
  getCacheStats(): Promise<OfflineCacheStats>;

  /** Clear all offline caches (gallery + prefetched thumbnails). */
  clearOfflineCache(): Promise<void>;
}
```

- [ ] **Step 2: Create the implementation**

Create `src/lib/shared/offline/services/implementations/OfflineCacheOrchestrator.ts`.

Constructor signature:
```typescript
constructor(
  private networkMonitor: INetworkStatusMonitor,
  private galleryCache: IGalleryOfflineCache,
  private thumbnailCache: IThumbnailLocalCache
)
```

**Key implementation details:**

**`startBackgroundCache()`:**
1. Check `galleryCache.getStats()` — if gallery is already cached, skip to thumbnail prefetch
2. Gallery metadata caching happens inside `PublicSequencesLoader` automatically (on next gallery load). The orchestrator just needs to confirm it's populated.
3. Call `prefetchThumbnails(false)` (background mode = adaptive concurrency)

**`downloadForOffline()`:**
1. Same as above but calls `prefetchThumbnails(true)` (full speed = 10 concurrent)

**`prefetchThumbnails(fullSpeed: boolean)`:**
```typescript
private cancelled = false;
private prefetching = false;

async prefetchThumbnails(fullSpeed: boolean): Promise<void> {
  if (this.prefetching) return;
  this.prefetching = true;
  this.cancelled = false;

  try {
    // Get all cached gallery entries from Dexie
    const cached = await this.galleryCache.loadCached();
    if (cached.sequences.length === 0) return;

    // Determine concurrency from connection quality
    const concurrency = fullSpeed ? 10 : this.getConcurrency();

    // Process in chunks
    const queue = cached.sequences.filter(seq => seq.thumbnails?.[0]);
    let i = 0;

    while (i < queue.length && !this.cancelled) {
      // Pause if page is hidden (save battery)
      if (typeof document !== 'undefined' && document.hidden) {
        await this.waitForVisible();
        if (this.cancelled) break;
      }

      // Pause if offline
      if (!this.networkMonitor.isOnline) {
        await this.waitForOnline();
        if (this.cancelled) break;
      }

      const batch = queue.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(seq => this.prefetchSingleThumbnail(seq))
      );
      i += concurrency;
    }
  } finally {
    this.prefetching = false;
  }
}
```

**Thumbnail key derivation for prefetch:**
The `ThumbnailKeyDeriver` needs a `ThumbnailRenderInput`. For prefetch, use defaults:
```typescript
private buildPrefetchInput(seq: SequenceData): ThumbnailRenderInput {
  return {
    sequenceName: seq.word || seq.name,
    sequenceId: seq.id,
    variant: "gallery" as ThumbnailVariant,
    lightMode: false, // dark mode default
    bluePropType: PropType.STAFF, // default prop
    redPropType: PropType.STAFF,
    catDogModeEnabled: false,
    loopType: seq.loopType ?? null,
    // Composition settings use GALLERY_DEFAULTS
    addWord: true,
    addStepNumbers: true,
    includeStartPosition: true,
    addDifficultyLevel: true,
    addUserInfo: false,
    showCreatorName: true,
    showNotes: true,
    showBirthday: true,
  };
}
```

**Thumbnail URLs:** `seq.thumbnails[0]` is a Firebase Storage URL (e.g., `https://firebasestorage.googleapis.com/...`). Fetch it, convert response to Blob, then `thumbnailCache.set(key.hash, blob)`.

**Concurrency adaptation:**
```typescript
private getConcurrency(): number {
  const status = this.networkMonitor.status;
  if (status.isMetered) return 1;
  switch (status.effectiveType) {
    case '4g': return 10;
    case '3g': return 3;
    case '2g': case 'slow-2g': return 1;
    default: return 5;
  }
}
```

**`getCacheStats()`:** Aggregates from `galleryCache.getStats()` + `thumbnailCache.getStats()`. `isOfflineReady` = gallery count > 0.

**`clearOfflineCache()`:** Calls `galleryCache.clear()` + `thumbnailCache.clear()`.

- [ ] **Step 3: Verify build**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/offline/services/contracts/IOfflineCacheOrchestrator.ts \
  src/lib/shared/offline/services/implementations/OfflineCacheOrchestrator.ts
git commit -m "feat(offline): add OfflineCacheOrchestrator for proactive caching"
```

---

## Task 5: DI Container Wiring

**Files:**
- Create: `src/lib/shared/di/containers/offline-container.ts`
- Modify: `src/lib/shared/di/index.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Create the offline container**

Create `src/lib/shared/di/containers/offline-container.ts`:

```typescript
/**
 * Offline Module ITI Container
 *
 * Provides services for offline caching:
 * - OfflineCacheOrchestrator (coordinates proactive caching)
 * - GalleryOfflineCache is created in browse-container (shared with PublicSequencesLoader)
 */

import { createContainer } from "iti";
import { OfflineCacheOrchestrator } from "$lib/shared/offline/services/implementations/OfflineCacheOrchestrator";
import type { INetworkStatusMonitor } from "$lib/shared/sync/services/contracts/INetworkStatusMonitor";
import type { IGalleryOfflineCache } from "$lib/shared/offline/services/contracts/IGalleryOfflineCache";
import type { IThumbnailLocalCache } from "$lib/features/browse/sequences/display/services/contracts/IThumbnailLocalCache";

export interface OfflineContainerDeps {
  networkStatusMonitor: INetworkStatusMonitor;
  galleryOfflineCache: IGalleryOfflineCache;
  thumbnailLocalCache: IThumbnailLocalCache;
}

export function createOfflineContainer(deps: OfflineContainerDeps) {
  return createContainer().add({
    offlineCacheOrchestrator: () =>
      new OfflineCacheOrchestrator(
        deps.networkStatusMonitor,
        deps.galleryOfflineCache,
        deps.thumbnailLocalCache
      ),
  });
}

export type OfflineContainer = ReturnType<typeof createOfflineContainer>;
```

- [ ] **Step 2: Add to container-types.ts**

In `src/lib/shared/di/container-types.ts`, add:

```typescript
import type { OfflineContainer } from "./containers/offline-container";
type OfflineItems = ItemsOf<OfflineContainer>;
```

Add `OfflineItems` to the `IAppContainerItems` intersection.

- [ ] **Step 3: Wire in index.ts**

In `src/lib/shared/di/index.ts`, inside `buildAppContainer()`:

```typescript
import { createOfflineContainer } from "./containers/offline-container";

// After browse container and deviceSyncContainer are created:
// networkStatusMonitor lives in deviceSyncContainer (NOT coreContainer)
const offlineContainer = createOfflineContainer({
  networkStatusMonitor: deviceSyncContainer.items.networkStatusMonitor,
  galleryOfflineCache: browseContainer.items.galleryOfflineCache,
  thumbnailLocalCache: browseContainer.items.thumbnailLocalCache,
});
```

Add offlineContainer items to the final merged container.

- [ ] **Step 4: Verify build**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/offline-container.ts \
  src/lib/shared/di/container-types.ts \
  src/lib/shared/di/index.ts
git commit -m "feat(offline): wire OfflineCacheOrchestrator into DI container"
```

---

## Task 6: Reactive State + Context

**Files:**
- Create: `src/lib/shared/offline/state/offline-cache-state.svelte.ts`
- Create: `src/lib/shared/offline/context/offline-cache-context.ts`

- [ ] **Step 1: Create the state factory**

Create `src/lib/shared/offline/state/offline-cache-state.svelte.ts`:

```typescript
/**
 * Offline Cache State Factory
 *
 * Reactive wrapper around OfflineCacheOrchestrator.
 * DI service holds logic, this factory adds Svelte 5 reactivity.
 */

import type { IOfflineCacheOrchestrator } from "../services/contracts/IOfflineCacheOrchestrator";
import type {
  OfflineCachePhase,
  OfflineCacheProgress,
  OfflineCacheStats,
} from "../domain/offline-cache-types";

export function createOfflineCacheState(orchestrator: IOfflineCacheOrchestrator) {
  let phase = $state<OfflineCachePhase>("idle");
  let progress = $state<OfflineCacheProgress>({ cached: 0, total: 0, currentTask: "" });
  let isOfflineReady = $state(false);

  async function startBackgroundCache() {
    phase = "caching";
    progress = { cached: 0, total: 0, currentTask: "Gallery metadata" };
    try {
      await orchestrator.startBackgroundCache();
      const stats = await orchestrator.getCacheStats();
      isOfflineReady = stats.isOfflineReady;
      phase = "ready";
    } catch {
      phase = "error";
    }
  }

  async function downloadForOffline() {
    phase = "caching";
    progress = { cached: 0, total: 0, currentTask: "Downloading..." };
    try {
      await orchestrator.downloadForOffline();
      const stats = await orchestrator.getCacheStats();
      isOfflineReady = stats.isOfflineReady;
      phase = "ready";
    } catch {
      phase = "error";
    }
  }

  function cancel() {
    orchestrator.cancel();
    phase = "idle";
  }

  async function getCacheStats(): Promise<OfflineCacheStats> {
    return orchestrator.getCacheStats();
  }

  async function clearOfflineCache() {
    await orchestrator.clearOfflineCache();
    isOfflineReady = false;
    phase = "idle";
  }

  // Check initial state
  orchestrator.getCacheStats().then((stats) => {
    isOfflineReady = stats.isOfflineReady;
    if (stats.isOfflineReady) phase = "ready";
  });

  return {
    get phase() { return phase; },
    get progress() { return progress; },
    get isOfflineReady() { return isOfflineReady; },
    startBackgroundCache,
    downloadForOffline,
    cancel,
    getCacheStats,
    clearOfflineCache,
  };
}

export type OfflineCacheState = ReturnType<typeof createOfflineCacheState>;
```

- [ ] **Step 2: Create the context**

Create `src/lib/shared/offline/context/offline-cache-context.ts`:

```typescript
/**
 * Offline Cache Context
 *
 * Set once in browse module root, consumed by settings panel
 * and any component that needs offline cache status.
 */

import { getContext, setContext } from "svelte";
import type { OfflineCacheState } from "../state/offline-cache-state.svelte";

const OFFLINE_CACHE_KEY = Symbol("offline-cache");

export function setOfflineCacheContext(state: OfflineCacheState): void {
  setContext(OFFLINE_CACHE_KEY, state);
}

export function getOfflineCacheContext(): OfflineCacheState {
  return getContext<OfflineCacheState>(OFFLINE_CACHE_KEY);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/offline/state/offline-cache-state.svelte.ts \
  src/lib/shared/offline/context/offline-cache-context.ts
git commit -m "feat(offline): add reactive state factory and context for offline cache"
```

---

## Task 7: Integrate into Browse Module

**Files:**
- Modify: `src/lib/features/browse/shared/components/BrowseModule.svelte`

- [ ] **Step 1: Initialize offline cache state in BrowseModule**

In `BrowseModule.svelte`, add:

```typescript
import { container } from "$lib/shared/di";
import { createOfflineCacheState } from "$lib/shared/offline/state/offline-cache-state.svelte";
import { setOfflineCacheContext } from "$lib/shared/offline/context/offline-cache-context";
import type { IOfflineCacheOrchestrator } from "$lib/shared/offline/services/contracts/IOfflineCacheOrchestrator";

const orchestrator = container.items.offlineCacheOrchestrator as IOfflineCacheOrchestrator;
const offlineCacheState = createOfflineCacheState(orchestrator);
setOfflineCacheContext(offlineCacheState);

// Start background caching on mount (one-time, async fire-and-forget)
onMount(() => {
  offlineCacheState.startBackgroundCache();
});
```

Use `onMount`, not `$effect`, because this is a one-time async side effect on mount. `BrowseModule` already uses `onMount`.

Also register a reconnect handler to invalidate stale gallery data:
```typescript
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";

onMount(() => {
  offlineCacheState.startBackgroundCache();

  // On reconnect: clear in-memory cache so next gallery load fetches fresh data
  const unsubscribe = networkStatusState.onOnline(() => {
    // PublicSequencesLoader caches in memory — clear it so next load hits Firestore
    const loader = container.items.browseLoader;
    if (loader && 'removeFromCache' in loader) {
      // The loader's cachedSequences will be re-populated on next load
      // which also triggers a Dexie persist via GalleryOfflineCache
    }
  });

  return unsubscribe;
});
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/shared/components/BrowseModule.svelte
git commit -m "feat(offline): initialize offline cache in browse module"
```

---

## Task 8: Verify Prop SVG Precaching in Workbox

**Files:**
- Possibly modify: `vite.config.ts`

- [ ] **Step 1: Build and check the precache manifest**

Run: `npm run build`

Then check if prop SVGs appear in the generated service worker:

```bash
grep -c "props/pictograph" build/sw.js
```

If the count is 0 or less than 48, the glob pattern isn't matching. If it's ≥48, prop SVGs are already precached and no changes needed.

- [ ] **Step 2: If needed, add explicit precache entry**

In `vite.config.ts`, if prop SVGs aren't in the precache, add to `globPatterns`:

```typescript
globPatterns: [
  '**/*.{js,css,csv,html,ico,png,svg,woff2,woff,webp,webmanifest}',
  // Explicitly include prop SVGs for offline pictograph rendering
  'images/props/pictograph/*.svg',
],
```

Or remove any `globIgnores` pattern that excludes them.

- [ ] **Step 3: Verify and commit (if changed)**

Run: `npm run build` again and verify prop SVGs appear.

```bash
git add vite.config.ts
git commit -m "fix(offline): ensure prop SVGs are included in Workbox precache"
```

---

## Task 9: Settings Panel — Download for Offline

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/profile/StorageSection.svelte`

- [ ] **Step 1: Add offline cache controls to StorageSection**

Expand `StorageSection.svelte` to include:
- "Download for offline" button (calls `offlineCacheState.downloadForOffline()`)
- Cache stats display (gallery count, thumbnail count, total size)
- Offline ready indicator
- The existing "Clear Cache" button should also call `offlineCacheState.clearOfflineCache()`

**Architecture note:** Settings is NOT a descendant of BrowseModule, so the offline cache Svelte context is not available here. Use `container.items.offlineCacheOrchestrator` directly from the DI container. This means:
- `getCacheStats()` works for display
- `downloadForOffline()` works for the button action
- `clearOfflineCache()` works for the clear button
- There is no reactive progress indicator in Settings during download — the button shows a simple loading spinner and resolves when done. Granular progress is only available in the BrowseModule where the context lives. This is acceptable since the settings panel is a secondary entry point for this feature.

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/profile/StorageSection.svelte
git commit -m "feat(offline): add Download for Offline button and cache stats to settings"
```

---

## Task 10: Integration Testing

**Files:**
- No new test files (earned tests philosophy — this is wiring/UI, not silent math)

- [ ] **Step 1: Build check**

Run: `npm run build && npm run check`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 2: Manual verification checklist**

Verify in browser:
1. Open app on localhost, navigate to Browse gallery
2. Check DevTools → Application → IndexedDB → TKADatabase → galleryCache table has entries
3. Check DevTools → Application → Cache Storage → `workbox-precache-v2-*` contains prop SVGs
4. Go to DevTools → Network → check "Offline"
5. Refresh page, navigate to Browse gallery
6. Gallery should load from Dexie cache (check console for `[PublicSequencesLoader] Firestore fetch failed, trying offline cache`)
7. Pictograph prop images should render (from SW precache)
8. Settings → Storage section should show cache stats

- [ ] **Step 3: Commit final integration**

```bash
git commit -m "feat(offline): complete offline-first architecture integration"
```
