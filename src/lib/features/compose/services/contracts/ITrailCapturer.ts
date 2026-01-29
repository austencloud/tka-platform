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
} from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type { PropState } from "../../shared/domain/types/PropState";

/**
 * Prop states for trail capture (distinct from the simpler PropStates in domain)
 */
export interface TrailCapturePropStates {
  blueProp: PropState | null;
  redProp: PropState | null;
  secondaryBlueProp?: PropState | null;
  secondaryRedProp?: PropState | null;
}

/**
 * Prop dimensions for endpoint calculation
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Trail capture configuration
 */
export interface TrailCaptureConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  trailSettings: TrailSettings;
  /** Prop type for blue prop (e.g., "staff", "minihoop") - used for bilateral detection */
  bluePropType?: string | null;
  /** Prop type for red prop (e.g., "staff", "minihoop") - used for bilateral detection */
  redPropType?: string | null;
  /** Whether the sequence returns to its starting position (LOOP pattern) */
  isSeamlesslyLoopable?: boolean;
}

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
   * Get trail points for a specific prop/end combination
   * @param propIndex - 0=blue, 1=red, 2=secondaryBlue, 3=secondaryRed
   * @param endType - 0=left, 1=right
   */
  getTrailPoints(propIndex: 0 | 1 | 2 | 3, endType: 0 | 1): TrailPoint[];

  /**
   * Get all trail points for rendering
   */
  getAllTrailPoints(): {
    blue: TrailPoint[];
    red: TrailPoint[];
    secondaryBlue: TrailPoint[];
    secondaryRed: TrailPoint[];
  };

  /**
   * Fill provided arrays with trail points (avoids allocation)
   * CRITICAL: Use this in hot paths to prevent GC pressure on mobile
   */
  fillTrailPointArrays(
    blue: TrailPoint[],
    red: TrailPoint[],
    secondaryBlue: TrailPoint[],
    secondaryRed: TrailPoint[]
  ): void;

  /**
   * Clear all trail points and reset state
   */
  clearTrails(): void;

  /**
   * Update trail settings (triggers clear if mode changed to OFF)
   */
  updateSettings(settings: TrailSettings): void;

  /**
   * Set the animation cache service for backfill support
   */
  setAnimationCacheService(cacheService: IAnimationCacheService | null): void;

  /**
   * Set the performance monitor for adaptive sampling
   */
  setPerformanceMonitor(monitor: IPerformanceMonitorService | null): void;
}

/**
 * Animation cache service interface
 * Implemented by AnimationPathCache for backfilling trail gaps during device stutters
 */
export interface IAnimationCacheService {
  getCachedPoints(
    propIndex: 0 | 1,
    endType: 0 | 1,
    startStep: number,
    endStep: number,
    canvasSize: number
  ): TrailPoint[];
  isValid(): boolean;
}

/**
 * Performance monitor interface
 * Provides adaptive point spacing based on device performance
 */
export interface IPerformanceMonitorService {
  getAdaptivePointSpacing(): number;
}
