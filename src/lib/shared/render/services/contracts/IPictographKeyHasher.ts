/**
 * IPictographKeyHasher
 *
 * Generates deterministic cache keys for pictograph configurations.
 *
 * The key includes all properties that affect the visual SVG output:
 * - Letter/glyph
 * - Blue motion data (motionType, locations, turns, orientations, propType, gridMode)
 * - Red motion data (same properties)
 * - Visibility settings (showTKA, showVTG, etc.)
 *
 * The key explicitly EXCLUDES:
 * - stepNumber (drawn as canvas overlay)
 * - size (handled by Layer 2 memory cache)
 *
 * This allows identical pictographs with different beat numbers to share
 * the same cached base SVG.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";

export interface IPictographKeyHasher {
  /**
   * Generate a deterministic cache key from pictograph data and visibility settings
   *
   * @param data The pictograph or step data
   * @param visibility Visibility options that affect rendering
   * @returns A hash string suitable for use as a cache key
   */
  deriveKey(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): string;
}
