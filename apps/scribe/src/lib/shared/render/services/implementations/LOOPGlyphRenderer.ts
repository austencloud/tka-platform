/**
 * LOOP Glyph Renderer
 *
 * Renders the 4-quadrant pie chart glyph for LOOP components
 * using Canvas 2D API. Used for image exports.
 *
 * Quadrant Layout (clockwise from top-right):
 *   ┌───┬───┐
 *   │ I │ R │   I = INVERTED (orange #eb7d00)
 *   ├───┼───┤   R = ROTATED (blue #36c3ff)
 *   │ S │ M │   M = MIRRORED (purple #6F2DA8)
 *   └───┴───┘   S = SWAPPED (green #26e600)
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { ILOOPGlyphRenderer } from "../contracts/ILOOPGlyphRenderer";

interface QuadrantDefinition {
  component: LOOPComponent;
  color: string;
  startAngle: number; // Degrees, 0 = 3 o'clock, clockwise
  endAngle: number;
}

export class LOOPGlyphRenderer implements ILOOPGlyphRenderer {
  // Quadrant definitions (clockwise from top-right)
  // Angles in degrees: 0 = 3 o'clock position, positive = clockwise
  private readonly quadrants: readonly QuadrantDefinition[] = [
    {
      component: LOOPComponent.ROTATED,
      color: "#36c3ff", // Blue
      startAngle: -90, // 12 o'clock
      endAngle: 0, // 3 o'clock
    },
    {
      component: LOOPComponent.MIRRORED,
      color: "#6F2DA8", // Purple
      startAngle: 0, // 3 o'clock
      endAngle: 90, // 6 o'clock
    },
    {
      component: LOOPComponent.SWAPPED,
      color: "#26e600", // Green
      startAngle: 90, // 6 o'clock
      endAngle: 180, // 9 o'clock
    },
    {
      component: LOOPComponent.INVERTED,
      color: "#eb7d00", // Orange
      startAngle: 180, // 9 o'clock
      endAngle: 270, // 12 o'clock
    },
  ];

  /**
   * Render the LOOP glyph onto a canvas context
   *
   * @param ctx - Canvas 2D rendering context
   * @param components - Set of active LOOP components
   * @param x - X coordinate for glyph center
   * @param y - Y coordinate for glyph center
   * @param size - Diameter of the glyph in pixels
   * @param darkMode - Whether to use dark mode colors
   */
  render(
    ctx: CanvasRenderingContext2D,
    components: Set<LOOPComponent>,
    x: number,
    y: number,
    size: number,
    darkMode: boolean
  ): void {
    const radius = (size / 2) * 0.9; // 90% of radius for padding
    const strokeWidth = Math.max(1, size * 0.02);

    // Colors based on theme
    const emptyColor = darkMode
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)";
    const strokeColor = darkMode
      ? "rgba(255, 255, 255, 0.2)"
      : "rgba(0, 0, 0, 0.15)";

    ctx.save();

    // Draw each quadrant
    for (const quadrant of this.quadrants) {
      const isActive = components.has(quadrant.component);
      const fillColor = isActive ? quadrant.color : emptyColor;

      this.drawQuadrant(
        ctx,
        x,
        y,
        radius,
        quadrant.startAngle,
        quadrant.endAngle,
        fillColor,
        strokeColor,
        strokeWidth
      );
    }

    // Draw center circle for visual polish
    const centerRadius = radius * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, centerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = darkMode
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.6)";
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a single pie slice quadrant
   */
  private drawQuadrant(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    startAngleDeg: number,
    endAngleDeg: number,
    fillColor: string,
    strokeColor: string,
    strokeWidth: number
  ): void {
    // Convert degrees to radians
    const startRad = (startAngleDeg * Math.PI) / 180;
    const endRad = (endAngleDeg * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startRad, endRad);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopGlyphRenderer = new LOOPGlyphRenderer();
