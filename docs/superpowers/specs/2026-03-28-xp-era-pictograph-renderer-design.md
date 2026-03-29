# 2003 XP Era Pictograph Renderer + Era-Native Rendering Architecture

**Date:** 2026-03-28
**Status:** Draft
**Scope:** New 2003 XP renderer, 1995 renderer refactor, timeline layout update

---

## Problem

The Pictograph Timeline currently shows three eras (1989, 1995, 2026). Two issues:

1. **No 2003 era.** The `winxp` era is defined in data (era-types, lore, timeline events) but has no renderer. The timeline should be a 2x2 grid showing all four eras.

2. **Wrong rendering architecture for 1995.** The current PixelRenderer uses "render modern then degrade" — it renders a full modern pictograph at 400px, downsamples to 128px, remaps colors, and applies Bayer dithering. This produces a degraded photocopy rather than an authentically retro pictograph. The 2003 renderer should not repeat this mistake.

## Architecture Decision: Same Placement, Different Renderer

All era renderers (except 1989 braille, which is a different medium) should:

1. **Convert** `RetroPictographData` → `PictographData` (already done in PixelRenderer)
2. **Prepare** via `PictographPreparer.prepareSingle()` to get `PreparedRenderData`
3. **Draw SVG shapes** — load arrow/prop SVG content as Images, draw on canvas at prepared positions
4. **Apply era-specific effects** — canvas context settings (shadows, compositing) and post-processing

This means the complex arrow positioning pipeline (tiers, directional tuples, beta offsets, per-letter adjustments) is shared, while each era controls its own rendering aesthetic.

### Why not render-then-degrade?

| Aspect | Render-then-degrade | Same-placement-different-renderer |
|--------|--------------------|---------------------------------|
| Output quality | Degraded photocopy | Intentionally styled |
| Artifacts | Downscaling aliasing, color bleed | None — direct drawing |
| New eras | Need image processing pipeline | Write a canvas painter |
| Maintenance | Two pipelines to debug | One pipeline, multiple painters |
| Authenticity | "Bad photocopy of 2026" | "Built for this era" |

### Exception: 1989 braille

The 1989 renderer (`SvgToBrailleConverter`) stays as-is. Braille is a fundamentally different output medium (character grid, not pixels). Downsampling a rendered image to braille dots is the correct approach.

### Note: `win98` era

The `era-types.ts` defines a `win98` era (year 1998). This is intentionally excluded from the Pictograph Timeline — 1998 is too close to 1995 to be visually distinct in a 2x2 grid. If `win98` gets a renderer later, the timeline can be expanded or it can live in its own exhibit.

## How SVG Assets Work (Critical Implementation Detail)

The `PreparedRenderData` contains SVG assets for arrows and props:

```typescript
interface ArrowAssets {
  readonly imageSrc: string;     // Inner SVG content (paths, groups) — NOT a complete SVG document
  readonly viewBox: {
    width: number;
    height: number;
    fullViewBox?: string;        // e.g., "-296 -2937 2784 3091"
  };
  readonly center: { x: number; y: number };
}

interface PropAssets {
  readonly imageSrc: string;     // Inner SVG content
  readonly viewBox: string;      // e.g., "100 100"
}
```

**`imageSrc` is inner SVG content** (paths, groups), not a complete SVG document. The modern renderer (`Canvas2DDirectRenderer`) handles this by:

1. Wrapping `imageSrc` with `<svg xmlns="..." viewBox="..." width="..." height="...">` to make a valid SVG document
2. Converting the SVG string to a `Blob` URL
3. Loading as an `Image` element (cached by content hash)
4. Drawing on canvas with `ctx.drawImage()` at the prepared position/rotation

### Era-Native Drawing Strategy

The era renderers use the **same SVG→Image→canvas pipeline** for arrow/prop shapes. The era-specific treatment comes from:

1. **Canvas context effects applied before `drawImage()`**: `ctx.shadowColor`, `ctx.shadowBlur`, `ctx.shadowOffsetX/Y`, `ctx.filter`
2. **Color tinting via composite operations**: Draw image, then `ctx.globalCompositeOperation = "source-in"` + `ctx.fillStyle = eraColor` + `ctx.fillRect()` — this recolors the shape. The modern renderer already does this in `drawColoredSvg()`.
3. **Post-processing**: Read `ImageData` and manipulate pixels (e.g., Bayer dithering for 1995)
4. **Era-native elements** drawn directly: background, grid, border, letter, hand dots

This means the shapes (arrow curves, prop outlines) are pixel-accurate with the modern renderer, while everything else is era-styled.

### Coordinate System

The modern renderer works in a 950x950 SVG viewBox. Positions from `PreparedRenderData` are in this coordinate space. Era renderers scale by `eraSize / 950`:

- 1995: `128 / 950 = 0.1347`
- 2003: `256 / 950 = 0.2695`

For each arrow/prop:
```typescript
const scale = eraSize / 950;
const drawX = position.x * scale;
const drawY = position.y * scale;
// Apply rotation around the element's center, then drawImage
```

Verify the exact viewBox size during implementation by checking `Canvas2DDirectRenderer.renderPictograph()`.

## 2003 XP Renderer: Visual Treatment

### Canvas Properties
- **Resolution:** 256x256 internal (double 1995's 128x128)
- **Anti-aliasing:** ON (`imageSmoothingEnabled = true`) — key difference from 1995
- **Background:** Clean white (`#FFFFFF`)
- **Display:** Standard rendering (NOT `image-rendering: pixelated`)

### Element Treatments

| Element | Treatment |
|---------|-----------|
| **Staves (props)** | Draw SVG as Image, tint with era blue/red via composite op. Apply `ctx.shadowColor` for colored drop shadow (2px blur, 40% opacity, offset 2px) before drawing. |
| **Arrows** | Same SVG→Image→tint pipeline. Apply `ctx.shadowColor` for colored drop shadow (4px blur, 30% opacity) before drawing. |
| **Grid lines** | Draw directly on canvas. 1px gray lines (`#C0C0C0`). Anti-aliased. |
| **Grid dots** | Draw directly. Gray fill (`#A0A0A0`), 4-5px radius. |
| **Hand dots** | Draw directly. Two-layer: dark base with shadow, lighter highlight on top. |
| **Border** | Draw directly. 3D beveled: white highlight top-left, gray shadow bottom-right, inner bevel. |
| **Letter** | Draw directly. Tahoma/Verdana bold, dark navy (`#003366`), subtle emboss. |
| **Center dot** | Draw directly. Small gray dot. |

### Drawing Order

1. Background (white fill)
2. Grid lines (direct canvas drawing)
3. Grid dots + center dot (direct canvas drawing)
4. Props/staves (SVG Image + tint + shadow)
5. Arrows (SVG Image + tint + shadow)
6. Hand position dots (direct canvas drawing)
7. Letter (direct canvas drawing)
8. Border (direct canvas drawing, on top)

### Error Handling

- If `prepareSingle()` fails or `_prepared` is undefined: call `renderPlaceholder()` (gray fill with "?" — same as 1995)
- If SVG asset loading fails for a specific arrow/prop: skip that element, log warning
- `renderPlaceholder()` is required on the interface

## 1995 PixelRenderer Refactor

The current PixelRenderer will be refactored to use the same SVG→Image→canvas pipeline with era-native effects.

### What stays the same
- `IPixelRenderer` interface (unchanged)
- `convertToModernData()` and `handToMotionData()` (unchanged)
- Win16 palette, Bayer dithering, 128x128 resolution, `image-rendering: pixelated`
- `renderPlaceholder()` (unchanged)

### What changes
- Instead of calling `renderer.renderPictograph()` and downsampling, draw SVG Images at prepared positions with flat Win16 colors via composite tinting
- Apply Bayer dithering as final step (replaces current color remapping + dithering)
- Keep `IDirectRenderer` dependency — needed for SVG→Image conversion utilities (wrapping, caching)
- Keep `IPictographPreparer` dependency — needed for positioning

### Era-native 1995 drawing
- **Staves:** SVG Image drawn, tinted to flat blue (`#0000FF`) or red (`#FF0000`) via composite op. No gradients, no shadows.
- **Arrows:** Same pipeline, flat colors. No shadows.
- **Grid:** 1px black/gray lines, drawn directly.
- **Background:** White.
- **Anti-aliasing:** OFF (`imageSmoothingEnabled = false`)
- **Resolution:** 128x128, displayed with `image-rendering: pixelated`
- **Post-process:** Bayer 4x4 dithering to Win16 palette

## Shared Interface: `IEraRenderer`

Both 1995 and 2003 renderers share the same interface shape. Rather than duplicating, use a shared interface:

```typescript
// src/lib/features/retro/shared/services/contracts/IEraRenderer.ts
import type { RetroPictographData } from "../../domain/pictograph-types";

export interface IEraRenderer {
  render(canvas: HTMLCanvasElement, data: RetroPictographData, size?: number): Promise<void>;
  renderPlaceholder(canvas: HTMLCanvasElement, size?: number): void;
}
```

The existing `IPixelRenderer` becomes an alias or is replaced by `IEraRenderer`. The XP renderer implements the same interface.

## Timeline Layout Update

### Current layout
Three-column horizontal row with dividers:
```
| 1989 | 1995 | 2026 |
```

### New layout
2x2 grid:
```
| 1989 | 1995 |
| 2003 | 2026 |
```

### Changes to PictographTimelineLab.svelte

1. Replace `.compare-row` flex layout with CSS grid: `grid-template-columns: 1fr 1fr`
2. Remove `.era-divider` elements
3. Add 2003 column with canvas element and `XPRenderer` instance
4. Add `.era-2003` label style (color: `#FF9933` — warm orange, XP Luna accent)
5. Add `$effect` to render 2003 when pictograph changes
6. The 2003 renderer takes `RetroPictographData` (same as 1995) via `toRetro()`
7. `XPRenderer` instantiated directly (same pattern as `PixelRenderer` — no DI container needed, these are lab-only renderers)

## File Structure

### New files
```
src/lib/features/retro/shared/services/contracts/IEraRenderer.ts
  — Shared interface for era-native renderers

src/lib/features/retro/winxp/
  services/
    implementations/
      XPRenderer.ts            — the 2003 era-native renderer
```

### Modified files
```
src/lib/features/retro/win95/services/implementations/PixelRenderer.ts
  — Refactor to era-native rendering (SVG→Image→tint instead of render-then-degrade)

src/lib/features/retro/win95/services/contracts/IPixelRenderer.ts
  — Update to extend or alias IEraRenderer

src/lib/features/retro/labs/PictographTimelineLab.svelte
  — Add 2003 column, change to 2x2 grid layout, instantiate XPRenderer
```

## Scope Boundaries

### In scope
- `IEraRenderer` shared interface
- `XPRenderer` implementation
- `PixelRenderer` refactor to era-native
- Timeline layout change to 2x2
- Integration of 2003 into the timeline

### Out of scope
- Full 2003/WinXP exhibit (desktop, boot sequence, apps) — separate project
- PyQt widget framing around the pictograph — part of the exhibit, not the renderer
- 1989 braille renderer changes — stays as-is
- `win98` era renderer — intentionally excluded from timeline
- New pictograph navigation or data loading changes

## Success Criteria

1. All four eras render the same pictograph side-by-side in a 2x2 grid
2. 1995 and 2003 draw SVG arrow/prop shapes at positions from PictographPreparer, not from downscaled renders
3. 2003 is visually distinct from 1995 (gradients, shadows, anti-aliasing vs flat, dithered, pixelated)
4. Arrow and prop positions match the modern 2026 renderer exactly
5. TypeScript compiles clean (`npm run check`)
6. Navigation (prev/next/random) updates all four eras simultaneously
