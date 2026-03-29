/**
 * LOOP Icon Strip Renderer
 *
 * Delegates to @tka/render-composition for SVG-path-based icon rendering.
 * The class exists for DI container compatibility; all drawing logic lives
 * in the shared package.
 */

import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { ILOOPIconStripRenderer } from "../contracts/ILOOPIconStripRenderer";
import { renderLoopIconStrip, type LOOPComponentId } from "@tka/render-composition";

/** LOOPComponent enum values are already lowercase strings matching LOOPComponentId */
function toComponentId(c: LOOPComponent): LOOPComponentId {
  return c as unknown as LOOPComponentId;
}

export class LOOPIconStripRenderer implements ILOOPIconStripRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    components: Set<LOOPComponent>,
    x: number,
    y: number,
    iconSize: number,
    darkMode: boolean
  ): number {
    const ids = new Set<LOOPComponentId>();
    for (const c of components) ids.add(toComponentId(c));

    const showFreeform = components.size === 0;
    const result = renderLoopIconStrip(ctx, ids, x, y, iconSize, darkMode, showFreeform);
    return result.totalWidth;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopIconStripRenderer = new LOOPIconStripRenderer();
