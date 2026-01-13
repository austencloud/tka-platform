/**
 * Minimal Node.js Render Container
 *
 * Includes only Canvas2DDirectRenderer and its direct dependencies.
 * Avoids loading the full app container which has SvelteKit-specific imports.
 */

import { createContainer } from "iti";
import { Canvas2DDirectRenderer } from "../src/lib/shared/render/services/implementations/Canvas2DDirectRenderer.js";

/**
 * Create a minimal container for Node.js CLI rendering
 * Only includes services needed for Canvas2DDirectRenderer
 */
export function createNodeRenderContainer() {
  return createContainer().add({
    canvas2DRenderer: () => new Canvas2DDirectRenderer(),
  });
}

export const nodeContainer = createNodeRenderContainer();
