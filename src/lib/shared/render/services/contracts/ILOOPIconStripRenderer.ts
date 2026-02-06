/**
 * LOOP Icon Strip Renderer Interface
 *
 * Renders a horizontal strip of icons for LOOP components
 * using Canvas 2D API. Used for image exports.
 *
 * Icons (matching Design Lab selections):
 * - Rotated: rotation arrows (fa-rotate)
 * - Mirrored: left-right arrows (fa-left-right)
 * - Flipped: up-down arrows (fa-up-down)
 * - Swapped: shuffle arrows (fa-shuffle)
 * - Inverted: half-circle (fa-adjust)
 * - Rewound: backward arrows (fa-backward)
 * - Freeform: infinity symbol (fa-infinity)
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";

export interface ILOOPIconStripRenderer {
  /**
   * Render the LOOP icon strip onto a canvas context
   *
   * @param ctx - Canvas 2D rendering context
   * @param components - Set of active LOOP components
   * @param x - X coordinate for strip center
   * @param y - Y coordinate for strip center
   * @param iconSize - Size of each icon in pixels
   * @param darkMode - Whether to use dark mode colors
   * @returns The total width of the rendered strip
   */
  render(
    ctx: CanvasRenderingContext2D,
    components: Set<LOOPComponent>,
    x: number,
    y: number,
    iconSize: number,
    darkMode: boolean
  ): number;
}
