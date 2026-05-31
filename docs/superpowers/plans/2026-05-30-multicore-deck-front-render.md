# Multicore Deck Front Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the deck card-front render through the existing `CompositionDispatcher` OffscreenCanvas worker pool so an 88-card cold draw spreads across CPU cores instead of blocking one main thread for ~15 s.

**Architecture:** Reuse the shipped pool (`composition.worker` + `CompositionDispatcher` + `card-asset-bundle`), unchanged except: cap the pool at `min(cores−1, 8)`, parallelize the per-worker asset seed, and let the worker composite a main-supplied QR `ImageBitmap`. `PrintCardRenderer.renderFront` calls `composeFrontBitmap` (worker) with a per-card main-thread fallback; `PrintPreviewPages.renderAll` probes once, builds+sets the AssetBundle once, and renders the QR bitmap on main. Backs and browse thumbnails are out of scope. Zero pixel change.

**Tech Stack:** TypeScript, Svelte 5, Vite module workers, OffscreenCanvas, transferable `ImageBitmap`, Vitest.

**Spec:** `docs/superpowers/specs/active/2026-05-30-multicore-deck-front-render-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/shared/render/services/composition-dispatcher.ts` | Pool manager | Cap pool size (extract `computePoolSize`); parallelize seed; `composeFrontBitmap` accepts + forwards `qrBitmap` |
| `src/lib/shared/render/workers/composition.worker.ts` | Worker render | Attach supplied `qrBitmap` to compose options |
| `src/lib/shared/render/services/image-composer.ts` | Compose + chrome | `renderQRCode` draws a pre-rendered QR when supplied (worker has no QR generator) |
| `src/lib/shared/render/domain/models/sequence-export-options.ts` | Options type | Add `qrImageBitmap?: CanvasImageSource` (render-only, never serialized) |
| `src/lib/features/choreo-card/services/PrintCardRenderer.ts` | Card-front orchestration | Worker path in `renderFront` + `renderQrBitmap` helper, gated on `useWorkerPool` |
| `src/lib/features/choreo-card/services/types.ts` | `PrintRenderOptions` | Add `useWorkerPool?: boolean` |
| `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` | Deck render driver | Probe + build/set bundle once per draw; set `useWorkerPool`; render QR is delegated to renderFront |

---

## Task 1: Cap the worker pool size

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts:67`
- Test: `src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts
import { describe, it, expect } from "vitest";
import { computePoolSize } from "../composition-dispatcher";

describe("computePoolSize", () => {
  it("reserves one core", () => {
    expect(computePoolSize(8)).toBe(7);
  });
  it("caps at 8 on many-core machines", () => {
    expect(computePoolSize(32)).toBe(8);
  });
  it("floors at 2 on tiny machines", () => {
    expect(computePoolSize(1)).toBe(2);
    expect(computePoolSize(2)).toBe(2);
  });
  it("handles undefined hardwareConcurrency", () => {
    expect(computePoolSize(undefined)).toBe(3); // (4 || default) - 1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts`
Expected: FAIL — `computePoolSize` is not exported.

- [ ] **Step 3: Add the helper and use it**

Replace `composition-dispatcher.ts:67`:

```ts
// One in-flight 1644x2244 RGBA card canvas per worker ≈ 14.7 MB. Reserve a core
// for the main thread and cap at 8 — past ~8 the seed/memory cost outweighs the
// throughput gain (a 32-core box would otherwise spawn 31 workers ≈ 455 MB).
export function computePoolSize(hardwareConcurrency: number | undefined): number {
  const cores = hardwareConcurrency || 4;
  return Math.max(2, Math.min(cores - 1, 8));
}

const POOL_SIZE = computePoolSize(
  typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts
git commit -m "perf(render): cap composition worker pool at min(cores-1, 8)" -- src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/services/__tests__/composition-dispatcher-pool.test.ts
```

---

## Task 2: Parallelize the per-worker seed

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts:364-477` (`initPool`)

No new unit test (timing/structural change verified by the runtime gate in Task 7); correctness is preserved because the per-worker clone payloads are unchanged — only their scheduling moves from serial to parallel.

- [ ] **Step 1: Replace the serial spawn loop with a parallel one**

In `initPool`, the current `for` loop `await`s each worker's `createImageBitmap` clones inline (serial across workers). Restructure so every worker's clone+seed runs concurrently. Replace the body from `const initPromises: Promise<void>[] = [];` through `await Promise.allSettled(initPromises);` with:

```ts
    // Build a fresh per-worker clone of the glyph + bundle bitmaps. `transfer`
    // detaches the source, so each worker needs its own clone; running the N
    // clone-sets concurrently (instead of awaiting each inside the spawn loop)
    // is what turns the ~3.7s serial seed into a sub-second parallel one.
    const glyphMeta: GlyphTransferEntry[] = glyphEntries.map((e) => ({
      letter: e.letter,
      naturalWidth: e.naturalWidth,
      naturalHeight: e.naturalHeight,
      isDash: e.isDash,
    }));

    const spawnWorker = async (i: number): Promise<void> => {
      try {
        const worker = new Worker(
          new URL("../workers/composition.worker.ts", import.meta.url),
          { type: "module" },
        );
        const entry: WorkerEntry = { worker, ready: false, pendingCount: 0 };
        worker.onerror = (err) => {
          console.error(`[CompositionDispatcher] Worker ${i} error:`, err);
        };
        this.workers.push(entry);

        const ready = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Worker ${i} init timeout`)),
            INIT_TIMEOUT_MS,
          );
          worker.onmessage = (event: MessageEvent<CompositionWorkerOutMessage>) => {
            if (event.data.type === "init-done") {
              clearTimeout(timeout);
              entry.ready = true;
              worker.onmessage = (ev: MessageEvent<CompositionWorkerOutMessage>) =>
                this.handleWorkerMessage(ev.data);
              resolve();
            }
          };
        });

        const clonedGlyphs = await Promise.all(
          glyphEntries.map((e) => createImageBitmap(e.bitmap)),
        );

        const bundle = this.pendingBundle;
        let bundleClone: import("./card-asset-bundle").AssetBundle = {
          keys: [],
          bitmaps: [],
          grids: { diamond: null, box: null, diamondNonRadial: null, boxNonRadial: null },
        };
        if (bundle) {
          const clonedBmps = await Promise.all(
            bundle.bitmaps.map((b) => createImageBitmap(b)),
          );
          type GridSlot = import("./card-asset-bundle").AssetBundle["grids"]["diamond"];
          const cloneGrid = async (g: GridSlot): Promise<ImageBitmap | null> =>
            g ? await createImageBitmap(g as ImageBitmapSource) : null;
          bundleClone = {
            keys: [...bundle.keys],
            bitmaps: clonedBmps,
            grids: {
              diamond: await cloneGrid(bundle.grids.diamond),
              box: await cloneGrid(bundle.grids.box),
              diamondNonRadial: await cloneGrid(bundle.grids.diamondNonRadial),
              boxNonRadial: await cloneGrid(bundle.grids.boxNonRadial),
            },
          };
        }

        const initMessage: CompositionWorkerInMessage = {
          type: "init",
          glyphs: clonedGlyphs,
          glyphMeta,
          bundle: bundleClone,
        };
        worker.postMessage(initMessage, [
          ...clonedGlyphs,
          ...bundleTransferables(bundleClone),
        ]);

        await ready;
      } catch (err) {
        console.error(`[CompositionDispatcher] Failed to create worker ${i}:`, err);
      }
    };

    await Promise.all(Array.from({ length: POOL_SIZE }, (_, i) => spawnWorker(i)));
```

Keep the lines after the loop unchanged:

```ts
    // Close the source glyph bitmaps — workers have their own clones
    for (const entry of glyphEntries) {
      entry.bitmap.close();
    }
    this.initialized = true;
    this.initializing = null;
```

- [ ] **Step 2: Type-check**

Run: `npm run check:fast`
Expected: no new errors in `composition-dispatcher.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts
git commit -m "perf(render): parallelize per-worker asset seed (serial->concurrent)" -- src/lib/shared/render/services/composition-dispatcher.ts
```

---

## Task 3: Add the render-only `qrImageBitmap` option

**Files:**
- Modify: `src/lib/shared/render/domain/models/sequence-export-options.ts`

- [ ] **Step 1: Add the field**

Find the `SequenceExportOptions` interface and add (near `visibilityOverrides`):

```ts
  /**
   * A pre-rendered QR code image, drawn into the QR cell instead of generating
   * one. Render-only and NEVER serialized — the worker attaches it to its local
   * options copy after structured-clone, because the worker's ImageComposer has
   * no QR generator (and no Firebase). On the main thread this stays undefined
   * and renderQRCode generates as usual.
   */
  qrImageBitmap?: CanvasImageSource;
```

- [ ] **Step 2: Type-check**

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/domain/models/sequence-export-options.ts
git commit -m "feat(render): add render-only qrImageBitmap option" -- src/lib/shared/render/domain/models/sequence-export-options.ts
```

---

## Task 4: `renderQRCode` draws a pre-rendered QR when supplied

**Files:**
- Modify: `src/lib/shared/render/services/image-composer.ts` — `buildChromeDeps` `renderQRCode` closure (~line 458) and the private `renderQRCode` method (~line 706)
- Test: `src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts
import { describe, it, expect, vi } from "vitest";
import { ImageComposer } from "../image-composer";

// A pre-rendered QR must be drawn without invoking the QR generator. We assert
// the generator is never called when a bitmap is supplied, and IS the source of
// the draw. Uses a minimal stub canvas context to capture drawImage calls.
function stubCtx() {
  const calls: unknown[][] = [];
  return {
    calls,
    ctx: {
      fillStyle: "",
      fillRect: () => {},
      drawImage: (...args: unknown[]) => calls.push(args),
    } as unknown as CanvasRenderingContext2D,
  };
}

describe("renderQRCode pre-rendered path", () => {
  it("draws the supplied image and never calls the generator", async () => {
    const generateAsImage = vi.fn();
    const composer = new ImageComposer(
      { } as never, { } as never, { } as never, { } as never, { } as never, { } as never,
      { generateAsImage } as never, // qrCodeGenerator
    );
    const fakeQr = { width: 10, height: 10 } as unknown as CanvasImageSource;
    const { ctx, calls } = stubCtx();
    // @ts-expect-error private method invoked for unit coverage
    await composer.renderQRCode(ctx, { steps: [] } as never, { col: 0, row: 0 }, 300, 0, false,
      undefined, undefined, 0, undefined, undefined, fakeQr);
    expect(generateAsImage).not.toHaveBeenCalled();
    expect(calls.some((c) => c[0] === fakeQr)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts`
Expected: FAIL — `renderQRCode` does not accept a 12th `preRenderedQR` argument.

- [ ] **Step 3: Add the `preRenderedQR` parameter to `renderQRCode`**

Change the private method signature (~line 706) to add a trailing parameter:

```ts
  private async renderQRCode(
    ctx: CanvasRenderingContext2D,
    sequence: SequenceData,
    cell: { col: number; row: number },
    stepSize: number,
    headerHeight: number,
    isDarkMode: boolean,
    bluePropType?: PropType,
    redPropType?: PropType,
    horizontalOffset: number = 0,
    deckId?: string,
    deckName?: string,
    preRenderedQR?: CanvasImageSource,
  ): Promise<void> {
    // Proceed if we have either a generator OR a pre-rendered image.
    if (!this.qrCodeGenerator && !preRenderedQR) {
      return;
    }

    try {
      const stepCount = sequence.steps?.length ?? 0;
      const qrSize = Math.floor(stepSize * getQRCellScale(stepCount));
      const padding = (stepSize - qrSize) / 2;

      const qrImage: CanvasImageSource = preRenderedQR
        ? preRenderedQR
        : await this.qrCodeGenerator!.generateAsImage(sequence, qrSize, {
            style: "modern",
            margin: 1,
            darkMode: isDarkMode,
            bluePropType,
            redPropType,
            deckId,
            deckName,
          });

      const x = cell.col * stepSize + horizontalOffset + padding;
      const y = cell.row * stepSize + headerHeight + padding;

      ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
      ctx.fillRect(
        cell.col * stepSize + horizontalOffset,
        cell.row * stepSize + headerHeight,
        stepSize,
        stepSize,
      );

      // Pre-rendered QR is authored at a fixed resolution; drawImage scales it
      // to the cell. Generated QR is already qrSize.
      ctx.drawImage(qrImage, x, y, qrSize, qrSize);
    } catch (error) {
      console.error("[ImageComposer] Failed to render QR code:", error);
    }
  }
```

- [ ] **Step 4: Forward the option through the chrome closure**

In `buildChromeDeps`, the `renderQRCode` closure (~line 458) passes its args to `this.renderQRCode(...)`. Add the option as the final argument:

```ts
      renderQRCode: async (c) => {
        const emptyCell = findEmptyCellForQR(columns, rows, sequence, options);
        if (emptyCell) {
          await this.renderQRCode(
            c,
            sequence,
            emptyCell,
            stepSize,
            gridOffsetY,
            isDarkMode,
            effectiveBluePropType,
            effectiveRedPropType,
            gridOffsetX,
            options.deckId,
            options.deckName,
            options.qrImageBitmap,
          );
        }
      },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/render/services/image-composer.ts src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts
git commit -m "feat(render): renderQRCode draws a pre-rendered QR when supplied" -- src/lib/shared/render/services/image-composer.ts src/lib/shared/render/services/__tests__/render-qr-prerendered.test.ts
```

---

## Task 5: `composeFrontBitmap` accepts + forwards a QR bitmap; worker attaches it

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts` — `composeFrontBitmap` (~line 235)
- Modify: `src/lib/shared/render/workers/composition.worker.ts` — `handleCompose` (~line 165)
- Test: `src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts
import { describe, it, expect, vi } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

// composeFrontBitmap must put the QR bitmap in the postMessage transfer list so
// it is moved (not cloned) into the worker.
describe("composeFrontBitmap qr transfer", () => {
  it("transfers the qrBitmap to the worker", async () => {
    const posted: { msg: any; transfer: Transferable[] }[] = [];
    const fakeWorker = {
      worker: { postMessage: (msg: any, transfer: Transferable[]) => posted.push({ msg, transfer }) },
      ready: true,
      pendingCount: 0,
    };
    const d = new CompositionDispatcher({} as never, {} as never);
    // bypass init + worker pick
    (d as any).initialized = true;
    (d as any).ensureInitialized = async () => {};
    (d as any).pickWorker = () => fakeWorker;

    const qr = { width: 8, height: 8 } as unknown as ImageBitmap;
    void d.composeFrontBitmap({ steps: [] } as never, {} as never, qr);
    await Promise.resolve();

    expect(posted).toHaveLength(1);
    expect(posted[0]!.msg.qrBitmap).toBe(qr);
    expect(posted[0]!.transfer).toContain(qr);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts`
Expected: FAIL — `composeFrontBitmap` ignores a 3rd arg / `qrBitmap` is null in the message.

- [ ] **Step 3: Update `composeFrontBitmap` to accept + forward the bitmap**

Change the signature and the message build (~line 235-279):

```ts
  async composeFrontBitmap(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    qrBitmap: ImageBitmap | null = null,
    signal?: AbortSignal,
  ): Promise<ImageBitmap> {
    await this.ensureInitialized();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const id = this.nextRequestId++;
    const worker = this.pickWorker();
    worker.pendingCount++;

    return new Promise<ImageBitmap>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve: () => {},
        reject,
        signal,
        workerEntry: worker,
        resolveBitmap: resolve,
      };
      if (signal) {
        pending.abortHandler = () => {
          worker.worker.postMessage({ type: "cancel", id } satisfies CompositionWorkerInMessage);
        };
        signal.addEventListener("abort", pending.abortHandler, { once: true });
      }
      this.pendingRequests.set(id, pending);

      const plainSequence = JSON.parse(JSON.stringify(sequence));
      const plainOptions = JSON.parse(JSON.stringify(options));

      const message: CompositionWorkerInMessage = {
        type: "compose",
        id,
        sequence: plainSequence,
        options: plainOptions,
        qrBitmap,
      };
      worker.worker.postMessage(message, qrBitmap ? [qrBitmap] : []);
    });
  }
```

- [ ] **Step 4: Worker attaches the bitmap to its local options copy**

In `composition.worker.ts` `handleCompose` (~line 168), after `const { id, sequence, options } = msg;` and `const effectiveOptions = { ...options };`, inject the transferred bitmap:

```ts
    const effectiveOptions = { ...options };
    // The QR bitmap is rendered on the main thread (the worker has no Firebase /
    // QR generator) and transferred in. Attach it so composeSequenceImage's
    // renderQRCode draws it instead of generating. Not part of the serialized
    // options — it arrived via the transfer list.
    if (msg.qrBitmap) {
      (effectiveOptions as { qrImageBitmap?: CanvasImageSource }).qrImageBitmap = msg.qrBitmap;
    }
```

(The `compose` message type in `composition-dispatcher.ts` already declares `qrBitmap: ImageBitmap | null` — no protocol change needed.)

- [ ] **Step 5: Run test + type-check**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts`
Expected: PASS.
Run: `npm run check:fast`
Expected: no new errors in the two files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts
git commit -m "feat(render): thread main-rendered QR bitmap into the worker compose" -- src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts src/lib/shared/render/services/__tests__/compose-front-bitmap-qr.test.ts
```

---

## Task 6: `PrintCardRenderer.renderFront` worker path + QR bitmap helper

**Files:**
- Modify: `src/lib/features/choreo-card/services/types.ts` — `PrintRenderOptions`
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts`

- [ ] **Step 1: Add `useWorkerPool` to `PrintRenderOptions`**

In `types.ts`, add to the `PrintRenderOptions` interface:

```ts
  /**
   * Render the front via the OffscreenCanvas worker pool. Set true by the deck
   * preview driver ONLY after it has probed worker support and seeded the pool's
   * AssetBundle. Other callers (single-card rerender) leave it falsy and use the
   * main-thread path, so an un-seeded worker never produces a blank card.
   */
  useWorkerPool?: boolean;
```

- [ ] **Step 2: Add worker-path imports + QR helper to `PrintCardRenderer.ts`**

Add imports at the top:

```ts
import { getCompositionDispatcher } from "$lib/shared/render/get-composition-dispatcher";
import { CompositionDispatcher } from "$lib/shared/render/services/composition-dispatcher";
```

Add a private helper (renders the QR on the main thread as an `ImageBitmap`, or null):

```ts
  // Fixed authoring resolution for the worker-bound QR. The worker scales it to
  // the QR cell via drawImage, so this just needs to be crisp at cell size.
  private static readonly QR_BITMAP_SIZE = 512;

  private async renderQrBitmap(
    sequence: SequenceData,
    composeOptions: Partial<SequenceExportOptions>,
  ): Promise<ImageBitmap | null> {
    const gen = this.imageComposer.qrGenerator;
    if (!gen) return null;
    try {
      const dark = composeOptions.visibilityOverrides?.darkMode ?? false;
      const img = await gen.generateAsImage(sequence, PrintCardRenderer.QR_BITMAP_SIZE, {
        style: "modern",
        margin: 1,
        darkMode: dark,
        bluePropType: composeOptions.bluePropTypeOverride,
        redPropType: composeOptions.redPropTypeOverride,
        deckId: composeOptions.deckId,
        deckName: composeOptions.deckName,
      });
      return await createImageBitmap(img as ImageBitmapSource);
    } catch (err) {
      console.warn("[PrintCardRenderer] QR bitmap render failed:", err);
      return null;
    }
  }
```

- [ ] **Step 3: Route the inner compose through the worker when enabled**

Replace the single line `const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);` (currently line 106) with:

```ts
    const sequenceCanvas = await this.composeFront(sequence, composeOptions, options);
```

Add the method:

```ts
  private async composeFront(
    sequence: SequenceData,
    composeOptions: Partial<SequenceExportOptions>,
    options: PrintRenderOptions,
  ): Promise<RenderCanvas> {
    if (options.useWorkerPool && CompositionDispatcher.canUseWorker()) {
      try {
        const qrBitmap = await this.renderQrBitmap(sequence, composeOptions);
        const inner = await getCompositionDispatcher().composeFrontBitmap(
          sequence,
          composeOptions,
          qrBitmap,
        );
        const canvas = document.createElement("canvas");
        canvas.width = inner.width;
        canvas.height = inner.height;
        canvas.getContext("2d")!.drawImage(inner, 0, 0);
        inner.close();
        return canvas;
      } catch (err) {
        console.warn("[PrintCardRenderer] worker front render failed, main-thread fallback:", err);
      }
    }
    return this.imageComposer.composeSequenceImage(sequence, composeOptions);
  }
```

Add the `RenderCanvas` import:

```ts
import type { RenderCanvas } from "$lib/shared/render/services/types";
```

(`wrapContentInCardFrame` accepts the returned canvas unchanged — `RenderCanvas` is `HTMLCanvasElement | OffscreenCanvas`, and the worker path returns an `HTMLCanvasElement`.)

- [ ] **Step 4: Type-check**

Run: `npm run check:fast`
Expected: no new errors in `PrintCardRenderer.ts` / `types.ts`. If `wrapContentInCardFrame`'s parameter type is narrower than `RenderCanvas`, widen its first param to `RenderCanvas` in `card-front-frame.ts` (it already draws via `drawImage`, which accepts both).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/services/types.ts
git commit -m "feat(choreo-card): renderFront worker path with main-thread fallback" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/services/types.ts
```

---

## Task 7: Wire the deck driver — probe + seed bundle once, enable the pool

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` — `renderAll` (~line 285) and `buildRenderOptions` (~line 177)

- [ ] **Step 1: Add imports**

After the existing imports (near line 19):

```ts
  import { getCompositionDispatcher } from "$lib/shared/render/get-composition-dispatcher";
  import { CompositionDispatcher } from "$lib/shared/render/services/composition-dispatcher";
  import { getCardAssetBundle } from "$lib/shared/render/services/get-card-asset-bundle";
```

- [ ] **Step 2: Probe + seed the pool once per draw, before the render lanes**

In `renderAll`, immediately after `const renderer = getPrintCardRenderer();` and BEFORE the existing `await getShortCodeManager().resolveCodesForDeck(...)` call, add:

```ts
    // Engage the worker pool for this draw: probe support once, then build +
    // seed the AssetBundle so worker renders have their SVGs. Best-effort — on
    // failure (or unsupported browser) useWorkerPool stays false and every card
    // renders on the main thread exactly as before.
    let workerPoolReady = false;
    try {
      if (await CompositionDispatcher.probeWorkerSupport()) {
        const bundle = await getCardAssetBundle(seqs, {
          bluePropType: resolvedBlueProp,
          redPropType: resolvedRedProp,
          theme: resolvedBackground,
        });
        if (generation !== renderGeneration) return;
        getCompositionDispatcher().setAssetBundle(bundle);
        workerPoolReady = true;
      }
    } catch (err) {
      console.warn("[PrintPreview] worker pool unavailable, main-thread render:", err);
    }
```

- [ ] **Step 3: Thread `useWorkerPool` into the per-card options**

`buildRenderOptions` builds `PrintRenderOptions`. It must know whether the pool is ready. Add a parameter and field. Change the signature (~line 177):

```ts
  function buildRenderOptions(stepCount?: number, footer?: CardFooter, cardIndex?: number, useWorkerPool = false): PrintRenderOptions {
```

and add to the returned object (alongside `deckId`, `deckName`):

```ts
      useWorkerPool,
```

Then at the single call site inside `renderOne` (~line 368) pass the flag:

```ts
          const options = buildRenderOptions(stepCount, footer, i, workerPoolReady);
```

(`workerPoolReady` is in `renderAll`'s closure scope, which `renderOne` already captures.)

- [ ] **Step 4: Type-check**

Run: `npm run check:fast`
Expected: no new errors in `PrintPreviewPages.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): deck draw probes + seeds the worker pool, enables it per card" -- src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

---

## Task 8: Full check + runtime gate (the proof)

**Files:** none (verification only).

- [ ] **Step 1: Full type check (capture once)**

Run: `npm run check > /tmp/check-multicore.log 2>&1; echo "EXIT=$?"`
Then filter: `grep -iE "composition-dispatcher|composition.worker|image-composer|PrintCardRenderer|PrintPreviewPages|sequence-export-options" /tmp/check-multicore.log`
Expected: zero errors attributable to the changed files. (Pre-existing unrelated errors — ILOOPExecutor, IAsciiRenderer, IEndpointDetector, ISubInterpreter, DeckReleaserTab, Viewer3DScene — may remain; they are not part of this work.)

- [ ] **Step 2: Run the full QR + render test suites**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/render/services/__tests__/ src/lib/shared/qr/services/__tests__/`
Expected: all PASS, including the three new tests (pool-size, qr-prerendered, compose-front-bitmap-qr).

- [ ] **Step 3: Runtime gate — re-measure the 88-card cold draw**

This repeats the diagnostic from the spec. With the user's verbal go-ahead to drive Chrome:
1. Launch Chrome with `--remote-debugging-port=9222` if not running.
2. Navigate to `http://localhost:5173/choreo_card/releaser`.
3. Clear ONLY the render/QR caches (by exact name — do NOT blanket-delete):
   `deck-card-cache`, `pictograph-blob-cache`, `short-code-cache`, `qr-image-cache`. Reload.
4. Reduce the catalog to ~88 cards, arm the jank/thread harness, start a performance trace.
5. Click "Draw N Cards".
6. Stop trace; parse per-thread busy time.

Expected (PASS criteria):
- `DedicatedWorker` threads present and busy (was 0).
- `CrRendererMain` blocked time collapses from ~15 s to a small fraction.
- Wall clock drops from ~21 s toward a few seconds.
- Firestore requests stay ~11 (QR cache intact).
- Visual: cards (with QR) look identical to the main-thread render.

Record before/after numbers in the commit message or a short note.

- [ ] **Step 4: Commit any final fixes** (only if Step 1–3 surfaced issues; otherwise nothing to commit).

---

## Self-Review notes

- **Spec coverage:** pool cap (T1), parallel seed (T2), wire seam (T6/T7), AssetBundle once (T7), QR-on-main+transfer (T3/T4/T5), probe+fallback (T6/T7), runtime gate (T8). All spec sections mapped.
- **Type consistency:** `qrImageBitmap` (option) ↔ `preRenderedQR` (renderQRCode param) ↔ `msg.qrBitmap` (worker→option) are the three hops of one value; `useWorkerPool` flows options→renderFront; `computePoolSize` exported and consumed in the same file.
- **Fallback safety:** every worker engagement is guarded (`useWorkerPool && canUseWorker()`, per-card try/catch, probe gate, un-seeded callers stay main-thread) so the worst case is the current main-thread behavior, never a blank card.
