# Parallel Card Front Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Project rules (override skill defaults):** Work on `main` — NO branches/worktrees. Every commit uses an explicit pathspec (`git commit -m "…" -- <files>`), NEVER a bare `git commit` (the shared index may hold other agents' work). NEVER `git add -A`/`.`/`-u`. Subagents: omit the `model` param (inherit Opus 4.8) or use `sonnet`; NEVER Opus 4.7.

**Goal:** Render choreo-card fronts across CPU cores by fanning each card's per-cell pictograph raster out to a seeded Web Worker pool, while the header (TKA glyphs), footer, and chrome render on the main thread through one shared assembler — at full visual parity.

**Architecture:** Main thread owns layout + assembly; workers own per-cell `LayerCompositor.compose`. SVGs are decoded once on main (the proven `AssetBundle`) and seeded into every worker so workers never hit the broken in-worker `createImageBitmap(svgBlob)`. `composeSequenceImage` and the new parallel path share one layout/background/chrome implementation so header/footer/glyphs can't drift. Main-thread `composeSequenceImage` is the fallback.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, OffscreenCanvas, module Web Workers, `createImageBitmap`/`ImageBitmap` transfer, Vitest.

---

## Proven foundation (already in the tree, do not rebuild)

- `src/lib/shared/render/workers/pictograph-render.worker.ts` — `init` / `seed(AssetBundle)` / `render(prepared, options, visibility, stepNumber)→PNG blob`. `$env`-clean.
- `src/lib/shared/render/workers/create-pictograph-worker.ts` — relative-URL worker factory.
- `src/lib/shared/render/services/card-asset-bundle.ts` — `buildAssetBundle`, `bundleTransferables`, `seedCachesFromBundle`, `AssetBundle`.
- `src/lib/shared/render/services/get-card-asset-bundle.ts` — `getCardAssetBundle(sequences, {bluePropType, redPropType, theme})` (warm-render decode pass).
- `/test/worker-pictograph` proves one cell at 0.516% vs main (the accepted AA floor).

## File Structure

- **Create** `src/lib/shared/render/services/card-front-assembler.ts` — shared, side-effect-light helpers: `computeCardFrontLayout`, `paintCardFrontBackground`, `paintCardFrontChrome`, `buildCellLayerOptions`. Single source for layout + non-cell painting.
- **Modify** `src/lib/shared/render/services/image-composer.ts` — `composeSequenceImage` refactored to call the shared helpers (cells still inline). Public behavior unchanged.
- **Create** `src/lib/shared/render/services/card-front-worker-pool.ts` — `CardFrontWorkerPool` (N seeded workers, round-robin `composeCell`, deck-keyed `seedForDeck`) + `getCardFrontWorkerPool()` singleton.
- **Create** `src/lib/shared/render/services/compose-card-front-parallel.ts` — `composeCardFrontParallel(sequence, options, pool)`: layout → prepare cells → fan out → assemble; throws if pool not ready (caller falls back).
- **Modify** `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderFront` tries the parallel path when the pool is ready, else current main-thread path.
- **Modify** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` — seed the pool once per deck before the render lanes.
- **Modify** `src/routes/test/worker-pictograph/+page.svelte` — add a full-card front parity diff (main vs parallel) as the ship gate.
- **Create** `tests/unit/render/card-front-worker-pool.test.ts`, `tests/unit/render/card-front-assembler.test.ts`.
- **Delete (final task)** `src/lib/shared/render/services/__render-perf-probe.ts` + its two taps; the parity-page "Measure front timing" button.

---

## Task 1: Extract shared layout + chrome from composeSequenceImage

Pure extraction — move code, no logic change. The full-card parity diff (Task 5) is the safety net; this task's gate is that `composeSequenceImage` output stays byte-identical.

**Files:**
- Create: `src/lib/shared/render/services/card-front-assembler.ts`
- Modify: `src/lib/shared/render/services/image-composer.ts:219-623` (the `composeSequenceImage` body)
- Test: `tests/unit/render/card-front-assembler.test.ts`

- [ ] **Step 1: Read the source of truth.** Read `image-composer.ts:219-623` (`composeSequenceImage`) and note the four extractable regions: layout sizing (lines ~246-340), background+tint fill (lines ~330-358), the cell loop (lines ~360-460, stays in image-composer), and post-cell chrome — QR/mandala/borders/loop-resolution/header/footer (lines ~462-620).

- [ ] **Step 2: Write `card-front-assembler.ts` with the layout function.** Move the layout math verbatim into a pure function. Signature:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type { PictographVisibilityOptions } from "../utils/pictograph-to-svg";
import type { RenderCanvas, RenderContext2D } from "./types";

export interface CardFrontLayout {
  columns: number;
  rows: number;
  stepSize: number;
  canvasWidth: number;
  canvasHeight: number;
  headerHeight: number;
  footerHeight: number;
  gridOffsetX: number;
  gridOffsetY: number;
  isDarkMode: boolean;
  derivedWord: string;
  startColumn: number;
  startRow: number;
  stepsPerRow: number;
  hasStartPosition: boolean;
}

/** Pure layout computation — moved verbatim from composeSequenceImage. */
export function computeCardFrontLayout(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  visibility: PictographVisibilityOptions,
): CardFrontLayout { /* moved code: columns/rows/stepSize/header/footer/offsets/derivedWord/start* */ }
```

Move the existing computations (column/row via `calculateLayout` or `columnCount`, `simplifyRepeatedWord`, `deckCard` vs default sizing, `gridOffsetX/Y`, `startColumn/startRow/stepsPerRow`, `hasStartPosition`) into the body unchanged.

- [ ] **Step 3: Add background + chrome painters to `card-front-assembler.ts`.** Move the background/tint fill and the post-cell chrome verbatim:

```ts
export function paintCardFrontBackground(
  ctx: RenderContext2D,
  layout: CardFrontLayout,
  options: Partial<SequenceExportOptions>,
): void { /* moved: fillStyle bg + deckCard fillRect + accent-tint side fills */ }

/** Header (TKA glyphs), footer, borders, mandala, QR. Async (header/footer/mandala/QR await). */
export async function paintCardFrontChrome(
  canvas: RenderCanvas,
  ctx: RenderContext2D,
  layout: CardFrontLayout,
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  visibility: PictographVisibilityOptions,
  deps: {
    textRenderer: import("./text-renderer").TextRenderer;
    qrCodeGenerator?: import("../../qr/services/qr-code-generator").QRCodeGenerator;
    renderMandalas: (ctx: RenderContext2D, layout: CardFrontLayout) => Promise<void>;
    renderQRCode: (ctx: RenderContext2D, layout: CardFrontLayout) => Promise<void>;
  },
): Promise<void> { /* moved: drawSmartCellBorders + mandala + QR + loop-component resolution + renderWordHeader + renderUserInfo */ }
```

Keep `renderMandalas`/`renderQRCode` as injected callbacks bound to the `ImageComposer` instance (they use instance state). Move the loop-component resolution block (lines ~509-556) into `paintCardFrontChrome` so both paths resolve loop glyphs identically.

- [ ] **Step 4: Add `buildCellLayerOptions` (shared cell-option builder).** Mirror `renderPictographWithLayerCompositor` (image-composer.ts:1048-1097) so the parallel path builds identical compose inputs:

```ts
import type { LayerRenderOptions, LayerVisibility } from "./types";

export function buildCellLayerOptions(
  stepSize: number,
  visibility: PictographVisibilityOptions,
): { options: LayerRenderOptions; visibility: LayerVisibility } {
  const rawHand = visibility.handPointVisibility ?? "all";
  const handPointVisibility: "all" | "active" = rawHand === "none" ? "active" : rawHand;
  return {
    options: {
      size: stepSize,
      darkMode: visibility.darkMode ?? false,
      showNonRadialPoints: visibility.showNonRadialPoints ?? false,
      handPointVisibility,
      bluePropType: visibility.bluePropType,
      redPropType: visibility.redPropType,
      showBlueMotion: visibility.showBlueMotion,
      showRedMotion: visibility.showRedMotion,
      showPositions: visibility.showPositions ?? false,
      handPathMode: visibility.handPathMode ?? false,
      showTnD: visibility.showTnD,
      showElemental: visibility.showElemental,
    },
    visibility: {
      showTKA: visibility.showTKA ?? true,
      showReversals: visibility.showReversals ?? true,
    },
  };
}
```

- [ ] **Step 5: Refactor `composeSequenceImage` to call the shared helpers.** Replace the inline layout block with `const layout = computeCardFrontLayout(sequence, options, visibilitySettings);` and use `layout.*` throughout; replace the inline bg/tint with `paintCardFrontBackground(ctx, layout, options)`; replace the post-cell chrome block with `await paintCardFrontChrome(canvas, ctx, layout, sequence, options, visibilitySettings, { textRenderer: this.TextRenderer, qrCodeGenerator: this.qrCodeGenerator, renderMandalas: (c, l) => this.renderMandalas(c, sequence, l.columns, l.rows, l.stepSize, l.gridOffsetY, l.gridOffsetX, l.isDarkMode, options, effectiveBluePropType, effectiveRedPropType), renderQRCode: (c, l) => this.renderQRCodeForLayout(...) })`. The cell loop stays inline.

- [ ] **Step 6: Write the layout unit test.**

```ts
import { describe, it, expect } from "vitest";
import { computeCardFrontLayout } from "$lib/shared/render/services/card-front-assembler";

describe("computeCardFrontLayout", () => {
  it("derives deckCard geometry from contentWidth/Height", () => {
    const seq = { steps: [{ letter: "A" }, { letter: "B" }] } as any;
    const layout = computeCardFrontLayout(
      seq,
      { deckCard: { contentWidth: 750, contentHeight: 1050 }, includeStartPosition: true, addWord: true },
      { showTKA: true } as any,
    );
    expect(layout.canvasWidth).toBe(750);
    expect(layout.canvasHeight).toBe(1050);
    expect(layout.columns).toBeGreaterThan(0);
    expect(layout.stepSize).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Run the unit test.** Run: `npx vitest run tests/unit/render/card-front-assembler.test.ts`. Expected: PASS.

- [ ] **Step 8: Parity gate (browser).** Open `http://localhost:5173/test/card-back-parity`, mode = Front, Run parity check. Expected: worst diff unchanged from pre-refactor (~0.5%, the existing worker-vs-main number) — the main-thread reference (`renderFrontMain`) must be unchanged. If any front cell or header shifts, the extraction changed behavior — fix before committing.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/shared/render/services/card-front-assembler.ts src/lib/shared/render/services/image-composer.ts tests/unit/render/card-front-assembler.test.ts
git commit -m "refactor(render): extract shared card-front layout + chrome assembler" -- src/lib/shared/render/services/card-front-assembler.ts src/lib/shared/render/services/image-composer.ts tests/unit/render/card-front-assembler.test.ts
```

---

## Task 2: CardFrontWorkerPool (N seeded workers)

**Files:**
- Create: `src/lib/shared/render/services/card-front-worker-pool.ts`
- Test: `tests/unit/render/card-front-worker-pool.test.ts`

- [ ] **Step 1: Write the pool.** Multi-worker generalization of the proven single-worker flow in `/test/worker-pictograph`:

```ts
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "./types";
import type { AssetBundle } from "./card-asset-bundle";
import { bundleTransferables } from "./card-asset-bundle";
import { createPictographWorker } from "../workers/create-pictograph-worker";
import type { WorkerInMessage, WorkerOutMessage } from "../workers/pictograph-render.worker";

interface Lane { worker: Worker; seeded: boolean; pending: number; }
interface Pending { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void; }

const POOL_SIZE = Math.max(1, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) - 1);

export class CardFrontWorkerPool {
  private lanes: Lane[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private deckKey: string | null = null;
  private bootPromise: Promise<void> | null = null;
  private booted = false;

  isReady(): boolean { return this.booted && this.lanes.length > 0 && this.deckKey !== null; }

  private async boot(): Promise<void> {
    if (this.booted) return;
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = (async () => {
      if (typeof OffscreenCanvas === "undefined") return; // leaves lanes empty → not ready
      for (let i = 0; i < POOL_SIZE; i++) {
        const worker = createPictographWorker();
        worker.onmessage = (ev: MessageEvent<WorkerOutMessage>) => this.onMessage(ev.data);
        this.lanes.push({ worker, seeded: false, pending: 0 });
      }
      this.booted = true;
    })();
    return this.bootPromise;
  }

  /** Build+seed the bundle for a deck. Idempotent per deckKey. */
  async seedForDeck(
    sequences: import("$lib/shared/foundation/domain/models/SequenceData").SequenceData[],
    opts: { bluePropType: import("$lib/shared/pictograph/prop/domain/enums/PropType").PropType; redPropType: import("$lib/shared/pictograph/prop/domain/enums/PropType").PropType; theme: string },
    deckKey: string,
  ): Promise<void> {
    await this.boot();
    if (this.lanes.length === 0) return; // no OffscreenCanvas → caller falls back
    if (this.deckKey === deckKey && this.lanes.every((l) => l.seeded)) return;

    const { getCardAssetBundle } = await import("./get-card-asset-bundle");
    const bundle = await getCardAssetBundle(sequences, opts);

    await Promise.all(this.lanes.map((lane) => this.seedLane(lane, bundle)));
    this.deckKey = deckKey;
  }

  private seedLane(lane: Lane, bundle: AssetBundle): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (ev: MessageEvent<WorkerOutMessage>) => {
        if (ev.data.type === "seed-done") { lane.worker.removeEventListener("message", handler); lane.seeded = true; resolve(); }
        else if (ev.data.type === "error" && ev.data.id === -1) { lane.worker.removeEventListener("message", handler); reject(new Error(ev.data.message)); }
      };
      lane.worker.addEventListener("message", handler);
      // Each worker needs its own copy of the bitmaps (transfer detaches), so
      // structuredClone the bundle per lane before transferring.
      const copy = structuredClone(bundle);
      lane.worker.postMessage({ type: "seed", bundle: copy } satisfies WorkerInMessage, bundleTransferables(copy));
    });
  }

  async composeCell(
    prepared: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber: number | undefined,
  ): Promise<ImageBitmap> {
    if (!this.isReady()) throw new Error("CardFrontWorkerPool not ready");
    const id = this.nextId++;
    const lane = this.pickLane();
    lane.pending++;
    const msg: WorkerInMessage = JSON.parse(JSON.stringify({ type: "render", id, preparedData: prepared, options, visibility, stepNumber }));
    return new Promise<Blob>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as unknown as (b: ImageBitmap) => void, reject });
      lane.worker.postMessage(msg);
    }).then((blob) => createImageBitmap(blob as unknown as Blob));
  }

  private pickLane(): Lane {
    let best = this.lanes[0]!;
    for (const l of this.lanes) if (l.pending < best.pending) best = l;
    return best;
  }

  private onMessage(msg: WorkerOutMessage): void {
    if (msg.type === "render-result") {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); this.decPending(); (p.resolve as unknown as (b: Blob) => void)(msg.blob); }
    } else if (msg.type === "error" && msg.id >= 0) {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); this.decPending(); p.reject(new Error(msg.message)); }
    }
  }

  private decPending(): void {
    let max: Lane | null = null;
    for (const l of this.lanes) if (l.pending > 0 && (!max || l.pending > max.pending)) max = l;
    if (max) max.pending--;
  }

  dispose(): void {
    for (const l of this.lanes) l.worker.terminate();
    this.lanes = []; this.booted = false; this.deckKey = null;
    for (const [, p] of this.pending) p.reject(new Error("pool disposed"));
    this.pending.clear();
  }
}

let instance: CardFrontWorkerPool | null = null;
export function getCardFrontWorkerPool(): CardFrontWorkerPool {
  return (instance ??= new CardFrontWorkerPool());
}
```

- [ ] **Step 2: Write a protocol unit test (no real worker).** Validate `pickLane` least-loaded selection + `composeCell` rejects when not ready:

```ts
import { describe, it, expect } from "vitest";
import { CardFrontWorkerPool } from "$lib/shared/render/services/card-front-worker-pool";

describe("CardFrontWorkerPool", () => {
  it("rejects composeCell before seeding", async () => {
    const pool = new CardFrontWorkerPool();
    await expect(pool.composeCell({} as any, { size: 300 } as any, { showTKA: true, showReversals: true }, 1))
      .rejects.toThrow(/not ready/);
  });
});
```

- [ ] **Step 3: Run the test.** Run: `npx vitest run tests/unit/render/card-front-worker-pool.test.ts`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/shared/render/services/card-front-worker-pool.ts tests/unit/render/card-front-worker-pool.test.ts
git commit -m "feat(render): CardFrontWorkerPool — seeded multi-worker pictograph raster" -- src/lib/shared/render/services/card-front-worker-pool.ts tests/unit/render/card-front-worker-pool.test.ts
```

---

## Task 3: composeCardFrontParallel

**Files:**
- Create: `src/lib/shared/render/services/compose-card-front-parallel.ts`

- [ ] **Step 1: Write the parallel composer.** Mirrors the cell-selection + duration-badge logic of `composeSequenceImage` (image-composer.ts:360-460) but sources cells from the pool and shares layout/bg/chrome:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type { RenderCanvas, RenderContext2D } from "./types";
import { createRenderCanvas } from "./create-render-canvas";
import { computeCardFrontLayout, paintCardFrontBackground, paintCardFrontChrome, buildCellLayerOptions } from "./card-front-assembler";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import type { CardFrontWorkerPool } from "./card-front-worker-pool";
import { getImageComposer } from "../get-image-composer";

export async function composeCardFrontParallel(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
  pool: CardFrontWorkerPool,
): Promise<RenderCanvas> {
  if (!pool.isReady()) throw new Error("pool not ready");
  const composer = getImageComposer();
  // Reuse the SAME visibility resolution + glyph preload as the main path so the
  // header glyphs and cell visibility match exactly.
  await composer.preloadHeaderGlyphs(); // see Task 4 (public passthrough to TextRenderer.preloadGlyphImages)
  const visibility = await composer.resolveVisibilitySettings(options); // see Task 4

  const layout = computeCardFrontLayout(sequence, options, visibility);
  const canvas = createRenderCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext("2d") as RenderContext2D;
  paintCardFrontBackground(ctx, layout, options);

  const { pictographPreparer } = await import("../../pictograph/shared/services/pictograph-preparer");
  const { options: cellOpts, visibility: cellVis } = buildCellLayerOptions(layout.stepSize, visibility);

  const themeMode = visibility.darkMode ? "dark" : "light";
  const prep = (data: StepData | StartPositionData) =>
    pictographPreparer.prepareSingle(data, {
      themeMode, bluePropType: visibility.bluePropType, redPropType: visibility.redPropType,
      handPathMode: visibility.handPathMode ?? false,
      showBlueMotion: visibility.showBlueMotion, showRedMotion: visibility.showRedMotion,
    });

  interface Cell { col: number; row: number; data: StepData | StartPositionData; stepNumber: number | undefined; duration: number; }
  const cells: Cell[] = [];

  // Start position cell (col/row 0,0 in row mode; col 0 in column mode) — mirror
  // composeSequenceImage's hasStartPosition handling.
  let derivedStart: StartPositionData | null = null;
  const firstStep = sequence.steps[0];
  if (options.includeStartPosition && !sequence.startPosition && firstStep) derivedStart = createStartPositionFromBeatStart(firstStep);
  const effectiveStart = sequence.startPosition ?? derivedStart;
  if (layout.hasStartPosition && effectiveStart) {
    cells.push({ col: 0, row: 0, data: effectiveStart, stepNumber: options.addStepNumbers ? 0 : undefined, duration: 1 });
  }
  for (let i = 0; i < sequence.steps.length; i++) {
    const beat = sequence.steps[i]!;
    const col = layout.startColumn + (i % layout.stepsPerRow);
    const row = layout.startRow + Math.floor(i / layout.stepsPerRow);
    cells.push({ col, row, data: beat, stepNumber: options.addStepNumbers ? i + 1 : undefined, duration: beat.duration ?? 1 });
  }

  // Prepare all cells (main) then fan compose out to the pool concurrently.
  const bitmaps = await Promise.all(cells.map(async (c) => {
    const prepared = await prep(c.data);
    try {
      return await pool.composeCell(prepared, cellOpts, cellVis, c.stepNumber);
    } catch {
      // Per-cell fallback: render this cell on the main thread (no Error square).
      const fallback = await composer.composeCellMainThread(prepared, cellOpts, cellVis, c.stepNumber); // see Task 4
      return fallback;
    }
  }));

  cells.forEach((c, i) => {
    const x = c.col * layout.stepSize + layout.gridOffsetX;
    const y = c.row * layout.stepSize + layout.gridOffsetY;
    ctx.drawImage(bitmaps[i]!, x, y, layout.stepSize, layout.stepSize);
    if (Math.abs(c.duration - 1) > 0.001) composer.drawDurationBadgePublic(ctx, c.duration, x, y, layout.stepSize, layout.isDarkMode); // see Task 4
  });

  await paintCardFrontChrome(canvas, ctx, layout, sequence, options, visibility, {
    textRenderer: composer.textRenderer, qrCodeGenerator: composer.qrCodeGenerator,
    renderMandalas: (cx, l) => composer.renderMandalasForLayout(cx, sequence, l, options),
    renderQRCode: (cx, l) => composer.renderQRCodeForLayout(cx, sequence, l, options),
  });

  return canvas;
}
```

- [ ] **Step 2: Typecheck.** Run: `npm run check:fast > /tmp/c.log 2>&1; grep -iE "compose-card-front-parallel" /tmp/c.log`. Expected: no errors for this file (passthrough methods land in Task 4).

- [ ] **Step 3: Commit.**

```bash
git add src/lib/shared/render/services/compose-card-front-parallel.ts
git commit -m "feat(render): composeCardFrontParallel — fan cells to pool, share assembler" -- src/lib/shared/render/services/compose-card-front-parallel.ts
```

---

## Task 4: ImageComposer passthroughs for the parallel path

`composeCardFrontParallel` needs a few ImageComposer internals exposed without duplicating logic. Add thin public methods/getters.

**Files:**
- Modify: `src/lib/shared/render/services/image-composer.ts`

- [ ] **Step 1: Expose visibility + glyph preload.** Add public methods that wrap the existing private logic (no behavior change):

```ts
// In ImageComposer:
async preloadHeaderGlyphs(): Promise<void> { await this.TextRenderer.preloadGlyphImages(); }

async resolveVisibilitySettings(options: Partial<SequenceExportOptions>): Promise<PictographVisibilityOptions> {
  const v = await this.getVisibilitySettings(options.visibilityOverrides);
  if (options.blueVisible === false) v.showBlueMotion = false;
  if (options.redVisible === false) v.showRedMotion = false;
  if (v.showBlueMotion === false || v.showRedMotion === false) v.showTKA = false;
  return v;
}

get textRenderer() { return this.TextRenderer; }
get qrCodeGenerator() { return this.qrCodeGenerator; } // rename backing field if needed to avoid clash

drawDurationBadgePublic(ctx: CanvasRenderingContext2D, d: number, x: number, y: number, size: number, dark: boolean) { this.drawDurationBadge(ctx, d, x, y, size, dark); }
```

- [ ] **Step 2: Add a main-thread single-cell render (fallback).** Wrap the existing layer compositor path:

```ts
async composeCellMainThread(
  prepared: import("../../pictograph/shared/domain/models/PreparedPictographData").PreparedPictographData,
  options: LayerRenderOptions, visibility: LayerVisibility, stepNumber: number | undefined,
): Promise<ImageBitmap> {
  await this.ensureCanvas2DInitialized();
  const result = await this.layerCompositor!.compose(prepared, options, visibility, stepNumber);
  const c = result.canvas;
  return c instanceof OffscreenCanvas ? c.transferToImageBitmap() : createImageBitmap(c);
}
```

- [ ] **Step 3: Add layout-bound mandala/QR wrappers.** Adapt the existing `renderMandalas`/`renderQRCode` (which take loose params) to a `CardFrontLayout`:

```ts
async renderMandalasForLayout(ctx: CanvasRenderingContext2D, seq: SequenceData, layout: import("./card-front-assembler").CardFrontLayout, options: Partial<SequenceExportOptions>): Promise<void> {
  if (!(options.visibilityOverrides?.showMandala && seq.loopType)) return;
  await this.renderMandalas(ctx, seq, layout.columns, layout.rows, layout.stepSize, layout.gridOffsetY, layout.gridOffsetX, layout.isDarkMode, options, options.bluePropTypeOverride ?? options.propTypeOverride, options.redPropTypeOverride ?? options.propTypeOverride);
}
async renderQRCodeForLayout(ctx: CanvasRenderingContext2D, seq: SequenceData, layout: import("./card-front-assembler").CardFrontLayout, options: Partial<SequenceExportOptions>): Promise<void> {
  if (!(options.visibilityOverrides?.showQRCode && this.qrCodeGenerator)) return;
  const { findEmptyCellForQR } = await import("./cell-border-renderer");
  const cell = findEmptyCellForQR(layout.columns, layout.rows, seq, options);
  if (cell) await this.renderQRCode(ctx, seq, cell, layout.stepSize, layout.gridOffsetY, layout.isDarkMode, options.bluePropTypeOverride ?? options.propTypeOverride, options.redPropTypeOverride ?? options.propTypeOverride, layout.gridOffsetX, options.deckId, options.deckName);
}
```

Update `paintCardFrontChrome` (Task 1) to call these injected callbacks for mandala/QR (so `composeSequenceImage` passes its own bound versions too — single code path).

- [ ] **Step 4: Typecheck.** Run: `npm run check:fast > /tmp/c.log 2>&1; grep -iE "image-composer|compose-card-front-parallel" /tmp/c.log`. Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/shared/render/services/image-composer.ts
git commit -m "feat(render): ImageComposer passthroughs for parallel front path" -- src/lib/shared/render/services/image-composer.ts
```

---

## Task 5: Full-card parity gate (browser harness)

**Files:**
- Modify: `src/routes/test/worker-pictograph/+page.svelte`

- [ ] **Step 1: Add a full-card parity run.** Add a second button "Render FULL CARD (parallel vs main)" that: picks the first renderable sequence; builds + seeds `getCardFrontWorkerPool().seedForDeck([seq], {STAFF,STAFF,"front"}, "proof")`; renders main = `getImageComposer().composeSequenceImage(seq, frontOptions)` and parallel = `composeCardFrontParallel(seq, frontOptions, pool)` with the SAME `frontOptions` (deckCard contentWidth/Height = 822x1122, includeStartPosition, addStepNumbers, addWord, canonical visibilityOverrides); normalizes both to one size; diffs; renders MAIN / PARALLEL / DIFF panels + reports `diffPct` and a `headerDiffPct` (diff restricted to the top `headerHeight` band).

- [ ] **Step 2: Run it (browser).** Open `http://localhost:5173/test/worker-pictograph`, click the full-card button. Expected: overall `diffPct` ≈ 0.5% (cell AA floor), `headerDiffPct` ≈ 0% (TKA glyph header is main-thread identical). Visually: header word, step numbers, footer, all cells match. **This is the ship gate — if headerDiffPct is non-trivial or any cell is an Error square, stop and fix.**

- [ ] **Step 3: Commit.**

```bash
git add src/routes/test/worker-pictograph/+page.svelte
git commit -m "test(render): full-card front parity gate (parallel vs main, header band)" -- src/routes/test/worker-pictograph/+page.svelte
```

---

## Task 6: Wire into PrintCardRenderer + deck render

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts:96-204` (`renderFront`)
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`

- [ ] **Step 1: Branch `renderFront` onto the pool when ready.** Replace the unconditional `composeSequenceImage` call (PrintCardRenderer.ts:163-166) with:

```ts
import { getCardFrontWorkerPool } from "../../../shared/render/services/card-front-worker-pool";
import { composeCardFrontParallel } from "../../../shared/render/services/compose-card-front-parallel";
// ...
const pool = getCardFrontWorkerPool();
let sequenceCanvas: RenderCanvas;
if (pool.isReady()) {
  try {
    sequenceCanvas = await composeCardFrontParallel(sequence, composeOptions, pool);
  } catch (err) {
    console.warn("[PrintCardRenderer] parallel front failed, main-thread fallback:", err);
    sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
  }
} else {
  sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
}
```

- [ ] **Step 2: Seed the pool once per deck in `renderAll`.** In `PrintPreviewPages.svelte`, in `renderAll` just before Phase 3 lanes (after `const renderer = getPrintCardRenderer();`, line ~341), add:

```ts
// Seed the worker pool once for this deck so renderFront fans cells across cores.
// deckKey changes when the visual inputs change → triggers a re-seed.
try {
  const { getCardFrontWorkerPool } = await import("$lib/shared/render/services/card-front-worker-pool");
  const deckKey = [seqs.length, resolvedBlueProp, resolvedRedProp, resolvedBackground, CARD_RENDER_SCHEMA].join("|");
  await getCardFrontWorkerPool().seedForDeck(seqs, { bluePropType: resolvedBlueProp, redPropType: resolvedRedProp, theme }, deckKey);
} catch (err) {
  console.warn("[PrintPreview] pool seed failed; rendering on main thread:", err);
}
```

(If seeding fails or there's no OffscreenCanvas, `pool.isReady()` is false and `renderFront` uses the main thread — no behavior change.)

- [ ] **Step 3: Typecheck.** Run: `npm run check:fast > /tmp/c.log 2>&1; grep -iE "PrintCardRenderer|PrintPreviewPages" /tmp/c.log`. Expected: no errors.

- [ ] **Step 4: Parity + smoke (browser).** Open the deck print preview (choreo-card module → print preview). Expected: cards render correctly, headers with TKA glyphs intact, no Error squares; first render seeds the pool (one-time bundle build), subsequent cards fan across cores.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): render deck fronts via seeded worker pool, main-thread fallback" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

---

## Task 7: Perf verification (deck wall-time)

**Files:**
- Modify: `src/routes/test/worker-pictograph/+page.svelte`

- [ ] **Step 1: Add a deck timing run.** Add a button "Time deck (parallel vs main)": select ~24 sequences (reuse `selectSequences` style), seed the pool, render all via `composeCardFrontParallel` (wall-time A) and all via `composeSequenceImage` (wall-time B), report `{ cards, parallelMs, mainMs, speedup: mainMs/parallelMs, cores }`.

- [ ] **Step 2: Run it (browser).** Open `http://localhost:5173/test/worker-pictograph`, click "Time deck". Expected on 32-core: parallel wall-time materially below main (target ≥2× on a cold deck; record the actual number). Paste result into the spec's "results" note.

- [ ] **Step 3: Commit.**

```bash
git add src/routes/test/worker-pictograph/+page.svelte
git commit -m "test(render): deck wall-time benchmark (parallel vs main)" -- src/routes/test/worker-pictograph/+page.svelte
```

---

## Task 8: Remove spike instrumentation

Only after Tasks 5–7 pass. Keep the proof routes? No — fold the parity/timing buttons into the kept harness, delete the temporary perf probe.

**Files:**
- Delete: `src/lib/shared/render/services/__render-perf-probe.ts`
- Modify: `src/lib/shared/render/services/svg-image-cache.ts` (remove the probe import + the `decodeMs` tap)
- Modify: `src/lib/shared/render/services/layer-compositor.ts` (remove the probe import + the `compositeMs` tap)
- Modify: `src/routes/test/card-back-parity/+page.svelte` (remove the "Measure front timing" button + `measureFront` + probe imports)

- [ ] **Step 1: Remove the probe taps.** Delete the `renderPerfProbe` import and the two timing blocks in `svg-image-cache.ts` (the `getImage` decode tap) and `layer-compositor.ts` (the `compose` tap). Delete `__render-perf-probe.ts`. Remove `measureFront`, its button, and the probe imports from `card-back-parity/+page.svelte`.

- [ ] **Step 2: Full typecheck.** Run: `npm run check > /tmp/check.log 2>&1; grep -iniE "error" /tmp/check.log | grep -iE "render|choreo-card|worker-pictograph|card-back-parity" `. Expected: no errors in the touched trees.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/shared/render/services/svg-image-cache.ts src/lib/shared/render/services/layer-compositor.ts src/routes/test/card-back-parity/+page.svelte
git rm src/lib/shared/render/services/__render-perf-probe.ts
git commit -m "chore(render): remove worker-pool perf spike instrumentation" -- src/lib/shared/render/services/svg-image-cache.ts src/lib/shared/render/services/layer-compositor.ts src/routes/test/card-back-parity/+page.svelte src/lib/shared/render/services/__render-perf-probe.ts
```

---

## Self-Review

**Spec coverage:**
- Per-deck bundle + seed → Task 2 (`seedForDeck`) + Task 6 step 2. ✓
- Per-card layout/prepare/fan-out/assemble → Task 3. ✓
- Single shared assembler (header/footer/bg/borders/mandala) → Task 1 + Task 4. ✓
- Header TKA-glyph parity → Task 1 (chrome extracted, main-thread) + Task 5 `headerDiffPct` gate. ✓
- Seeded pool, no global gate flip → Task 2 (own readiness flag). ✓
- PrintCardRenderer branch + deck wiring → Task 6. ✓
- Worker/main fallback (no Error squares) → Task 3 per-cell fallback + Task 6 whole-card fallback. ✓
- Full-card parity gate → Task 5. Perf → Task 7. Cleanup → Task 8. ✓
- Out of scope (backs, global gate, WASM) respected. ✓

**Placeholder scan:** Task 1 references exact line ranges to move (extraction, not invention); all new functions have full signatures + bodies or explicit "moved verbatim from <lines>" instructions. No TBD/TODO.

**Type consistency:** `CardFrontLayout`, `buildCellLayerOptions`, `composeCell(prepared, options, visibility, stepNumber)`, `seedForDeck(sequences, opts, deckKey)`, `isReady()`, `composeCellMainThread`, `renderMandalasForLayout`/`renderQRCodeForLayout`, `drawDurationBadgePublic` — names consistent across Tasks 2–6. Worker messages (`seed`/`seed-done`/`render`/`render-result`/`error`) match the shipped `pictograph-render.worker.ts`.

**Note on `qrCodeGenerator` getter:** ImageComposer's field is `private qrCodeGenerator` — a public getter of the same name clashes. Task 4 step 1 flags renaming the backing field (e.g. `#qrGen`) or naming the getter `getQrGenerator()`; pick one during impl and keep call sites consistent.
