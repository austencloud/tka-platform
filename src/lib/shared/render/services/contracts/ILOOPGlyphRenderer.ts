/**
 * LOOP Glyph Renderer Interface
 *
 * Renders the 4-quadrant pie chart glyph for LOOP components
 * using Canvas 2D API. Used for image exports where SVG is not available.
 *
 * Quadrant Layout (clockwise from top-right):
 *   ┌───┬───┐
 *   │ I │ R │   I = INVERTED (orange #eb7d00)
 *   ├───┼───┤   R = ROTATED (blue #36c3ff)
 *   │ S │ M │   M = MIRRORED (purple #6F2DA8)
 *   └───┴───┘   S = SWAPPED (green #26e600)
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";

export interface ILOOPGlyphRenderer {
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
  ): void;
}
