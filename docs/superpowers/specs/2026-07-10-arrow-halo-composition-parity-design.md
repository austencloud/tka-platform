# Arrow Halo — Composition Pipeline Parity

**Date:** 2026-07-10
**Status:** Design approved

## Problem

Arrows in a pictograph frequently overlay the same visual space a prop occupies.
The live interactive renderer separates them with a subtle background-matching
halo — three stacked `drop-shadow(0 0 2px …)` CSS filters on the arrow group —
so the arrow reads as floating above the prop. This shipped and looks great.

The halo lives ONLY in `ArrowSvg.svelte` as a CSS `filter`. The image
composition pipeline (`Canvas2DDirectRenderer.drawArrows`) draws the raw arrow
SVG straight to canvas via `drawElementWithTransform` and never sees the CSS
filter. Exported cards, sequence images, and thumbnails therefore render arrows
with no halo — arrows visually merge into same-colored props.

## Goal

The halo renders identically in the live pictograph and in every composed image.
**One halo definition**, consumed by both paths. No divergence to hand-sync.

## Canonical rendering paths (verified)

- **Live:** `ArrowSvg.svelte` → CSS `filter` on the arrow `<g>`.
- **Composition:** `CompositionDispatcher` → composition worker →
  `Canvas2DDirectRenderer` (confirmed the shipping renderer; `render-factory`
  and `composition.worker.ts` both instantiate `Canvas2DDirectRenderer`). Arrows
  drawn in `drawArrows` → `wrapSvgContent` → `SvgImageCache.getImage` →
  `ctx.drawImage`.
- **SVG → drawable rasterization** (`svg-image-cache.ts`):
  - Main thread: `HTMLImageElement` decode → SVG `<filter>` renders fully.
  - Worker: `createImageBitmap(blob)` (no DOM). Chromium rasterizes SVG filters
    on this path, but the codebase flags worker SVG decode as finicky. This is a
    verification point, not a blocker — see Risks.

## Approach — bake an SVG `<filter>`, shared by both paths

Chosen over canvas-only `ctx.filter` (would keep two definitions in sync by hand)
and export-only baking (still two definitions). The baked SVG filter is
resolution-independent, lives in one place, and is the same markup both paths
apply.

### Parity math (why one `stdDeviation` matches both)

The arrow's path content is authored in arrow-intrinsic units. In the live path
those units map 1:1 into the 950-unit pictograph space (the arrow content sits
inside `<g transform="translate(-center)">` with no scaling — only translate /
rotate / mirror, all blur-symmetric). In the export path `wrapSvgContent` gives
the arrow its own viewBox in those same intrinsic units, then `drawArrows` scales
the whole thing by `size / 950`. Both paths therefore scale the filter by the
same `renderSize / 950` factor. A single `stdDeviation` expressed in
arrow-intrinsic units yields an identical blur in both. The value is tuned once
to match today's `drop-shadow(0 0 2px)×3` at a representative render size and
verified side-by-side.

## Components

### New — `src/lib/shared/pictograph/arrow/rendering/arrow-halo.ts`

Single source of truth for the halo:

- `HALO_STD_DEVIATION: number` — blur std deviation in arrow-intrinsic units,
  tuned to match the current CSS halo. Starting point ~ the intrinsic-unit
  equivalent of `2px`; final value set empirically on `/test/arrow-rotation`.
- `haloColor(isDarkMode: boolean): string` — `#0a0a0f` (dark) / `white` (light).
  Matches the pictograph background so the halo is invisible against the
  background and only shows as a clean gap where the arrow overlaps a prop.
- `buildArrowHaloFilter(id: string, isDarkMode: boolean): string` — returns
  `<filter id=…>` markup: three chained `feDropShadow` primitives
  (`dx=0 dy=0 stdDeviation=HALO_STD_DEVIATION flood-color=haloColor`),
  reproducing the compounding triple-shadow. Explicit generous filter region
  (`x=-20% y=-20% width=140% height=140%`) so the blur never clips.
- `haloCanvasFilter(isDarkMode: boolean): string` — a `ctx.filter` string built
  from the same constants. FALLBACK ONLY: used if worker verification shows the
  baked SVG filter does not rasterize in-worker. Keeps values single-sourced even
  if the mechanism must differ.

### Live — `ArrowSvg.svelte`

- Remove the CSS `haloFilter` derivation and the inline `filter: ${haloFilter}`.
- Emit `<defs>{@html buildArrowHaloFilter(haloId, isDarkMode)}</defs>` and set
  `filter="url(#haloId)"` on the arrow **content** group (the inner
  `translate(-center)` group — arrow-intrinsic units, so `stdDeviation` matches
  export).
- Suppress the halo when `isSelected` (unchanged behavior — selection swaps to
  the accent glow).
- `haloId` unique per component instance (module-level counter) to avoid
  duplicate SVG filter ids when multiple arrows / pictographs share a document.
- Hover / active / selected accent glows remain outer-`<g>` CSS filters —
  untouched.

### Export — `canvas-2d-transform-helper.ts` + `Canvas2DDirectRenderer.drawArrows`

- `wrapSvgContent` gains an optional halo parameter (id + isDarkMode, or a
  prebuilt filter markup + application flag). When present AND wrapping an arrow,
  it injects `<defs>` with the filter and wraps inner content in
  `<g filter="url(#id)">`. Props never pass it — no prop halo.
- `drawArrows` threads `options.visibility.darkMode` (the same effective
  `isDarkMode` the renderer already uses for the background fill, so halo color
  matches the composed background by construction, including print mode which
  resolves to light) into the wrap.
- The draw call itself (`drawElementWithTransform` → `ctx.drawImage`) is
  unchanged — the filter travels inside the wrapped SVG.

## Data flow

Live: `ArrowSvg` builds filter markup from `isDarkMode` → applies to content
group → browser renders halo.

Export: `drawArrows` resolves `isDarkMode` → `wrapSvgContent` injects the same
filter markup → `SvgImageCache` rasterizes the filtered SVG → `ctx.drawImage`.

## Error handling / edge cases

- **Worker SVG-filter rasterization** — verify a real worker-composed export
  shows the halo. If not, switch the export application to `haloCanvasFilter`
  (`ctx.filter` set around `drawImage` in `drawArrows`, restored after), driven
  by the same constants. Same look, guaranteed rasterization.
- **Filter clipping** — explicit `-20% … 140%` filter region plus
  `wrapSvgContent`'s existing 15% arrow viewBox expansion give ample room for the
  small blur.
- **Shaft/tip split render** (`renderPart`) — each rendered part carries the
  filter, matching today's per-instance CSS behavior; no regression.
- **Selection** — export is never selected, so it always shows the halo; live
  keeps the selected-suppresses-halo rule.

## Scope

Files: `arrow-halo.ts` (new), `ArrowSvg.svelte`, `canvas-2d-transform-helper.ts`,
`canvas-2d-direct-renderer.ts` (thread `isDarkMode`). No prop halo. No live
behavior change beyond the filter mechanism swap (CSS → baked SVG filter).

## Verification

- `/test/arrow-rotation` (live) before/after — halo visually unchanged.
- A real card export and a real sequence-image export — arrow now shows the halo
  over same-colored props, matching the live look.
- `npm run check` green.
