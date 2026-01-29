/**
 * Animation Path Cache Service
 *
 * Pre-computes entire animation sequence at high frame rate to provide
 * smooth, gap-free trail rendering regardless of actual playback performance.
 *
 * Benefits:
 * - Frame-independent: No gaps when device stutters
 * - Smooth interpolation: Can look up positions between frames
 * - Performance: One-time computation, reused for entire playback
 */

import type { PropState } from "../../shared/domain/types/PropState";
import type { TrailPoint } from "../../shared/domain/types/TrailTypes";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import type { PropEndpointConfig } from "$lib/shared/animation-engine/services/contracts/IPropPositionCalculator";

// ============================================================================
// PATH CACHE CONSTANTS
// ============================================================================

/** Default cache FPS - high for ultra-smooth trails */
const DEFAULT_CACHE_FPS = 120;

/** Default canvas size for endpoint calculations */
const DEFAULT_CACHE_CANVAS_SIZE = 950;

/** Default prop width for endpoint calculations */
const DEFAULT_PROP_WIDTH = 120;

/** Default prop height for endpoint calculations */
const DEFAULT_PROP_HEIGHT = 15;

/**
 * Pre-computed position data for a single prop at a specific time
 */
export interface PrecomputedPropPosition {
  /** Beat number (fractional, e.g., 2.5) */
  beat: number;
  /** Timestamp in milliseconds from animation start */
  timestamp: number;
  /** Prop state (angles, positions) */
  propState: PropState;
  /** Calculated endpoint positions for both ends */
  endpoints: {
    left: { x: number; y: number }; // endType = 0
    right: { x: number; y: number }; // endType = 1 (tip)
  };
}

/**
 * Pre-computed path data for a single prop (blue or red)
 */
export interface PrecomputedPropPath {
  /** Array of positions ordered by time */
  positions: PrecomputedPropPosition[];
  /** Quick lookup by beat number (rounded to nearest cache frame) */
  stepLookup: Map<number, number>; // beat -> index in positions array
}

/**
 * Complete pre-computed animation cache
 */
export interface AnimationPathCacheData {
  /** Pre-computed path for blue prop */
  bluePropPath: PrecomputedPropPath;
  /** Pre-computed path for red prop */
  redPropPath: PrecomputedPropPath;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Total number of steps in sequence */
  totalSteps: number;
  /** Cache frame rate (FPS) */
  cacheFps: number;
  /** Whether cache is valid and ready to use */
  isValid: boolean;
}

/**
 * Configuration for animation path caching
 */
export interface PathCacheConfig {
  /**
   * Frame rate for cache generation
   * Higher = smoother but more memory
   * Recommended: 60-120 FPS
   */
  cacheFps: number;

  /**
   * Canvas size for endpoint calculations
   * Should match actual canvas size
   */
  canvasSize: number;

  /**
   * Prop dimensions for endpoint calculations
   */
  propDimensions: {
    width: number;
    height: number;
  };
}

export const DEFAULT_PATH_CACHE_CONFIG: PathCacheConfig = {
  cacheFps: DEFAULT_CACHE_FPS,
  canvasSize: DEFAULT_CACHE_CANVAS_SIZE,
  propDimensions: { width: DEFAULT_PROP_WIDTH, height: DEFAULT_PROP_HEIGHT },
};

/**
 * Animation Path Cache Service
 *
 * Pre-computes animation paths to enable smooth, gap-free trail rendering.
 */
export class AnimationPathCache {
  private cacheData: AnimationPathCacheData | null = null;
  private config: PathCacheConfig;

  // Shared calculator for prop endpoint positions
  private readonly propPositionCalculator = new PropPositionCalculator();

  constructor(config: Partial<PathCacheConfig> = {}) {
    this.config = { ...DEFAULT_PATH_CACHE_CONFIG, ...config };
  }

  /**
   * Pre-compute animation paths for entire sequence
   *
   * @param orchestrator - Animation orchestrator to calculate prop states
   * @param totalSteps - Total number of steps in sequence
   * @param stepDurationMs - Duration of each beat in milliseconds
   */
  precomputePaths(
    calculateStateFunc: (beat: number) => {
      blueProp: PropState;
      redProp: PropState;
    },
    totalSteps: number,
    stepDurationMs: number
  ): AnimationPathCacheData {
    const totalDurationMs = totalSteps * stepDurationMs;
    const frameTimeMs = 1000 / this.config.cacheFps;
    const totalFrames = Math.ceil(totalDurationMs / frameTimeMs);

    const bluePositions: PrecomputedPropPosition[] = [];
    const redPositions: PrecomputedPropPosition[] = [];

    // Pre-compute positions for every virtual frame
    for (let frame = 0; frame <= totalFrames; frame++) {
      const timestamp = frame * frameTimeMs;
      const beat = timestamp / stepDurationMs; // Fractional beat number

      // Get prop states from orchestrator
      const { blueProp, redProp } = calculateStateFunc(beat);

      // Calculate endpoints using shared calculator
      const endpointConfig: PropEndpointConfig = {
        canvasSize: this.config.canvasSize,
        propDimensions: this.config.propDimensions,
      };

      const blueEndpoints = this.propPositionCalculator.calculateEndpoints(blueProp, endpointConfig);
      const redEndpoints = this.propPositionCalculator.calculateEndpoints(redProp, endpointConfig);

      // Debug logging disabled - too noisy
      // if (frame < 3) {
      //   console.log(`🔧 CACHE FRAME ${frame} (beat ${beat.toFixed(2)}):`);
      //   console.log(`   Blue: left=(${blueEndpoints.left.x.toFixed(1)}, ${blueEndpoints.left.y.toFixed(1)}), right=(${blueEndpoints.right.x.toFixed(1)}, ${blueEndpoints.right.y.toFixed(1)})`);
      // }

      // Store positions
      bluePositions.push({
        beat,
        timestamp,
        propState: { ...blueProp },
        endpoints: blueEndpoints,
      });

      redPositions.push({
        beat,
        timestamp,
        propState: { ...redProp },
        endpoints: redEndpoints,
      });
    }

    // Build beat lookup tables
    const blueBeatLookup = this.buildBeatLookup(bluePositions);
    const redBeatLookup = this.buildBeatLookup(redPositions);

    // Create cache data
    this.cacheData = {
      bluePropPath: {
        positions: bluePositions,
        stepLookup: blueBeatLookup,
      },
      redPropPath: {
        positions: redPositions,
        stepLookup: redBeatLookup,
      },
      totalDurationMs,
      totalSteps,
      cacheFps: this.config.cacheFps,
      isValid: true,
    };

    return this.cacheData;
  }

  /**
   * Get pre-computed trail points for a beat range
   *
   * @param propIndex - 0 for blue, 1 for red
   * @param endType - 0 for left end, 1 for right end (tip)
   * @param startStep - Start beat number (fractional, e.g., 2.5)
   * @param endStep - End beat number (fractional, e.g., 4.2)
   * @returns Array of trail points with beat-relative timestamps
   */
  getTrailPoints(
    propIndex: 0 | 1,
    endType: 0 | 1,
    startStep: number,
    endStep: number
  ): TrailPoint[] {
    if (!this.cacheData?.isValid) {
      return [];
    }

    const propPath =
      propIndex === 0
        ? this.cacheData.bluePropPath
        : this.cacheData.redPropPath;

    // Convert beat range to frame indices
    const stepDurationMs =
      this.cacheData.totalDurationMs / this.cacheData.totalSteps;
    const frameTimeMs = 1000 / this.config.cacheFps;

    const startTime = startStep * stepDurationMs;
    const endTime = endStep * stepDurationMs;

    const startFrame = Math.floor(startTime / frameTimeMs);
    const endFrame = Math.ceil(endTime / frameTimeMs);

    const trailPoints: TrailPoint[] = [];

    for (let frame = startFrame; frame <= endFrame; frame++) {
      if (frame >= 0 && frame < propPath.positions.length) {
        const position = propPath.positions[frame]!;
        const endpoint =
          endType === 0 ? position.endpoints.left : position.endpoints.right;

        trailPoints.push({
          x: endpoint.x,
          y: endpoint.y,
          timestamp: position.timestamp, // Beat-relative timestamp (0ms to totalDurationMs)
          propIndex,
          endType,
        });
      }
    }

    // Debug logging disabled - too noisy for every frame
    // if (trailPoints.length > 0 && trailPoints.length < 10) {
    //   console.log(`📦 CACHE RETRIEVAL (prop=${propIndex}, end=${endType}, steps ${startStep.toFixed(2)}-${endStep.toFixed(2)}):`);
    //   console.log(`   Frames ${startFrame}-${endFrame}, returned ${trailPoints.length} points`);
    // }

    return trailPoints;
  }

  /**
   * Get pre-computed trail points for a time range (animation-relative)
   *
   * @param propIndex - 0 for blue, 1 for red
   * @param endType - 0 for left end, 1 for right end (tip)
   * @param startTimeMs - Start time in ms from animation start (0-based)
   * @param endTimeMs - End time in ms from animation start (0-based)
   * @returns Array of trail points
   */
  getTrailPointsByTime(
    propIndex: 0 | 1,
    endType: 0 | 1,
    startTimeMs: number,
    endTimeMs: number
  ): TrailPoint[] {
    if (!this.cacheData?.isValid) {
      return [];
    }

    const stepDurationMs =
      this.cacheData.totalDurationMs / this.cacheData.totalSteps;
    const startStep = startTimeMs / stepDurationMs;
    const endStep = endTimeMs / stepDurationMs;

    return this.getTrailPoints(propIndex, endType, startStep, endStep);
  }

  /**
   * Get cached points for IAnimationCacheService interface compatibility
   * This is a wrapper around getTrailPoints to match the expected interface signature
   *
   * @param propIndex - 0 for blue, 1 for red
   * @param endType - 0 for left end, 1 for right end (tip)
   * @param startStep - Start beat number (fractional, e.g., 2.5)
   * @param endStep - End beat number (fractional, e.g., 4.2)
   * @param canvasSize - Canvas size (unused, kept for interface compatibility)
   * @returns Array of trail points with beat-relative timestamps
   */
  getCachedPoints(
    propIndex: 0 | 1,
    endType: 0 | 1,
    startStep: number,
    endStep: number,
    _canvasSize: number
  ): TrailPoint[] {
    // canvasSize is ignored - cache uses standard coordinate system (950x950)
    // and points are transformed by AnimatorCanvas as needed
    return this.getTrailPoints(propIndex, endType, startStep, endStep);
  }

  /**
   * Get position at specific beat number
   *
   * @param propIndex - 0 for blue, 1 for red
   * @param beat - Beat number (can be fractional)
   * @returns Position data or null if not found
   */
  getPositionAtBeat(
    propIndex: 0 | 1,
    beat: number
  ): PrecomputedPropPosition | null {
    if (!this.cacheData?.isValid) {
      return null;
    }

    const propPath =
      propIndex === 0
        ? this.cacheData.bluePropPath
        : this.cacheData.redPropPath;

    const roundedBeat =
      Math.round(beat * this.config.cacheFps) / this.config.cacheFps;
    const index = propPath.stepLookup.get(roundedBeat);

    if (
      index !== undefined &&
      index >= 0 &&
      index < propPath.positions.length
    ) {
      return propPath.positions[index]!;
    }

    return null;
  }

  /**
   * Get all cached positions for a prop
   *
   * @param propIndex - 0 for blue, 1 for red
   * @returns Array of all pre-computed positions
   */
  getAllPositions(propIndex: 0 | 1): readonly PrecomputedPropPosition[] {
    if (!this.cacheData?.isValid) {
      return [];
    }

    const propPath =
      propIndex === 0
        ? this.cacheData.bluePropPath
        : this.cacheData.redPropPath;

    return propPath.positions;
  }

  /**
   * Check if cache is valid and ready
   */
  isValid(): boolean {
    return this.cacheData?.isValid ?? false;
  }

  /**
   * Get cache metadata
   */
  getCacheInfo() {
    if (!this.cacheData) {
      return null;
    }

    return {
      totalSteps: this.cacheData.totalSteps,
      totalDurationMs: this.cacheData.totalDurationMs,
      cacheFps: this.cacheData.cacheFps,
      bluePointCount: this.cacheData.bluePropPath.positions.length,
      redPointCount: this.cacheData.redPropPath.positions.length,
    };
  }

  /**
   * Clear cache and free memory
   */
  clear(): void {
    this.cacheData = null;
  }

  /**
   * Update cache configuration
   */
  setConfig(config: Partial<PathCacheConfig>): void {
    this.config = { ...this.config, ...config };
    // Invalidate cache if config changes
    if (this.cacheData) {
      this.cacheData.isValid = false;
    }
  }

  /**
   * Build beat lookup table for fast position retrieval
   */
  private buildBeatLookup(
    positions: PrecomputedPropPosition[]
  ): Map<number, number> {
    const lookup = new Map<number, number>();

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]!;
      const roundedBeat =
        Math.round(position.beat * this.config.cacheFps) / this.config.cacheFps;
      lookup.set(roundedBeat, i);
    }

    return lookup;
  }
}

/**
 * Global cache instance (singleton pattern)
 * @deprecated Use DI container instead: container.items.animationPathCache
 * Kept for backward compatibility during migration.
 */
let globalCacheInstance: AnimationPathCache | null = null;

/**
 * Get or create global animation path cache instance
 * @deprecated Use DI container instead: container.items.animationPathCache
 * This global singleton bypasses dependency injection.
 */
export function getGlobalPathCache(
  config?: Partial<PathCacheConfig>
): AnimationPathCache {
  if (!globalCacheInstance) {
    globalCacheInstance = new AnimationPathCache(config);
  } else if (config) {
    globalCacheInstance.setConfig(config);
  }
  return globalCacheInstance;
}

/**
 * Clear global cache instance
 * @deprecated Use DI container instead: container.items.animationPathCache.clear()
 */
export function clearGlobalPathCache(): void {
  if (globalCacheInstance) {
    globalCacheInstance.clear();
    globalCacheInstance = null;
  }
}
