# Parallel Card Front Rendering — Design (2026-05-30)

Supersedes the Approach-A portion of
`2026-05-29-worker-pool-card-rendering-design.md` (that file's "Phase 1 OUTCOME"
post-mortem stands as history). This is the forward design, built on a working
proof.

## Goal

Render choreo-card **fronts** across CPU cores so big-deck export (50–100+ cards)
is fast. Backs are already ~52ms warm on the main thread (`paintBackJob`) — **out
of scope**. Full visual parity required; the per-cell worker render is at a 0.5%
edge-AA floor (Austen accepted: "looks great").

## Proven foundation (this session, do not re-litigate)

- Clean worker `pictograph-render.worker.ts` renders a real pictograph at **0.516%**
  vs the main-thread `LayerCompositor` (`/test/worker-pictograph`). It imports only
  `LayerCompositor` + `card-asset-bundle` → **`$env`-clean** (the Approach-A crash
  came from running full `image-composer` in-worker).
- **Seeding** is the unlock: main thread decodes every prop/arrow/letter/turn/grid
  SVG (`getCardAssetBundle` warm pass, HTMLImageElement decode), snapshots them as
  transferable `ImageBitmap`s (`AssetBundle`), and seeds the worker's singleton
  `svgCache` + `svgAssetLoader`. The worker then **never** calls the broken
  in-worker `createImageBitmap(svgBlob)` — the one foundational wall behind every
  prior gate.
- **Measurement** (32-core): front render is **COMPOSITE-BOUND**. Cold 8 cards =
  315ms total, decode 18% / composite-minus-decode 28% / assemble 54%; warm =
  composite 13% / assemble 87%. The parallelizable hot part is per-cell raster;
  decode is small and main-thread-locked. → a worker pool is the correct lever.

## Architecture

**Main thread owns layout + assembly. Workers own per-cell pictograph raster.**
The header (TKA glyphs), footer, background, accent tint, borders, mandala, QR,
and duration badges are NOT touched by workers — they render on the main thread
through the exact same code as today, so they are pixel-identical by construction.

### Per deck (once)
1. `getCardAssetBundle(deckSequences, {bluePropType, redPropType, theme})` → one
   `AssetBundle`.
2. Seed every pool worker with it (transfer the bitmaps).

### Per card front
3. **Layout** — compute columns/rows/stepSize/grid offsets/header+footer heights.
   Reuses the exact math currently inline in `composeSequenceImage` (extracted, see
   Components §1).
4. **Prepare** — `pictographPreparer.prepareSingle` each cell (start position +
   each step), on the main thread (cheap, cached) → `PreparedPictographData[]`,
   with the per-cell `stepNumber` (0 = "Start", 1..n) so the worker bakes the step
   number into the cell exactly as `LayerCompositor.compose` does today.
5. **Fan out** — dispatch each cell's `compose(prepared, options, visibility,
   stepNumber)` to the worker pool (round-robin), collect cell bitmaps. This is the
   only parallelized step.
6. **Assemble** (main) — the shared assembler draws: bg + accent tint → composites
   each cell bitmap at its grid x/y → duration badges → smart cell borders →
   mandala → QR → `renderWordHeader` (TKA glyphs) → `renderUserInfo` (footer).
7. **Bleed wrap** — `PrintCardRenderer.renderFront` wraps the content canvas in the
   stripe/glow/bleed card frame (unchanged).

## Components

1. **Shared front assembler + layout (extract, NEW `card-front-assembler.ts`).**
   The non-cell parts of `composeSequenceImage` are extracted into shared,
   single-source helpers so the main-only path and the worker-assisted path cannot
   drift:
   - `computeCardFrontLayout(sequence, options, visibility)` → columns, rows,
     stepSize, canvas W/H, header/footer heights, grid offsets, derived word,
     loop-component resolution.
   - `assembleCardFront(canvas, layout, cellBitmaps, sequence, options, visibility)`
     → bg/tint, cell composite, duration badges, borders, mandala, QR, header,
     footer.
   `composeSequenceImage` is **refactored to call these** for its non-cell work
   (rendering cells inline as today), so there is exactly ONE implementation of the
   header/footer/bg/border/mandala logic. **`composeSequenceImage`'s public
   behavior and signature stay identical** — it is the main-thread fallback and is
   used app-wide beyond cards; its output must remain byte-identical (verified by
   the existing full-card parity diff).
   - Risk control: this is the highest-risk task. It is a pure extraction (move
     code, no logic change). The full-card parity harness gates it: refactored
     `composeSequenceImage` vs pre-refactor output must be 0%.

2. **Seeded worker pool (extend `WorkerRenderPool`).** Add: a `seed(bundle)` that
   posts the bundle to every worker and awaits `seed-done`; a `composeCell(prepared,
   options, visibility, stepNumber)` returning a cell `ImageBitmap`; round-robin
   dispatch (already present). Do **not** flip the global
   `supportsWorkerRendering()` gate (other call sites depend on it) — gate the card
   pool on its own readiness flag (workers booted + seeded). Pool size =
   `max(1, hardwareConcurrency - 1)`.

3. **`composeCardFrontParallel(sequence, options, pool)` (NEW).** Orchestrates
   steps 3–6: layout → prepare cells → fan out to pool → `assembleCardFront`.
   Returns a `RenderCanvas` matching `composeSequenceImage`'s output contract.

4. **`PrintCardRenderer.renderFront` branch.** If a seeded card pool is available,
   call `composeCardFrontParallel`; else the current `composeSequenceImage` path.
   Identical bleed-wrap afterward.

5. **Deck export wiring (`PrintPreviewPages` / deck export entry).** Build the
   AssetBundle + seed the pool once before iterating the deck; tear down after.

## Parity guarantees

- **Header (TKA glyphs), footer, bg, tint, borders, mandala, QR, badges** — main
  thread, same code as production (single shared assembler) → pixel-identical.
- **Cells** — worker `LayerCompositor.compose`, 0.5% edge-AA floor (accepted).
- **Gate:** full-card parity harness diffs the whole card (header + footer + cells),
  not a single cell. Header region must be ~0%; overall worst ~0.5%. Ships only if
  it passes.

## Error handling / fallback

- Worker `compose` failure or timeout → fall back to main-thread
  `LayerCompositor.compose` for that cell (no red Error square).
- Pool boot fail / no `OffscreenCanvas` / seed fail → whole render falls back to
  main-thread `composeSequenceImage`.
- `AbortSignal` honored (cancel mid-deck) — reject in-flight cell promises.

## Testing

- **Parity:** extend the harness to a full-card front diff (main vs parallel),
  header included. Worst ~0.5%, header ~0%.
- **Refactor safety:** `composeSequenceImage` post-extraction vs pre-extraction =
  0% across the representative deck.
- **Perf:** deck of N cards, parallel vs main wall-time on 32 cores; report
  speedup.
- **Fallback:** force a worker error → card still renders correct via main thread.

## Out of scope

- Card backs (already fast).
- Flipping the global `supportsWorkerRendering()` gate.
- WASM SVG rasterizer (unnecessary — composite-bound; seeding works).
- Removing the spike code (`/test/worker-pictograph`, `__render-perf-probe`,
  parity Measure button) — cleaned up in the final task.
