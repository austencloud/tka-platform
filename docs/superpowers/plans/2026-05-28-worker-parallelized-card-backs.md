# Worker-Parallelized Card Backs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render choreo-card backs off the main thread (true multi-core via the existing worker pool) at byte-comparable visual parity with today's DOM-screenshot path.

**Architecture:** Layered composite. The main thread derives data, computes mandala geometry, builds a plain-data `BackJob` (numbers + strings + transferable `ImageBitmap`s), and pre-rasterizes every font/icon/pictograph-dependent layer to bitmaps. A worker paints the `BackJob`: border + bg gradients, the decorations SVG (`createImageBitmap`), the mandala (`renderMandalaToCanvas`, Path2D — no SVG raster), then `drawImage` of each placed bitmap, returning a composited `ImageBitmap`. The `BackJob` contract imports nothing from `$app`/`$env`/Firebase, sidestepping the two documented worker blockers.

**Tech Stack:** Svelte 5, TypeScript, OffscreenCanvas, `createImageBitmap`, Web Workers (module type), existing `CompositionDispatcher` pool, `vitest`.

**Spec:** `docs/superpowers/specs/active/2026-05-28-worker-parallelized-card-backs-design.md`

**Reference files (read before starting):**
- `src/lib/features/choreo-card/services/card-back-dom-renderer.ts` — the path being replaced
- `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderBack` seam (lines 196-211)
- `src/lib/features/choreo-card/components/card-back/CardBack.svelte` — z-stack, layout, cqi values (source of truth for the port)
- `src/lib/features/choreo-card/components/card-back/CardBackDecorations.svelte` — decorations SVG to port
- `src/lib/features/choreo-card/components/card-back/card-back-data.ts` — `deriveCardBackData`, `CardBackData`
- `src/lib/shared/mandala/services/mandala-renderer.ts` — `renderMandalaSVG`, `renderMandalaToCanvas`
- `src/lib/features/choreo-card/components/card-back/SequenceMandala.svelte` usage — geometry calc inputs (lines 220-248 of `SequenceMandala.svelte`)
- `src/lib/shared/render/services/implementations/CompositionDispatcher.ts` — pool + message protocol
- `src/lib/shared/render/workers/composition.worker.ts` — worker message router
- `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` — consumer (lines 335-408, 430-481)
- `src/routes/test/card-back-print/+page.svelte` — existing test route (parity harness host)

**Constants (current back render):** content `822×1122`, bleed `36`, `modern-screenshot` scale `2` → **output `1644×2244`**. The new path MUST emit `1644×2244`.

---

## File Structure

**Create:**
- `src/lib/features/choreo-card/services/card-back/back-job.ts` — `BackJob` + placement types (plain data contract).
- `src/lib/features/choreo-card/services/card-back/card-back-decorations-svg.ts` — `buildDecorationsSVG(theme): string` (pure port).
- `src/lib/features/choreo-card/services/card-back/card-back-layout.ts` — `computeCardBackLayout(data, dims): CardBackLayout` (cqi→px).
- `src/lib/features/choreo-card/services/card-back/card-back-job-builder.ts` — `buildBackJob(sequence, opts): Promise<BackJob>` (main thread).
- `src/lib/features/choreo-card/services/card-back/card-back-raster.ts` — `paintBackJob(job): OffscreenCanvas` (worker-safe; no SvelteKit imports).
- `src/lib/features/choreo-card/services/card-back/card-back-bitmaps.ts` — main-thread pre-rasterizers (text/icons/pictograph), cached.
- Tests alongside under `.../card-back/__tests__/`.
- `src/routes/test/card-back-parity/+page.svelte` — pixel-diff harness (old path vs new path).

**Modify:**
- `src/lib/shared/render/services/implementations/CompositionDispatcher.ts` — add `compose-back` message + `composeBack(job)`.
- `src/lib/shared/render/workers/composition.worker.ts` — handle `compose-back`.
- `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderBack` routes to new path with DOM fallback.

**Retire (Phase 2, after parity gate):** `src/lib/features/choreo-card/services/card-back-dom-renderer.ts`.

---

# PHASE 0 — Spike: prove worker SVG raster (GATE)

Goal: empirically confirm a real decorations SVG (with `feGaussianBlur` filters) rasterizes correctly via `createImageBitmap` in a worker in the target browser. If it fails, Phase 1/2 swap decorations to a Path2D port; do NOT proceed assuming SVG raster works.

### Task 0.1: Spike worker + probe route

**Files:**
- Create: `src/lib/shared/render/workers/__spike__/svg-raster-probe.worker.ts`
- Create: `src/routes/test/svg-raster-probe/+page.svelte`

- [ ] **Step 1: Write the spike worker**

```ts
// src/lib/shared/render/workers/__spike__/svg-raster-probe.worker.ts
// Throwaway. Confirms createImageBitmap(svgBlob) decodes a filtered,
// self-contained SVG inside a worker and produces non-blank pixels.
self.onmessage = async (e: MessageEvent<{ svg: string; w: number; h: number }>) => {
  try {
    const { svg, w, h } = e.data;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    // Sample non-edge pixels to detect a non-blank render.
    const data = ctx.getImageData(0, 0, w, h).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) nonTransparent++;
    self.postMessage({ ok: true, bmpW: bmp.width, bmpH: bmp.height, nonTransparent });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
```

- [ ] **Step 2: Write the probe route**

```svelte
<!-- src/routes/test/svg-raster-probe/+page.svelte -->
<script lang="ts">
  import { buildDecorationsSVGInline } from "./probe-svg";
  let result = $state<string>("(idle)");
  async function run() {
    const worker = new Worker(
      new URL("$lib/shared/render/workers/__spike__/svg-raster-probe.worker.ts", import.meta.url),
      { type: "module" },
    );
    const svg = buildDecorationsSVGInline(); // cosmic decorations, explicit width/height
    worker.onmessage = (e) => { result = JSON.stringify(e.data); worker.terminate(); };
    worker.postMessage({ svg, w: 1644, h: 2244 });
  }
</script>
<button onclick={run}>Run probe</button>
<pre>{result}</pre>
```

- [ ] **Step 3: Create `probe-svg.ts`** — paste the cosmic branch of `CardBackDecorations.svelte` evaluated to a literal string, wrapped in `<svg xmlns="http://www.w3.org/2000/svg" width="1644" height="2244" viewBox="0 0 500 700" preserveAspectRatio="none">…</svg>`. (Hand-evaluate the `{#each}` loops for cosmic, ~150 elements, or temporarily log the rendered `.decorations` `outerHTML` from a live card back and paste it.)

- [ ] **Step 4: Run the probe in the target browser**

Ask the user to open `http://localhost:5173/test/svg-raster-probe` and click "Run probe", report the JSON.
Expected PASS: `{ ok: true, bmpW: 1644, ..., nonTransparent: <large number> }`.
Decision gate:
- `ok:true` + large `nonTransparent` → SVG raster works; Phase 1/2 use `createImageBitmap` for decorations.
- `ok:false` OR `nonTransparent` near 0 (filters dropped) → decorations must be Path2D-ported; flag this and adjust Phase 1 Task 1.3 + Phase 2 to draw decorations programmatically.

- [ ] **Step 5: Record the decision** in the spec file under a new `## Phase 0 result` section, then delete the `__spike__` worker and probe route.

```bash
git add docs/superpowers/specs/active/2026-05-28-worker-parallelized-card-backs-design.md
git rm src/lib/shared/render/workers/__spike__/svg-raster-probe.worker.ts
# remove the probe route dir
git commit -m "spike(choreo-card): confirm worker SVG raster feasibility for card backs"
```

---

# PHASE 1 — Main-thread direct assembly (no worker yet)

Goal: replace `mount + 200ms + modern-screenshot` with direct `BackJob` assembly + main-thread paint. Removes the fixed latency and DOM introspection. Establishes the paint + parity path before adding the worker.

### Task 1.1: `BackJob` contract

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/back-job.ts`
- Test: `.../card-back/__tests__/back-job.test.ts`

- [ ] **Step 1: Define the contract (plain data only — no SvelteKit imports)**

```ts
// back-job.ts
import type { MandalaPaths, MandalaRenderOptions } from "$lib/shared/mandala/domain/mandala-types";

export interface Placement { x: number; y: number; w: number; h: number; }

export type BackBitmapKind =
  | "brand" | "url-ornament" | "difficulty-badge" | "loop-icon"
  | "start-pos-pictograph" | "turn-glyph" | "reversal-glyph"
  | "step-count" | "loop-label";

export interface PlacedBitmap {
  kind: BackBitmapKind;
  bitmap: ImageBitmap;
  placement: Placement;
}

export interface BackJob {
  width: number;            // 1644
  height: number;           // 2244
  bleedPx: number;          // 72 (36 * scale 2)
  // Self-contained layers painted in-worker:
  borderGradient: { type: "linear"; angleDeg: number; stops: { offset: number; color: string }[] };
  bgGradient: { type: "linear"; angleDeg: number; stops: { offset: number; color: string }[] };
  decorationsSVG: string | null;   // null when decorationOpacity === 0 (proof mode)
  decorationOpacity: number;
  mandalaPaths: MandalaPaths;
  mandalaOptions: MandalaRenderOptions & { offsetX: number; offsetY: number };
  // Pre-rasterized layers:
  bitmaps: PlacedBitmap[];
}
```

- [ ] **Step 2: Write a shape test**

```ts
// back-job.test.ts
import { describe, it, expect } from "vitest";
import type { BackJob } from "../back-job";
describe("BackJob", () => {
  it("is structurally plain (serializable except bitmaps)", () => {
    const job = { width: 1644, height: 2244, bleedPx: 72, decorationsSVG: "<svg/>", decorationOpacity: 1, bitmaps: [] } as Partial<BackJob>;
    expect(() => JSON.stringify({ ...job, mandalaPaths: undefined })).not.toThrow();
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/features/choreo-card/services/card-back/__tests__/back-job.test.ts` → PASS.
- [ ] **Step 4: Commit** `git add … && git commit -m "feat(choreo-card): BackJob plain-data contract for off-thread card backs"`

### Task 1.2: Decorations SVG pure port

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/card-back-decorations-svg.ts`
- Test: `.../__tests__/card-back-decorations-svg.test.ts`

- [ ] **Step 1: Port `CardBackDecorations.svelte` to a string function.** Reproduce each theme branch exactly (cosmic/ocean/winter/ember/blossom/forest/autumn/rainbow). Evaluate the Svelte `{#each}` loops into emitted `<rect>/<circle>/<path>/<g>` strings using the SAME math (same seeds `(i*48271+73)%2147483647`, same coordinates). Wrap in `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 500 700" preserveAspectRatio="none">…</svg>`. Signature:

```ts
export function buildDecorationsSVG(theme: string, w: number, h: number): string { /* per-theme branches */ }
```

- [ ] **Step 2: Snapshot test** asserting output contains the theme's signature markers (cosmic: `aurora-ray`, `coma-glow`; ocean: `f1-body`, `jelly-glow`; winter snowflake `stroke="white"`; etc.) and a valid single root `<svg`.
- [ ] **Step 3: Parity micro-check** — render the live `CardBackDecorations.svelte` `.decorations` `outerHTML` for one theme (via the existing card-back test route) and diff element counts/attrs against `buildDecorationsSVG` output; must match.
- [ ] **Step 4: Run tests → PASS. Commit.**

### Task 1.3: Layout (cqi → px)

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/card-back-layout.ts`
- Test: `.../__tests__/card-back-layout.test.ts`

- [ ] **Step 1: Port the absolute positions from `CardBack.svelte` `<style>`.** `cqi` = 1% of container inline-size. At `width=1644`, `1cqi = 16.44px`. Emit placement boxes for: brand slot (`top:3.2cqi`, centered column), top-left glyph-box (`10cqi×6cqi` at `3.2,3.2`), top-right glyph-box, mandala content inset (`10cqi 3.2cqi 30cqi`), mandala-anchor (`72cqi` square centered), loop-row (`bottom:28cqi`, gap `6cqi`), level-badge (`bottom:18cqi`, `7cqi`), bottom-left start-pos (`12cqi` at `bottom:2cqi,left:3.2cqi`), bottom-right step count (`bottom:2cqi,right:3.2cqi`, font `9cqi`), url slot (`bottom:2.8cqi`). Signature:

```ts
export interface CardBackLayout {
  brand: Placement; topLeftGlyph: Placement; topRightGlyph: Placement;
  mandala: Placement; loopRow: { items: Placement[] }; levelBadge: Placement;
  startPos: Placement; stepCount: Placement; url: Placement;
}
export function computeCardBackLayout(data: CardBackData, dims: { width: number; height: number; cqi: number }): CardBackLayout { … }
```

- [ ] **Step 2: Test** exact px for a known case (e.g. `cqi=16.44`, `loopRow` with 3 items): assert each box's `x/y/w/h` equals the hand-computed value from the CSS.
- [ ] **Step 3: Run → PASS. Commit.**

### Task 1.4: Pre-rasterizers (text / icons / pictograph)

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/card-back-bitmaps.ts`
- Test: `.../__tests__/card-back-bitmaps.test.ts` (jsdom-light: assert caching + dimensions)

- [ ] **Step 1: Implement main-thread rasterizers returning `ImageBitmap`**, each drawing to an offscreen `<canvas>` then `createImageBitmap`. Reproduce DOM styling exactly:
  - `rasterizeBrand(theme, w)` — "The Kinetic Alphabet" + ornament + "Choreo Cards" with the theme's `brandGradient`/`brandStyle`/font. Cache key `theme`.
  - `rasterizeUrl(theme)` — ornament + `tkaflowarts.com` + `© <year>`. Cache key `theme` (+year).
  - `rasterizeDifficultyBadge(level)` — port `DifficultyBadge.svelte` (read it first). Cache key `level`.
  - `rasterizeLoopIcon(component, color, quartered)` — FontAwesome glyph / `SwapIcon` / `CheckerboardCircleIcon` (read those three first). Draw FA via a hidden `<i>` element measured + `domToCanvas` of just that node, OR use the FA SVG path data. Cache key `component+color+quartered`.
  - `rasterizeStartPosPictograph(pictographData, darkMode)` — run the existing `pictographPreparer.prepareSingle` + render to canvas (reuse `PictographRenderer` offscreen, same as `StartPositionPictograph.svelte`). Per-card, not cached.
  - `rasterizeTurnGlyph(entries)`, `rasterizeReversalGlyph(seq, period)`, `rasterizeStepCount(n)` — small canvases. Per-card.
- [ ] **Step 2: Add a module-level `Map` cache for theme/level-constant kinds; expose `clearCardBackBitmapCache()`.**
- [ ] **Step 3: Test** that two calls with the same theme return the same cached `ImageBitmap` instance and that per-card kinds are not cached.
- [ ] **Step 4: Run → PASS. Commit.**

### Task 1.5: Job builder

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/card-back-job-builder.ts`
- Test: `.../__tests__/card-back-job-builder.test.ts`

- [ ] **Step 1: Implement `buildBackJob(sequence, opts)`** — calls `deriveCardBackData(sequence)`, runs mandala geometry (`getMandalaGeometryCalculator().calculate(steps, bluePropType, redPropType, pathOptions, { dx, dy:0 })` mirroring `SequenceMandala.svelte:220-248`), parses theme gradients (`getCardBackThemeVisuals(theme)`) into `{angleDeg, stops}` (port the CSS `linear-gradient` parse), calls `computeCardBackLayout`, calls `buildDecorationsSVG` (null if `decorationOpacity===0`), and the pre-rasterizers, assembling `BackJob`.
- [ ] **Step 2: Test** with a fixture sequence (reuse an existing test fixture; grep `__tests__` for a `SequenceData` fixture) → assert `job.width===1644`, `mandalaPaths.blue.length>0`, `bitmaps` includes a `start-pos-pictograph` when `sequence.startPosition` set, `decorationsSVG===null` for proof mode.
- [ ] **Step 3: Run → PASS. Commit.**

### Task 1.6: Raster (paint a BackJob) — worker-safe, runs main-thread first

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/card-back-raster.ts`
- Test: `.../__tests__/card-back-raster.test.ts`

- [ ] **Step 1: Implement `paintBackJob(job, createCanvas)`** where `createCanvas(w,h)` returns an `OffscreenCanvas` (injected so it runs in both contexts). Paint order EXACTLY: (1) border gradient fills full canvas; (2) bg gradient fills inner area inside `bleedPx`; (3) if `decorationsSVG`, `createImageBitmap` it and `drawImage` at full inner rect with `globalAlpha=decorationOpacity`; (4) `renderMandalaToCanvas(ctx, job.mandalaPaths, job.mandalaOptions)`; (5) for each `PlacedBitmap`, `drawImage(bitmap, placement.x, y, w, h)`. **Import only** `renderMandalaToCanvas` + `RenderFactory` helpers — NO `$app`/`$env`/Firebase/Svelte imports.
- [ ] **Step 2: Test** in vitest with an `OffscreenCanvas` polyfill (or guard: skip if unavailable, run in browser harness instead): paint a minimal job, assert canvas is non-blank (sample alpha channel > 0).
- [ ] **Step 3: Run → PASS (or browser-harness verify). Commit.**

### Task 1.7: Wire `renderBack` to main-thread paint + verification harness

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts:196-211`
- Create: `src/routes/test/card-back-parity/+page.svelte`

- [ ] **Step 1: Change `renderBack`** to: `const job = await buildBackJob(sequence, {width,height,bleedPx,theme}); const off = paintBackJob(job, (w,h)=>new OffscreenCanvas(w,h)); ` then convert to `HTMLCanvasElement` (draw the offscreen onto a DOM canvas) for the existing `CardPair` seam. Wrap in `try { … } catch (e) { console.warn(...); return renderCardBack(sequence, {...}); }` — DOM path stays as fallback.
- [ ] **Step 2: Build the parity harness route** — render the SAME set of sequences both ways: `renderCardBackOld` (the DOM renderer, imported directly) and the new `renderBack`. Draw both to side-by-side canvases, compute per-pixel max delta + % differing pixels, render a sortable table. Cover the matrix: each theme × {loop, no-loop} × {float, mixed turns, 0T} × level {1,2,3} × {with, without start position}.
- [ ] **Step 3: Run the harness** — ask the user to open `/test/card-back-parity`, report worst-case delta. Gate: % differing pixels under threshold (target < 0.5% with max delta ≤ small AA tolerance). If a layer is off, fix the corresponding port (layout px, gradient parse, or bitmap styling) and re-run. **Do not claim parity without this output.**
- [ ] **Step 4: Commit** once the gate passes: `git commit -m "feat(choreo-card): main-thread BackJob assembly replaces DOM screenshot for card backs"`

---

# PHASE 2 — Move paint into the worker pool

Goal: dispatch `BackJob` paint to the `CompositionDispatcher` workers for true multi-core. Retire the DOM renderer after the gate re-passes.

### Task 2.1: Worker message protocol

**Files:**
- Modify: `src/lib/shared/render/services/implementations/CompositionDispatcher.ts:18-33`
- Modify: `src/lib/shared/render/workers/composition.worker.ts`

- [ ] **Step 1: Extend `CompositionWorkerInMessage`** with:

```ts
| { type: "compose-back"; id: number; job: BackJobTransfer }
```

where `BackJobTransfer` is `BackJob` minus `bitmaps[].bitmap` inlined as a parallel `ImageBitmap[]` transfer array + `placements`/`kinds` arrays (bitmaps must be in the structured-clone transfer list).

- [ ] **Step 2: Handle `compose-back` in the worker** — reconstruct `BackJob`, call `paintBackJob(job, (w,h)=>new OffscreenCanvas(w,h))`, `transferToImageBitmap()`, `postResult({type:"result", id, bitmap}, [bitmap])`. `paintBackJob` already imports nothing SvelteKit-coupled, so worker module-init won't crash.
- [ ] **Step 3: Commit.**

### Task 2.2: Dispatcher `composeBack`

**Files:**
- Modify: `CompositionDispatcher.ts`

- [ ] **Step 1: Add `async composeBack(job: BackJob): Promise<ImageBitmap>`** — gate on a NEW `canUseBackWorker()` that returns `true` (the back path is worker-safe by construction; do NOT reuse `detectWorkerSupport()` which is hard-false for the front pipeline). Pick a worker, post `compose-back` with the bitmap transfer list, resolve with the returned `ImageBitmap`. On error, reject so the caller falls back.
- [ ] **Step 2: Ensure init works without front-pipeline glyphs** — `compose-back` paint does not need the transferred letter glyphs, but the existing `init` still runs; verify a worker that fails front-init can still serve `compose-back` (the paint path has no dependency on `imageComposer`). If `init` hard-fails, add a lightweight `init-back` that skips the `ImageComposer` construction.
- [ ] **Step 3: Commit.**

### Task 2.3: Route `renderBack` through the pool

**Files:**
- Modify: `PrintCardRenderer.ts`

- [ ] **Step 1:** `renderBack` builds the job, calls `dispatcher.composeBack(job)`, wraps the `ImageBitmap` into a canvas. Keep `try → catch → paintBackJob main-thread → catch → renderCardBack DOM`. Two-tier fallback (worker → main-thread → DOM).
- [ ] **Step 2: Re-run the parity harness** (`/test/card-back-parity`) with the worker path active — same gate. Report worst-case delta.
- [ ] **Step 3: Commit.**

### Task 2.4: Perf check + retire DOM renderer

- [ ] **Step 1: Measure** — render a 50-card family via `PrintPreviewPages`, compare wall-clock vs the pre-Phase-1 baseline (`performance.now()` around `rebuildPairs`). Report numbers.
- [ ] **Step 2: If worker path wins on the batch** and the parity gate passed, delete `card-back-dom-renderer.ts` and its import; keep `paintBackJob` main-thread as the small-batch/fallback path.
- [ ] **Step 3: Full `npm run check` (one cold run into a log), fix any types, commit.**

```bash
npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log
```

- [ ] **Step 4: Commit** `git commit -m "feat(choreo-card): card backs render off-thread via worker pool; retire DOM screenshot path"`

---

## Notes for the implementer

- **Parity is the hard requirement.** The pixel-diff harness (Task 1.7 Step 2-3) is the real test; unit tests cover the pure functions. Never report parity without harness output.
- **Caching matters:** brand/url/decorations/badge/loop-icon bitmaps are theme/level-constant — build once per batch, reuse. Only mandala + pictograph + glyphs + step-count are per-card.
- **The mandala uses `renderMandalaToCanvas` (Path2D), NOT SVG raster** — it's the most complex per-card layer and this sidesteps the SVG-in-worker risk for it. Decorations are the only `createImageBitmap`-SVG dependency (Phase 0 gates it).
- **Do not re-enable `RenderFactory.supportsWorkerRendering()` or `CompositionDispatcher.detectWorkerSupport()`** — those gate the FRONT pipeline (different, still-blocked). The back path makes its own worker-safety guarantee.
- Read `DifficultyBadge.svelte`, `ReversalPatternGlyph.svelte`, `SwapIcon.svelte`, `CheckerboardCircleIcon.svelte` before Task 1.4 — their exact markup is the parity source.
