# BrailleHybridRenderer Design Spec

**Date:** 2026-03-28
**Status:** Approved (handoff doc + working POC provided by user)

## Summary

Replace the ASCII-character motion arrows in the DOS terminal renderer with Unicode Braille curves (U+2800-U+28FF). Grid dots, staves, and structural elements remain as plain ASCII. The result is a drop-in replacement for `AsciiRenderer` that implements the same `IAsciiRenderer` interface.

## Motivation

The existing `AsciiRenderer` draws motion arrows using characters like `/ \ | - . '`. These produce blocky, hard-to-read arcs. Braille characters encode a 2x4 dot grid per cell, giving 2x horizontal and 4x vertical sub-pixel resolution. This enables smooth Bezier curves for arrows while keeping the retro terminal aesthetic for structural elements.

No existing library handles multi-layer colored vector-to-braille compositing. This is novel.

## Architecture

### Two-Layer Compositing

**Layer 1: ASCII (foreground, always wins)**
- Grid position dots (cardinal `●` for diamond, `O` for box)
- Center marker `o`
- Hand position dots `.`
- Orientation staves (`│`, `─`, `╱`, `╲`) with perpendicular thumb caps
- Step separators in sequence view

**Layer 2: Braille (background, fills gaps)**
- Motion arrows rendered as quadratic Bezier curves into a pixel bitmap
- Each Braille character encodes a 2×4 dot grid
- Per-pixel color tracking (blue=1, red=2) for HTML span coloring
- A 66×26 char canvas = 132×104 effective pixel resolution (diamond mode)

### Render Pipeline

```
1. drawGrid()       → ASCII layer: outer dots, center, hand dots
2. drawStaves()     → ASCII layer: orientation lines, thumb caps
3. drawArrows()     → Braille layer: Bezier curves, skipping cells occupied by ASCII
4. composite()      → Merge: ASCII wins where active, Braille fills the rest
```

### Coordinate System

Reuses the existing char-coordinate maps from `AsciiRenderer.ts`:
- `DIAMOND_OUTER`, `DIAMOND_HAND`, `BOX_OUTER`, `BOX_HAND`
- `DIAMOND_BETA`, `BOX_BETA` for beta position offsets

Pixel coordinates derived by: `px = charCol * 2`, `py = charRow * 4`

This ensures the braille renderer places elements at exactly the same positions as the existing renderer.

### Arrow Rendering Rules

**Pro arrows (CW rotation):**
- Bulge OUTWARD (away from center)
- Start/end at outer dot pixel positions
- Sweeping curves through the corners

**Anti arrows (CCW rotation):**
- Bulge INWARD (toward center)
- Entire arrow unit pushed radially outward by `RADIAL_PUSH` pixels before Bezier computation
- Tighter arcs that run between staves and outer dots

**Collision avoidance:**
- Before drawing any Braille pixel, check if the character cell (or 1-cell neighbors) in the ASCII layer is occupied
- `DOT_GAP` trims the curve near start/end points

### Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `RADIAL_PUSH` | 20 | Pixels to push anti arrow endpoints outward |
| `DOT_GAP` | 10 | Breathing room between arrow and grid dots |
| `bulge` | `dist * 0.55` | Bezier control point offset |
| Cell buffer | 1 cell | Neighbor cells checked for ASCII collision |

## Interface

Implements `IAsciiRenderer` exactly:
- `renderPictograph(data, options?)` → `string[]` (HTML spans)
- `renderPlaceholder()` → `string[]`
- `renderCompact(data)` → `string`
- `renderSequence(steps, options?)` → `string[]`

`renderCompact` delegates to the same text-only logic (no braille needed).
`renderSequence` stacks pictographs vertically with step labels.
`renderPlaceholder` shows grid with `?` at center.

## Output Format

HTML spans matching the existing DOS terminal CSS:
```html
<span class="dos-blue">⣿⡟</span><span class="dos-red">│</span>
```

## File Location

```
src/lib/features/retro/dos/services/implementations/BrailleHybridRenderer.ts
```

## Consumers Updated

All 6 direct instantiations of `AsciiRenderer` switch to `BrailleHybridRenderer`:
- `ScribeBrowse.svelte`
- `ScribeCards.svelte`
- `ScribeConstruct.svelte`
- `ScribeGenerate.svelte`
- `ScribeSpell.svelte`
- `AsciiPictographLab.svelte`

## Known Limitations

1. **Color per cell**: Each braille character gets one foreground color. Where blue and red pixels share a 2×4 cell, dominant color wins.
2. **Anti arrow endpoints**: Inward-bulging Bezier may clip stave zones on some variations. RADIAL_PUSH and DOT_GAP need visual tuning.
3. **Arrowheads**: Basic Bresenham line barbs. Could be improved later.
