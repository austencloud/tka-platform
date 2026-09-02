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

- `engine`: `computeEngineAlignedMandalaScale(size)`, the live overlay's own
  transform. Tiles, headers, and the hero floor all use it (revised in the
  parity follow-up, below), so every still is the live canvas at another size.
- `extent`: whole mandala fills the box (the standalone rule
  `resolveMandalaRenderExtent` already used). Kept for surfaces that are not
  morph endpoints.

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

Revised after the first ship (Austen: "very obviously different mandalas ...
not in the exact same position ... the animation overshoots"). Three things
made the moving element not one picture:

1. **Fits differed.** Tiles used `extent`, the hero used `engine`. The
   shared-element morph's default old/new crossfade blended two drawings of
   different scale. Now `renderCell` and `renderHeader` paint at `engine`
   fit too, so the morph is a uniform scale and translate of one picture.
2. **The hero's square was not the canvas's square.** The player rendered
   its word header inside the frame, so the live canvas letterboxed beneath a
   ~53px band while `MandalaHeroLayer` centered on the whole frame. The
   drill now passes `showWordHeader: false` and renders the shared
   `WordHeader` in a drill-owned band above `.hero-frame` (grid rows
   `auto minmax(0, 1fr)`), with a hidden one-letter ghost header holding the
   band's height before a realization exists. The frame is the canvas
   region, so the floor's inscribed square is the canvas's inscribed square,
   and the header still follows the visibility manager's `wordHeader` and
   dark-mode settings and the visible step number.
3. **Overshoot.** The group animation used `--ease-spring`. It now uses
   `--ease-in-out`; the picture settles onto the square the live canvas
   paints in.

The return trip is the same element: the hero claims the name while the
detail view is active, the selected tile claims it in matrix view, and both
draw the identical engine-fit picture, so going back is the same mandala
travelling back.

Two more things held the second ship back, both about WHEN the browser
captures the new state. Both compact panes stay mounted and the destination
pane sits at 0px until the view flips inside the transition's update
callback. Rendering is suppressed there, so anything sized by a
ResizeObserver (`bind:clientWidth`, a measured square) still describes the
collapsed pane at capture time: the forward morph was captured to a 0x0
endpoint and the return trip landed on a 55px tile that then grew to 65px.

4. **Endpoints are container math, not measurements.** The hero square is
   `min(100cqw, 100cqh)` of its layer and the grid tile is
   `round(down, clamp(44px, min(100cqw / cols, 100cqh / rows), max), 1px)`
   of `.wrap`, both with `container-type: size`. Those are right in the same
   layout pass that sizes the pane. The raster inside each still measures
   itself, so `startMorph` takes a `settle` step that the mandala morph uses
   to re-measure every art instance synchronously
   (`registerMandalaArtMeasurer` / `measureMandalaArt`), flush, and await
   `img.decode()` before the capture.
5. **The player mounts after the morph.** Its module load and engine
   construction ran between the update callback and the new-state capture
   and held the morph back by about a second. The drill's player `LazyMount`
   is `active={!mandalaTransition.handoff}`; keep-alive holds it through
   later handoffs. Measured at 375x667: ready 121ms after the tap (was
   1064ms), forward `64.656px @ (156, 470.7)` to `228.375px @ (73.3,
   342.7)`, back `227.875px @ (74, 343.3)` to `64.656px @ (156, 470.7)`,
   tile after the trip 66px at (155, 470).

6. **The whole rectangle flies, and the tiles keep their size.** The third
   review asked for the clicked square to become the animation canvas, not
   just the mandala inside it, and rejected the smaller tiles the engine fit
   had produced. Two nested shared elements now travel: `button.cell` and
   `.hero-stage` share `shape-matrix-active-stage`, and inside each the tile
   art and the hero's `.mandala-extent` box share `shape-matrix-active-mandala`.
   A named descendant is cut out of its ancestor's snapshot, so the stage
   group is the frame and the mandala group is the drawing, painted in DOM
   order. Tiles are back on the `extent` fit (`renderExtentFit`), and the hero
   floor sits in a box scaled by `engineExtentBoxRatio(paths, tipDx)` so the
   extent-fit picture lands exactly where the engine draws it (ratio 0.611 for
   the reviewed pair). The live player is `visibility: hidden` while its pair
   key differs or the handoff runs, so no stale canvas shows under the
   arriving frame. Measured at 375x667: stage `66x66 @ (145.3, 470)` to
   `343.2x271.4 @ (11.3, 300)`, mandala `64.66px @ (146, 470.7)` to
   `140.27px @ (112.7, 386.7)`, landing art inside the stage; back trip
   returns to `66px @ (145.3, 470)`.

Both endpoints are now the same painter's output. The View Transition morphs
one drawing between two positions and sizes; the only remaining change across
the morph is the tile's full opacity easing to the floor's 0.55.

## Compact detail header

The same review rejected the compact detail chrome: a bottom drawer of
full-width segmented controls for turns, an "Element relationships" button
alone on a second row, and that button's back arrow reading like the Matrix
button. The compact detail view now has one chrome row:

- `← Matrix` stays the only arrow. The relationships toggle keeps the shapes
  glyph in every layout.
- The turn chip (`L2 2 · 2`) opens `ShapeMatrixTurnPopover`, a bits-ui popover
  anchored under the chip and sized `max-content` to the notation and turn
  controls. The tray layout of `ShapeMatrixTurnControls` sizes to content
  instead of stretching to the drawer.
- The shell owns `createShapeMatrixAnimationState()` and its scope contexts,
  so the topbar can show a `Relationships` pill only while a control section
  covers the relationships (it is the way back; it has nothing to do
  otherwise). Under 30rem it drops the word and keeps the glyph plus its
  aria-label so the chip beside it never clips. The detail pane hides its
  heading in compact and renders it unchanged in wide layouts.

## Tests

- `tests/unit/mandala-guide-painter.test.ts` — transform, constant stroke,
  reveal dash vs complete guide, overlap only with both hands, mask reuse.
- `tests/unit/shape-matrix/shape-matrix-render.test.ts` — animator colors and
  stroke, exact DPR rasters, extent fit, engine fit, empty box.
- `tests/unit/shape-matrix/shape-matrix-mandala-continuity-contract.test.ts` —
  one painter across overlay and stills; no align scale or glow on the hero;
  the shared floor opacity in both the drill and the render loop; the nested
  stage and mandala names; the offstage player; the popover and one-row
  compact header.
- `tests/unit/mandala-overlay-guide-crossfade.test.ts` — unchanged, proves the
  overlay's behavior survived the extraction.

## Not in scope

- The pre-existing 1–2 s compact pane-switch stall (task chip spawned in the
  continuity session).
- The poi painter's look.
