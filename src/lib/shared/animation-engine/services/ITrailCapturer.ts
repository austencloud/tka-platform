/**
 * Trail Capture Service Interface
 *
 * Handles real-time trail point capture with:
 * - Distance-based adaptive sampling
 * - Cache backfill during device stutters
 * - Loop detection and clearing
 * - Fade mode with automatic pruning
 * - Multi-prop and multi-endpoint support
 */

import type {
  TrailPoint,
  TrailSettings,
} from "$lib/shared/animation-engine/domain/types/trail-types";
import type {
  TrailCapturePropStates,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "$lib/shared/animation-engine/domain/types/trail-capture-types";

export type {
  AdditionalLayerProps,
  TrailCapturePropStates,
  PropDimensions,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "$lib/shared/animation-engine/domain/types/trail-capture-types";

/**
 * Service for capturing trail points during animation
 */
export interface ITrailCapturer {
  /**
   * Initialize the service with configuration
   */
  initialize(config: TrailCaptureConfig): void;

  /**
   * Update configuration (e.g., canvas resized, settings changed)
   */
  updateConfig(config: Partial<TrailCaptureConfig>): void;

  /**
   * Capture trail points for current frame
   * @param props - Current prop states
   * @param currentStep - Current beat number (for loop detection and cache queries)
   * @param currentTime - Current timestamp from performance.now()
   */
  captureFrame(
    props: TrailCapturePropStates,
    currentStep: number | undefined,
    currentTime: number
  ): void;

  /**
   * Get trail points for a specific prop/tip combination
   * @param propIndex - 0=blue, 1=red
   * @param tipIndex - Index into prop's tip points array
   * @param layerIndex - 0=primary, 1+=additional layers (optional, defaults to 0)
   */
  getTrailPoints(propIndex: 0 | 1, tipIndex: number, layerIndex?: number): TrailPoint[];

  getAllTrailPoints(): {
    blue: TrailPoint[];
    red: TrailPoint[];
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>;
  };

  /**
   * Fill provided arrays with trail points (avoids allocation)
   * CRITICAL: Use this in hot paths to prevent GC pressure on mobile
   */
  fillTrailPointArrays(
    blue: TrailPoint[],
    red: TrailPoint[],
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>
  ): void;

  /**
   * Fill ONLY the overlaid tunnel-layer trail arrays (allocation-free). Layer
   * trails are always sourced from the live capturer — the path cache holds
   * base prop paths (propIndex 0/1) only.
   */
  fillAdditionalLayerTrails(
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>
  ): void;

  /**
   * Clear all trail points and reset state
   */
  clearTrails(): void;

  /**
   * Update trail settings (triggers clear if mode changed to OFF)
   */
  updateSettings(settings: TrailSettings): void;

  setAnimationCacheService(cacheService: IAnimationCacheService | null): void;

  setPerformanceMonitor(monitor: IPerformanceMonitorService | null): void;
}
