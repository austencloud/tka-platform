# Composition Worker: Off-Main-Thread Thumbnail Rendering

**Date:** 2026-05-06
**Status:** Draft
**Scope:** Move all `ImageComposer.composeSequenceImage()` work into a Web Worker pool using OffscreenCanvas. Eliminates main-thread jank during bulk thumbnail rendering (Deck browser, gallery browsing, card exports).

---

## Problem

When browsing decks with 50-136+ sequences, the ThumbnailRenderQueue processes up to 8 concurrent renders on the main thread. Each render calls `ImageComposer.composeSequenceImage()` which does synchronous Canvas2D work: beat rendering, text layout, mandala compositing, QR codes, borders. Even with `setTimeout(0)` yielding between beats, the accumulated draw calls saturate the main thread, causing jank when navigating away or interacting with other parts of the app.

The existing `WorkerRenderPool` only offloads individual pictograph/beat rendering. The composition loop (layout calculation, beat arrangement, headers, footers, QR, mandalas, borders) remains on the main thread.

## Solution

A `CompositionDispatcher` that routes all `composeSequenceImage()` calls to a pool of dedicated Web Workers using OffscreenCanvas. Workers return `ImageBitmap` via Transferable (zero-copy). On browsers without OffscreenCanvas 2D support in workers (Firefox, some Safari), falls back to main-thread rendering with `scheduler.yield()` cooperative yielding.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Universal — all composition goes through workers | One rendering path to maintain; exports benefit too |
| Per-beat WorkerRenderPool | Keep for Sequence Viewer | Different workload (real-time single-beat vs bulk composition) |
| Worker boundary | At `ImageComposer.composeSequenceImage()` | Main thread handles option building, LOOP detection, start position derivation (cheap). Heavy canvas work goes to worker. |
| Nested workers | No | Safari doesn't support them |
| Worker communication | Raw typed postMessage | Comlink unnecessary for simple render-and-return protocol |
| Pool sizing | `Math.max(1, Math.min(hardwareConcurrency - 1, 4))` | Floor 1, cap 4. Diminishing returns beyond 4; memory cost is linear. |
| Return format | `transferToImageBitmap()` via transfer list | Zero-copy in Chromium. `bitmap.close()` mandatory after use. |
| Between-beat yielding | `scheduler.yield()` with `setTimeout(0)` fallback | Shipped in Chrome+Firefox. Respects task priority. |
| Firefox/Safari | Main-thread fallback with cooperative yielding | OffscreenCanvas 2D not baseline in workers (Firefox flag-gated, Safari unclear) |

## Architecture

```
MAIN THREAD                              WORKER POOL
─────────────                            ───────────
ThumbnailRenderer.render()
  ├─ build SequenceExportOptions
  ├─ pre-fetch visibility settings
  ├─ pre-render QR code as ImageBitmap
  ├─ pre-load glyph images as ImageBitmap[]
  │
  └─ CompositionDispatcher.compose()
       │
       ├─ canUseWorker?
       │   ├─ YES → post CompositionRequest to least-busy worker
       │   │         worker runs composeSequenceImage() on OffscreenCanvas
       │   │         worker posts back ImageBitmap (zero-copy transfer)
       │   │         main thread: bitmap → Blob → ObjectURL
       │   │         main thread: bitmap.close()
       │   │
       │   └─ NO  → run composeSequenceImage() on main thread
       │             use scheduler.yield() between beats
       │             canvas → Blob → ObjectURL
       │
       └─ return Blob (same shape regardless of path)
```

### Existing Pipeline Integration

`ThumbnailRenderer.render()` currently calls:
```typescript
const blob = await this.sequenceRenderer.renderSequenceToBlob(sequence, options, onProgress, signal);
```

After this change:
```typescript
const blob = await this.compositionDispatcher.compose(sequence, options, onProgress, signal);
```

`CompositionDispatcher` replaces the `SequenceRenderer.renderSequenceToBlob()` call for composition. `SequenceRenderer` itself stays — it's still used for one-off exports where the caller wants a canvas reference.

### Worker Lifecycle

1. **Pool creation:** Lazy on first `compose()` call. Workers are long-lived (survive across renders).
2. **Worker initialization:** Each worker imports the render pipeline, initializes `SvgAssetLoader`, loads fonts via `FontFace` API. Posts `init-done` when ready.
3. **Task dispatch:** Round-robin to least-busy worker (lowest `pendingCount`).
4. **Cancellation:** Main thread posts `CancelMessage`. Worker checks between beats and bails.
5. **Error recovery:** Worker catches errors, posts `CompositionError`. Main thread retries on main-thread fallback path (one retry, no infinite loop).
6. **Teardown:** `dispatcher.terminate()` kills all workers. Called on app unmount.

## Worker Protocol

### Main → Worker

```typescript
type WorkerInMessage =
  | { type: "init" }
  | {
      type: "compose";
      id: number;
      sequence: SequenceData;
      options: SequenceExportOptions;       // fully resolved
      visibilitySettings: PictographVisibilityOptions;
      glyphImages: ImageBitmap[];           // pre-loaded, Transferable
      glyphMeta: GlyphMetaEntry[];          // naturalWidth, naturalHeight, isDash per glyph
      qrBitmap: ImageBitmap | null;         // pre-rendered QR code
      elementIconBitmap: ImageBitmap | null; // pre-rendered element icon for footer
    }
  | { type: "cancel"; id: number };
```

### Worker → Main

```typescript
type WorkerOutMessage =
  | { type: "init-done" }
  | { type: "result"; id: number; bitmap: ImageBitmap }  // Transferable
  | { type: "progress"; id: number; current: number; total: number; stage: string }
  | { type: "error"; id: number; message: string };
```

### Transferable Objects

**Main → Worker (transfer list):**
- `glyphImages: ImageBitmap[]` — glyph letter images, one per letter in alphabet
- `qrBitmap: ImageBitmap | null` — pre-rendered QR code
- `elementIconBitmap: ImageBitmap | null` — pre-rendered element icon

**Worker → Main (transfer list):**
- `bitmap: ImageBitmap` — the rendered composition

Transferable = zero-copy. Ownership moves; sender can no longer access.

## DOM Dependency Extraction

### Already Worker-Safe (no changes needed)

| Component | Why |
|-----------|-----|
| `LayerCompositor` | Already uses `OffscreenCanvas` when available |
| `SvgImageCache` | Returns `ImageBitmap` in workers |
| `SvgAssetLoader` | Uses `fetch()` for SVG loading |
| `renderHeader()` / `renderFooter()` | Pure canvas 2D drawing (from @tka/render-composition) |
| `RenderCanvas` / `RenderContext2D` types | Already union `HTMLCanvasElement | OffscreenCanvas` |
| `drawStepNumber()` | Pure canvas 2D |
| `drawSmartCellBorders()` | Pure canvas 2D |
| `renderMandalaToCanvas()` | Pure canvas 2D |
| `MandalaGeometryCalculator` | Pure math |

### Surgical DOM Fixes (5 changes)

Each is a one-line replacement of `document.createElement("canvas")` with a conditional:

```typescript
function createRenderCanvas(w: number, h: number): RenderCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  return document.createElement("canvas");
}
```

| File | Line | Current | Fix |
|------|------|---------|-----|
| `ImageComposer.ts` | 271 | `document.createElement("canvas")` | `createRenderCanvas(w, h)` |
| `card-composer.ts` | 37 | `document.createElement("canvas")` | `createRenderCanvas(w, h)` |
| `Canvas2DDirectRenderer.ts` | 126 | `document.createElement("canvas")` | `createRenderCanvas(w, h)` |
| `ImageFormatConverter.ts` | 71 | `document.createElement("canvas")` in `imageToBlob()` | `createRenderCanvas(w, h)` |
| `TextRenderer.ts` | 314 | `document.createElement("canvas")` in `measureText()` | `createRenderCanvas(w, h)` |

### Pre-Compute on Main Thread (pass to worker)

| Data | Why | How |
|------|-----|-----|
| **Visibility settings** | `getVisibilityStateManager()` reads Svelte stores | Already bypassed — `ThumbnailRenderer` provides full `visibilityOverrides`, so `ImageComposer.getVisibilitySettings()` skips store reads. For universal path (exports), `CompositionDispatcher` pre-fetches settings and includes them in the message. |
| **Glyph images** | `TextRenderer.preloadGlyphImages()` uses `new Image()` + GlyphCache (main-thread-only) | Pre-load on main thread once. Convert each to `ImageBitmap` via `createImageBitmap()`. Transfer to worker as `Transferable[]`. Worker reconstructs `glyphImageCache` map from transferred bitmaps + metadata. |
| **QR code** | `QRCodeGenerator.generateAsImage()` uses DOM (qr-code-styling library) | Pre-render on main thread. Convert to `ImageBitmap`. Transfer to worker. Worker draws it at the right position. |
| **Element icon** | Footer's `elementIcon: CanvasImageSource` | Pre-render on main thread if present. Transfer as `ImageBitmap`. |

### Not Used in Workers

| Component | Reason |
|-----------|--------|
| `CanvasManager` | Canvas pooling + `window.setInterval()`. Workers create/dispose canvases directly. |
| `PictographMemoryCache` | Stores `HTMLImageElement`. Workers use `ImageBitmap` cache instead. |
| `QRCodeGenerator` | DOM-dependent. QR pre-rendered on main thread. |
| Svelte store managers | DOM-context-only. Settings pre-fetched. |

## Composition Worker File

**`src/lib/shared/render/workers/composition.worker.ts`**

The worker imports the render pipeline and exposes a single `compose` handler:

```
imports:
  - ImageComposer (worker-mode: no store reads, uses createRenderCanvas)
  - LayerCompositor
  - Canvas2DDirectRenderer
  - SvgAssetLoader
  - SvgImageCache
  - TextRenderer (worker-compatible: uses transferred glyph ImageBitmaps)
  - renderMandalaToCanvas, getMandalaGeometryCalculator
  - renderHeader, renderFooter (@tka/render-composition)

state (per worker):
  - imageComposer: ImageComposer instance
  - svgAssetLoader: SvgAssetLoader (initialized once, caches SVG assets)
  - fontLoaded: boolean
  - activeRenders: Map<number, { cancelled: boolean }>

message handler:
  init → initialize SvgAssetLoader, load fonts via FontFace API, create ImageComposer
  compose → run composeSequenceImage(), yield between beats, post progress, return bitmap
  cancel → set cancelled flag for given id
```

**Between-beat cancellation check in worker:**

```typescript
const yieldToLoop = globalThis.scheduler?.yield
  ?? (() => new Promise<void>(r => setTimeout(r, 0)));

// In the beat loop (ImageComposer line 355-357):
for (let i = 0; i < sequence.steps.length; i++) {
  if (activeRenders.get(id)?.cancelled) {
    throw new DOMException("Render cancelled", "AbortError");
  }
  if (i > 0) await yieldToLoop();
  // ... render beat
}
```

## CompositionDispatcher

**`src/lib/shared/render/services/implementations/CompositionDispatcher.ts`**

```
class CompositionDispatcher {
  private workers: WorkerEntry[]
  private nextRequestId: number
  private pendingRequests: Map<number, PendingRequest>
  private initialized: boolean
  private glyphBitmaps: ImageBitmap[] | null  // loaded once, cloned per dispatch

  // Feature detection (cached)
  private static canUseWorker: boolean | null = null

  compose(
    sequence: SequenceData,
    options: SequenceExportOptions,
    onProgress?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<Blob>

  terminate(): void
}
```

**Feature detection for OffscreenCanvas 2D:**

```typescript
static detectWorkerSupport(): boolean {
  if (typeof OffscreenCanvas === "undefined") return false;
  try {
    const c = new OffscreenCanvas(1, 1);
    const ctx = c.getContext("2d");
    return ctx !== null;
  } catch {
    return false;
  }
}
```

**Glyph pre-loading strategy:**

Glyph images are loaded once on main thread (existing `TextRenderer.preloadGlyphImages()`), then converted to `ImageBitmap[]` via `createImageBitmap()`. These bitmaps are transferred to each worker during initialization (once per worker lifetime, not per render). Workers cache them permanently in their own `glyphImageCache` map. The glyph set is static per session — no per-render transfer overhead.

**QR pre-rendering:**

Only when `options.visibilityOverrides.showQRCode` is true. `QRCodeGenerator.generateAsImage()` runs on main thread, result converted to `ImageBitmap`, transferred with the compose request.

## Fallback Path (Firefox/Safari)

When `detectWorkerSupport()` returns false, `CompositionDispatcher.compose()` runs on the main thread using the existing `ImageComposer.composeSequenceImage()` path, but with an improved yield strategy:

```typescript
// Replace setTimeout(0) with scheduler.yield() where available
const yieldFn = globalThis.scheduler?.yield
  ?? (() => new Promise<void>(r => setTimeout(r, 0)));
```

This is strictly better than the current `setTimeout(0)`: in Chrome/Firefox it preserves task priority context, in Safari it degrades to `setTimeout(0)` (current behavior, no regression).

The fallback path also checks `signal?.aborted` between beats (already implemented at ImageComposer line 356).

## Cancellation

**Worker path:**
1. `signal.addEventListener("abort", ...)` on main thread
2. On abort: post `{ type: "cancel", id }` to worker
3. Worker sets `cancelled` flag for that render ID
4. Between beats, worker checks flag and throws `AbortError`
5. Worker posts `{ type: "error", id, message: "Render cancelled" }`
6. Main thread resolves/rejects the pending promise

**Main-thread fallback:**
Unchanged — `signal?.aborted` check at ImageComposer line 356.

## Pool Management

```typescript
const POOL_SIZE = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 4));
```

| Device | hardwareConcurrency | Pool Size |
|--------|---------------------|-----------|
| M3 MacBook Pro | 12 | 4 (capped) |
| Mid-range laptop | 8 | 4 (capped) |
| Chromebook / low-end | 4 | 3 |
| Budget phone | 2 | 1 (floor) |

Workers are long-lived. Created lazily on first `compose()` call. Each worker initializes its own `SvgAssetLoader` (fetches and caches SVG assets). Glyph `ImageBitmap[]` transferred during init, cached permanently in worker.

**Task dispatch:** Least-busy (lowest `pendingCount`). Ties broken by round-robin.

**Memory cleanup:** `bitmap.close()` called on main thread after converting to Blob. Worker's OffscreenCanvas is reused (resized per render).

## ThumbnailRenderQueue Changes

The existing `ThumbnailRenderQueue` stays. It limits concurrency and provides the cancellation/deduplication layer. The change is what runs inside its `execute` callback:

**Before:**
```typescript
const blob = await this.renderer.render(sequence, key.inputs, undefined, onProgress, signal);
```

**After:**
```typescript
const blob = await this.renderer.render(sequence, key.inputs, undefined, onProgress, signal);
// ThumbnailRenderer.render() internally calls CompositionDispatcher.compose()
// instead of SequenceRenderer.renderSequenceToBlob()
```

The queue's `maxConcurrent` (currently 8) should be adjusted:
- **Worker path:** Can stay at 8 (or match pool size × 2 for pipelining) — workers handle the load
- **Fallback path:** Drop to 2-3 to reduce main-thread pressure

```typescript
const maxConcurrent = CompositionDispatcher.canUseWorker()
  ? Math.min(POOL_SIZE * 2, 8)
  : 3;
queue.setMaxConcurrent(maxConcurrent);
```

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/render/workers/composition.worker.ts` | Composition worker — imports render pipeline, handles compose/cancel messages |
| `src/lib/shared/render/services/implementations/CompositionDispatcher.ts` | Pool manager — feature detection, dispatch, fallback, glyph pre-loading |
| `src/lib/shared/render/services/implementations/createRenderCanvas.ts` | Shared helper: `OffscreenCanvas` when available, `document.createElement` otherwise |
| `src/lib/shared/render/services/implementations/glyph-bitmap-loader.ts` | Converts TextRenderer's glyph Image cache to ImageBitmap[] for worker transfer |

### Modified Files

| File | Change |
|------|--------|
| `ImageComposer.ts:271` | Use `createRenderCanvas()` |
| `card-composer.ts:37` | Use `createRenderCanvas()` |
| `Canvas2DDirectRenderer.ts:126` | Use `createRenderCanvas()` |
| `ImageFormatConverter.ts:71` | Use `createRenderCanvas()` |
| `TextRenderer.ts:314` | Use `createRenderCanvas()` |
| `TextRenderer.ts` | Add method to accept pre-loaded `ImageBitmap[]` glyphs (worker path) |
| `ImageComposer.ts` | Accept optional `qrBitmap` and `elementIconBitmap` params (skip QR generation in worker) |
| `ImageComposer.ts:355-357` | Use `scheduler.yield()` fallback instead of `setTimeout(0)` |
| `ThumbnailRenderer.ts` | Replace `SequenceRenderer.renderSequenceToBlob()` with `CompositionDispatcher.compose()` |
| `ThumbnailRenderQueue.ts` | Dynamic `maxConcurrent` based on worker availability |
| `getThumbnailRenderOrchestrator.ts` | Wire `CompositionDispatcher` into `ThumbnailRenderer` |

### Unchanged

| Component | Why |
|-----------|-----|
| `ThumbnailRenderOrchestrator` | Cache logic unchanged. Just gets Blobs faster. |
| `PropAwareThumbnail.svelte` | Consumer unchanged. |
| `ChoreoCardTab.svelte` | Consumer unchanged. `onDestroy` → `cancelAll()` still works. |
| `WorkerRenderPool` (per-beat) | Separate pool for Sequence Viewer. |
| `pictograph-render.worker.ts` | Unchanged. |

## Success Criteria

1. **Zero main-thread Canvas2D calls during Deck browsing** on Chromium — all composition happens in workers
2. **No jank when navigating away** from Deck tab — worker renders continue silently; cancellation is instant (post message + flag check)
3. **No visual regression** — rendered thumbnails are pixel-identical (same ImageComposer code, same inputs)
4. **Graceful degradation** — Firefox/Safari fall back to improved main-thread path with `scheduler.yield()`
5. **Cache compatibility** — same cache keys, same Blob output. Existing cached thumbnails remain valid.
6. **Memory safety** — all `ImageBitmap.close()` calls verified, no GPU memory leaks
7. **Export path benefits** — card exports and batch operations also use workers when available

## Risk: Font Rendering in Workers

Fonts loaded via `FontFace` API in workers use a separate font face set from the document. If a font isn't loaded in the worker before drawing, text renders in fallback font silently. Mitigation: worker initialization loads required fonts (`Georgia`, system serif) and awaits `fontFace.load()` before posting `init-done`. Header/footer text rendering uses the `@tka/render-composition` package which accepts canvas context — no DOM font dependency.

Glyph images (TKA letter SVGs) are pre-rendered as `ImageBitmap` on the main thread, so they bypass font rendering entirely — they're raster images drawn via `drawImage()`.

## Risk: Large Sequence Data Transfer

`SequenceData` for a 16-beat sequence with full motion data could be 20-50KB. Structured clone (postMessage) copies this. For 8 concurrent renders, that's 160-400KB of cloning overhead per render batch. This is negligible compared to the Canvas2D rendering time saved (~200-500ms per thumbnail).

For very large batches (deck export of 136 sequences), the queue's concurrency limit (8) ensures we never have more than 8 clones in flight.
