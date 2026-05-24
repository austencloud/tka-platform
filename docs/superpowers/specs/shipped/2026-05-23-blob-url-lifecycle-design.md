# Blob URL Lifecycle Management

## Status: BACKLOG

## Problem

9 blob URL leak sites across the video/gallery/preview pipeline. `URL.createObjectURL()` allocates a persistent mapping from a URL string to an in-memory Blob. The mapping (and the Blob it pins) survives until `URL.revokeObjectURL()` is called or the page unloads. None of the sites below reliably revoke, so long sessions accumulate hundreds of megabytes of unreclaimable memory.

## Confirmed Leak Sites

### 1. VideoSourceProvider.ts:9 - loadFromFile() blob URL never revoked

**File:** `src/lib/shared/video/services/implementations/VideoSourceProvider.ts`

`loadFromFile()` creates a blob URL at line 9 and stores it in the returned `VideoSourceInfo.url`. The `dispose()` method (line 103) clears the video element and nulls `currentInfo`, but never calls `URL.revokeObjectURL(this.currentInfo.url)`. The blob URL persists until page unload.

```ts
// Line 9 - creates blob URL
const url = URL.createObjectURL(file);

// Line 103-114 - dispose() never revokes it
dispose(): void {
  if (this.videoEl) {
    this.videoEl.pause();
    this.videoEl.removeAttribute("src");
    this.videoEl.load();
    this.videoEl.remove();
    this.videoEl = null;
  }
  this.offscreenCanvas = null;
  this.offscreenCtx = null;
  this.currentInfo = null; // blob URL reference dropped, never revoked
}
```

**Fix:** Revoke the blob URL in `dispose()` before nulling `currentInfo`. Also revoke on successive `loadFromFile()` calls if `currentInfo` already has a blob URL.

```ts
dispose(): void {
  if (this.currentInfo?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(this.currentInfo.url);
  }
  // ...existing cleanup
}
```

Add the same guard to `loadFromUrl()` so that reloading revokes the previous URL:

```ts
async loadFromFile(file: File): Promise<VideoSourceInfo> {
  if (this.currentInfo?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(this.currentInfo.url);
  }
  const url = URL.createObjectURL(file);
  return this.loadFromUrl(url, file.name);
}
```

---

### 2. GalleryRenderer.ts:161 - renderBatch() creates blob URLs with no component-unmount revocation

**File:** `src/lib/features/gallery-generator/services/GalleryRenderer.ts`

`renderBatch()` creates a blob URL per rendered sequence at line 161 and returns it in `BatchRenderResult.imageUrl`. The consumer (`GalleryGeneratorState.clearResults()`) does revoke these URLs -- but only when the user explicitly clears results. If the component unmounts without clearing (navigation away, tab switch), all blob URLs leak.

```ts
// Line 161
const imageUrl = URL.createObjectURL(blob);
```

**Fix:** The `GalleryGeneratorState` already has `clearResults()` with revocation at lines 177-179. Add an `onDestroy` hook in `GalleryGenerator.svelte` that calls `galleryGeneratorState.clearResults()` on unmount, or add a standalone `revokeAllUrls()` method that revokes without clearing blobs from the Map (preserving IndexedDB-backed reload).

```ts
// In GalleryGenerator.svelte onMount return, or via onDestroy:
onDestroy(() => {
  for (const img of galleryGeneratorState.renderedImages) {
    if (img.imageUrl) URL.revokeObjectURL(img.imageUrl);
  }
});
```

---

### 3. GalleryPersistence.ts:128 - loadAll() creates blob URLs with no lifecycle management

**File:** `src/lib/features/gallery-generator/services/GalleryPersistence.ts`

`loadAll()` iterates IndexedDB entries and creates a blob URL per stored image at line 128. These URLs are returned in the `RenderedImage[]` array and stored in `GalleryGeneratorState.renderedImages` via `restoreFromPersistence()`. The state's `clearResults()` revokes them, but there is no guarantee `clearResults()` runs before the state is garbage collected.

```ts
// Line 128
const imageUrl = URL.createObjectURL(item.blob);
```

**Fix:** Same as leak #2 -- the `onDestroy` hook in the component covers these URLs too since they end up in the same `renderedImages` array. No separate fix needed beyond ensuring the component always revokes on unmount.

---

### 4. VideoRecorder.ts:234,289 - blob URLs returned in result objects, caller-must-revoke contract

**File:** `src/lib/shared/video-record/services/implementations/VideoRecorder.ts`

Two sites create blob URLs:

- **Line 234** (`stopRecording()`): creates `blobUrl` and returns it in `RecordingResult`. The caller (`VideoRecordPanel.svelte`) does revoke at lines 189 and 268. This works but the contract is fragile -- any new caller that forgets to revoke leaks.

- **Line 289** (`getCachedRecording()`): creates a new blob URL every call from the same IndexedDB blob. If called multiple times for the same recording, each call leaks the previous URL.

```ts
// Line 234
const blobUrl = URL.createObjectURL(videoBlob);

// Line 289
const blobUrl = URL.createObjectURL(result.videoBlob);
```

**Fix:** For `getCachedRecording()`, maintain an internal `Map<string, string>` of `recordingId -> blobUrl`. Revoke the previous URL before creating a new one for the same recording. Expose a `releaseBlobUrl(recordingId)` method.

```ts
private cachedBlobUrls = new Map<string, string>();

async getCachedRecording(recordingId: string): Promise<RecordingResult | null> {
  // ...existing IndexedDB lookup...
  if (result?.videoBlob) {
    // Revoke previous blob URL for this recording if it exists
    const prev = this.cachedBlobUrls.get(recordingId);
    if (prev) URL.revokeObjectURL(prev);

    const blobUrl = URL.createObjectURL(result.videoBlob);
    this.cachedBlobUrls.set(recordingId, blobUrl);
    // ...
  }
}

releaseBlobUrl(recordingId: string): void {
  const url = this.cachedBlobUrls.get(recordingId);
  if (url) {
    URL.revokeObjectURL(url);
    this.cachedBlobUrls.delete(recordingId);
  }
}
```

---

### 5. VideoPreRenderer.ts:436,497 - same pattern as VideoRecorder

**File:** `src/lib/shared/animation-engine/services/implementations/VideoPreRenderer.ts`

Two sites:

- **Line 436** (`renderSequenceToVideo()`): creates `blobUrl` at the end of a render and returns it. Callers don't revoke.

- **Line 497** (`getCachedVideo()`): creates a new blob URL per call from the same cached blob. Repeated calls for the same sequence leak.

```ts
// Line 436
const blobUrl = URL.createObjectURL(videoBlob);

// Line 497
const blobUrl = URL.createObjectURL(result.videoBlob);
```

**Fix:** Same pattern as VideoRecorder fix -- internal `Map<string, string>` for `sequenceId -> blobUrl`, revoke-before-recreate, expose `releaseBlobUrl(sequenceId)`.

---

### 6. preview-cell-renderer.ts:95 - acknowledged design debt

**File:** `src/lib/shared/sequence-viewer/services/preview-cell-renderer.ts`

The module comment at line 96 explicitly says "Callers must call URL.revokeObjectURL() on returned URLs when done." The function creates blob URLs at lines 108 and 170, one per cell render. Callers (browse grids, sequence viewers) render hundreds of cells and must track every returned URL.

```ts
// Line 96 - the comment
// IMPORTANT: Callers must call URL.revokeObjectURL() on returned URLs when done.

// Line 108
return URL.createObjectURL(cachedBlob);

// Line 170
return URL.createObjectURL(blob);
```

**Fix:** This is the highest-volume leak site. A single browse scroll can generate 50-200 blob URLs. The `BlobUrlTracker` utility (see below) is the primary fix. Each component that calls `renderCell()` should register returned URLs with a tracker scoped to the component's lifecycle.

---

### 7. VideoCache.ts:90 - accumulates blob URLs, partial eviction may not revoke

**File:** `src/lib/shared/video/services/implementations/VideoCache.ts`

`VideoCache` maintains a `Map<string, string>` (`blobUrls`) mapping original URLs to blob URLs. It has proper revocation in:
- `clearAll()` (line 222): revokes all
- `cleanup()` (line 197): revokes expired entries
- `releaseVideo()` (line 243): revokes single entry
- `releaseAllBlobUrls()` (line 255): revokes all in-memory

The gap: when `getVideoUrl()` is called for a URL that is already in the map (line 80), it returns the existing blob URL without issue. But `downloadAndCache()` (line 376) creates a new blob URL unconditionally. If `downloadAndCache()` is called for a URL that already has a blob URL in the map (race condition from duplicate preload queue entries), the old one leaks.

```ts
// Line 376
const blobUrl = URL.createObjectURL(blob);
this.blobUrls.set(url, blobUrl); // overwrites without revoking
```

**Fix:** Check and revoke before setting:

```ts
private async downloadAndCache(url: string): Promise<void> {
  // ...existing download logic...
  const prev = this.blobUrls.get(url);
  if (prev) URL.revokeObjectURL(prev);
  const blobUrl = URL.createObjectURL(blob);
  this.blobUrls.set(url, blobUrl);
}
```

---

### 8. QR video route (/q/[code]) - blob URLs never revoked on prop/effect changes or unmount

**File:** `src/routes/q/[code]/+page.svelte`

The worker completion handler creates a blob URL at line 393 and sets it as `pageState.videoUrl`. When the user changes props or effects (`handlePropChange`, `handleEffectChange`), a new worker render produces a new blob URL that replaces the old one in `pageState` -- the old URL is never revoked. The component has no `onDestroy` cleanup.

```ts
// Line 393
const blobUrl = URL.createObjectURL(blob);
pageState = { kind: "playing", videoUrl: blobUrl, word, isFirstView: !isBackground };
// Previous pageState.videoUrl (if it was a blob:) is abandoned
```

On mobile, where this page is the primary entry point from QR scans, users experimenting with prop/effect combinations accumulate leaked blob URLs. Each is an entire MP4 video blob (typically 2-10 MB).

**Fix:** Track the current blob URL and revoke it before setting a new one. Add cleanup on unmount.

```ts
let currentBlobUrl: string | null = null;

function setBlobVideoState(blobUrl: string, word: string, isFirstView: boolean) {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = blobUrl;
  pageState = { kind: "playing", videoUrl: blobUrl, word, isFirstView };
}

onDestroy(() => {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  if (activeWorker) activeWorker.terminate();
});
```

---

## Central Utility: BlobUrlTracker

### Rationale

Sites 1, 4, 5, and 7 each independently implement (or fail to implement) the same pattern: "remember the blob URL I created, revoke the old one before creating a new one, revoke everything on dispose." A shared utility eliminates the class of bug.

### Location

`src/lib/shared/foundation/services/blob-url-tracker.ts`

### API

```ts
/**
 * Tracks blob URLs created via URL.createObjectURL and ensures
 * they are revoked when no longer needed.
 *
 * Usage patterns:
 *   const tracker = new BlobUrlTracker();
 *   const url = tracker.track(URL.createObjectURL(blob));
 *   // ...use url...
 *   tracker.revokeAll(); // on cleanup
 *
 * Keyed usage (replaces previous URL for same key):
 *   const url = tracker.trackKeyed("preview", URL.createObjectURL(blob));
 *   // Later, automatically revokes the old "preview" URL:
 *   const url2 = tracker.trackKeyed("preview", URL.createObjectURL(newBlob));
 */
export class BlobUrlTracker {
  private urls = new Set<string>();
  private keyedUrls = new Map<string, string>();

  /** Track an anonymous blob URL. Returns the URL for chaining. */
  track(url: string): string {
    this.urls.add(url);
    return url;
  }

  /** Track a keyed blob URL. Revokes any previous URL stored under the same key. */
  trackKeyed(key: string, url: string): string {
    const prev = this.keyedUrls.get(key);
    if (prev) {
      URL.revokeObjectURL(prev);
      this.urls.delete(prev);
    }
    this.keyedUrls.set(key, url);
    this.urls.add(url);
    return url;
  }

  /** Revoke a single tracked URL. */
  revoke(url: string): void {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
    // Also remove from keyed map if present
    for (const [key, val] of this.keyedUrls) {
      if (val === url) {
        this.keyedUrls.delete(key);
        break;
      }
    }
  }

  /** Revoke all tracked URLs. Call on component destroy / service dispose. */
  revokeAll(): void {
    for (const url of this.urls) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.keyedUrls.clear();
  }

  /** Number of currently tracked URLs. Useful for diagnostics. */
  get size(): number {
    return this.urls.size;
  }
}
```

### Svelte $effect-based auto-cleanup helper

For Svelte 5 components that create blob URLs in reactive contexts, a helper that ties tracker lifetime to the component lifecycle:

```ts
// src/lib/shared/foundation/services/use-blob-tracker.svelte.ts
import { BlobUrlTracker } from "./blob-url-tracker";

/**
 * Creates a BlobUrlTracker that auto-revokes all URLs when the
 * enclosing component is destroyed.
 *
 * Usage in a .svelte component:
 *   const blobs = useBlobTracker();
 *   const url = blobs.track(URL.createObjectURL(someBlob));
 */
export function useBlobTracker(): BlobUrlTracker {
  const tracker = new BlobUrlTracker();

  $effect(() => {
    return () => tracker.revokeAll();
  });

  return tracker;
}
```

This pattern covers leak sites 2, 3, 6, and 8 where components create blob URLs and need automatic cleanup on unmount.

---

## Fix Mapping

| # | File | Leak Pattern | Fix | Utility |
|---|------|-------------|-----|---------|
| 1 | VideoSourceProvider.ts | No revoke in dispose() | Revoke in dispose() + revoke-before-reload | BlobUrlTracker (keyed) |
| 2 | GalleryRenderer.ts | No revoke on component unmount | onDestroy revocation in GalleryGenerator.svelte | useBlobTracker() |
| 3 | GalleryPersistence.ts | Same URLs end up in state | Covered by fix #2 | -- |
| 4 | VideoRecorder.ts | Repeated getCachedRecording() leaks | Internal keyed map + releaseBlobUrl() | BlobUrlTracker (keyed) |
| 5 | VideoPreRenderer.ts | Same as #4 | Internal keyed map + releaseBlobUrl() | BlobUrlTracker (keyed) |
| 6 | preview-cell-renderer.ts | Caller-must-revoke at high volume | useBlobTracker() in consuming components | useBlobTracker() |
| 7 | VideoCache.ts | downloadAndCache() overwrites without revoking | Revoke before overwrite in downloadAndCache() | Inline (already has Map) |
| 8 | /q/[code]/+page.svelte | No revoke on prop/effect change or unmount | Track current blob URL, revoke on change + onDestroy | BlobUrlTracker (keyed) |

## Scope

- **New files:** 2 (blob-url-tracker.ts, use-blob-tracker.svelte.ts)
- **Modified files:** 7 (all leak sites except #3 which is covered by #2)
- **Risk:** Low. All changes are additive revocation calls. No behavioral change to rendering, caching, or playback.
- **Testing:** Manual verification via DevTools Memory tab -- navigate through browse grid, record a video, change QR page props, then check that blob URL count returns to baseline after cleanup.

## Out of Scope

- Refactoring the preview-cell-renderer to not return blob URLs at all (would require an Object URL pool or direct ImageBitmap rendering). That is a larger architectural change.
- Auditing the remaining ~60 files that call `createObjectURL` outside the video/gallery/preview pipeline. Most are short-lived (download links, clipboard operations) and are either revoked already or used in fire-and-forget contexts where the page lifecycle handles cleanup.
