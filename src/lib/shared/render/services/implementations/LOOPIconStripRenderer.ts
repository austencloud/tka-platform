/**
 * LOOP Icon Strip Renderer
 *
 * Renders a horizontal strip of icons for LOOP components
 * using Canvas 2D API. Used for image exports and thumbnails.
 *
 * Renders actual Font Awesome 7 glyphs via ctx.fillText() so the
 * canvas output matches the live LOOPIconStrip.svelte component exactly.
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { ILOOPIconStripRenderer } from "../contracts/ILOOPIconStripRenderer";

// Font Awesome 7 Free Solid: font-family + weight from static/fonts/css/all.css
const FA_FONT_FAMILY = '"Font Awesome 7 Free"';
const FA_FONT_WEIGHT = 900;

// Unicode code points for each FA solid icon (from static/fonts/css/all.css)
const FA_GLYPHS: Record<LOOPComponent | "freeform", string> = {
  [LOOPComponent.ROTATED]: "\uf2f1",   // fa-rotate
  [LOOPComponent.MIRRORED]: "\uf337",  // fa-left-right
  [LOOPComponent.FLIPPED]: "\uf338",   // fa-up-down
  [LOOPComponent.SWAPPED]: "\uf074",   // fa-shuffle
  [LOOPComponent.INVERTED]: "\uf042",  // fa-adjust
  [LOOPComponent.REWOUND]: "\uf04a",   // fa-backward
  freeform: "\uf534",                   // fa-infinity
};

export class LOOPIconStripRenderer implements ILOOPIconStripRenderer {
  private readonly displayOrder: LOOPComponent[] = [
    LOOPComponent.ROTATED,
    LOOPComponent.MIRRORED,
    LOOPComponent.FLIPPED,
    LOOPComponent.SWAPPED,
    LOOPComponent.INVERTED,
    LOOPComponent.REWOUND,
  ];

  private readonly colors: Record<LOOPComponent | "freeform", string> = {
    [LOOPComponent.ROTATED]: "#36c3ff",
    [LOOPComponent.MIRRORED]: "#6F2DA8",
    [LOOPComponent.FLIPPED]: "#e91e63",
    [LOOPComponent.SWAPPED]: "#26e600",
    [LOOPComponent.INVERTED]: "#eb7d00",
    [LOOPComponent.REWOUND]: "#00bcd4",
    freeform: "#9e9e9e",
  };

  render(
    ctx: CanvasRenderingContext2D,
    components: Set<LOOPComponent>,
    x: number,
    y: number,
    iconSize: number,
    darkMode: boolean
  ): number {
    const activeComponents = this.displayOrder.filter(comp => components.has(comp));

    if (activeComponents.length === 0) {
      this.drawGlyph(ctx, "freeform", x, y, iconSize, this.colors.freeform, darkMode);
      return iconSize;
    }

    const gap = Math.max(2, Math.round(iconSize * 0.15));
    const totalWidth = activeComponents.length * iconSize + (activeComponents.length - 1) * gap;
    let currentX = x - totalWidth / 2 + iconSize / 2;

    for (const component of activeComponents) {
      this.drawGlyph(ctx, component, currentX, y, iconSize, this.colors[component], darkMode);
      currentX += iconSize + gap;
    }

    return totalWidth;
  }

  private drawGlyph(
    ctx: CanvasRenderingContext2D,
    component: LOOPComponent | "freeform",
    x: number,
    y: number,
    size: number,
    color: string,
    darkMode: boolean
  ): void {
    ctx.save();

    // Drop shadow matching the Svelte component's CSS filter
    ctx.shadowColor = darkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = color;
    ctx.font = `${FA_FONT_WEIGHT} ${size}px ${FA_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(FA_GLYPHS[component], x, y);

    ctx.restore();
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopIconStripRenderer = new LOOPIconStripRenderer();
