/**
 * ILayerCompositor
 *
 * Coordinates rendering of pictograph layers with independent caching.
 * Enables visibility changes without full re-renders.
 *
 * Layer architecture:
 * - BASE: Background + Grid + Props + Arrows (visibility-independent)
 * - TKA: Letter + Turns + DirectionDot (only when showTKA=true)
 * - REVERSAL: Blue/red dots (only when showReversals=true)
 * - STEP: Beat number text (always shown)
 *
 * Cache key strategy:
 * - Base layer key includes: motions, props, darkMode, gridOptions, size
 * - Base layer key EXCLUDES: showTKA, showReversals (these toggle overlays, not base)
 * - TKA overlay key: letter + turnsTuple + darkMode + size (SHARED across pictographs with same letter/turns)
 * - Reversal overlay key: blueReversal + redReversal + size (only 4 possible states)
 */

import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";

/**
 * Canvas type that works in both main thread and Web Workers.
 * OffscreenCanvas is used when available (workers + modern browsers).
 * Falls back to HTMLCanvasElement on main thread when OffscreenCanvas unavailable.
 */
export type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * 2D rendering context type that works with both HTMLCanvasElement and OffscreenCanvas.
 * The intersection type captures the common API surface used for drawing.
 */
export type RenderContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Layer types for compositional caching
 *
 * - base: Props + Arrows (no grid dots)
 * - gridPoints: Grid dots only (toggleable via handPointVisibility)
 * - tka: Letter + Turns + DirectionDot
 * - reversal: Blue/red reversal indicators
 * - beat: Beat number text
 */
export type LayerType = "base" | "gridPoints" | "tka" | "reversal" | "beat";

/**
 * Options for layer rendering
 */
export interface LayerRenderOptions {
  size: number;
  /** Width multiplier for duration-expanded cells (1 = square, 2 = double-wide). Default: 1 */
  widthMultiplier?: number;
  darkMode: boolean;

  // Grid options (affect base layer only)
  showNonRadialPoints: boolean;
  handPointVisibility: "all" | "active";

  // Prop type overrides
  bluePropType?: PropType;
  redPropType?: PropType;

  // Per-color motion visibility. When false, renderer skips that color's props+arrows.
  // Default: true (both visible). Affects base layer cache key.
  showBlueMotion?: boolean;
  showRedMotion?: boolean;

  // Glyphs baked into the base layer (toggle invalidates base cache, which
  // is acceptable given the rarity of toggles and low cost of a fresh render).
  /** VTG glyph (bottom-right category badge). */
  showVTG?: boolean;
  /** Elemental glyph (paired with VTG, same corner). */
  showElemental?: boolean;
  /** Start/end position letters (alpha/beta/gamma). */
  showPositions?: boolean;
}

/**
 * Visibility settings for layer composition
 */
export interface LayerVisibility {
  showTKA: boolean;
  showReversals: boolean;
}

/**
 * Result from a layer render operation
 */
export interface LayerRenderResult {
  canvas: RenderCanvas;
  cacheKey: string;
  fromCache: boolean;
  renderTimeMs: number;
}

/**
 * Result from a full composition
 */
export interface CompositionResult {
  canvas: RenderCanvas;
  timing: {
    totalMs: number;
    baseLayerMs: number;
    gridPointsLayerMs: number;
    tkaLayerMs: number;
    reversalLayerMs: number;
    beatLayerMs: number;
    compositeMs: number;
  };
  cacheStats: {
    baseFromCache: boolean;
    gridPointsFromCache: boolean;
    tkaFromCache: boolean;
    reversalFromCache: boolean;
  };
}

/**
 * Cache statistics for monitoring
 */
export interface LayerCacheStats {
  baseCacheSize: number;
  gridPointsCacheSize: number;
  tkaCacheSize: number;
  reversalCacheSize: number;
  baseCacheHits: number;
  baseCacheMisses: number;
  gridPointsCacheHits: number;
  gridPointsCacheMisses: number;
  tkaCacheHits: number;
  tkaCacheMisses: number;
  totalCompositions: number;
}

/**
 * Layer compositor interface
 */
export interface ILayerCompositor {
  /**
   * Compose a pictograph from cached layers
   *
   * The core operation: get/render each layer, then composite them
   * based on visibility settings.
   *
   * @param pictograph - Prepared pictograph data
   * @param options - Render options (size, dark mode, grid settings)
   * @param visibility - Which overlays to include
   * @param stepNumber - Optional beat number to display
   * @returns Composited canvas with timing and cache stats
   */
  compose(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber?: number
  ): Promise<CompositionResult>;

  /**
   * Render just the base layer (for cache warming)
   * Base layer includes props + arrows, but NOT grid dots
   */
  renderBaseLayer(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<LayerRenderResult>;

  /**
   * Render just the grid points overlay
   * Contains only the grid dots, affected by handPointVisibility and showNonRadialPoints
   */
  renderGridPointsOverlay(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<LayerRenderResult>;

  /**
   * Render just the TKA overlay (letter + turns + dot)
   * Returns null if pictograph has no letter
   */
  renderTKAOverlay(
    pictograph: PreparedPictographData,
    options: Pick<LayerRenderOptions, "size" | "darkMode">
  ): Promise<LayerRenderResult | null>;

  /**
   * Render just the reversal overlay
   * Returns null if no reversals
   */
  renderReversalOverlay(
    stepData: StepData,
    size: number,
    darkMode?: boolean
  ): Promise<LayerRenderResult | null>;

  /**
   * Get cache statistics
   */
  getCacheStats(): LayerCacheStats;

  /**
   * Clear all layer caches
   */
  clearCache(): void;

  /**
   * Clear specific layer cache
   */
  clearLayerCache(layer: LayerType): void;
}
