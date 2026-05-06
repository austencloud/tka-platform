# Composition Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all thumbnail composition (`ImageComposer.composeSequenceImage()`) off the main thread into a Web Worker pool using OffscreenCanvas, eliminating jank during deck browsing.

**Architecture:** `CompositionDispatcher` routes composition requests to a pool of dedicated workers (Chromium) or a cooperative main-thread fallback (Firefox/Safari). Workers return `ImageBitmap` via zero-copy Transferable. Integrates into existing `ThumbnailRenderer` → `ThumbnailRenderOrchestrator` pipeline.

**Tech Stack:** Web Workers, OffscreenCanvas, `scheduler.yield()`, Transferable `ImageBitmap`, Vite `import.meta.url` worker bundling

**Spec:** `docs/superpowers/specs/2026-05-06-composition-worker-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/render/services/implementations/createRenderCanvas.ts` | Shared helper: returns `OffscreenCanvas` or `HTMLCanvasElement` based on environment |
| `src/lib/shared/render/services/implementations/glyph-bitmap-loader.ts` | Converts TextRenderer's glyph `Image` cache to `ImageBitmap[]` + metadata for worker transfer |
| `src/lib/shared/render/services/implementations/CompositionDispatcher.ts` | Pool manager: feature detection, dispatch to workers or main-thread fallback, glyph pre-loading |
| `src/lib/shared/render/workers/composition.worker.ts` | Composition worker: imports render pipeline, handles compose/cancel messages, returns ImageBitmap |
| `src/lib/shared/render/getCompositionDispatcher.ts` | Factory getter (singleton pattern matching codebase convention) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/render/services/implementations/ImageComposer.ts:271` | `document.createElement("canvas")` → `createRenderCanvas()` |
| `src/lib/shared/render/services/implementations/ImageComposer.ts:357` | `setTimeout(resolve, 0)` → `scheduler.yield()` fallback |
| `src/lib/shared/render/services/implementations/card-composer.ts:37` | `document.createElement("canvas")` → `createRenderCanvas()` |
| `src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.ts:126` | `document.createElement("canvas")` → `createRenderCanvas()` |
| `src/lib/shared/render/services/implementations/ImageFormatConverter.ts:71` | `document.createElement("canvas")` → `createRenderCanvas()` |
| `src/lib/shared/render/services/implementations/TextRenderer.ts:314` | `document.createElement("canvas")` → `createRenderCanvas()` |
| `src/lib/shared/render/services/implementations/TextRenderer.ts` | Add `setGlyphBitmaps()` to accept pre-loaded `ImageBitmap[]` in worker context |
| `src/lib/shared/render/services/implementations/ImageComposer.ts` | Accept optional `qrBitmap` and `elementIconBitmap` via options (skip QR generation in worker) |
| `src/lib/shared/browse/services/ThumbnailRenderer.ts` | Replace `SequenceRenderer.renderSequenceToBlob()` with `CompositionDispatcher.compose()` |
| `src/lib/shared/browse/getThumbnailRenderer.ts` | Wire `CompositionDispatcher` into `ThumbnailRenderer` constructor |
| `src/lib/shared/browse/services/ThumbnailRenderQueue.ts` | Dynamic `maxConcurrent` based on worker availability |

---

## Task 1: `createRenderCanvas` Helper

**Files:**
- Create: `src/lib/shared/render/services/implementations/createRenderCanvas.ts`

This is the foundational utility that every subsequent task depends on.

- [ ] **Step 1: Create the helper module**

```typescript
// src/lib/shared/render/services/implementations/createRenderCanvas.ts
import type { RenderCanvas } from "../contracts/types";

export function createRenderCanvas(width: number, height: number): RenderCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS (no consumers yet, just a new export)

- [ ] **Step 3: Commit**

```
git add src/lib/shared/render/services/implementations/createRenderCanvas.ts
git commit -m "feat(render): add createRenderCanvas helper for worker-safe canvas creation"
```

---

## Task 2: Surgical DOM Fixes — Replace `document.createElement("canvas")`

**Files:**
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts:271`
- Modify: `src/lib/shared/render/services/implementations/card-composer.ts:37`
- Modify: `src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.ts:126`
- Modify: `src/lib/shared/render/services/implementations/ImageFormatConverter.ts:71`
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts:314`

Five one-line replacements. Each `document.createElement("canvas")` becomes `createRenderCanvas(w, h)`, plus the import.

- [ ] **Step 1: Fix ImageComposer.ts**

At line 271, replace:
```typescript
const canvas = document.createElement("canvas");
canvas.width = canvasWidth;
canvas.height = canvasHeight;
```
With:
```typescript
const canvas = createRenderCanvas(canvasWidth, canvasHeight);
```

Add import at top:
```typescript
import { createRenderCanvas } from "./createRenderCanvas";
```

Note: `canvas.getContext("2d")` returns `CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null` — both support the same draw API used in this file.

Also update `composeSequenceImage` return type from `HTMLCanvasElement` to `RenderCanvas`:
```typescript
async composeSequenceImage(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  onProgress?: CompositionProgressCallback,
  signal?: AbortSignal
): Promise<RenderCanvas> {
```

And update `composeCardImage` similarly. The `RenderCanvas` type already exists in `contracts/types.ts`.

- [ ] **Step 2: Fix card-composer.ts**

At line 37, replace:
```typescript
const cardCanvas = document.createElement("canvas");
cardCanvas.width = cardWidth;
cardCanvas.height = cardHeight;
```
With:
```typescript
const cardCanvas = createRenderCanvas(cardWidth, cardHeight);
```

Add import:
```typescript
import { createRenderCanvas } from "./createRenderCanvas";
```

Update `composeCardImage` return type from `HTMLCanvasElement` to `RenderCanvas`. Update the `composeSequenceImage` parameter type to return `Promise<RenderCanvas>`.

- [ ] **Step 3: Fix Canvas2DDirectRenderer.ts**

At line 126, replace:
```typescript
const canvas = document.createElement("canvas");
canvas.width = options.size;
canvas.height = options.size;
```
With:
```typescript
const canvas = createRenderCanvas(options.size, options.size);
```

Add import:
```typescript
import { createRenderCanvas } from "./createRenderCanvas";
```

Update `renderPictograph` and `renderPictographWithTiming` return types from `HTMLCanvasElement` to `RenderCanvas`.

- [ ] **Step 4: Fix ImageFormatConverter.ts**

At line 71, in `imageToBlob()`, replace:
```typescript
const canvas = document.createElement("canvas");
canvas.width = img.width || img.naturalWidth;
canvas.height = img.height || img.naturalHeight;
```
With:
```typescript
const canvas = createRenderCanvas(
  img.width || img.naturalWidth,
  img.height || img.naturalHeight
);
```

Add import:
```typescript
import { createRenderCanvas } from "./createRenderCanvas";
```

Note: `imageToBlob` is only called from main thread paths (it takes `HTMLImageElement`), but making it worker-safe costs nothing.

- [ ] **Step 5: Fix TextRenderer.ts**

At line 314, in `measureText()`, replace:
```typescript
const canvas = document.createElement("canvas");
```
With:
```typescript
const canvas = createRenderCanvas(0, 0);
```

Add import:
```typescript
import { createRenderCanvas } from "$lib/shared/render/services/implementations/createRenderCanvas";
```

- [ ] **Step 6: Propagate RenderCanvas type through SequenceRenderer**

In `SequenceRenderer.ts`, update `renderSequenceToCanvas` to return `Promise<RenderCanvas>`. Update `canvasToBlob` calls — the `ImageFormatConverter.canvasToBlob` method takes `HTMLCanvasElement`. For OffscreenCanvas, use `canvas.convertToBlob()` instead. Add a helper:

In `SequenceRenderer.ts`, replace the blob conversion in `renderSequenceToBlob`:
```typescript
const blob = canvas instanceof OffscreenCanvas
  ? await canvas.convertToBlob({
      type: this.formatService['getMimeType'](fullOptions.format.toLowerCase()),
      quality: fullOptions.quality,
    })
  : await this.formatService.canvasToBlob(canvas as HTMLCanvasElement, {
      format: fullOptions.format.toLowerCase() as "png" | "jpeg" | "webp",
      quality: fullOptions.quality,
    });
```

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: PASS. Fix any type errors from the `RenderCanvas` propagation. The key consumer chain is `ImageComposer → SequenceRenderer → ThumbnailRenderer`. Follow compiler errors.

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: PASS. No runtime behavior change — `createRenderCanvas` returns `OffscreenCanvas` on Chrome (it's available on main thread too, but `document.createElement` would also work), and `HTMLCanvasElement` on Firefox/Safari.

- [ ] **Step 9: Commit**

```
git add -p  # Stage only the 5 DOM fixes + type propagation
git commit -m "refactor(render): replace document.createElement('canvas') with createRenderCanvas for worker safety"
```

---

## Task 3: `scheduler.yield()` Fallback in Beat Loop

**Files:**
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts:357`

Replace `setTimeout(resolve, 0)` with `scheduler.yield()` + fallback.

- [ ] **Step 1: Add yield helper at module scope**

At the top of `ImageComposer.ts` (after imports), add:

```typescript
const yieldToEventLoop: () => Promise<void> =
  (globalThis as any).scheduler?.yield?.bind((globalThis as any).scheduler)
  ?? (() => new Promise<void>(r => setTimeout(r, 0)));
```

- [ ] **Step 2: Replace setTimeout in beat loop**

At line 357, replace:
```typescript
if (i > 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
```
With:
```typescript
if (i > 0) await yieldToEventLoop();
```

- [ ] **Step 3: Run typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS. Runtime behavior is identical on Chrome/Firefox (both support `scheduler.yield`), degrades to current `setTimeout(0)` on Safari.

- [ ] **Step 4: Commit**

```
git add src/lib/shared/render/services/implementations/ImageComposer.ts
git commit -m "perf(render): use scheduler.yield() between beats for better priority handling"
```

---

## Task 4: Glyph Bitmap Loader

**Files:**
- Create: `src/lib/shared/render/services/implementations/glyph-bitmap-loader.ts`
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts`

Pre-converts TextRenderer's `Image`-based glyph cache to `ImageBitmap[]` for worker transfer.

- [ ] **Step 1: Create the glyph bitmap loader**

```typescript
// src/lib/shared/render/services/implementations/glyph-bitmap-loader.ts
import type { GlyphImageData } from "@tka/render-composition";

export interface GlyphBitmapEntry {
  letter: string;
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean;
}

export async function convertGlyphCacheToBitmaps(
  cache: Map<string, GlyphImageData>
): Promise<GlyphBitmapEntry[]> {
  const entries: GlyphBitmapEntry[] = [];

  await Promise.all(
    Array.from(cache.entries()).map(async ([letter, data]) => {
      try {
        const bitmap = await createImageBitmap(data.image as HTMLImageElement);
        entries.push({
          letter,
          bitmap,
          naturalWidth: data.naturalWidth,
          naturalHeight: data.naturalHeight,
          isDash: data.isDash,
        });
      } catch {
        // Non-fatal — glyph will be missing in worker renders
      }
    })
  );

  return entries;
}
```

- [ ] **Step 2: Add `setGlyphBitmaps` to TextRenderer**

In `TextRenderer.ts`, add a method that lets workers inject pre-transferred `ImageBitmap` glyphs:

```typescript
setGlyphBitmaps(entries: { letter: string; bitmap: ImageBitmap; naturalWidth: number; naturalHeight: number; isDash: boolean }[]): void {
  this.glyphImageCache.clear();
  for (const entry of entries) {
    this.glyphImageCache.set(entry.letter, {
      image: entry.bitmap,
      naturalWidth: entry.naturalWidth,
      naturalHeight: entry.naturalHeight,
      isDash: entry.isDash,
    });
  }
}
```

Also add a getter so the dispatcher can access the loaded cache:

```typescript
getGlyphCache(): Map<string, GlyphImageData> {
  return this.glyphImageCache;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add src/lib/shared/render/services/implementations/glyph-bitmap-loader.ts src/lib/shared/render/services/implementations/TextRenderer.ts
git commit -m "feat(render): add glyph bitmap loader for worker transfer"
```

---

## Task 5: Composition Worker Protocol Types

**Files:**
- Create a shared types section at the top of `CompositionDispatcher.ts` (Task 6) and `composition.worker.ts` (Task 7).

Since both files need these types, define them in the dispatcher file and import from the worker.

This is a design-only task — the types are written in Tasks 6 and 7. No separate commit needed.

---

## Task 6: CompositionDispatcher

**Files:**
- Create: `src/lib/shared/render/services/implementations/CompositionDispatcher.ts`
- Create: `src/lib/shared/render/getCompositionDispatcher.ts`

The core orchestration layer. Routes composition to worker pool or main-thread fallback.

- [ ] **Step 1: Create CompositionDispatcher**

```typescript
// src/lib/shared/render/services/implementations/CompositionDispatcher.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { CompositionProgressCallback, RenderCanvas } from "../contracts/types";
import type { ImageComposer } from "./ImageComposer";
import type { TextRenderer } from "./TextRenderer";
import type { GlyphBitmapEntry } from "./glyph-bitmap-loader";
import { convertGlyphCacheToBitmaps } from "./glyph-bitmap-loader";

// ---- Protocol types (shared with composition.worker.ts) ----

export interface GlyphTransferEntry {
  letter: string;
  naturalWidth: number;
  naturalHeight: number;
  isDash: boolean;
}

export type CompositionWorkerInMessage =
  | { type: "init"; glyphs: ImageBitmap[]; glyphMeta: GlyphTransferEntry[] }
  | {
      type: "compose";
      id: number;
      sequence: SequenceData;
      options: Partial<SequenceExportOptions>;
      qrBitmap: ImageBitmap | null;
      elementIconBitmap: ImageBitmap | null;
    }
  | { type: "cancel"; id: number };

export type CompositionWorkerOutMessage =
  | { type: "init-done" }
  | { type: "result"; id: number; bitmap: ImageBitmap }
  | { type: "progress"; id: number; current: number; total: number; stage: string }
  | { type: "error"; id: number; message: string };

// ---- Pool management ----

interface WorkerEntry {
  worker: Worker;
  ready: boolean;
  pendingCount: number;
}

interface PendingRequest {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  onProgress?: CompositionProgressCallback;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

const POOL_SIZE = Math.max(1, Math.min((navigator?.hardwareConcurrency || 4) - 1, 4));
const INIT_TIMEOUT_MS = 15_000;

export class CompositionDispatcher {
  private workers: WorkerEntry[] = [];
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();

  private static workerSupport: boolean | null = null;

  constructor(
    private readonly imageComposer: ImageComposer,
    private readonly textRenderer: TextRenderer,
  ) {}

  static canUseWorker(): boolean {
    if (CompositionDispatcher.workerSupport !== null) {
      return CompositionDispatcher.workerSupport;
    }
    CompositionDispatcher.workerSupport = CompositionDispatcher.detectWorkerSupport();
    return CompositionDispatcher.workerSupport;
  }

  private static detectWorkerSupport(): boolean {
    if (typeof Worker === "undefined") return false;
    if (typeof OffscreenCanvas === "undefined") return false;
    try {
      const c = new OffscreenCanvas(1, 1);
      const ctx = c.getContext("2d");
      return ctx !== null;
    } catch {
      return false;
    }
  }

  async compose(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    if (CompositionDispatcher.canUseWorker()) {
      try {
        return await this.composeOnWorker(sequence, options, onProgress, signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        console.warn("[CompositionDispatcher] Worker failed, falling back to main thread:", error);
        return this.composeOnMainThread(sequence, options, onProgress, signal);
      }
    }
    return this.composeOnMainThread(sequence, options, onProgress, signal);
  }

  // ---- Worker path ----

  private async composeOnWorker(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    await this.ensureInitialized();

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const id = this.nextRequestId++;
    const worker = this.pickWorker();
    worker.pendingCount++;

    // Pre-render QR on main thread if needed (QRCodeGenerator is DOM-dependent)
    const qrBitmap: ImageBitmap | null = null; // TODO Task 8: pre-render QR
    const elementIconBitmap: ImageBitmap | null = null; // TODO Task 8: pre-render element icon

    return new Promise<Blob>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject, onProgress, signal };

      if (signal) {
        pending.abortHandler = () => {
          worker.worker.postMessage({ type: "cancel", id } satisfies CompositionWorkerInMessage);
        };
        signal.addEventListener("abort", pending.abortHandler, { once: true });
      }

      this.pendingRequests.set(id, pending);

      const transferList: Transferable[] = [];
      if (qrBitmap) transferList.push(qrBitmap);
      if (elementIconBitmap) transferList.push(elementIconBitmap);

      const message: CompositionWorkerInMessage = {
        type: "compose",
        id,
        sequence,
        options,
        qrBitmap,
        elementIconBitmap,
      };

      worker.worker.postMessage(message, transferList);
    });
  }

  private handleWorkerMessage(data: CompositionWorkerOutMessage): void {
    if (data.type === "init-done") return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    if (data.type === "progress") {
      pending.onProgress?.({
        current: data.current,
        total: data.total,
        stage: data.stage as "preparing" | "rendering" | "finalizing",
      });
      return;
    }

    // Terminal messages — clean up
    this.pendingRequests.delete(data.id);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener("abort", pending.abortHandler);
    }

    // Decrement pending count on the worker that handled this
    for (const w of this.workers) {
      if (w.pendingCount > 0) {
        w.pendingCount--;
        break;
      }
    }

    if (data.type === "result") {
      // Convert ImageBitmap → Blob, then close the bitmap
      const canvas = new OffscreenCanvas(data.bitmap.width, data.bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(data.bitmap, 0, 0);
      data.bitmap.close();

      canvas.convertToBlob({ type: "image/webp", quality: 0.9 }).then(
        (blob) => pending.resolve(blob),
        (err) => pending.reject(err instanceof Error ? err : new Error(String(err))),
      );
    } else if (data.type === "error") {
      if (data.message.includes("AbortError") || data.message.includes("cancelled")) {
        pending.reject(new DOMException(data.message, "AbortError"));
      } else {
        pending.reject(new Error(data.message));
      }
    }
  }

  // ---- Main-thread fallback path ----

  private async composeOnMainThread(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const canvas = options.cardMode
      ? await this.imageComposer.composeCardImage(sequence, options, onProgress, signal)
      : await this.imageComposer.composeSequenceImage(sequence, options, onProgress, signal);

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    }
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/webp",
        0.9,
      );
    });
  }

  // ---- Pool lifecycle ----

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initPool();
    await this.initializing;
  }

  private async initPool(): Promise<void> {
    // Pre-load glyphs on main thread
    await this.textRenderer.preloadGlyphImages();
    const glyphEntries = await convertGlyphCacheToBitmaps(
      this.textRenderer.getGlyphCache(),
    );

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      try {
        const worker = new Worker(
          new URL("../../workers/composition.worker.ts", import.meta.url),
          { type: "module" },
        );

        const entry: WorkerEntry = { worker, ready: false, pendingCount: 0 };

        worker.onmessage = (event: MessageEvent<CompositionWorkerOutMessage>) => {
          if (event.data.type === "init-done") {
            entry.ready = true;
          } else {
            this.handleWorkerMessage(event.data);
          }
        };

        worker.onerror = (err) => {
          console.error(`[CompositionDispatcher] Worker ${i} error:`, err);
        };

        this.workers.push(entry);

        const initPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`Worker ${i} init timeout`)), INIT_TIMEOUT_MS);
          const originalOnMessage = worker.onmessage;
          worker.onmessage = (event: MessageEvent<CompositionWorkerOutMessage>) => {
            if (event.data.type === "init-done") {
              clearTimeout(timeout);
              entry.ready = true;
              worker.onmessage = originalOnMessage;
              resolve();
            }
          };
        });

        initPromises.push(initPromise);

        // Clone glyph bitmaps for this worker (each transfer consumes the bitmap)
        const clonedBitmaps = await Promise.all(
          glyphEntries.map(async (e) => {
            const clone = await createImageBitmap(e.bitmap);
            return clone;
          }),
        );

        const glyphMeta: GlyphTransferEntry[] = glyphEntries.map((e) => ({
          letter: e.letter,
          naturalWidth: e.naturalWidth,
          naturalHeight: e.naturalHeight,
          isDash: e.isDash,
        }));

        const initMessage: CompositionWorkerInMessage = {
          type: "init",
          glyphs: clonedBitmaps,
          glyphMeta,
        };

        worker.postMessage(initMessage, clonedBitmaps);
      } catch (err) {
        console.error(`[CompositionDispatcher] Failed to create worker ${i}:`, err);
      }
    }

    await Promise.allSettled(initPromises);
    this.initialized = true;
    this.initializing = null;
  }

  private pickWorker(): WorkerEntry {
    let best = this.workers[0]!;
    for (const entry of this.workers) {
      if (entry.ready && entry.pendingCount < best.pendingCount) {
        best = entry;
      }
    }
    return best;
  }

  terminate(): void {
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
    this.initializing = null;

    // Reject all pending
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error("Dispatcher terminated"));
    }
    this.pendingRequests.clear();
  }
}
```

- [ ] **Step 2: Create factory getter**

```typescript
// src/lib/shared/render/getCompositionDispatcher.ts
import { browser } from "$app/environment";
import { CompositionDispatcher } from "./services/implementations/CompositionDispatcher";
import { getImageComposer } from "./getImageComposer";
import { textRenderer } from "./services/implementations/TextRenderer";

let instance: CompositionDispatcher | null = null;

export function getCompositionDispatcher(): CompositionDispatcher {
  if (!browser) throw new Error("getCompositionDispatcher() is browser-only");
  return (instance ??= new CompositionDispatcher(getImageComposer(), textRenderer));
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS or minor type errors to fix. The worker URL reference (`composition.worker.ts`) doesn't need to exist yet for typecheck — Vite resolves it at build time.

- [ ] **Step 4: Commit**

```
git add src/lib/shared/render/services/implementations/CompositionDispatcher.ts src/lib/shared/render/getCompositionDispatcher.ts
git commit -m "feat(render): add CompositionDispatcher with worker pool and main-thread fallback"
```

---

## Task 7: Composition Worker

**Files:**
- Create: `src/lib/shared/render/workers/composition.worker.ts`

The worker script. Imports the render pipeline, initializes assets, handles compose/cancel messages.

- [ ] **Step 1: Create the worker file**

```typescript
// src/lib/shared/render/workers/composition.worker.ts
import type {
  CompositionWorkerInMessage,
  CompositionWorkerOutMessage,
  GlyphTransferEntry,
} from "../services/implementations/CompositionDispatcher";
import { ImageComposer } from "../services/implementations/ImageComposer";
import { TextRenderer } from "../services/implementations/TextRenderer";
import { PictographBlobCache } from "../services/implementations/PictographBlobCache";
import { PictographKeyHasher } from "../services/implementations/PictographKeyHasher";
import { PictographMemoryCache } from "../services/implementations/PictographMemoryCache";
import { Canvas2DDirectRenderer } from "../services/implementations/Canvas2DDirectRenderer";
import { LayerCompositor } from "../services/implementations/LayerCompositor";

const activeRenders = new Map<number, { cancelled: boolean }>();
let imageComposer: ImageComposer | null = null;
let workerTextRenderer: TextRenderer | null = null;

function postResult(msg: CompositionWorkerOutMessage, transfer?: Transferable[]): void {
  (self as unknown as { postMessage: (msg: unknown, transfer?: Transferable[]) => void }).postMessage(
    msg,
    transfer ?? [],
  );
}

async function handleInit(glyphs: ImageBitmap[], glyphMeta: GlyphTransferEntry[]): Promise<void> {
  // Build TextRenderer with transferred glyph bitmaps
  workerTextRenderer = new TextRenderer();
  const entries = glyphMeta.map((meta, i) => ({
    letter: meta.letter,
    bitmap: glyphs[i]!,
    naturalWidth: meta.naturalWidth,
    naturalHeight: meta.naturalHeight,
    isDash: meta.isDash,
  }));
  workerTextRenderer.setGlyphBitmaps(entries);

  // Build render pipeline
  const blobCache = new PictographBlobCache();
  const keyHasher = new PictographKeyHasher();
  const memoryCache = new PictographMemoryCache();
  const canvas2DRenderer = new Canvas2DDirectRenderer();
  await canvas2DRenderer.initialize();
  const layerCompositor = new LayerCompositor(canvas2DRenderer);

  imageComposer = new ImageComposer(
    workerTextRenderer,
    blobCache,
    keyHasher,
    memoryCache,
    canvas2DRenderer,
    layerCompositor,
  );

  // Load fonts in worker context
  try {
    const font = new FontFace("Georgia", "local('Georgia')");
    await font.load();
    (self as unknown as WorkerGlobalScope).fonts?.add(font);
  } catch {
    // Font load failure is non-fatal; text renders in fallback
  }

  postResult({ type: "init-done" });
}

async function handleCompose(msg: Extract<CompositionWorkerInMessage, { type: "compose" }>): Promise<void> {
  const { id, sequence, options } = msg;
  const renderState = { cancelled: false };
  activeRenders.set(id, renderState);

  try {
    // Inject QR/element bitmaps into options if provided
    const effectiveOptions = { ...options };
    // QR and element icons are pre-rendered on main thread — inject as CanvasImageSource
    if (msg.qrBitmap) {
      // Will be used when we wire QR pre-rendering (Task 8)
    }
    if (msg.elementIconBitmap) {
      effectiveOptions.elementIcon = msg.elementIconBitmap;
    }

    const canvas = effectiveOptions.cardMode
      ? await imageComposer!.composeCardImage(
          sequence,
          effectiveOptions,
          (progress) => {
            if (renderState.cancelled) return;
            postResult({
              type: "progress",
              id,
              current: progress.current,
              total: progress.total,
              stage: progress.stage,
            });
          },
          // Create a pseudo-signal that checks cancelled flag
          { get aborted() { return renderState.cancelled; } } as AbortSignal,
        )
      : await imageComposer!.composeSequenceImage(
          sequence,
          effectiveOptions,
          (progress) => {
            if (renderState.cancelled) return;
            postResult({
              type: "progress",
              id,
              current: progress.current,
              total: progress.total,
              stage: progress.stage,
            });
          },
          { get aborted() { return renderState.cancelled; } } as AbortSignal,
        );

    if (renderState.cancelled) {
      postResult({ type: "error", id, message: "Render cancelled (AbortError)" });
      return;
    }

    // Convert canvas to ImageBitmap for zero-copy transfer
    let bitmap: ImageBitmap;
    if (canvas instanceof OffscreenCanvas) {
      bitmap = canvas.transferToImageBitmap();
    } else {
      bitmap = await createImageBitmap(canvas as HTMLCanvasElement);
    }

    postResult({ type: "result", id, bitmap }, [bitmap]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    postResult({ type: "error", id, message });
  } finally {
    activeRenders.delete(id);
  }
}

self.onmessage = (event: MessageEvent<CompositionWorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init":
      handleInit(msg.glyphs, msg.glyphMeta).catch((err) => {
        console.error("[composition.worker] Init failed:", err);
      });
      break;

    case "compose":
      handleCompose(msg).catch((err) => {
        console.error("[composition.worker] Compose failed:", err);
        postResult({
          type: "error",
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      });
      break;

    case "cancel": {
      const state = activeRenders.get(msg.id);
      if (state) state.cancelled = true;
      break;
    }
  }
};
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Some type errors likely around the constructor calls (services may have dependencies that are hard to instantiate in worker context). Fix by making constructors more flexible or by passing null where appropriate. The key constraint: the worker must be able to create its own `ImageComposer` instance.

Common issues to fix:
- `PictographBlobCache` constructor may need IndexedDB — check if it works in worker context (IndexedDB is available in workers). If it requires DOM, create a no-op implementation for worker use.
- `PictographMemoryCache` is likely a simple Map wrapper — should work.
- `Canvas2DDirectRenderer.initialize()` calls `getSvgAssetLoader().initialize()` which uses `fetch()` — works in workers.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS. Vite bundles the worker via `import.meta.url`.

- [ ] **Step 4: Commit**

```
git add src/lib/shared/render/workers/composition.worker.ts
git commit -m "feat(render): add composition worker for off-thread thumbnail rendering"
```

---

## Task 8: Wire CompositionDispatcher into ThumbnailRenderer

**Files:**
- Modify: `src/lib/shared/browse/services/ThumbnailRenderer.ts`
- Modify: `src/lib/shared/browse/getThumbnailRenderer.ts`

Replace `SequenceRenderer.renderSequenceToBlob()` with `CompositionDispatcher.compose()`.

- [ ] **Step 1: Update ThumbnailRenderer constructor**

In `ThumbnailRenderer.ts`, replace the `sequenceRenderer` dependency with `compositionDispatcher`:

```typescript
import type { CompositionDispatcher } from "$lib/shared/render/services/implementations/CompositionDispatcher";

export class ThumbnailRenderer {
  constructor(
    private compositionDispatcher: CompositionDispatcher,
    private startPositionDeriver: StartPositionDeriver,
    private browseLoader: PublicSequencesLoader | null,
    private loopDetector: ILOOPDetector,
  ) {}
```

Remove the `SequenceRenderer` import.

- [ ] **Step 2: Update the render method**

In `ThumbnailRenderer.render()`, replace the blob creation:

Old (around line 108-122):
```typescript
const blob = await this.sequenceRenderer.renderSequenceToBlob(
  sequenceWithStartPos,
  { ...renderOptions, ... },
  onProgress,
  signal
);
```

New:
```typescript
const blob = await this.compositionDispatcher.compose(
  sequenceWithStartPos,
  {
    ...renderOptions,
    birthday,
    loopType: resolvedLoopType ?? undefined,
    showLoopGlyph: (renderOptions.visibilityOverrides?.handPathMode || input.addDifficultyLevel === false) ? false : undefined,
    cardMode: input.cardMode ?? false,
  },
  onProgress,
  signal,
);
```

Remove the `SequenceRenderer` import entirely.

- [ ] **Step 3: Update the factory getter**

In `getThumbnailRenderer.ts`:

```typescript
import { browser } from "$app/environment";
import { ThumbnailRenderer } from "./services/ThumbnailRenderer";
import { getCompositionDispatcher } from "$lib/shared/render/getCompositionDispatcher";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
import { loopDetector } from "$lib/shared/create/services/LOOPDetector";

let instance: ThumbnailRenderer | null = null;

export function getThumbnailRenderer(): ThumbnailRenderer {
  if (!browser) throw new Error("getThumbnailRenderer() is browser-only");
  return (instance ??= new ThumbnailRenderer(
    getCompositionDispatcher(),
    startPositionDeriver,
    getBrowseLoader(),
    loopDetector,
  ));
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS. The `ThumbnailRenderer.render()` return type stays `Promise<Blob>` — no downstream changes needed.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add src/lib/shared/browse/services/ThumbnailRenderer.ts src/lib/shared/browse/getThumbnailRenderer.ts
git commit -m "feat(render): wire CompositionDispatcher into ThumbnailRenderer, replacing SequenceRenderer for thumbnails"
```

---

## Task 9: Dynamic Queue Concurrency

**Files:**
- Modify: `src/lib/shared/browse/services/ThumbnailRenderQueue.ts`
- Modify: `src/lib/shared/browse/getThumbnailRenderQueue.ts`

Adjust `maxConcurrent` based on whether workers are available.

- [ ] **Step 1: Update ThumbnailRenderQueue initialization**

In `getThumbnailRenderQueue.ts`:

```typescript
import { browser } from "$app/environment";
import { ThumbnailRenderQueue } from "./services/ThumbnailRenderQueue";
import { CompositionDispatcher } from "$lib/shared/render/services/implementations/CompositionDispatcher";

let instance: ThumbnailRenderQueue | null = null;

export function getThumbnailRenderQueue(): ThumbnailRenderQueue {
  if (!browser) throw new Error("getThumbnailRenderQueue() is browser-only");
  if (!instance) {
    instance = new ThumbnailRenderQueue();
    // Workers handle the heavy lifting — pipeline more tasks.
    // Without workers, limit to reduce main-thread pressure.
    const POOL_SIZE = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 4));
    const max = CompositionDispatcher.canUseWorker()
      ? Math.min(POOL_SIZE * 2, 8)
      : 3;
    instance.setMaxConcurrent(max);
  }
  return instance;
}
```

- [ ] **Step 2: Run typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/browse/getThumbnailRenderQueue.ts
git commit -m "perf(render): dynamic queue concurrency based on worker availability"
```

---

## Task 10: Worker Dependency Audit and Fixes

**Files:**
- Potentially modify multiple files based on what breaks

The composition worker imports the render pipeline, which may pull in Svelte-store-dependent code or DOM APIs transitively. This task audits and fixes those issues.

- [ ] **Step 1: Attempt a build and check worker bundling**

Run: `npm run build`

Look for errors in the worker bundle. Common issues:
1. `$app/environment` imported transitively — workers can't use SvelteKit's `$app` modules
2. Svelte store reads in `getVisibilitySettings()` — already bypassed when full `visibilityOverrides` provided
3. `getSettings()` call in `ImageComposer` line 118 — only reached when `visibilityOverrides` is incomplete. For worker path, the dispatcher always provides full overrides, so this code path is unreachable. But the import may still fail.

- [ ] **Step 2: Fix transitive import issues**

For each issue found:
- If it's a module-level `import` that fails in workers but is only used in code paths not reached by workers → guard with `typeof document !== "undefined"` or use dynamic `import()`.
- If it's a constructor dependency → check if a no-op version works for the worker use case.

The most likely fix needed: `ImageComposer` imports `getVisibilityStateManager` and `getAnimationVisibilityManager` at the module level. These come from `.svelte.ts` files which may not bundle correctly for workers. Solution: make these dynamic imports inside `getVisibilitySettings()` method only (the method is never called in the worker path since full overrides are always provided, but the module-level import is the problem).

Replace:
```typescript
import { getVisibilityStateManager } from "../../../pictograph/shared/state/visibility-state.svelte";
import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
```

With lazy imports inside `getVisibilitySettings()`:
```typescript
private async getVisibilitySettings(
  overrides?: SequenceExportOptions["visibilityOverrides"]
): Promise<PictographVisibilityOptions> {
  if (/* full overrides provided */) {
    // No store reads needed — worker-safe path
    return { ... };
  }

  // Lazy import — only reached on main thread
  const { getVisibilityStateManager } = await import("../../../pictograph/shared/state/visibility-state.svelte");
  const { getAnimationVisibilityManager } = await import("../../../animation-engine/state/animation-visibility-state.svelte");
  const { getSettings } = await import("$lib/shared/application/state/app-state.svelte");
  // ... rest of method
}
```

Similarly for `pictographPreparer` and `cellCacheKeyDeriver` imports — make them dynamic if they pull in DOM/Svelte dependencies.

- [ ] **Step 3: Build again**

Run: `npm run build`
Expected: PASS. Worker bundle resolves all imports.

- [ ] **Step 4: Commit**

```
git commit -m "fix(render): lazy-import Svelte stores in ImageComposer for worker compatibility"
```

---

## Task 11: End-to-End Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Clean.

- [ ] **Step 3: Test in browser — worker path (Chrome)**

1. Start dev server: `vite --port 5174`
2. Open Chrome, navigate to a deck with many sequences
3. Open DevTools → Sources → check that `composition.worker.ts` appears in the worker threads panel
4. Navigate to deck tab → thumbnails should render
5. Navigate away while rendering → no jank, renders stop

Verify in console:
- No errors from `[CompositionDispatcher]`
- Workers initialize (`init-done` messages)
- Thumbnails display correctly

- [ ] **Step 4: Test fallback path (Firefox)**

1. Open Firefox, navigate to same deck
2. Thumbnails should still render (main-thread fallback)
3. No `OffscreenCanvas` errors in console
4. Navigation should be smoother than before due to `scheduler.yield()`

- [ ] **Step 5: Report results**

If any issues found, fix them before committing. This task doesn't produce a commit — it's verification.

---

## Summary

| Task | Description | New Files | Modified Files |
|------|------------|-----------|---------------|
| 1 | createRenderCanvas helper | 1 | 0 |
| 2 | 5 surgical DOM fixes + type propagation | 0 | 6 |
| 3 | scheduler.yield() in beat loop | 0 | 1 |
| 4 | Glyph bitmap loader + TextRenderer | 1 | 1 |
| 5 | Protocol types (design only) | 0 | 0 |
| 6 | CompositionDispatcher + factory | 2 | 0 |
| 7 | Composition worker | 1 | 0 |
| 8 | Wire into ThumbnailRenderer | 0 | 2 |
| 9 | Dynamic queue concurrency | 0 | 1 |
| 10 | Worker dependency audit | 0 | ~2-3 |
| 11 | E2E smoke test | 0 | 0 |

**Total: 5 new files, ~11 modified files, 11 tasks**

---

## Known Limitations (deferred to follow-up)

### QR Code in Workers

The spec calls for pre-rendering QR codes on the main thread and transferring as `ImageBitmap`. This plan defers that: the worker's `ImageComposer` has no `qrCodeGenerator` set, so `renderQRCode` in `composeSequenceImage` silently skips when `showQRCode` is true. This only affects the QR-in-empty-cell feature (which is off by default in thumbnails).

**To complete later:** In `CompositionDispatcher.composeOnWorker()`, pre-render QR via `QRCodeGenerator.generateAsImage()` on main thread, convert to `ImageBitmap`, transfer with the compose message. Worker's `ImageComposer` draws the transferred bitmap at the QR cell position. Same pattern for `elementIcon`.

### SequenceRenderer for Exports

`SequenceRenderer` is still used by the export pipeline (`renderSequenceToBlob` / `renderSequenceToCanvas`) for one-off exports. Those callers expect an `HTMLCanvasElement` back (for DataURL generation, canvas reference). After this plan ships and proves stable, those callers can migrate to `CompositionDispatcher` too.
