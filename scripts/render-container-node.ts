/**
 * Minimal Node.js Render Container
 *
 * Includes only Canvas2DDirectRenderer without pictograph preparer.
 * This means it will render:
 * - Grid
 * - TKA glyph (letter)
 * - Direction dot, turn numbers, beat numbers
 *
 * But NOT:
 * - Arrows
 * - Props
 *
 * This is sufficient for basic pictograph visualization.
 * Arrow/prop rendering can be added later with a minimal preparer.
 */

import { createContainer } from "iti";
import { Canvas2DDirectRenderer } from "../apps/scribe/src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.js";

/**
 * Create a minimal container for Node.js CLI rendering
 * Canvas2DDirectRenderer created without preparer (no arrows/props initially)
 */
export function createNodeRenderContainer() {
  return createContainer().add({
    canvas2DRenderer: () => new Canvas2DDirectRenderer(undefined),
  });
}

export const nodeContainer = createNodeRenderContainer();
