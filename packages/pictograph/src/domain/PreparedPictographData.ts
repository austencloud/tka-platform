/**
 * PreparedPictographData - Pre-calculated pictograph data for rendering
 *
 * This type extends PictographData with pre-calculated positions for arrows,
 * props, and grid mode. Used by PictographRenderer for efficient rendering
 * without per-component async calculations.
 *
 * Created by: PictographPreparer.prepareSingle() or prepareBatch()
 * Consumed by: PictographRenderer.svelte
 */

import type { PictographData, GridMode } from "@tka/types";
import type { PropPosition } from "./PropPosition";
import type { PropAssets } from "./PropAssets";
import type { ArrowAssets } from "./arrow-models";

/**
 * Pre-calculated rendering data attached to a pictograph
 */
export interface PreparedRenderData {
  gridMode: GridMode;
  arrowPositions: Record<string, { x: number; y: number; rotation: number }>;
  arrowAssets: Record<string, ArrowAssets>;
  arrowMirroring: Record<string, boolean>;
  propPositions: Record<string, PropPosition>;
  propAssets: Record<string, PropAssets>;
}

/**
 * Extended pictograph data with pre-calculated positions
 */
export interface PreparedPictographData extends PictographData {
  _prepared?: PreparedRenderData;
}
