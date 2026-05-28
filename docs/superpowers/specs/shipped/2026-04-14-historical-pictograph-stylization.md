# Historical Pictograph Stylization — Canonical Render + Per-Era Post-Process

**Status:** draft
**Date:** 2026-04-14
**Scope:** Retro Labs → Pictograph History tab (10 era renderers)

## Problem

The History Lab renders every TKA pictograph across 10 historical eras (cave
painting through 1976 line printer). Each era is a hand-coded canvas scene.
We just refactored all 10 eras to consume `PictographData` via postMessage so
they draw the current pictograph instead of a hardcoded Letter A.

That refactor exposed a deeper problem: arrow variation space is enormous and
only partially handled. Each era would need to correctly draw, in its own
aesthetic:

- Pro vs anti (same hand path, different prop rotation — must be visually
  distinct)
- Turns indicators (0, 0.5, 1, 1.5, 2, 2.5, 3 per hand)
- Dash motions (straight through/across the grid)
- Hash motions (shortened dash to/from center)
- Float motions (45° micro-arcs at L7)
- Skew variants (`+` extended, `-` shortened)
- Interradial arrow sub-locations (45° offsets)
- Grid-mode variants (diamond vs box)

Reimplementing all of that in 10 eras is wrong. The canonical renderer
(`Canvas2DDirectRenderer`, already used by `SvgToBrailleConverter`) handles
all of it correctly. We should render the pictograph core once, then
stylize it per era.

## Goal

Render every TKA pictograph across 10 eras with **correct motion semantics
inherited from the canonical renderer** while **preserving each era's unique
artistic voice** in its chrome (borders, texture, ornamentation, palette).

## Non-goals

- Not replacing `Canvas2DDirectRenderer`. It stays the single source of
  truth for pictograph geometry.
- Not touching the other TKA rendering paths (sequence cards, 3D, exports).
- Not building a new palette-matching system for color-accurate era
  reproduction. Simple three-class pixel classification (blue / red /
  structural) is enough.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PictographHistoryLab.svelte  (parent)                      │
│                                                             │
│   PictographData                                            │
│        ↓                                                    │
│   canvas2DRenderer.renderPictograph(prepared, {size: 500})  │
│        ↓                                                    │
│   HTMLCanvasElement → createImageBitmap()                   │
│        ↓                                                    │
│   postMessage({type, data, canonical: ImageBitmap}, *, [bitmap])
└─────────────────────────────────────────────────────────────┘
               ↓ (to each of 10 iframes)
┌──────────────────────────────────────────────────┐
│  era.html  (iframe)                              │
│                                                  │
│   Background + chrome + border + texture         │ ← unchanged
│        ↓                                         │
│   PictographStylize.recolor(canonical, palette)  │ ← new shared helper
│        ↓                                         │
│   PictographStylize.edgeTreatment(cvs, preset)   │ ← new (optional)
│        ↓                                         │
│   ctx.drawImage(styledCanvas, cx, cy, d, d)      │
│        ↓                                         │
│   Letter glyph + decorations (handprint,         │ ← unchanged
│   hanko seal, cartouche, title block, etc.)      │
└──────────────────────────────────────────────────┘
```

The canonical bitmap IS the pictograph. Staves, arrows, grid dots,
turns indicators, arrow rotation adjustments, hand positions — all come
from the canonical render. Each era only supplies:

1. Its background and chrome (everything OUTSIDE the pictograph area)
2. Its palette for blue / red / structural pixels
3. Its edge treatment (pigment wobble, tessera quantize, halftone, etc.)
4. Its letter glyph (per-era artistic rendering of the letter)

## Data flow

### Parent side (PictographHistoryLab.svelte)

```ts
import { container } from "$lib/shared/di";

const canvas2D = container.items.canvas2DRenderer as IDirectRenderer;
const preparer = container.items.pictographPreparer as IPictographPreparer;

async function buildCanonical(p: PictographData): Promise<ImageBitmap> {
  await canvas2D.initialize();
  const prepared = await preparer.prepareSingle(p, { themeMode: "dark" });
  const cvs = await canvas2D.renderPictograph(prepared, {
    size: CANONICAL_SIZE,
    visibility: {
      showTKA:            false, // era draws its own letter glyph
      showTND:            false,
      showElemental:      false,
      showPositions:      false,
      showReversals:      false,
      showNonRadialPoints: true,  // need all grid dots for staff anchoring
      darkMode:           true,
    },
  });
  return await createImageBitmap(cvs);
}
```

`CANONICAL_SIZE = 500` (matches era canvases). Single render per navigation,
then the bitmap is transferred to 10 iframes.

### postMessage contract

Extends the existing `pictograph` message:

```ts
interface PictographPayload {
  type: "pictograph";
  data: RetroPictographData;
  canonical: ImageBitmap;     // transferred, zero-copy
  canonicalSize: number;      // in pixels (square)
}
```

The parent uses the transfer list to hand off the bitmap:

```ts
iframe.contentWindow.postMessage(
  { type: "pictograph", data, canonical, canonicalSize },
  "*",
  [canonical],
);
```

One bitmap PER iframe per navigation. The browser clones when transferring
to multiple targets (or we `createImageBitmap` fresh per iframe — TBD in
implementation).

### Iframe side (bridge extension)

```js
PictographBridge.onPictograph(function(data, canonical, meta) {
  // canonical: ImageBitmap | null (null if initial default render)
  // meta: { canonicalSize: number } | null
  render(data, canonical, meta);
});
```

Backwards compat: eras that don't want canonical can ignore the extra
arguments. `canonical` may be null on first render (before parent has
produced a bitmap).

## Shared helper: `_shared/pictograph-stylize.js`

New file. Exposes `window.PictographStylize`.

```js
/**
 * Paint the canonical pictograph bitmap onto a working canvas, remap
 * color classes to the era palette, optionally apply an edge treatment,
 * and return the result.
 */
function recolor(sourceBitmap, palette, size) {
  // palette = { blue: hex, red: hex, structural: hex, bg: hex | null }
  //
  // Pixel classification (reuse SvgToBrailleConverter logic):
  //   1. alpha < 30 or brightness < 60 → "bg" (skip or fill)
  //   2. b > r * 1.4 && b > g * 1.4 → "blue"
  //   3. r > g * 1.4 && r > b * 1.4 → "red"
  //   4. else → "structural" (grid, text, white/grey)
  //
  // For each class, tint the pixel by multiplying its luminance against
  // the target hex. This preserves anti-aliasing edges.
  //
  // Returns HTMLCanvasElement.
}

function edgeTreatment(canvas, preset, rng) {
  // preset:
  //   "pigment"    — jitter edges ±2px with opacity noise (cave painting)
  //   "flat"       — harden edges, collapse anti-aliasing to binary
  //   "quantize"   — snap alpha+color to nearest tile-grid cell
  //   "halftone"   — dot-pattern dither at configurable cell size
  //   "sepia"      — soft cross-hatch noise overlay
  //   "blueprint"  — invert + clip to two-tone cyanotype
  //   "ascii"      — downsample to character cells (returns lines[] not canvas)
}

window.PictographStylize = { recolor, edgeTreatment };
```

Each era calls `recolor` with its palette, then `edgeTreatment` with its
preset, then draws the result onto its scene.

## Per-era palette & treatment

| Era | Blue → | Red → | Structural → | Edge treatment |
|---|---|---|---|---|
| Cave painting | `#1e1a2e` (charcoal) | `#8a3a1a` (iron oxide) | `#3a2a18` (dark ochre) | pigment |
| Egyptian | `#2E5090` (lapis) | `#C13B2A` (vermillion) | `#1A0F00` (black) | flat |
| Greek mosaic | `#304a6a` (tesserae-blue) | `#8a3020` (tesserae-red) | `#e8d7a8` (cream grout) | quantize (9px) |
| Medieval | `#1B3A8A` (ultramarine) | `#A8162A` (crimson lake) | `#6B4A1A` (ink) | soft gold highlight pass |
| Renaissance | `#2A3258` (iron gall) | `#6A2A18` (sepia) | `#5A4028` (pencil) | sepia |
| Japanese woodblock | `#1E3A6A` (indigo) | `#B82410` (sumi red) | `#1A0F08` (sumi black) | flat + grain |
| Blueprint | `#A0D0FF` (light cyan) | `#A0D0FF` (unified cyan) | `#A0D0FF` | blueprint (invert+clip) |
| Art deco | `#1A6FFF` (electric blue) | `#CC1530` (ruby) | `#D4AF37` (gold) | flat |
| Bauhaus | `#0046D4` (primary blue) | `#D0282C` (primary red) | `#0A0A0A` (black) | flat + hard threshold |
| Line printer | N/A | N/A | `#33AA55` | ascii (returns text) |

Blueprint and line printer are special: blueprint collapses all lines to
cyan; line printer converts raster → ASCII character grid (same pipeline
as `SvgToBrailleConverter` but with printer-style characters).

## Composite placement

The canonical bitmap is 500×500 px. Each era's canvas is 500×500 px.
Center-composite the styled bitmap at the era's (CX, CY) sized to (2R, 2R)
where R is the era's grid radius.

```js
const diameter = R * 2 * CANONICAL_SCALE; // tuneable per era
ctx.drawImage(
  styledCanvas,
  CX - diameter / 2, CY - diameter / 2,
  diameter, diameter,
);
```

For eras whose grid center is offset (egyptian GCY=268, bauhaus CX=210,
CY=240, blueprint CY=230), the composite respects the offset.

## Migration plan

Per-era refactor (~20-30 min each):

1. Extend `PictographBridge.onPictograph` signature to accept `(data, canonical, meta)`
2. Inside `render(data, canonical, meta)`:
   - Keep all background/border/chrome/texture code
   - Delete `drawArrowForHand`, `drawStaffForHand`, grid-dot rendering
   - Add `PictographStylize.recolor(canonical, ERA_PALETTE)` → styled
   - Add `PictographStylize.edgeTreatment(styled, ERA_TREATMENT)` (if era has one)
   - Composite onto the scene at (CX, CY, 2R)
   - Keep letter glyph code (era-specific)
3. The existing `drawArrowForHand` / `drawStaffForHand` helpers get deleted
4. Helpers in `_shared/pictograph-geometry.js` may still be useful for chrome
   positioning (e.g. egyptian's hand-profile at endLocation). Keep the module.

First prototype: cave painting. If the approach reads aesthetically, roll
out to the other 9 via parallel sub-agent refactors.

## Rollback

Each era independently opts in. An era that doesn't want canonical
compositing can ignore the `canonical` argument and keep its current
`drawArrowForHand` / `drawStaffForHand` code. The shared helpers and
postMessage contract support both paths simultaneously.

Cave painting proves the pattern; if it fails aesthetically, we can:
- Revert cave painting to the data-driven rendering it currently has
- Leave the canonical pipeline built but unused
- Iterate on the stylization helper independently

## Performance targets

Per navigation:
- `buildCanonical`: target < 20ms (one `renderPictograph` call at 500px)
- `createImageBitmap`: < 5ms
- postMessage broadcast to 10 iframes: < 10ms
- Per iframe stylize + composite: < 10ms (pixel-pass on 500×500 = 250k pixels)

Total: < 50ms end-to-end on a mid-range machine. Navigation should feel
instant.

## Acceptance criteria

1. Lab produces a canonical ImageBitmap per pictograph and broadcasts to
   all era iframes.
2. Cave painting prototype shows:
   - Letter A (pro): arrows curve through NW (blue) and SE (red) as before
   - Letter B (anti, W→N / E→S): arrows visually **distinct from Letter A**
     because the canonical renderer draws anti-arrows differently from pro
   - All cave painting chrome (stone wall, handprint, vignette) unchanged
   - Color remap produces charcoal + iron oxide staves and arcs (not the
     modern blue/red)
   - Pigment edge treatment preserves the hand-drawn feel
3. Turns indicators appear correctly on letters with turns > 0 (no
   per-era work required)
4. Dash motions render as straight lines through the grid with correct
   arrowheads
5. No console errors
6. `npx svelte-check` passes
7. Navigation between pictographs feels instant (< 50ms)

## Open questions

- **Multiple iframes + single ImageBitmap**: does postMessage clone when
  transferring to multiple windows, or do we need to `createImageBitmap`
  per iframe? Test during prototype; fall back to per-iframe creation if
  needed.
- **Blueprint era**: canonical render → blueprint cyan is a dramatic
  inversion. May need a custom palette pass rather than the generic
  recolor. Defer until blueprint's turn.
- **Line printer**: fundamentally different output format (text). Keep
  using the existing `SvgToBrailleConverter`-style pipeline adapted for
  line-printer character set. The stylize helper returns `{lines: string[]}`
  for this preset rather than a canvas.
- **Letter glyphs**: each era currently has a hand-crafted Letter-A glyph
  (hieroglyph, illuminated capital, brush-stroke, etc.). Keep per-era
  rendering of the letter outside the canonical pipeline. Fallback to
  text for non-A letters in each era.

## File inventory

New:
- `static/retro-eras/_shared/pictograph-stylize.js` (shared helper)

Modified:
- `static/retro-eras/_shared/pictograph-bridge.js` (signature change)
- `src/lib/features/retro/labs/PictographHistoryLab.svelte` (canonical render + transfer)
- `static/retro-eras/cave-painting.html` (prototype — strip draw functions, add composite)
- Later: all other 9 era HTML files

Deleted (eventually):
- Per-era `drawArrowForHand` / `drawStaffForHand` / grid-dot render code

Preserved:
- `static/retro-eras/_shared/pictograph-geometry.js` (still useful for chrome positioning)
- Every era's background, border, chrome, palette, texture, letter glyph code
