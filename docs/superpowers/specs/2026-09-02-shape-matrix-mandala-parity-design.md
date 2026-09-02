# Shape Matrix Mandala Parity — Design

**Date:** 2026-09-02
**Status:** Implemented (branch `claude/shape-matrix-mandala-parity`)
**Follows:** `2026-09-02-shape-matrix-mandala-continuity-handoff.md`

## The ask

Austen, after the continuity handoff shipped: the still hero floor "sort of
kind of works but it's definitely getting replaced by the mandala that we
have in the animation canvas." He wants the exact same mandala in the matrix
tile, the detail hero floor, and the animation canvas, so that it only ever
moves between places, with a transition and no visible swap. Matrix tiles may
adopt the animator's look ("I already think they have that look anyway").

## What was actually wrong

Geometry was already shared (`MandalaPaths`) and the hero was already
engine-aligned. The "replaced" feel came from two renderers of the same
paths:

| | SVG stills (tiles, hero) | Animator guide overlay |
| --- | --- | --- |
| Colors | `#818cf8` / `#f87171` | motion blue `#3575E2` / red `#ED1C24` |
| Stroke | 2.4 viewbox units, scaled with the image | 2.5 CSS px, constant |
| Overlap | precomputed purple path | mask-intersected purple, alpha 0.9 |
| Opacity | 1 (plus a drop-shadow glow) | 0.55 |
| Hero fit | tile raster scaled by CSS `alignScale` | painted at engine scale |

A View Transition interpolates snapshots. Two different drawings of the same
shape morph as a crossfade, not as one object moving.

## Design: one painter, the animator's

`src/lib/shared/mandala/services/mandala-guide-painter.ts` now owns the
stroke-and-overlap routine that used to live privately inside
`MandalaOverlayCanvas` (`paintMandalaGuide`, `MandalaOverlapMasks`). The live
overlay calls it every frame. A new
`mandala-guide-image.ts` (`renderMandalaGuideImage`) calls the same painter
into a throwaway canvas and returns a data URL, with two fits:

- `extent`: whole mandala fills the box (tiles and headers; the standalone
  rule `resolveMandalaRenderExtent` already used).
- `engine`: `computeEngineAlignedMandalaScale(size)`, the live overlay's own
  transform (hero floor).

`shape-matrix-render.ts` routes `renderCell` / `renderHeader` through it and
adds `renderEngineAligned`. Colors come from `HERO_TRAIL_PRESET` — the preset
the detail animator plays — and stroke from
`DEFAULT_MANDALA_OVERLAY_CONFIG.strokeWidth`, so parity is by data, not by
matching numbers in two files. `shape-matrix-poi-render.ts` keeps its own
light-trail look; it is an intentionally different painter behind the same
`ShapeMatrixArtworkPainter` seam.

### Exact-size rasters

A guide is a constant 2.5 CSS px stroke, so a still cannot be one scale-free
image stretched to each box. `ShapeMatrixMandalaArt` now measures its own
square (ResizeObserver) and asks a `paint(sizePx)` seam for an image at that
size; `shape-matrix-artwork.ts` caches per (painter, identity, size, DPR)
behind a 512-entry LRU. A change of `artKey` (different flower or pair)
crossfades through the shared `Crossfade`; a resize repaints in place.

### Hero floor

`MandalaHeroLayer` paints at engine alignment for the animator's square, so
the CSS `alignScale` transform (`mandala-hero.ts`, now deleted) and the
drop-shadow glow are gone. The floor sits at the shared
`MANDALA_GUIDE_FLOOR_OPACITY` (0.55), which `MANDALA_GUIDE_CONFIG` in the
render loop now also reads, so when the live canvas takes over from the floor
nothing on screen changes. Disassembled split canvases use the live overlay
already and inherit parity for free.

### Tile → hero morph

Both endpoints are now the same painter's output. The View Transition morphs
one drawing between two positions and sizes; the only remaining change across
the morph is the tile's full opacity easing to the floor's 0.55.

## Tests

- `tests/unit/mandala-guide-painter.test.ts` — transform, constant stroke,
  reveal dash vs complete guide, overlap only with both hands, mask reuse.
- `tests/unit/shape-matrix/shape-matrix-render.test.ts` — animator colors and
  stroke, exact DPR rasters, extent fit, engine fit, empty box.
- `tests/unit/shape-matrix/shape-matrix-mandala-continuity-contract.test.ts` —
  one painter across overlay and stills; no align scale or glow on the hero;
  the shared floor opacity in both the drill and the render loop.
- `tests/unit/mandala-overlay-guide-crossfade.test.ts` — unchanged, proves the
  overlay's behavior survived the extraction.

## Not in scope

- The pre-existing 1–2 s compact pane-switch stall (task chip spawned in the
  continuity session).
- The poi painter's look.
