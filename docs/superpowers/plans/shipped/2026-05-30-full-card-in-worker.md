# Full-Card-In-Worker Front Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Project rules (override skill defaults):** Work on `main` — NO branches/worktrees. Every commit uses an explicit pathspec (`git commit -m "…" -- <files>`), NEVER a bare `git commit` (shared index holds other agents' work). NEVER `git add -A`/`.`/`-u`. Subagents: omit the `model` param (inherit Opus 4.8) or use `sonnet`; NEVER Opus 4.7. Inner loop: `npm run check:fast` only, never `npm run build`. Commit message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Goal:** Render the whole choreo-card front inside a Web Worker — one job per card — so a deck of N cards renders across N CPU cores, beating the main thread on cold decks at full visual parity.

**Architecture:** Main thread builds a plain-data `FrontJob` (resolve visibility/mandala-geometry/QR-URL, prepare cells) and seeds each worker once per deck with decoded SVG + glyph `ImageBitmap`s. A `$env`-clean worker painter (`paintFrontJob`) rasters every cell (`LayerCompositor` + seeded cache), composites, draws borders/mandala/QR/header/footer, and transfers one full-card `ImageBitmap` back. Mirrors the proven `buildBackJob`/`paintBackJob` plain-data split. Main-thread `composeSequenceImage` stays the fallback.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, OffscreenCanvas, module Web Workers, `transferToImageBitmap`/`ImageBitmap` transfer, `qrcode-generator` (pure QR matrix), Vitest.

**Design doc:** `docs/superpowers/specs/active/2026-05-30-full-card-in-worker-design.md`.

---

## Proven foundation (in the tree — reuse, do not rebuild)

- `src/lib/features/choreo-card/services/card-back/card-back-job-builder.ts` + `card-back-raster.ts` — the plain-data job + types-only painter template.
- `src/lib/shared/render/workers/pictograph-render.worker.ts` — `seed` + per-cell `render`; **extend** with a `paint-front` message.
- `src/lib/shared/render/workers/create-pictograph-worker.ts` — relative-URL worker factory.
- `src/lib/shared/render/services/card-asset-bundle.ts` — `buildAssetBundle`/`bundleTransferables`/`seedCachesFromBundle`/`AssetBundle`; **extend** with glyph bitmaps.
- `src/lib/shared/render/services/card-front-worker-pool.ts` — pool; `PARALLEL_FRONT_ENABLED=false`; **replace** `composeCell` with `composeFront`.
- `src/lib/shared/render/services/card-front-assembler.ts` — `computeCardFrontLayout`, `paintCardFrontBackground`, `buildCellLayerOptions`, `paintCardFrontChrome` (chrome currently pulls `TextRenderer` → decouple).
- `src/lib/features/choreo-card/services/card-front-frame.ts` — `wrapContentInCardFrame` (bleed border, main-thread, unchanged).
- `src/lib/shared/mandala/services/mandala-renderer.ts` — `renderMandalaToCanvas` (worker-safe Path2D).
- `src/lib/shared/sequence-viewer/services/getMandalaPlacements.ts` — pure placements.
- `src/routes/test/worker-pictograph/+page.svelte` — parity + deck-timing harness (retarget).

## File structure

- **Create** `src/lib/shared/render/services/front-job.ts` — the `FrontJob` plain-data type + sub-types.
- **Create** `src/lib/shared/render/services/qr-matrix-renderer.ts` — `$env`-clean QR matrix → canvas (uses `qrcode-generator`).
- **Create** `src/lib/shared/render/services/glyph-bitmap-seed.ts` — main-thread header-glyph preloader → seedable `ImageBitmap`s; worker-side glyph source.
- **Modify** `src/lib/shared/render/services/text-renderer.ts` — accept an injected glyph-bitmap source (decouple worker path from `get-glyph-cache`/`$env`).
- **Create** `src/lib/shared/render/services/paint-front-job.ts` — the `$env`-clean worker painter.
- **Create** `src/lib/shared/render/services/build-front-job.ts` — main-thread `FrontJob` builder.
- **Modify** `src/lib/shared/render/services/card-asset-bundle.ts` — glyph bitmaps in the bundle.
- **Modify** `src/lib/shared/render/workers/pictograph-render.worker.ts` — `paint-front` message.
- **Modify** `src/lib/shared/render/services/card-front-worker-pool.ts` — `composeFront(job)`.
- **Modify** `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — branch to the full-card path.
- **Modify** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` — seed the extended bundle.
- **Create** `tests/unit/render/paint-front-job-env-clean.test.ts` — `$env`-clean import guard.
- **Create** `tests/unit/render/qr-matrix-renderer.test.ts`, `tests/unit/render/front-job.test.ts`.
- **Modify** `src/routes/test/worker-pictograph/+page.svelte` — full-card-worker parity + timing.

---

## Task 1: `FrontJob` plain-data contract

**Files:**
- Create: `src/lib/shared/render/services/front-job.ts`
- Test: `tests/unit/render/front-job.test.ts`

- [ ] **Step 1: Read the source of truth.** Read `card-front-assembler.ts` (`CardFrontLayout`, `buildCellLayerOptions`, `paintCardFrontChrome` signature), `back-job.ts` (the BackJob plain-data style), `compose-card-front-parallel.ts` (cell list shape: col/row/stepNumber/duration), and `image-composer.ts` `renderMandalas` (the mandala paths + placements + palette inputs). Note every field the chrome/cell/mandala/QR/footer render consumes.

- [ ] **Step 2: Define the type.** Write `front-job.ts` with a fully-plain (structuredClone-able, no class instances, no functions) interface:

```ts
import type { CardFrontLayout } from "./card-front-assembler";
import type { LayerRenderOptions, LayerVisibility } from "./types";
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { MandalaPaths, MandalaPalette } from "../../mandala/domain/mandala-types";
import type { MandalaPlacement } from "../../sequence-viewer/services/getMandalaPlacements";

export interface FrontJobCell {
  prepared: PreparedPictographData;
  col: number;
  row: number;
  stepNumber: number | undefined;
  duration: number;
}

export interface FrontJobMandala {
  paths: MandalaPaths;
  placements: MandalaPlacement[];
  palette: MandalaPalette;
}

export interface FrontJobQr {
  /** Payload URL, resolved on main (shortcode already resolved). */
  matrixText: string;
  cell: { col: number; row: number };
  darkColor: string;
  lightColor: string;
  eccLevel: "L" | "M" | "Q" | "H";
}

export interface FrontJobFooter {
  show: boolean;
  leftLabel?: string;
  rightLabel?: string;
  notes?: string;
  iconBitmapKey?: string;   // footer element icon, seeded like glyphs (null if none)
  textColor: string;
  mutedColor: string;
}

export interface FrontJobHeader {
  show: boolean;
  word: string;               // derived/simplified word for the TKA glyph header
}

export interface FrontJob {
  canvasWidth: number;
  canvasHeight: number;
  layout: CardFrontLayout;
  cells: FrontJobCell[];
  cellOptions: LayerRenderOptions;
  cellVisibility: LayerVisibility;
  background: { fill: string; accentColor?: string; accentTintOpacity?: number };
  isDarkMode: boolean;
  mandala: FrontJobMandala | null;
  qr: FrontJobQr | null;
  header: FrontJobHeader;
  footer: FrontJobFooter;
}
```

If the actual chrome render needs a field not listed (e.g. smart-border inputs are derivable from `layout` + `cells` — confirm by reading `drawSmartCellBorders`), add it as a plain field and note why.

- [ ] **Step 3: Write a shape test.**

```ts
import { describe, it, expect } from "vitest";
import type { FrontJob } from "$lib/shared/render/services/front-job";

describe("FrontJob", () => {
  it("is structuredClone-able (plain data only)", () => {
    const job: FrontJob = {
      canvasWidth: 728, canvasHeight: 1028,
      layout: { columns: 2, rows: 2, stepSize: 300, canvasWidth: 728, canvasHeight: 1028, headerHeight: 80, footerHeight: 60, gridOffsetX: 0, gridOffsetY: 80, isDarkMode: false, derivedWord: "AB", startColumn: 1, startRow: 0, stepsPerRow: 1, hasStartPosition: true } as any,
      cells: [], cellOptions: { size: 300 } as any, cellVisibility: { showTKA: true, showReversals: true } as any,
      background: { fill: "#fff" }, isDarkMode: false,
      mandala: null, qr: null,
      header: { show: true, word: "AB" },
      footer: { show: false, textColor: "#111", mutedColor: "#555" },
    };
    expect(() => structuredClone(job)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run it.** `npx vitest run tests/unit/render/front-job.test.ts` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/shared/render/services/front-job.ts tests/unit/render/front-job.test.ts
git commit -m "feat(render): FrontJob plain-data contract for full-card worker render" -- src/lib/shared/render/services/front-job.ts tests/unit/render/front-job.test.ts
```

---

## Task 2: `$env`-clean QR matrix renderer

**Files:**
- Create: `src/lib/shared/render/services/qr-matrix-renderer.ts`
- Test: `tests/unit/render/qr-matrix-renderer.test.ts`

- [ ] **Step 1: Confirm the lib.** `qrcode-generator` is a transitive dep (via `qr-code-styling`). Confirm its API: `npx tsx -e "import qr from 'qrcode-generator'; const q=qr(0,'M'); q.addData('https://tka.run/ABCD'); q.make(); console.log(q.getModuleCount(), q.isDark(0,0))"` (or read `node_modules/qrcode-generator`). Note `getModuleCount()` and `isDark(row,col)`.

- [ ] **Step 2: Read current QR visuals.** Read `qr-code-generator.ts` `generateQR`/`generateAsImage` to capture the ECC level, dark/light colors, and quiet-zone/margin the current QR uses, so the matrix render matches. Record them as the renderer defaults.

- [ ] **Step 3: Write the renderer.** Pure, no DOM-construction, no `$env`:

```ts
import qrcode from "qrcode-generator";

export interface QrMatrixOptions {
  x: number; y: number; size: number;      // target square in device px
  darkColor: string; lightColor: string;
  eccLevel: "L" | "M" | "Q" | "H";
  marginModules?: number;                    // quiet zone (default match current)
}

/** Draw a QR for `text` into the (x,y,size) square. Worker-safe (no DOM). */
export function drawQrMatrix(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  opts: QrMatrixOptions,
): void {
  const qr = qrcode(0, opts.eccLevel);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const margin = opts.marginModules ?? 0;
  const total = count + margin * 2;
  const cell = opts.size / total;
  ctx.save();
  ctx.fillStyle = opts.lightColor;
  ctx.fillRect(opts.x, opts.y, opts.size, opts.size);
  ctx.fillStyle = opts.darkColor;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(
          opts.x + (c + margin) * cell,
          opts.y + (r + margin) * cell,
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }
  ctx.restore();
}
```

- [ ] **Step 4: Test (fake ctx, count fillRects).**

```ts
import { describe, it, expect, vi } from "vitest";
import { drawQrMatrix } from "$lib/shared/render/services/qr-matrix-renderer";

describe("drawQrMatrix", () => {
  it("draws dark modules for a payload", () => {
    const calls: string[] = [];
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), set fillStyle(v: string){ calls.push(v); } } as any;
    drawQrMatrix(ctx, "https://tka.run/ABCD", { x: 0, y: 0, size: 100, darkColor: "#000", lightColor: "#fff", eccLevel: "M" });
    expect(ctx.fillRect).toHaveBeenCalled();           // light bg + ≥1 dark module
    expect(calls).toContain("#000");
  });
});
```

- [ ] **Step 5: Run it.** `npx vitest run tests/unit/render/qr-matrix-renderer.test.ts` → PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/shared/render/services/qr-matrix-renderer.ts tests/unit/render/qr-matrix-renderer.test.ts
git commit -m "feat(render): env-clean QR matrix renderer (qrcode-generator)" -- src/lib/shared/render/services/qr-matrix-renderer.ts tests/unit/render/qr-matrix-renderer.test.ts
```

---

## Task 3: Decouple header-glyph rendering from `$env` (seedable glyph bitmaps)

**Files:**
- Create: `src/lib/shared/render/services/glyph-bitmap-seed.ts`
- Modify: `src/lib/shared/render/services/text-renderer.ts`
- Modify: `src/lib/shared/render/services/card-asset-bundle.ts`

- [ ] **Step 1: Read the glyph path.** Read `text-renderer.ts` (`preloadGlyphImages`, how it draws the word header / which glyph images it uses) and `get-glyph-cache.ts` (the `$env` import + what it returns: a map of glyph id → image). Identify the exact glyph-image lookup `TextRenderer` performs while rendering the header.

- [ ] **Step 2: Main-thread glyph preloader.** In `glyph-bitmap-seed.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface GlyphBitmapSeed { keys: string[]; bitmaps: ImageBitmap[]; }

/** MAIN THREAD. Preload the TKA header glyph images the deck's words need and
 * snapshot them as transferable ImageBitmaps. Uses the existing glyph cache
 * (which is $env-coupled — hence main-thread only). */
export async function buildGlyphBitmapSeed(sequences: SequenceData[]): Promise<GlyphBitmapSeed> {
  const { getGlyphCache } = await import("./get-glyph-cache");   // dynamic → not in worker bundle
  const cache = getGlyphCache();
  // Determine glyph keys for every (simplified) word in the deck, ensure each is
  // loaded, snapshot to ImageBitmap. Mirror how TextRenderer enumerates glyphs.
  // ... (use cache's existing API; convert each glyph image → ImageBitmap via createImageBitmap)
  return { keys, bitmaps };
}

/** WORKER. A glyph source backed by seeded bitmaps (no $env). */
export class SeededGlyphSource {
  private map = new Map<string, ImageBitmap>();
  seed(seed: GlyphBitmapSeed) { for (let i=0;i<seed.keys.length;i++) this.map.set(seed.keys[i]!, seed.bitmaps[i]!); }
  get(key: string): ImageBitmap | undefined { return this.map.get(key); }
}
```

Exact glyph-key enumeration mirrors `TextRenderer`'s lookup — read it in Step 1 and replicate.

- [ ] **Step 3: Inject the glyph source into `TextRenderer`.** Add an optional injected glyph source so the worker path never imports `get-glyph-cache`:

```ts
// text-renderer.ts
export interface GlyphSource { get(key: string): ImageBitmap | HTMLImageElement | undefined; }
// TextRenderer: accept setGlyphSource(src: GlyphSource); when set, the header
// render reads glyphs from it instead of the $env-coupled glyph cache.
```

Keep the existing main-thread behavior unchanged when no source is injected (default path still uses `get-glyph-cache`). Single render code path; only the glyph *source* swaps.

- [ ] **Step 4: Extend `AssetBundle` + seed with glyphs.** In `card-asset-bundle.ts`: add `glyphs: GlyphBitmapSeed` to `AssetBundle`; include `glyphs.bitmaps` in `bundleTransferables`; in `seedCachesFromBundle`, seed a `SeededGlyphSource` and hand it to the worker's `TextRenderer`. Add a `buildGlyphBitmapSeed` call to the bundle build (`buildAssetBundle`/`getCardAssetBundle` — sequences are already in scope).

- [ ] **Step 5: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "glyph-bitmap-seed|text-renderer|card-asset-bundle" /tmp/c.log` → no errors in these files.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/shared/render/services/glyph-bitmap-seed.ts src/lib/shared/render/services/text-renderer.ts src/lib/shared/render/services/card-asset-bundle.ts
git commit -m "feat(render): seedable header-glyph bitmaps; decouple TextRenderer from \$env" -- src/lib/shared/render/services/glyph-bitmap-seed.ts src/lib/shared/render/services/text-renderer.ts src/lib/shared/render/services/card-asset-bundle.ts
```

---

## Task 4: `paintFrontJob` — the `$env`-clean worker painter

**Files:**
- Create: `src/lib/shared/render/services/paint-front-job.ts`

- [ ] **Step 1: Read the assembler + parallel composer.** Read `card-front-assembler.ts` (`paintCardFrontBackground`, `paintCardFrontChrome`, `buildCellLayerOptions`) and `compose-card-front-parallel.ts` (cell draw loop, duration badge). Note that `paintCardFrontChrome` currently takes a `deps` object with `textRenderer`/`renderMandalas`/`renderQRCode` closures — the worker version supplies worker-safe versions of these.

- [ ] **Step 2: Write the painter.** Imports ONLY worker-safe modules + types — no `$app`/`$env`, no `getMandalaGeometryCalculator`, no `pictograph-blob-cache`/`pictograph-svg-cache`, no `image-composer`:

```ts
import type { FrontJob } from "./front-job";
import { paintCardFrontBackground } from "./card-front-assembler";
import { drawSmartCellBorders } from "./cell-border-renderer";
import { renderMandalaToCanvas } from "../../mandala/services/mandala-renderer";
import { drawQrMatrix } from "./qr-matrix-renderer";
import { getLayerCompositor } from "./get-layer-compositor";  // confirm $env-clean; else construct directly
import { SeededGlyphSource } from "./glyph-bitmap-seed";
// + a worker-safe header/footer text renderer using the seeded glyph source

/** WORKER. Render a full card-front content canvas from a FrontJob. */
export async function paintFrontJob(
  job: FrontJob,
  glyphSource: SeededGlyphSource,
): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(job.canvasWidth, job.canvasHeight);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  paintCardFrontBackground(ctx, job.layout, /* options derived from job.background */);

  const compositor = getLayerCompositor();
  for (const cell of job.cells) {
    const res = await compositor.compose(cell.prepared, job.cellOptions, job.cellVisibility, cell.stepNumber);
    const bmp = res.canvas instanceof OffscreenCanvas ? res.canvas.transferToImageBitmap() : await createImageBitmap(res.canvas);
    const x = cell.col * job.layout.stepSize + job.layout.gridOffsetX;
    const y = cell.row * job.layout.stepSize + job.layout.gridOffsetY;
    ctx.drawImage(bmp, x, y, job.layout.stepSize, job.layout.stepSize);
    if (Math.abs(cell.duration - 1) > 0.001) { /* drawDurationBadge — extract worker-safe copy or inline */ }
  }

  drawSmartCellBorders(ctx, /* layout + cell occupancy from job */);
  if (job.mandala) for (const p of job.mandala.placements) renderMandalaToCanvas(ctx, job.mandala.paths, /* size/offset from p + layout + palette */);
  if (job.qr) {
    const { x, y, size } = qrRectFromCell(job.qr.cell, job.layout);   // mirror image-composer renderQRCode placement
    drawQrMatrix(ctx, job.qr.matrixText, { x, y, size, darkColor: job.qr.darkColor, lightColor: job.qr.lightColor, eccLevel: job.qr.eccLevel });
  }
  if (job.header.show) { /* render TKA word header via seeded glyphs */ }
  if (job.footer.show) { /* render footer labels/notes + seeded icon */ }

  return canvas;
}
```

The duration badge, smart-border occupancy, mandala size/offset, QR rect, and header/footer geometry must mirror `image-composer.ts`/`card-front-assembler.ts` EXACTLY (read those; copy the math). Where the existing chrome lives in `paintCardFrontChrome` with closures, either (a) call `paintCardFrontChrome` with worker-safe `deps` (preferred — single code path), or (b) inline the math here. Prefer (a) if `paintCardFrontChrome`'s non-deps imports are already `$env`-clean.

- [ ] **Step 3: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "paint-front-job" /tmp/c.log` → no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/shared/render/services/paint-front-job.ts
git commit -m "feat(render): paintFrontJob — env-clean full-card worker painter" -- src/lib/shared/render/services/paint-front-job.ts
```

---

## Task 5: `$env`-clean import guard (regression lock)

**Files:**
- Create: `tests/unit/render/paint-front-job-env-clean.test.ts`

- [ ] **Step 1: Write the guard test.** Statically assert the worker painter's transitive import graph contains no `$app`/`$env`/Firebase. Read the module source + walk relative imports, or assert the worker entry imports cleanly under Vitest's Node env (where `$app/environment` is unmocked and would throw if pulled at module scope):

```ts
import { describe, it, expect } from "vitest";

describe("paintFrontJob env-clean", () => {
  it("imports without pulling $app/$env (no module-scope SvelteKit coupling)", async () => {
    // If any transitive import touches $app/environment at module scope, this import throws.
    await expect(import("$lib/shared/render/services/paint-front-job")).resolves.toBeDefined();
  });
  it("source tree references no forbidden modules", () => {
    // Optional stronger check: read paint-front-job.ts + its relative deps, assert
    // none import get-glyph-cache / getMandalaGeometryCalculator / pictograph-blob-cache /
    // pictograph-svg-cache / $app / $env.
  });
});
```

If Vitest's config aliases `$app/environment` to a stub (common), implement the **source-tree walk** variant: read `paint-front-job.ts`, follow relative `./` imports recursively, and `expect` no file in the graph contains `$app/environment`, `$env/`, `firebase`, `get-glyph-cache`, `getMandalaGeometryCalculator`, `pictograph-blob-cache`, or `pictograph-svg-cache`.

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/render/paint-front-job-env-clean.test.ts` → PASS. If it FAILS, the painter pulled a forbidden module — fix the import (move that work to `buildFrontJob` / pass as plain data) before proceeding.

- [ ] **Step 3: Commit.**

```bash
git add tests/unit/render/paint-front-job-env-clean.test.ts
git commit -m "test(render): guard paintFrontJob import tree stays env-clean" -- tests/unit/render/paint-front-job-env-clean.test.ts
```

---

## Task 6: `buildFrontJob` — main-thread builder

**Files:**
- Create: `src/lib/shared/render/services/build-front-job.ts`

- [ ] **Step 1: Read the main-thread resolution.** Read `image-composer.ts` `composeSequenceImage` for: visibility resolution (`resolveVisibilitySettings`), prop-type effective resolution (`bluePropTypeOverride ?? propTypeOverride`), the cell list build, mandala (`renderMandalas` → calculator + `getMandalaPlacements`), QR (`findEmptyCellForQR` + the shortcode/URL the QR encodes), header/footer inputs. Read `compose-card-front-parallel.ts` for the prepare-cells pattern.

- [ ] **Step 2: Write the builder.**

```ts
import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";
import type { FrontJob } from "./front-job";
import { computeCardFrontLayout, buildCellLayerOptions } from "./card-front-assembler";
import { getImageComposer } from "../get-image-composer";

export async function buildFrontJob(
  sequence: SequenceData,
  options: Partial<SequenceExportOptions>,
): Promise<FrontJob> {
  const composer = getImageComposer();
  const visibility = await composer.resolveVisibilitySettings(options);
  const layout = computeCardFrontLayout(sequence, options, visibility);
  // effective prop types → cellVisibility (mirror compose-card-front-parallel)
  // prepareSingle each cell → FrontJobCell[]
  // mandala: composer.getMandalaPathsAndPlacements(...) (add a thin main-side passthrough if needed) → FrontJobMandala | null
  // qr: findEmptyCellForQR + resolve shortcode→URL → FrontJobQr | null
  // header/footer from options + canonical
  // background {fill, accentColor, accentTintOpacity} from options
  return { /* assembled plain FrontJob */ } as FrontJob;
}
```

Add any thin main-side passthroughs needed on `ImageComposer` (e.g. expose mandala paths+placements, or the QR URL resolution) WITHOUT duplicating logic — mirror the `buildChromeDeps`/`resolveVisibilitySettings` passthrough pattern already added for the cells path. QR shortcode→URL: reuse the existing `QRCodeGenerator`/`ShortCodeManager` (main-thread); extract just the URL (do not rasterize here — the worker draws it).

- [ ] **Step 3: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "build-front-job|image-composer" /tmp/c.log` → no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/shared/render/services/build-front-job.ts src/lib/shared/render/services/image-composer.ts
git commit -m "feat(render): buildFrontJob — main-thread FrontJob builder" -- src/lib/shared/render/services/build-front-job.ts src/lib/shared/render/services/image-composer.ts
```

---

## Task 7: Worker `paint-front` message + glyph seed

**Files:**
- Modify: `src/lib/shared/render/workers/pictograph-render.worker.ts`

- [ ] **Step 1: Read the worker.** Read `pictograph-render.worker.ts` (its `WorkerInMessage`/`WorkerOutMessage` unions, `seed`/`render` handlers, `seedCachesFromBundle` usage).

- [ ] **Step 2: Extend the protocol.** Add to `WorkerInMessage`: `{ type: "paint-front"; id: number; job: FrontJob }`. Add to `WorkerOutMessage`: `{ type: "front-result"; id: number; bitmap: ImageBitmap }`. In `seed`, also seed the glyph source (from the extended bundle) into the worker's `TextRenderer`. Handle `paint-front`: `const canvas = await paintFrontJob(job, glyphSource); const bitmap = canvas.transferToImageBitmap(); postMessage({ type: "front-result", id, bitmap }, [bitmap]);`. On throw → post `{ type: "error", id, message }`.

- [ ] **Step 3: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "pictograph-render.worker" /tmp/c.log` → no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/shared/render/workers/pictograph-render.worker.ts
git commit -m "feat(render): worker paint-front message → paintFrontJob" -- src/lib/shared/render/workers/pictograph-render.worker.ts
```

---

## Task 8: Pool `composeFront(job)`

**Files:**
- Modify: `src/lib/shared/render/services/card-front-worker-pool.ts`

- [ ] **Step 1: Add `composeFront`.** One message per card; transfer the returned bitmap back:

```ts
async composeFront(job: import("./front-job").FrontJob): Promise<ImageBitmap> {
  if (!this.isReady()) throw new Error("CardFrontWorkerPool not ready");
  const id = this.nextId++;
  const lane = this.pickLane();
  lane.pending++;
  return new Promise<ImageBitmap>((resolve, reject) => {
    this.pending.set(id, { resolve: resolve as any, reject });
    // structuredClone the job (PreparedPictographData etc. are plain) so transfer is safe.
    lane.worker.postMessage({ type: "paint-front", id, job });
  });
}
```

Update `onMessage` to handle `front-result` (resolve with `msg.bitmap`). Keep `composeCell` or remove it (grep: if nothing else calls `composeCell`/the cell `render` path after Task 9, remove the dead per-cell code + the `render` message). `seedForDeck` already builds the bundle — ensure it now includes glyphs (Task 3 extended the bundle).

- [ ] **Step 2: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "card-front-worker-pool" /tmp/c.log` → no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/shared/render/services/card-front-worker-pool.ts
git commit -m "feat(render): pool composeFront — one job per card, transfer bitmap back" -- src/lib/shared/render/services/card-front-worker-pool.ts
```

---

## Task 9: Wire `PrintCardRenderer.renderFront` + deck seed

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts`
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`

- [ ] **Step 1: Branch renderFront.** Replace the parallel branch (currently `composeCardFrontParallel`, gated off) with the full-card path:

```ts
const pool = getCardFrontWorkerPool();
let sequenceCanvas: RenderCanvas | HTMLCanvasElement;
if (pool.isReady()) {
  try {
    const job = await buildFrontJob(sequence, composeOptions);
    const bitmap = await pool.composeFront(job);
    // draw the returned bitmap into a content canvas for wrapContentInCardFrame
    const cc = document.createElement("canvas"); cc.width = bitmap.width; cc.height = bitmap.height;
    cc.getContext("2d")!.drawImage(bitmap, 0, 0);
    sequenceCanvas = cc;
  } catch (err) {
    console.warn("[PrintCardRenderer] full-card worker failed, main fallback:", err);
    sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
  }
} else {
  sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
}
return wrapContentInCardFrame(sequenceCanvas, { canvasWidth: canvasW, canvasHeight: canvasH, bleedPx: bleed, accent, dark });
```

Remove the now-dead `composeCardFrontParallel` import/branch.

- [ ] **Step 2: Deck seed.** In `PrintPreviewPages.renderAll`, the `seedForDeck` call already exists; it now builds the glyph-extended bundle (Task 3). No change unless the deckKey needs a glyph-set component (it does not — glyphs derive from sequences already keyed by `seqs.length`).

- [ ] **Step 3: Typecheck.** `npm run check:fast > /tmp/c.log 2>&1; grep -iE "PrintCardRenderer|PrintPreviewPages|compose-card-front-parallel" /tmp/c.log` → no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): render deck fronts via full-card worker job, main fallback" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

---

## Task 10: Parity harness (full-card worker vs main)

**Files:**
- Modify: `src/routes/test/worker-pictograph/+page.svelte`

- [ ] **Step 1: Retarget the full-card run.** Replace the `composeCardFrontParallel` call in `runFullCard()` with: seed the pool (extended bundle), `buildFrontJob(seq, frontOptions)` → `pool.composeFront(job)` → draw bitmap to a canvas = PARALLEL; `composeSequenceImage(seq, frontOptions)` = MAIN. Keep the existing framed panels + content diff. Add explicit **QR-cell** band diff alongside header/footer band diffs.

- [ ] **Step 2: Run it (browser).** Open `http://localhost:5173/test/worker-pictograph`, pick an element, **Render FULL CARD**. Expected: header/footer/QR bands ~0%, overall ≤ ~0.5%, framed MAIN vs PARALLEL visually identical (border, tint, footer, QR, cells). **Ship gate — if any band is non-trivial, stop and fix (likely glyph-seed or QR-matrix parity).**

- [ ] **Step 3: Commit.**

```bash
git add src/routes/test/worker-pictograph/+page.svelte
git commit -m "test(render): full-card-worker parity (vs main, header/footer/QR bands)" -- src/routes/test/worker-pictograph/+page.svelte
```

---

## Task 11: Perf benchmark + flip the gate

**Files:**
- Modify: `src/routes/test/worker-pictograph/+page.svelte`
- Modify: `src/lib/shared/render/services/card-front-worker-pool.ts`

- [ ] **Step 1: Retarget `timeDeck`.** Point the parallel run at `buildFrontJob` + `pool.composeFront` (full-card), keep the same 8-lane shape + warm-up + `{cards, cores, parallelMs, mainMs, speedup}` report. Include a separate `seedMs` (one-time seed cost) in the report so seed vs steady-state is visible.

- [ ] **Step 2: Run it (browser).** Open `http://localhost:5173/test/worker-pictograph`, **Time deck**. Record `{parallelMs, mainMs, speedup, seedMs}`.

- [ ] **Step 3: Decide + flip.** If `speedup ≥ ~1.5` (parallel beats main meaningfully) AND parity (Task 10) passed → set `PARALLEL_FRONT_ENABLED = true` in `card-front-worker-pool.ts`. If not, leave it `false`, paste the numbers into the design doc's results, and report which mitigation to try next (seed cost → cap pool size; or header-glyph parity → hybrid header-on-main). Do NOT flip a slower path.

- [ ] **Step 4: Commit.**

```bash
git add src/routes/test/worker-pictograph/+page.svelte src/lib/shared/render/services/card-front-worker-pool.ts
git commit -m "test(render): full-card deck benchmark; flip PARALLEL_FRONT_ENABLED per result" -- src/routes/test/worker-pictograph/+page.svelte src/lib/shared/render/services/card-front-worker-pool.ts
```

---

## Self-Review

**Spec coverage:** FrontJob (T1), QR-in-worker (T2), glyph decouple+seed (T3), worker painter (T4), env-clean guard (T5), main builder (T6), worker message (T7), pool composeFront (T8), production wiring (T9), parity gate (T10), perf+flip (T11). All design components mapped. ✓

**Placeholder scan:** Tasks 3/4/6 contain `/* ... */` regions for chrome/mandala/QR-placement geometry that must mirror existing code — each is annotated "mirror `image-composer.ts`/`card-front-assembler.ts` exactly, read in Step 1." This is extraction-by-reference (the code exists), not invention. The implementer reads the cited source. Acceptable for an extraction plan; if any region's source can't be found, that's a STOP-and-escalate.

**Type consistency:** `FrontJob`/`FrontJobCell`/`FrontJobMandala`/`FrontJobQr` (T1) consumed identically in T4/T6/T7/T8. `composeFront(job)` (T8) matches the `paint-front`/`front-result` protocol (T7). `SeededGlyphSource`/`GlyphBitmapSeed` (T3) consumed in T4/T7. `drawQrMatrix` (T2) called in T4. `wrapContentInCardFrame` (T9) matches `card-front-frame.ts`. Consistent.

**Risk gates:** T5 locks env-cleanliness; T10 gates parity (header/footer/QR bands); T11 gates the flip on a real speedup. The path ships ONLY if it's both correct and faster.
