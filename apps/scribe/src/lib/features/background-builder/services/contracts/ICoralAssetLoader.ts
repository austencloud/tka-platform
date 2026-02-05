/**
 * Contract for loading and tinting coral silhouette PNGs.
 *
 * Loads all coral images once, tints them to offscreen canvases using
 * the provided palette, and groups them by depth layer.
 */

import type {
  CoralDepthLayer,
  CoralTintPalette,
  TintedCoralAsset,
} from "../../domain/coral-types";

export interface ICoralAssetLoader {
  /**
   * Load all coral PNGs from the static manifest, tint each to an
   * offscreen canvas, and return them grouped by depth layer.
   *
   * Calling this multiple times reuses cached results unless cleanup()
   * was called first.
   */
  loadAndTint(
    palette?: CoralTintPalette
  ): Promise<Map<CoralDepthLayer, TintedCoralAsset[]>>;

  /** Whether assets have been loaded and are ready to use */
  isLoaded(): boolean;

  /** Release all offscreen canvases and cached data */
  cleanup(): void;
}
