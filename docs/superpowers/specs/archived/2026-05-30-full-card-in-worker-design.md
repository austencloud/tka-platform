# Full-Card-In-Worker Front Rendering — Design (2026-05-30)

Supersedes `2026-05-30-parallel-card-front-rendering-design.md` (the cells-only
approach). That approach shipped, was benchmarked at **0.45x (2.2x slower than
main)**, and is now gated off (`PARALLEL_FRONT_ENABLED = false`). This is the
forward design: render the **whole** card front in a worker, one job per card,
so a deck of N cards renders across N cores.

## Why cells-only failed, and why this wins

Measured (this project's own perf probe, warm): per-cell raster is **~13%** of
front render time; **~87%** is assembly (compositing draws, smart borders, QR,
mandala, header glyphs, footer, bg/tint), which the cells-only path left on the
main thread. Cells-only also paid a **per-cell** IPC tax — `JSON` deep-clone of
the prepared data + PNG encode in-worker + `createImageBitmap` decode on main,
once per cell. So it taxed the main thread heavily to offload only the 13%.
Amdahl + IPC ⇒ net loss.

Full-card-in-worker flips both levers:

1. **One job in, one full-card `ImageBitmap` out, per card.** IPC is amortized
   to once per card (not once per cell), and the return is a zero-copy
   transferred bitmap (no PNG encode/decode).
2. **The whole expensive render moves off main** — cells *and* assembly. Main
   keeps only cheap per-card prep (prepare cells, resolve plain inputs) plus a
   once-per-deck seed. A deck of N cards then renders concurrently across the
   pool, bounded by core count.

The serial fraction that caps the speedup (Amdahl) shrinks to: per-card cell
`prepareSingle` (cached/cheap), mandala geometry `calculate` (pure math), QR
shortcode→URL resolution (cheap if precomputed), and the final bleed-frame wrap.
Everything visually expensive is parallel.

## The blocker that killed Approach A — and the exact fix

Approach A crashed in-worker with `reading 'env' at public:1:47` — a transitive
`$env/dynamic/public` import. The full import-tree sweep (this session) found
the worker must never import these **four** module-scope `$app/environment`
offenders:

- `get-glyph-cache.ts`
- `getMandalaGeometryCalculator.ts`
- `pictograph-blob-cache.ts`
- `pictograph-svg-cache.ts`

Everything else in the front pipeline is either **already worker-safe** —
`layer-compositor.ts`, `svg-image-cache.ts`, `svg-asset-loader.ts`,
`cell-border-renderer.ts`, `layout-calculator.ts`, `mandala-renderer.ts`,
`step-number-renderer.ts`, `canvas-2d-direct-renderer.ts` (all proven via the
existing `pictograph-render.worker`) — or **function-scope** store/`$env` reads
that resolve to plain data on the main thread before the worker runs.

**Hard rule for this design:** the worker entry (`paintFrontJob`) and its entire
transitive import graph import ONLY worker-safe modules + types. No `$app`,
`$env`, Firebase, Svelte stores, `window`, or `document`. A build-time guard
enforces it (see Testing).

## Proven foundation (reuse, do not rebuild)

- **`buildBackJob` / `paintBackJob`** (`card-back/`) — the exact template:
  main-thread builder emits a plain-data job; a types-only worker-safe painter
  composites it. `paintBackJob` imports **nothing but types**. The front mirrors
  this, with the difference that the front's painter ALSO runs the cell raster
  (the back pre-rasterizes everything on main; the front rasters cells in-worker
  because that's the CPU work we're parallelizing).
- **`pictograph-render.worker.ts` + `card-asset-bundle.ts`** — proven `seed`
  (transfer decoded SVG `ImageBitmap`s) + in-worker `LayerCompositor.compose`.
  The seed already makes per-cell raster work in-worker at the accepted 0.5% AA
  floor.
- **`card-front-assembler.ts`** — `computeCardFrontLayout`,
  `paintCardFrontBackground`, `buildCellLayerOptions`, `paintCardFrontChrome`.
  Reusable for layout + paint, but `paintCardFrontChrome` currently pulls
  `TextRenderer` (→ `get-glyph-cache` → `$env`); this design decouples that.
- **`wrapContentInCardFrame`** (`card-front-frame.ts`) — the bleed/stripe border
  wrap; stays on main, unchanged.
- **`getCardAssetBundle` / `AssetBundle` / `seedCachesFromBundle`** — extended
  here to also carry header glyph bitmaps.
- **`/test/worker-pictograph`** — the full-card parity + deck-timing harness;
  retargeted from `composeCardFrontParallel` (cells) to the new full-card path.

## Architecture

### `FrontJob` (plain data — structuredClone-able, no class instances)

```
interface FrontJob {
  canvasWidth: number;
  canvasHeight: number;
  layout: CardFrontLayout;            // already plain (numbers + derivedWord)
  cells: Array<{
    prepared: PreparedPictographData; // plain (preparer output)
    col: number; row: number;
    stepNumber: number | undefined;
    duration: number;
  }>;
  cellOptions: LayerRenderOptions;    // plain
  cellVisibility: LayerVisibility;    // plain
  background: { fill: string; accentColor?: string; accentTintOpacity?: number };
  borders: CellBorderSpec;            // inputs drawSmartCellBorders needs (plain)
  mandala: {                          // null when no loopType / disabled
    paths: MandalaPaths;              // plain (SVG path strings + numbers)
    placements: MandalaPlacement[];   // plain
    palette: MandalaPalette;          // color strings
  } | null;
  qr: {                               // null when no empty cell / disabled
    matrixText: string;               // the payload URL (resolved on main)
    cell: { col: number; row: number };
    darkColor: string; lightColor: string;
    eccLevel: "L" | "M" | "Q" | "H";
  } | null;
  header: { word: string; ... } | null;  // word + glyph layout inputs
  footer: {                               // labels/notes/icon + colors
    leftLabel?: string; rightLabel?: string; notes?: string;
    iconPath?: string; show: boolean;
  };
}
```

### Seed (once per deck)

`buildFrontSeedBundle(deckSequences, { bluePropType, redPropType, theme })`
extends the existing `AssetBundle` with **header glyph bitmaps**:

- Existing: every prop/arrow/letter/grid SVG decoded on main → transferable
  `ImageBitmap`s (the proven path).
- New: preload the TKA header glyph images (the set `TextRenderer` would load via
  `get-glyph-cache`) on main, snapshot as `ImageBitmap`s keyed by glyph id.

Seed transfers a structuredClone per lane (each worker needs its own copy;
transfer detaches). Seed cost is one-time per deck and is the main thing to watch
in the perf pass (see Risks).

### `buildFrontJob(sequence, options)` — MAIN, cheap per card

1. Resolve visibility → plain `PictographVisibilityOptions` (deck cards use the
   canonical profile — trivial; the store path is the fallback).
2. Compute layout (`computeCardFrontLayout`).
3. `prepareSingle` each cell (start position + steps) → `PreparedPictographData`
   (cached; the only non-trivial main per-card cost, already paid today).
4. Mandala (if `loopType` + enabled): `getMandalaGeometryCalculator().calculate`
   (pure once past the `$env` guard) → `MandalaPaths`; `getMandalaPlacements`
   (already pure) → placements; palette from constants.
5. QR (if an empty cell exists + enabled): resolve the shortcode→URL on main
   (Firebase, cheap if precomputed for a released deck). Pass the URL string;
   the worker generates the matrix.
6. Assemble the plain `FrontJob`.

### `paintFrontJob(job, seededCaches)` — WORKER, the expensive part, ×N cores

`$env`-clean. Imports ONLY: `LayerCompositor`, `svg-image-cache`,
`svg-asset-loader`, `cell-border-renderer`, `mandala-renderer`, a decoupled text
renderer, `qrcode-generator`, `card-asset-bundle` (seed), types. Steps:

1. `paintCardFrontBackground` (bg + accent tint) on an `OffscreenCanvas`.
2. For each cell: `LayerCompositor.compose(prepared, cellOptions, cellVisibility,
   stepNumber)` against the **seeded** cache → draw at its grid x/y; duration
   badge when `duration !== 1`.
3. `drawSmartCellBorders` (pure).
4. Mandala: `renderMandalaToCanvas(ctx, paths, …)` per placement (Path2D —
   worker-safe), from the passed paths.
5. QR: `qrcode-generator` produces the module matrix from `matrixText`
   (pure, no DOM); draw the modules into the QR cell.
6. Header (TKA glyphs) + footer: render from the **seeded glyph bitmaps** via the
   decoupled text renderer (no `get-glyph-cache`/`$env`).
7. `transferToImageBitmap()` → transfer back to main.

### Pool + wiring

- **`CardFrontWorkerPool`** — replace `composeCell(cell)` with
  `composeFront(job): Promise<ImageBitmap>` (one message per card, transfer the
  bitmap back). Keep `seedForDeck` (extended bundle). Re-enable behind
  `PARALLEL_FRONT_ENABLED` once the new path passes parity + beats main.
- **`pictograph-render.worker.ts`** — add a `paint-front` message →
  `paintFrontJob`; keep `seed`. (Extend, don't fork.)
- **`PrintCardRenderer.renderFront`** — when the pool is ready: `buildFrontJob`
  → `pool.composeFront(job)` → `wrapContentInCardFrame`. Else the current
  main-thread `composeSequenceImage` path (unchanged fallback). Per-card failure
  falls back to main.
- **`PrintPreviewPages.renderAll`** — seed once per deck (already wired; swap to
  the extended seed bundle).

## The `$env` decoupling work (the real risk/effort)

1. **TextRenderer glyph source.** Today `TextRenderer.preloadGlyphImages` →
   `get-glyph-cache` (`$env`). Split: a main-thread preloader produces glyph
   `ImageBitmap`s for the seed; the worker text renderer consumes seeded glyph
   bitmaps and imports no `$env`. Either parameterize `TextRenderer` with an
   injected glyph source, or extract a worker-safe text-render core that
   `TextRenderer` also uses (single source, no drift).
2. **No calculator/cache imports in the worker tree.** `paintFrontJob` must not
   transitively import `getMandalaGeometryCalculator`, `pictograph-blob-cache`,
   or `pictograph-svg-cache`. Mandala arrives as plain paths; cells arrive
   prepared. Audit the import graph.
3. **QR in-worker.** Use `qrcode-generator` (pure; already a transitive dep via
   `qr-code-styling`) for the matrix; draw modules with canvas rects. No
   `QRCodeStyling`/`new Image()` in the worker.

## Parity guarantees

- **Cells** — same `LayerCompositor.compose` as today, seeded cache → the
  accepted 0.5% edge-AA floor.
- **Borders, mandala, bg/tint, footer** — same pure renderers, same inputs →
  pixel-identical.
- **Header glyphs** — must render byte-identical from seeded bitmaps vs the
  main-thread `TextRenderer`. This is the parity risk to gate hardest.
- **QR** — `qrcode-generator` matrix must match the current QR for the same
  payload + ECC. Diff the QR cell region explicitly.
- **Border frame** — `wrapContentInCardFrame` on main, unchanged, identical by
  construction.
- **Gate:** the full-card parity harness diffs the whole card (header band, QR
  cell, footer band, cells). Ships only if header/footer/QR bands are ~0% and
  overall ≤ ~0.5%.

## Error handling / fallback

- Pool not ready / no `OffscreenCanvas` / seed fail → whole render falls back to
  main-thread `composeSequenceImage` (no regression, no Error squares).
- A worker `paint-front` throw/timeout → that card falls back to main.
- `AbortSignal` honored (cancel mid-deck) → reject in-flight card promises.

## Testing

- **Parity:** `/test/worker-pictograph` full-card diff (main vs worker-full),
  with explicit header/footer/QR-band sub-diffs. Header/footer/QR ~0%, overall
  ≤ ~0.5%.
- **`$env`-clean guard:** a test (or build step) that imports the worker entry in
  a non-browser context and asserts it does not pull `$app`/`$env` — fails the
  build if a future edit reintroduces the coupling. (The original crash had no
  guard; this prevents regression.)
- **Perf:** deck wall-time benchmark (parallel vs main, N cards, on the 32-core
  box). Target: parallel materially below main for a cold deck (the cells-only
  path got 0.45x; the bar is ≥ ~1.5–2x to justify shipping). Record the number;
  if it doesn't beat main, do not flip `PARALLEL_FRONT_ENABLED`.
- **Unit:** `FrontJob` build (plain-data shape), QR matrix parity, glyph-seed
  completeness for a deck's letter set.

## Risks

- **Seed cost (per deck).** Extended bundle (assets + glyph bitmaps)
  structuredCloned per lane × ~31 lanes on a 32-core box. If the first deck
  render lags then the rest fly, this is it. Mitigations to evaluate in perf:
  cap pool size, or share via transfer where safe. Measure before optimizing.
- **Header-glyph parity.** In-worker text render must match main exactly. If it
  drifts, fall back to rasterizing the header on main per card (the hybrid path)
  — but that reintroduces a serial fraction, so only as a parity escape hatch.
- **`$env` leak regression.** Any future import into the worker tree can
  reintroduce the crash. The build-time guard is mandatory, not optional.
- **QR matrix parity.** `qrcode-generator` defaults (ECC, mask) must match the
  current `qr-code-styling` output for the same payload. Pin ECC explicitly.

## Out of scope

- Card backs (already fast on main via `paintBackJob`).
- Flipping the global `supportsWorkerRendering()` gate (the card pool keeps its
  own readiness flag).
- WASM SVG rasterizer (unnecessary — seeding works).
- Non-deck single-card render paths (they ride the warm pool opportunistically
  when ready; no dedicated seed).
