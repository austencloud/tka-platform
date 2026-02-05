/**
 * LOOP Icon Strip Renderer
 *
 * Renders a horizontal strip of icons for LOOP components
 * using Canvas 2D API. Used for image exports.
 *
 * Draws simplified geometric versions of Font Awesome icons:
 * - Rotated: circular arrow
 * - Mirrored: horizontal double arrows
 * - Flipped: vertical double arrows
 * - Swapped: crossed arrows
 * - Inverted: half-filled circle
 * - Rewound: double left arrows
 * - Freeform: infinity symbol
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { ILOOPIconStripRenderer } from "../contracts/ILOOPIconStripRenderer";

interface IconDefinition {
  component: LOOPComponent | "freeform";
  color: string;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void;
}

export class LOOPIconStripRenderer implements ILOOPIconStripRenderer {
  // Display order for consistent rendering
  private readonly displayOrder: LOOPComponent[] = [
    LOOPComponent.ROTATED,
    LOOPComponent.MIRRORED,
    LOOPComponent.FLIPPED,
    LOOPComponent.SWAPPED,
    LOOPComponent.INVERTED,
    LOOPComponent.REWOUND,
  ];

  // Icon colors matching LOOPIconStrip.svelte
  private readonly colors: Record<LOOPComponent | "freeform", string> = {
    [LOOPComponent.ROTATED]: "#36c3ff",
    [LOOPComponent.MIRRORED]: "#6F2DA8",
    [LOOPComponent.FLIPPED]: "#e91e63",
    [LOOPComponent.SWAPPED]: "#26e600",
    [LOOPComponent.INVERTED]: "#eb7d00",
    [LOOPComponent.REWOUND]: "#00bcd4",
    freeform: "#9e9e9e",
  };

  /**
   * Render the LOOP icon strip onto a canvas context
   */
  render(
    ctx: CanvasRenderingContext2D,
    components: Set<LOOPComponent>,
    x: number,
    y: number,
    iconSize: number,
    darkMode: boolean
  ): number {
    // Filter to only active components
    const activeComponents = this.displayOrder.filter(comp => components.has(comp));

    // If no components, show freeform
    if (activeComponents.length === 0) {
      this.drawFreeformIcon(ctx, x, y, iconSize, this.colors.freeform);
      return iconSize;
    }

    // Calculate gap between icons
    const gap = Math.max(2, Math.round(iconSize * 0.15));
    const totalWidth = activeComponents.length * iconSize + (activeComponents.length - 1) * gap;

    // Calculate starting x to center the strip
    let currentX = x - totalWidth / 2 + iconSize / 2;

    ctx.save();

    // Add subtle drop shadow
    ctx.shadowColor = darkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    // Draw each active icon
    for (const component of activeComponents) {
      const color = this.colors[component];
      this.drawIcon(ctx, component, currentX, y, iconSize, color);
      currentX += iconSize + gap;
    }

    ctx.restore();

    return totalWidth;
  }

  /**
   * Draw a specific icon at the given position
   */
  private drawIcon(
    ctx: CanvasRenderingContext2D,
    component: LOOPComponent,
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (component) {
      case LOOPComponent.ROTATED:
        this.drawRotatedIcon(ctx, x, y, size);
        break;
      case LOOPComponent.MIRRORED:
        this.drawMirroredIcon(ctx, x, y, size);
        break;
      case LOOPComponent.FLIPPED:
        this.drawFlippedIcon(ctx, x, y, size);
        break;
      case LOOPComponent.SWAPPED:
        this.drawSwappedIcon(ctx, x, y, size);
        break;
      case LOOPComponent.INVERTED:
        this.drawInvertedIcon(ctx, x, y, size);
        break;
      case LOOPComponent.REWOUND:
        this.drawRewoundIcon(ctx, x, y, size);
        break;
    }
  }

  /**
   * Draw rotation icon (circular arrow) - fa-rotate
   */
  private drawRotatedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const r = size * 0.35;

    ctx.beginPath();
    // Draw arc (270° = 3/4 of circle)
    ctx.arc(x, y, r, -Math.PI * 0.75, Math.PI * 0.5);
    ctx.stroke();

    // Draw arrow head at end of arc
    const arrowSize = size * 0.15;
    const endX = x + r * Math.cos(Math.PI * 0.5);
    const endY = y + r * Math.sin(Math.PI * 0.5);

    ctx.beginPath();
    ctx.moveTo(endX - arrowSize, endY - arrowSize * 0.5);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX + arrowSize, endY - arrowSize * 0.5);
    ctx.stroke();
  }

  /**
   * Draw mirrored icon (left-right arrows) - fa-left-right
   */
  private drawMirroredIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const w = size * 0.35;
    const arrowSize = size * 0.15;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    // Left arrow head
    ctx.beginPath();
    ctx.moveTo(x - w + arrowSize, y - arrowSize);
    ctx.lineTo(x - w, y);
    ctx.lineTo(x - w + arrowSize, y + arrowSize);
    ctx.stroke();

    // Right arrow head
    ctx.beginPath();
    ctx.moveTo(x + w - arrowSize, y - arrowSize);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - arrowSize, y + arrowSize);
    ctx.stroke();
  }

  /**
   * Draw flipped icon (up-down arrows) - fa-up-down
   */
  private drawFlippedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const h = size * 0.35;
    const arrowSize = size * 0.15;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // Up arrow head
    ctx.beginPath();
    ctx.moveTo(x - arrowSize, y - h + arrowSize);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + arrowSize, y - h + arrowSize);
    ctx.stroke();

    // Down arrow head
    ctx.beginPath();
    ctx.moveTo(x - arrowSize, y + h - arrowSize);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + arrowSize, y + h - arrowSize);
    ctx.stroke();
  }

  /**
   * Draw swapped icon (crossed arrows) - fa-shuffle
   */
  private drawSwappedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const w = size * 0.3;
    const h = size * 0.2;
    const arrowSize = size * 0.12;

    // Cross paths (X shape with arrows)
    ctx.beginPath();
    ctx.moveTo(x - w, y - h);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - w, y + h);
    ctx.lineTo(x + w, y - h);
    ctx.stroke();

    // Arrow heads at ends
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - arrowSize, y - h);
    ctx.lineTo(x + w, y - h);
    ctx.lineTo(x + w, y - h + arrowSize);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - arrowSize, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - arrowSize);
    ctx.stroke();
  }

  /**
   * Draw inverted icon (half-filled circle) - fa-adjust
   */
  private drawInvertedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const r = size * 0.35;

    // Draw full circle outline
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Fill left half
    ctx.beginPath();
    ctx.arc(x, y, r - ctx.lineWidth / 2, Math.PI * 0.5, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw rewound icon (double left arrows) - fa-backward
   */
  private drawRewoundIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const w = size * 0.2;
    const h = size * 0.3;
    const gap = size * 0.12;

    // First triangle (left)
    ctx.beginPath();
    ctx.moveTo(x - gap - w, y);
    ctx.lineTo(x - gap + w, y - h);
    ctx.lineTo(x - gap + w, y + h);
    ctx.closePath();
    ctx.fill();

    // Second triangle (right)
    ctx.beginPath();
    ctx.moveTo(x + gap - w, y);
    ctx.lineTo(x + gap + w, y - h);
    ctx.lineTo(x + gap + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw freeform icon (infinity symbol) - fa-infinity
   */
  private drawFreeformIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.lineCap = "round";

    const w = size * 0.35;
    const h = size * 0.2;

    // Draw infinity using two bezier curves
    ctx.beginPath();
    // Right loop
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + w * 0.5, y - h, x + w, y - h, x + w, y);
    ctx.bezierCurveTo(x + w, y + h, x + w * 0.5, y + h, x, y);
    // Left loop
    ctx.bezierCurveTo(x - w * 0.5, y - h, x - w, y - h, x - w, y);
    ctx.bezierCurveTo(x - w, y + h, x - w * 0.5, y + h, x, y);
    ctx.stroke();
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopIconStripRenderer = new LOOPIconStripRenderer();
