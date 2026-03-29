# XP Era Pictograph Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2003 XP-era pictograph renderer to the Pictograph Timeline, refactor the 1995 renderer to era-native drawing, and update the timeline to a 2x2 grid.

**Architecture:** All era renderers consume positioned data from `PictographPreparer`, then draw SVG arrow/prop shapes as Images on canvas with era-specific effects (shadows, tinting, dithering). No downscaling of modern renders. The SVG→Image→canvas pipeline is shared; only the paint style differs.

**Tech Stack:** TypeScript, Canvas 2D API, SVG→Image conversion, Svelte 5

**Spec:** `docs/superpowers/specs/2026-03-28-xp-era-pictograph-renderer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/features/retro/shared/services/contracts/IEraRenderer.ts` | Create | Shared interface for era renderers |
| `src/lib/features/retro/shared/services/implementations/EraRendererBase.ts` | Create | Shared SVG drawing utilities (wrap, load, tint, grid) |
| `src/lib/features/retro/winxp/services/implementations/XPRenderer.ts` | Create | 2003 XP-era canvas painter |
| `src/lib/features/retro/win95/services/contracts/IPixelRenderer.ts` | Modify | Extend IEraRenderer |
| `src/lib/features/retro/win95/services/implementations/PixelRenderer.ts` | Modify | Refactor to era-native drawing |
| `src/lib/features/retro/labs/PictographTimelineLab.svelte` | Modify | Add 2003, change to 2x2 grid |

**Key reference files (read, don't modify):**
- `src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.ts` — SVG wrapping (`wrapSvgContent` line 530), prop drawing (line 589), arrow drawing (line 677), `VIEWBOX_SIZE = 950` (line 81), color tinting pattern (line 1012)
- `src/lib/shared/render/services/implementations/SvgImageCache.ts` — `getSvgImageCache()`, `getImage(svgString, cacheKey)`
- `src/lib/shared/pictograph/shared/domain/models/PreparedPictographData.ts` — `PreparedRenderData` interface
- `src/lib/shared/pictograph/arrow/orchestration/domain/arrow-models.ts` — `ArrowAssets`, `ArrowPosition`
- `src/lib/features/retro/shared/domain/pictograph-types.ts` — `RetroPictographData`

---

## Task 1: Create IEraRenderer Shared Interface

**Files:**
- Create: `src/lib/features/retro/shared/services/contracts/IEraRenderer.ts`
- Modify: `src/lib/features/retro/win95/services/contracts/IPixelRenderer.ts`

- [ ] **Step 1: Create IEraRenderer**

```typescript
// src/lib/features/retro/shared/services/contracts/IEraRenderer.ts
/**
 * IEraRenderer — Shared contract for era-native pictograph renderers.
 *
 * Each era (1995, 2003, etc.) implements this to draw pictographs
 * with era-appropriate visual treatment. All use PictographPreparer
 * for positioning — only the paint style differs.
 */
import type { RetroPictographData } from "../../domain/pictograph-types";

export interface IEraRenderer {
  render(canvas: HTMLCanvasElement, data: RetroPictographData, size?: number): Promise<void>;
  renderPlaceholder(canvas: HTMLCanvasElement, size?: number): void;
}
```

- [ ] **Step 2: Update IPixelRenderer to extend IEraRenderer**

In `src/lib/features/retro/win95/services/contracts/IPixelRenderer.ts`, replace the standalone interface with one that extends `IEraRenderer`. Keep the doc comments. The method signatures are identical so this is purely a type relationship change.

```typescript
import type { IEraRenderer } from "../../../shared/services/contracts/IEraRenderer";

export interface IPixelRenderer extends IEraRenderer {}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No new errors (existing PixelRenderer already matches this shape)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/retro/shared/services/contracts/IEraRenderer.ts src/lib/features/retro/win95/services/contracts/IPixelRenderer.ts
git commit -m "feat(retro): add IEraRenderer shared interface for era-native renderers"
```

---

## Task 2: Create EraRendererBase with Shared SVG Drawing Utilities

**Files:**
- Create: `src/lib/features/retro/shared/services/implementations/EraRendererBase.ts`

This extracts the SVG wrapping, image loading, color tinting, and coordinate scaling that both the 1995 and 2003 renderers need. The patterns come from `Canvas2DDirectRenderer.ts`.

- [ ] **Step 1: Create EraRendererBase**

```typescript
// src/lib/features/retro/shared/services/implementations/EraRendererBase.ts
/**
 * EraRendererBase — Shared utilities for era-native pictograph renderers.
 *
 * Provides SVG wrapping, image loading/caching, color tinting, and
 * coordinate scaling. Subclasses implement era-specific drawing (grid
 * style, effects, post-processing).
 *
 * The SVG→Image→canvas pipeline mirrors Canvas2DDirectRenderer but
 * with era-specific color tinting instead of the modern color scheme.
 */
import type { IPictographPreparer, PrepareOptions } from "$lib/shared/pictograph/shared/services/contracts/IPictographPreparer";
import type { PreparedRenderData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { RetroPictographData, RetroHandData } from "../../domain/pictograph-types";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { getSvgImageCache, type DrawableImage } from "$lib/shared/render/services/implementations/SvgImageCache";

/** Matches Canvas2DDirectRenderer.VIEWBOX_SIZE */
const VIEWBOX_SIZE = 950;

/** Overflow expansion ratio for arrow SVGs (matches Canvas2DDirectRenderer) */
const OVERFLOW_EXPANSION = 0.15;

export abstract class EraRendererBase {
  protected preparer: IPictographPreparer;

  constructor(preparer: IPictographPreparer) {
    this.preparer = preparer;
  }

  // ── Data Conversion ──

  protected convertToModernData(data: RetroPictographData): PictographData {
    const blueMotion = this.handToMotionData(data.blueHand, MotionColor.BLUE, data.gridMode);
    const redMotion = this.handToMotionData(data.redHand, MotionColor.RED, data.gridMode);
    return {
      id: `retro-${data.letter}-${Date.now()}`,
      letter: typeof data.letter === "string" ? (data.letter as any) : data.letter,
      motions: { [MotionColor.BLUE]: blueMotion, [MotionColor.RED]: redMotion },
      gridMode: data.gridMode,
    };
  }

  private handToMotionData(hand: RetroHandData, color: MotionColor, gridMode: GridMode): MotionData {
    return createMotionData({
      motionType: hand.motionType,
      rotationDirection: hand.rotationDirection,
      startLocation: hand.location,
      endLocation: hand.endLocation,
      turns: hand.turns,
      startOrientation: hand.orientation,
      endOrientation: hand.orientation,
      isVisible: true,
      propType: PropType.STAFF,
      color,
      gridMode,
    });
  }

  // ── Preparation ──

  protected async prepare(data: RetroPictographData): Promise<PreparedRenderData | null> {
    try {
      const pictographData = this.convertToModernData(data);
      const prepared = await this.preparer.prepareSingle(pictographData, {
        themeMode: "dark",
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });
      return prepared._prepared ?? null;
    } catch {
      return null;
    }
  }

  // ── SVG Wrapping (mirrors Canvas2DDirectRenderer.wrapSvgContent exactly) ──

  protected wrapSvgContent(
    innerContent: string,
    viewBoxWidth: number,
    viewBoxHeight: number,
    expandViewBox: boolean,
    fullViewBox?: string,
  ): { svg: string; offsetX: number; offsetY: number; newWidth: number; newHeight: number } {
    // Parse viewBox origin if full viewBox string provided (e.g., "-322 -253 2730 426")
    let minX = 0, minY = 0;
    if (fullViewBox) {
      const parts = fullViewBox.split(/\s+/);
      minX = parseFloat(parts[0] || "0") || 0;
      minY = parseFloat(parts[1] || "0") || 0;
    }

    if (!expandViewBox) {
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">${innerContent}</svg>`,
        offsetX: 0,
        offsetY: 0,
        newWidth: viewBoxWidth,
        newHeight: viewBoxHeight,
      };
    }

    // Expand viewBox by overflow ratio in all directions
    const expandX = viewBoxWidth * OVERFLOW_EXPANSION;
    const expandY = viewBoxHeight * OVERFLOW_EXPANSION;
    const newWidth = viewBoxWidth + expandX * 2;
    const newHeight = viewBoxHeight + expandY * 2;
    const newMinX = minX - expandX;
    const newMinY = minY - expandY;

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${newMinX} ${newMinY} ${newWidth} ${newHeight}" width="${newWidth}" height="${newHeight}">${innerContent}</svg>`,
      offsetX: expandX,
      offsetY: expandY,
      newWidth,
      newHeight,
    };
  }

  // ── Element Transform (mirrors Canvas2DDirectRenderer.drawElementWithTransform) ──

  protected drawElementWithTransform(
    ctx: CanvasRenderingContext2D,
    img: DrawableImage,
    params: {
      x: number; y: number; rotation: number;
      centerX: number; centerY: number;
      viewBoxWidth: number; viewBoxHeight: number;
      scale: number; shouldMirror: boolean;
    },
  ): void {
    const { x, y, rotation, centerX, centerY, viewBoxWidth, viewBoxHeight, scale, shouldMirror } = params;
    ctx.save();
    ctx.translate(x, y);                          // 1. Position on canvas
    ctx.rotate((rotation * Math.PI) / 180);       // 2. Rotate
    if (shouldMirror) ctx.scale(-1, 1);           // 3. Mirror
    ctx.scale(scale, scale);                      // 4. Scale viewBox → canvas
    ctx.translate(-centerX, -centerY);            // 5. Center element
    ctx.drawImage(img, 0, 0, viewBoxWidth, viewBoxHeight); // 6. Draw
    ctx.restore();
  }

  // ── Image Loading ──

  protected async loadSvgImage(svgString: string, cacheKey: string): Promise<DrawableImage> {
    const cache = getSvgImageCache();
    return cache.getImage(svgString, cacheKey);
  }

  // ── Color Tinting (mirrors Canvas2DDirectRenderer.drawColoredImage) ──

  protected drawTintedImage(
    ctx: CanvasRenderingContext2D,
    img: DrawableImage,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ): void {
    const offscreen = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) {
      ctx.drawImage(img, x, y, width, height);
      return;
    }
    offCtx.drawImage(img, 0, 0, width, height);
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);
    ctx.drawImage(offscreen, x, y);
  }

  // ── Coordinate Scaling ──

  protected getScale(eraSize: number): number {
    return eraSize / VIEWBOX_SIZE;
  }

  // ── Placeholder ──

  renderPlaceholder(canvas: HTMLCanvasElement, size: number = 128): void {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#C0C0C0";
    ctx.fillRect(0, 0, size, size);
    const fontSize = Math.max(8, Math.floor(size * 0.4));
    ctx.fillStyle = "#000000";
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", size / 2, size / 2);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/retro/shared/services/implementations/EraRendererBase.ts
git commit -m "feat(retro): add EraRendererBase with shared SVG drawing utilities"
```

---

## Task 3: Implement XPRenderer (2003 Era)

**Files:**
- Create: `src/lib/features/retro/winxp/services/implementations/XPRenderer.ts`

**Key references:**
- `Canvas2DDirectRenderer.ts` line 589-670 — prop drawing pattern (viewBox parsing, wrapping, caching, transforms)
- `Canvas2DDirectRenderer.ts` line 677-790 — arrow drawing pattern (expanded viewBox, mirroring, rotation)
- `Canvas2DDirectRenderer.ts` line 81 — `VIEWBOX_SIZE = 950`

- [ ] **Step 1: Create XPRenderer**

The renderer extends `EraRendererBase` and draws with XP-era effects: gradient-tinted SVG shapes with drop shadows, anti-aliased, white background, beveled border, Tahoma letter.

```typescript
// src/lib/features/retro/winxp/services/implementations/XPRenderer.ts
/**
 * XPRenderer — 2003 Windows XP era pictograph renderer.
 *
 * Draws pictographs at 256x256 with XP-era visual treatment:
 * anti-aliased rendering, gradient-tinted SVG shapes, colored
 * drop shadows, 3D beveled border, Tahoma font.
 *
 * Uses PictographPreparer for arrow/prop positioning (shared pipeline),
 * then draws SVG shapes as Images with era-specific canvas effects.
 */
```

The implementation should:

1. Set canvas to 256x256, `imageSmoothingEnabled = true`, fill white background
2. Draw grid: iterate diamond grid point positions (same geometry as Canvas2DDirectRenderer), draw 1px `#C0C0C0` lines and `#A0A0A0` dots
3. Draw props: for each color in `["blue", "red"]`:
   - Get `propPositions[color]` and `propAssets[color]` from prepared data
   - Parse viewBox from `propAssets.viewBox` (split on whitespace, take width/height)
   - Wrap `propAssets.imageSrc` via `wrapSvgContent(content, w, h, false)`
   - Load as Image via `loadSvgImage(wrapped, cacheKey)`
   - Set `ctx.shadowColor`, `ctx.shadowBlur = 6`, `ctx.shadowOffsetX/Y = 2`
   - Draw with `drawTintedImage()` using era blue (`#3366EE`) or red (`#EE3322`)
   - Clear shadow after drawing
4. Draw arrows: for each color in `["blue", "red"]`:
   - Get `arrowPositions[color]`, `arrowAssets[color]`, `arrowMirroring[color]`
   - Get viewBox dimensions from `arrowAssets.viewBox.width/height`
   - Get `fullViewBox` from `arrowAssets.viewBox.fullViewBox`
   - Wrap with `wrapSvgContent(content, w, h, true, fullViewBox)` (expanded — returns `{ svg, offsetX, offsetY, newWidth, newHeight }`)
   - Load as Image via `loadSvgImage(wrapped.svg, cacheKey)`
   - Compute adjusted center (critical — matches Canvas2DDirectRenderer lines 704-720):
     ```typescript
     let viewBoxMinX = 0, viewBoxMinY = 0;
     if (fullViewBox) {
       const parts = fullViewBox.split(/\s+/);
       viewBoxMinX = parseFloat(parts[0] || "0") || 0;
       viewBoxMinY = parseFloat(parts[1] || "0") || 0;
     }
     const adjustedCenterX = (assets.center?.x ?? viewBoxWidth / 2) - viewBoxMinX + wrapped.offsetX;
     const adjustedCenterY = (assets.center?.y ?? viewBoxHeight / 2) - viewBoxMinY + wrapped.offsetY;
     ```
   - Set `ctx.shadowColor/Blur/Offset` for colored drop shadow
   - Draw via `drawElementWithTransform(ctx, img, { x: position.x * scale, y: position.y * scale, rotation: position.rotation, centerX: adjustedCenterX, centerY: adjustedCenterY, viewBoxWidth: wrapped.newWidth, viewBoxHeight: wrapped.newHeight, scale, shouldMirror })`
   - Clear shadow after drawing
5. Draw hand dots: two-layer circles at prop end positions (shadow base + highlight)
6. Draw letter: Tahoma bold, `#003366`, with white emboss offset
7. Draw 3D beveled border: white highlight top-left, `#808080` shadow bottom-right, inner bevel

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/retro/winxp/services/implementations/XPRenderer.ts
git commit -m "feat(retro): add XPRenderer for 2003 Windows XP era pictograph"
```

---

## Task 4: Refactor PixelRenderer to Era-Native Drawing

**Files:**
- Modify: `src/lib/features/retro/win95/services/implementations/PixelRenderer.ts`

The current PixelRenderer (lines 117-385) renders a modern pictograph at 400px, downsamples to 128px, remaps colors, and applies Bayer dithering. Refactor it to extend `EraRendererBase` and draw SVG shapes directly at 128px with flat Win16 colors.

- [ ] **Step 1: Refactor PixelRenderer to extend EraRendererBase**

Key changes:
1. `class PixelRenderer extends EraRendererBase implements IPixelRenderer`
2. Constructor takes only `IPictographPreparer` (remove `IDirectRenderer` param). Call `super(preparer)`.
3. `render()` method:
   - Set canvas to 128x128, `imageSmoothingEnabled = false`
   - Fill white background
   - Call `this.prepare(data)` to get `PreparedRenderData`
   - If null, call `this.renderPlaceholder()` and return
   - Draw grid (1px gray lines, gray dots — same geometry as XPRenderer but flat)
   - Draw props using same SVG→Image→tint pipeline, but with flat Win16 colors: blue `#0000FF`, red `#FF0000`. No shadows.
   - Draw arrows same way, flat colors, no shadows
   - Draw hand dots: flat gray circles, no highlight
   - Draw letter: monospace bold black
   - Draw border: 1px solid black
   - Apply Bayer dithering (keep existing `WIN16_PALETTE`, `BAYER_4X4`, `findNearestPaletteColor`, `clampByte`)
4. Remove: `convertToModernData()`, `handToMotionData()` (now in base class), `remapColors()` (no longer needed), `RENDER_SIZE` constant, `IDirectRenderer` dependency (SVG wrapping/caching now lives in `EraRendererBase` — spec said to keep it but the base class replaces this need)
5. Keep: `WIN16_PALETTE`, `BAYER_4X4`, `findNearestPaletteColor`, `clampByte`, `applyDithering()`, `renderPlaceholder()` override (with dithering)

- [ ] **Step 2: Update call sites for new constructor**

The constructor signature changes from `new PixelRenderer(renderer, preparer)` to `new PixelRenderer(preparer)`. Update these files:

- `src/lib/features/retro/labs/PictographTimelineLab.svelte` (line 29-32)
- `src/lib/features/retro/win95/components/rendering/RetroPictograph.svelte` — search for `new PixelRenderer`
- `src/lib/features/retro/labs/RetroPictographLab.svelte` — search for `new PixelRenderer`

Remove the `IDirectRenderer` / `canvas2DRenderer` import and argument from each.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/retro/win95/services/implementations/PixelRenderer.ts src/lib/features/retro/labs/PictographTimelineLab.svelte src/lib/features/retro/win95/components/rendering/RetroPictograph.svelte src/lib/features/retro/labs/RetroPictographLab.svelte
git commit -m "refactor(retro): PixelRenderer uses era-native drawing instead of render-then-degrade"
```

---

## Task 5: Integrate 2003 into PictographTimelineLab

**Files:**
- Modify: `src/lib/features/retro/labs/PictographTimelineLab.svelte`

- [ ] **Step 1: Add XPRenderer import and instantiation**

After the existing `PixelRenderer` instantiation (around line 29), add:

```typescript
import { XPRenderer } from "$lib/features/retro/winxp/services/implementations/XPRenderer";

const xpRenderer = new XPRenderer(pictographPreparer);
```

Add a canvas binding and size constant:

```typescript
const XP_INTERNAL_SIZE = 256;
let xpCanvas = $state<HTMLCanvasElement | undefined>();
```

- [ ] **Step 2: Add $effect for 2003 rendering**

After the existing 1995 pixel `$effect` (around line 110-117), add:

```typescript
$effect(() => {
  const data = pictograph;
  const canvas = xpCanvas;
  if (!canvas || !data) return;
  const retroData = toRetro(data);
  xpRenderer.render(canvas, retroData, XP_INTERNAL_SIZE);
});
```

- [ ] **Step 3: Change layout from 3-column to 2x2 grid**

In the template section, replace the `compare-row` with `.era-divider` elements with a 2x2 grid. Add the 2003 column:

```svelte
<!-- 2003: XP -->
<div class="era-column">
  <div class="era-label era-2003">2003</div>
  <div class="era-content">
    <div class="xp-frame">
      <canvas
        bind:this={xpCanvas}
        width={XP_INTERNAL_SIZE}
        height={XP_INTERNAL_SIZE}
        class="xp-canvas"
        aria-label="2003 XP pictograph"
      ></canvas>
    </div>
  </div>
</div>
```

Remove the `.era-divider` elements.

- [ ] **Step 4: Update CSS for 2x2 grid**

Replace `.compare-row` styles:

```css
.compare-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  flex: 1;
  min-height: 0;
  gap: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.era-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
}
```

Add era-2003 label and XP frame styles:

```css
.era-2003 { color: #FF9933; }

.xp-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.xp-canvas {
  display: block;
  width: min(100%, 80vh);
  max-width: 500px;
  height: auto;
  aspect-ratio: 1;
  background: #ffffff;
}
```

Remove `.era-divider` styles.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/retro/labs/PictographTimelineLab.svelte
git commit -m "feat(retro): add 2003 XP era to Pictograph Timeline, change to 2x2 grid"
```

---

## Task 6: Visual Verification

- [ ] **Step 1: Navigate to Pictograph Timeline**

Open localhost:5173 → Retro → Pictograph Timeline. Verify:
- 2x2 grid layout with all four eras (1989, 1995, 2003, 2026)
- All four show the same pictograph
- Navigation (prev/next/random) updates all four simultaneously
- Arrow and prop positions match between 2003 and 2026

- [ ] **Step 2: Verify 1995 era-native rendering**

- Props and arrows are at correct positions (match 2026)
- Colors are flat Win16 blue/red (no gradients)
- Bayer dithering is visible
- `image-rendering: pixelated` is applied
- No downscaling artifacts

- [ ] **Step 3: Verify 2003 XP rendering**

- White background
- Gradient-tinted staves with drop shadows
- Gradient-tinted arrows with drop shadows
- Anti-aliased (smooth edges, NOT pixelated)
- 3D beveled border
- Tahoma-style letter with emboss
- Visually distinct from 1995 (smooth vs chunky)

- [ ] **Step 4: Verify 1989 braille unchanged**

- Still renders via SVG→braille conversion
- Sizing and centering are correct

- [ ] **Step 5: Run TypeScript check**

Run: `npm run check 2>&1 | head -30`
Expected: No new errors from these changes
