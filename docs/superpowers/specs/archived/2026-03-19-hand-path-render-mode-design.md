---
status: archived
---
# Hand Path Render Mode

**Date:** 2026-03-19
**Status:** Approved

## Problem

The L1 Quartered Rotated LOOP deck has 64 sequences that map to 18 unique hand paths — spatial trajectories showing where each hand goes, stripped of letter names, pro/anti distinction, and orientation. We need a way to render these as choreo cards that show only the spatial pattern: hands instead of props, float arrows for shifts, dash arrows for dashes, no arrows for statics, no TKA overlay, no reversals.

## Design

A single `handPathMode?: boolean` flag added to the render options. When true, the rendering pipeline internally transforms motion data before positioning calculations. No data cloning outside the renderer — this is a display concern.

### Data Flow

```
PreviewCellRenderOptions { handPathMode: true }
  ↓
PreviewCellRenderer: forces showTKA=false, showReversals=false, propType=HAND
  ↓
LayerRenderOptions { handPathMode: true }
  ↓
PictographPreparer.prepareSingle(): clones motions, transforms:
  - pro/anti → float (turns: "fl", handPath derived from locations)
  - dash → unchanged
  - static → unchanged
  - orientation → null on all motions
  ↓
PropRotAngleManager: null orientation → 0° rotation (hand always same facing)
  ↓
Arrow placement: float arrow for shifts, dash arrow for dashes, no arrow for statics
  ↓
LayerCompositor: renders as normal, TKA/reversals already suppressed
```

### Files Modified

| File | Change |
|---|---|
| `IPreviewCellRenderer.ts` | Add `handPathMode?: boolean` to `PreviewCellRenderOptions` |
| `ILayerCompositor.ts` | Add `handPathMode?: boolean` to `LayerRenderOptions` |
| `PreviewCellRenderer.ts` | Map flag: force prop=HAND, showTKA=false, showReversals=false |
| `PictographPreparer.ts` | When handPathMode, clone + transform motions before positioning |
| `PropRotAngleManager.ts` | Handle null orientation → 0° |
| `CellCacheKeyDeriver.ts` | Include handPathMode in cache key |
| `LayerKeyDeriver.ts` | Include handPathMode in base layer cache key |

### Motion Transform (in PictographPreparer)

When `handPathMode` is true, before calculating arrow/prop positions:

```
for each motion (blue, red):
  if motionType is pro or anti:
    motionType → float
    turns → "fl"
    handPath → derive from startLocation/endLocation (using getHandpathDirection)
  orientation (start + end) → null
  propType → HAND
```

### What Renders

- Grid background (normal)
- Grid points (normal — hands are at those points)
- Hand prop SVG at each hand's location (no orientation rotation)
- Float arrows for shift motions (show hand trajectory direction)
- Dash arrows for dash motions (show linear hand path)
- No arrows for static motions
- Arrow colors (blue/red) still distinguish the two hands
- Beat numbers (if enabled)

### What Does NOT Render

- TKA letter overlay (no letters in hand path mode)
- Reversal indicators (no reversals without props)
- Prop-orientation-based rotation (orientation is null — hands always face same direction)

### Cache Strategy

`handPathMode` is included in both:
- `CellCacheKeyDeriver` (IndexedDB blob cache) — prevents stale images
- `LayerKeyDeriver` (base layer memory cache) — ensures hand path renders don't collide with normal renders

### Why This Approach

- **Display concern, not data concern.** The sequence data IS pro/anti. We're choosing to VIEW it as hand paths. The projection belongs in the renderer.
- **One flag, clean API.** Callers just pass `handPathMode: true`. No data cloning, no external transform services.
- **Existing pipeline.** Float arrows and HAND prop already exist. We're composing existing capabilities.
- **Cache-safe.** Flag in cache key means zero collision risk with normal renders.
