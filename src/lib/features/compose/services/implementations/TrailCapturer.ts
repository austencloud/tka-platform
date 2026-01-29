/**
 * Trail Capture Service Implementation
 *
 * Handles real-time trail point capture with distance-based adaptive sampling.
 *
 * Key Features:
 * - Distance-based sampling: Only captures points when prop moves >N pixels
 * - Adaptive density: Adjusts spacing based on device performance
 * - Cache backfill: Fills gaps during device stutters with pre-computed paths
 * - Loop detection: Automatically clears trails when animation loops (LOOP_CLEAR mode)
 * - Fade mode: Automatically prunes old points based on fade duration
 *
 * Architecture:
 * - Uses CircularBuffer for O(1) point insertion and memory efficiency
 * - Coordinates with PerformanceMonitor for adaptive spacing
 * - Coordinates with AnimationCacheService for backfill during stutters
 */

import type { PropState } from "../../shared/domain/types/PropState";
import type {
  TrailPoint,
  TrailSettings,
} from "../../shared/domain/types/TrailTypes";
import {
  TrackingMode,
  TrailMode,
  TrailEffect,
} from "../../shared/domain/types/TrailTypes";
import type {
  ITrailCapturer,
  TrailCapturePropStates,
  PropDimensions,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
  TrailEventCallback,
  TrailEvent,
} from "../contracts/ITrailCapturer";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import type { PropEndpointConfig } from "$lib/shared/animation-engine/services/contracts/IPropPositionCalculator";

// ============================================================================
// CIRCULAR BUFFER (inlined for O(1) trail point management)
// ============================================================================

/**
 * High-performance ring buffer for managing trail points.
 * Provides O(1) push and automatic old point removal.
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  get length(): number {
    return this.size;
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) return undefined;
    return this.buffer[(this.tail + index) % this.capacity];
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[(this.tail + i) % this.capacity];
      if (item !== undefined) yield item;
    }
  }

  filterInPlace(predicate: (item: T) => boolean): void {
    const kept: T[] = [];
    for (const item of this) {
      if (predicate(item)) kept.push(item);
    }
    this.clear();
    for (const item of kept) this.push(item);
  }

  toArray(): T[] {
    return Array.from(this);
  }

  getLast(n: number): T[] {
    const result: T[] = [];
    const count = Math.min(n, this.size);
    const startIndex = this.size - count;
    for (let i = startIndex; i < this.size; i++) {
      const item = this.buffer[(this.tail + i) % this.capacity];
      if (item !== undefined) result.push(item);
    }
    return result;
  }
}

// ============================================================================
// TRAIL CAPTURE CONSTANTS
// ============================================================================

/** Wait for panel open and textures before capturing first point */
const INITIALIZATION_DELAY_MS = 500;

/** Beat gap threshold for triggering cache backfill (>0.05 steps = use cache) */
const LARGE_BEAT_GAP_THRESHOLD = 0.05;

/** Skip trails for jumps larger than this (initial position jump detection) */
const INITIAL_JUMP_DISTANCE_THRESHOLD = 200;

/** Default minimum distance in pixels before adding a new trail point */
const DEFAULT_POINT_SPACING = 0.75;

/** Maximum accumulated points before forced pruning (safety limit for mobile memory) */
const MAX_TOTAL_POINTS_BEFORE_PRUNE = 8000;

/** Duration to keep when emergency pruning (5 seconds) */
const EMERGENCY_PRUNE_KEEP_DURATION_MS = 5000;

/** Default trail buffer capacity */
const DEFAULT_BUFFER_CAPACITY = 1000;

/** Default prop dimensions (staff dimensions in viewbox units) */
const DEFAULT_PROP_WIDTH = 252.8;
const DEFAULT_PROP_HEIGHT = 77.8;

// ============================================================================
// TRAIL CAPTURE SERVICE
// ============================================================================

/**
 * Last captured point tracking for distance-based sampling
 */
interface LastCapturedPoint {
  x: number;
  y: number;
  beat: number;
  timestamp: number;
}

export class TrailCapturer implements ITrailCapturer {
  // Shared calculator for prop endpoint positions
  private readonly propPositionCalculator = new PropPositionCalculator();

  // Configuration
  private config: TrailCaptureConfig = {
    canvasSize: 500,
    bluePropDimensions: { width: DEFAULT_PROP_WIDTH, height: DEFAULT_PROP_HEIGHT },
    redPropDimensions: { width: DEFAULT_PROP_WIDTH, height: DEFAULT_PROP_HEIGHT },
    trailSettings: {
      enabled: false,
      mode: TrailMode.OFF,
      effect: TrailEffect.NONE,
      trackingMode: TrackingMode.RIGHT_END,
      fadeDurationMs: 3000,
      maxPoints: 1000,
      lineWidth: 2,
      glowBlur: 0,
      blueColor: "#4A9EFF",
      redColor: "#FF6B6B",
      minOpacity: 0.2,
      maxOpacity: 0.8,
      hideProps: false,
      usePathCache: true,
      previewMode: false,
    },
  };

  // Trail buffers (one per prop/end combination)
  private blueTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);
  private redTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);
  private secondaryBlueTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);
  private secondaryRedTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);

  // Last captured points for distance-based sampling
  // Key format: "propIndex-endType" (e.g., "0-1" = blue prop, right end)
  private lastCapturedPoints = new Map<string, LastCapturedPoint>();

  // Animation timing
  private animationStartTime: number | null = null;
  private previousBeatForLoopDetection = 0;

  // Optional dependencies for advanced features
  private animationCacheService: IAnimationCacheService | null = null;
  private performanceMonitor: IPerformanceMonitorService | null = null;

  // Memory leak prevention: Track total accumulated points
  private totalPointsCaptured = 0;

  // Event callback for UX feedback (memory pruning notifications, etc.)
  private eventCallback: TrailEventCallback | null = null;

  initialize(config: TrailCaptureConfig): void {
    this.config = { ...config };
    this.clearTrails();
  }

  updateConfig(config: Partial<TrailCaptureConfig>): void {
    const oldCanvasSize = this.config.canvasSize;
    this.config = { ...this.config, ...config };

    // If canvas size changed, scale existing trail points to match new size
    if (config.canvasSize !== undefined && config.canvasSize !== oldCanvasSize) {
      this.scaleTrailPoints(oldCanvasSize, config.canvasSize);
    }

    // If settings changed, update trail settings
    if (config.trailSettings) {
      this.updateSettings(config.trailSettings);
    }
  }

  /**
   * Scale all existing trail points when canvas size changes.
   * This maintains visual continuity during resize.
   */
  private scaleTrailPoints(oldSize: number, newSize: number): void {
    if (oldSize === 0 || newSize === 0) return;

    const scaleFactor = newSize / oldSize;

    // Scale points in all buffers
    this.scaleBuffer(this.blueTrailBuffer, scaleFactor);
    this.scaleBuffer(this.redTrailBuffer, scaleFactor);
    this.scaleBuffer(this.secondaryBlueTrailBuffer, scaleFactor);
    this.scaleBuffer(this.secondaryRedTrailBuffer, scaleFactor);

    // Also scale the last captured points tracking
    for (const [key, point] of this.lastCapturedPoints.entries()) {
      this.lastCapturedPoints.set(key, {
        ...point,
        x: point.x * scaleFactor,
        y: point.y * scaleFactor,
      });
    }
  }

  /**
   * Scale all points in a circular buffer by a factor
   */
  private scaleBuffer(buffer: CircularBuffer<TrailPoint>, scaleFactor: number): void {
    const length = buffer.length;
    for (let i = 0; i < length; i++) {
      const point = buffer.get(i);
      if (point) {
        point.x *= scaleFactor;
        point.y *= scaleFactor;
      }
    }
  }

  updateSettings(settings: TrailSettings): void {
    this.config.trailSettings = settings;

    // Clear trails if disabled or mode is OFF
    if (!settings.enabled || settings.mode === TrailMode.OFF) {
      this.clearTrails();
    }
  }

  setAnimationCacheService(cacheService: IAnimationCacheService | null): void {
    this.animationCacheService = cacheService;
  }

  setPerformanceMonitor(monitor: IPerformanceMonitorService | null): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Set callback for trail system events (memory pruning, etc.)
   * Use this to show user notifications when trails are auto-pruned
   */
  setEventCallback(callback: TrailEventCallback | null): void {
    this.eventCallback = callback;
  }

  captureFrame(
    props: TrailCapturePropStates,
    currentStep: number | undefined,
    currentTime: number
  ): void {
    const { trailSettings } = this.config;

    // Skip if trails disabled
    if (!trailSettings.enabled || trailSettings.mode === TrailMode.OFF) {
      return;
    }

    // Initialize animation start time on first call
    if (this.animationStartTime === null) {
      this.animationStartTime = currentTime;
    }

    // Calculate animation-relative time (0ms to totalDurationMs)
    const animRelativeTime = currentTime - this.animationStartTime;

    // Use current beat (fallback to 0 if undefined)
    const beat = currentStep ?? 0;

    // Check for loop and clear trails if:
    // - Mode is LOOP_CLEAR (user explicitly wants clearing on every loop)
    // - OR sequence is not seamlessly loopable (props jump back, trails don't connect)
    // Note: undefined is treated as "not loopable" (clear on loop) for safety
    const shouldClearOnLoop =
      trailSettings.mode === TrailMode.LOOP_CLEAR ||
      this.config.isSeamlesslyLoopable !== true;

    const loopDetected = this.detectAnimationLoop(beat);

    if (shouldClearOnLoop && loopDetected) {
      this.clearTrails();
      // Reset animation start time
      this.animationStartTime = currentTime;
    }

    // Capture trail points for each prop
    if (props.blueProp) {
      this.captureTrailPoint(
        props.blueProp,
        this.config.bluePropDimensions,
        0,
        animRelativeTime,
        beat
      );
    }
    if (props.redProp) {
      this.captureTrailPoint(
        props.redProp,
        this.config.redPropDimensions,
        1,
        animRelativeTime,
        beat
      );
    }
    if (props.secondaryBlueProp) {
      this.captureTrailPoint(
        props.secondaryBlueProp,
        this.config.bluePropDimensions,
        2,
        animRelativeTime,
        beat
      );
    }
    if (props.secondaryRedProp) {
      this.captureTrailPoint(
        props.secondaryRedProp,
        this.config.redPropDimensions,
        3,
        animRelativeTime,
        beat
      );
    }

    // Prune old trail points (fade mode only)
    this.pruneOldTrailPoints(animRelativeTime);
  }

  getTrailPoints(propIndex: 0 | 1 | 2 | 3, endType: 0 | 1): TrailPoint[] {
    const buffer = this.getBufferForProp(propIndex);
    const allPoints = buffer.toArray();

    // Filter points for this specific end
    return allPoints.filter((p) => p.endType === endType);
  }

  getAllTrailPoints(): {
    blue: TrailPoint[];
    red: TrailPoint[];
    secondaryBlue: TrailPoint[];
    secondaryRed: TrailPoint[];
  } {
    return {
      blue: this.blueTrailBuffer.toArray(),
      red: this.redTrailBuffer.toArray(),
      secondaryBlue: this.secondaryBlueTrailBuffer.toArray(),
      secondaryRed: this.secondaryRedTrailBuffer.toArray(),
    };
  }

  /**
   * Fill provided arrays with trail points (avoids allocation)
   * CRITICAL: Use this in hot paths to prevent GC pressure on mobile
   */
  fillTrailPointArrays(
    blue: TrailPoint[],
    red: TrailPoint[],
    secondaryBlue: TrailPoint[],
    secondaryRed: TrailPoint[]
  ): void {
    // Clear arrays without deallocating
    blue.length = 0;
    red.length = 0;
    secondaryBlue.length = 0;
    secondaryRed.length = 0;

    // Fill from buffers using iterator (no intermediate array)
    for (const p of this.blueTrailBuffer) blue.push(p);
    for (const p of this.redTrailBuffer) red.push(p);
    for (const p of this.secondaryBlueTrailBuffer) secondaryBlue.push(p);
    for (const p of this.secondaryRedTrailBuffer) secondaryRed.push(p);
  }

  clearTrails(): void {
    const hadPoints = this.totalPointsCaptured > 0;

    this.blueTrailBuffer.clear();
    this.redTrailBuffer.clear();
    this.secondaryBlueTrailBuffer.clear();
    this.secondaryRedTrailBuffer.clear();
    this.lastCapturedPoints.clear();
    this.animationStartTime = null;
    this.totalPointsCaptured = 0;

    // Emit event for UX feedback (only if there were points to clear)
    if (hadPoints && this.eventCallback) {
      this.eventCallback({
        type: "trails_cleared",
        pointsRemaining: 0,
        message: "Trails cleared",
      });
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get the appropriate buffer for a prop index
   */
  private getBufferForProp(
    propIndex: 0 | 1 | 2 | 3
  ): CircularBuffer<TrailPoint> {
    switch (propIndex) {
      case 0:
        return this.blueTrailBuffer;
      case 1:
        return this.redTrailBuffer;
      case 2:
        return this.secondaryBlueTrailBuffer;
      case 3:
        return this.secondaryRedTrailBuffer;
    }
  }

  /**
   * Detect if animation has looped (for LOOP_CLEAR mode)
   */
  private detectAnimationLoop(currentStep: number | undefined): boolean {
    if (currentStep === undefined) return false;
    const hasLooped =
      this.previousBeatForLoopDetection > 0.5 && currentStep < 0.5;
    this.previousBeatForLoopDetection = currentStep;
    return hasLooped;
  }

  /**
   * Capture trail point with distance-based sampling and intelligent cache backfill
   *
   * Strategy:
   * 1. Distance-based sampling: Only add points when prop moves >N pixels
   * 2. Intelligent backfill: Use cache to fill gaps during device stutters
   * 3. Adaptive density: Adjust spacing based on device performance
   */
  private captureTrailPoint(
    prop: PropState,
    propDimensions: PropDimensions,
    propIndex: 0 | 1 | 2 | 3,
    currentTime: number,
    currentStep: number
  ): void {
    const { trailSettings, bluePropType, redPropType } = this.config;

    // Determine which ends to track based on tracking mode AND prop type
    // For unilateral props (minihoop, fan, club), always use single end even if BOTH_ENDS is selected
    // This prevents imaginary second ends on props that only have one meaningful endpoint
    const propType =
      propIndex === 0 || propIndex === 2 ? bluePropType : redPropType;
    const isPropBilateral = propType ? isBilateralProp(propType) : true; // Default to bilateral if unknown
    const isHandProp = propType?.toLowerCase() === "hand";

    let endsToTrack: Array<0 | 1>;
    if (trailSettings.trackingMode === TrackingMode.BOTH_ENDS) {
      // Only track both ends for bilateral props (staff, buugeng, etc.)
      endsToTrack = isPropBilateral && !isHandProp ? [0, 1] : [1]; // Unilateral/hand uses single point
    } else if (trailSettings.trackingMode === TrackingMode.LEFT_END) {
      endsToTrack = [0];
    } else {
      endsToTrack = [1]; // RIGHT_END
    }

    // Select buffer based on prop index
    const buffer = this.getBufferForProp(propIndex);

    // Get adaptive point spacing
    const minSpacing = this.getAdaptivePointSpacing();

    for (const endType of endsToTrack) {
      const key = `${propIndex}-${endType}`;
      const lastPoint = this.lastCapturedPoints.get(key);

      // Calculate current endpoint position using shared calculator
      const endpointConfig: PropEndpointConfig = {
        canvasSize: this.config.canvasSize,
        propDimensions,
      };
      const endpoint = this.propPositionCalculator.calculateEndpoint(
        prop,
        endpointConfig,
        endType,
        propType
      );

      // FIRST POINT: Wait for animation initialization
      if (lastPoint === undefined) {
        // Only capture first point after initialization delay
        if (currentTime >= INITIALIZATION_DELAY_MS) {
          // Map propIndex to 0|1 for storage (secondary props map to primary)
          const storagePropIndex: 0 | 1 =
            propIndex === 0 || propIndex === 2 ? 0 : 1;
          const point: TrailPoint = {
            x: endpoint.x,
            y: endpoint.y,
            timestamp: currentTime,
            propIndex: storagePropIndex,
            endType,
          };
          buffer.push(point);
          this.totalPointsCaptured++;
        }

        // Always update tracking position (even if we don't capture the point yet)
        this.lastCapturedPoints.set(key, {
          x: endpoint.x,
          y: endpoint.y,
          beat: currentStep,
          timestamp: currentTime,
        });
      } else {
        // SUBSEQUENT POINTS: Use distance-based sampling with optional cache backfill

        const beatDelta = Math.abs(currentStep - lastPoint.beat);

        // Check if we have a LARGE beat gap (seeking or major stutter)
        const hasLargeBeatGap = beatDelta > LARGE_BEAT_GAP_THRESHOLD;

        if (
          hasLargeBeatGap &&
          trailSettings.usePathCache &&
          this.animationCacheService?.isValid()
        ) {
          // CACHE BACKFILL: Device stuttered - fill gap with pre-computed points
          // Map all prop indices to primary props (0/1) for cache lookup
          const cachePropIndex: 0 | 1 =
            propIndex === 0 || propIndex === 2 ? 0 : 1;
          const cachedPoints = this.animationCacheService.getCachedPoints(
            cachePropIndex,
            endType,
            lastPoint.beat,
            currentStep,
            this.config.canvasSize
          );

          // Add cached points but apply distance filtering to maintain consistent spacing
          let lastAddedX = lastPoint.x;
          let lastAddedY = lastPoint.y;

          for (const cachedPoint of cachedPoints) {
            const dist = Math.hypot(
              cachedPoint.x - lastAddedX,
              cachedPoint.y - lastAddedY
            );

            if (dist >= minSpacing) {
              buffer.push(cachedPoint);
              this.totalPointsCaptured++; // Track backfilled points too
              lastAddedX = cachedPoint.x;
              lastAddedY = cachedPoint.y;
            }
          }

          // Backfill gaps silently

          // Update last captured point
          this.lastCapturedPoints.set(key, {
            x: endpoint.x,
            y: endpoint.y,
            beat: currentStep,
            timestamp: currentTime,
          });
        } else {
          // REAL-TIME SAMPLING: Normal playback - use distance-based sampling
          const distance = Math.hypot(
            endpoint.x - lastPoint.x,
            endpoint.y - lastPoint.y
          );

          // Detect initial jump (from default position to first beat position)
          const isInitialJump = distance > INITIAL_JUMP_DISTANCE_THRESHOLD;

          if (isInitialJump) {
            // Just update the tracking position without adding a trail point
            this.lastCapturedPoints.set(key, {
              x: endpoint.x,
              y: endpoint.y,
              beat: currentStep,
              timestamp: currentTime,
            });
          } else if (distance >= minSpacing) {
            // Normal trail capture - add point if prop moved far enough
            // Map propIndex to 0|1 for storage (secondary props map to primary)
            const storagePropIndex: 0 | 1 =
              propIndex === 0 || propIndex === 2 ? 0 : 1;
            const point: TrailPoint = {
              x: endpoint.x,
              y: endpoint.y,
              timestamp: currentTime,
              propIndex: storagePropIndex,
              endType,
            };

            buffer.push(point);
            this.totalPointsCaptured++;
            this.lastCapturedPoints.set(key, {
              x: endpoint.x,
              y: endpoint.y,
              beat: currentStep,
              timestamp: currentTime,
            });
          }
          // If distance < minSpacing, skip this point (prevents oversaturation)
        }
      }
    }

    // CRITICAL: Prevent unbounded memory growth during long playback sessions
    // If we've accumulated too many points (e.g., playing for hours), prune aggressively
    if (this.totalPointsCaptured > MAX_TOTAL_POINTS_BEFORE_PRUNE) {
      const pointsBefore = this.totalPointsCaptured;
      this.pruneToReasonableSize(currentTime);
      const pointsPruned = pointsBefore - this.totalPointsCaptured;

      // Emit event for UX feedback
      if (this.eventCallback) {
        this.eventCallback({
          type: "memory_pruned",
          pointsPruned,
          pointsRemaining: this.totalPointsCaptured,
          message: `Trail memory optimized: removed ${pointsPruned} old points`,
        });
      }
    }
  }

  /**
   * Emergency memory pruning - keeps only recent trail points
   * Called when total points exceed safety threshold
   */
  private pruneToReasonableSize(currentTime: number): void {
    const cutoffTime = currentTime - EMERGENCY_PRUNE_KEEP_DURATION_MS;

    this.blueTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);
    this.redTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);
    this.secondaryBlueTrailBuffer.filterInPlace(
      (p) => p.timestamp > cutoffTime
    );
    this.secondaryRedTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);

    // Reset counter
    this.totalPointsCaptured =
      this.blueTrailBuffer.length +
      this.redTrailBuffer.length +
      this.secondaryBlueTrailBuffer.length +
      this.secondaryRedTrailBuffer.length;
  }

  /**
   * Get minimum point spacing based on device performance
   * Returns distance in pixels that prop must move before adding a new trail point
   */
  private getAdaptivePointSpacing(): number {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getAdaptivePointSpacing();
    }
    return DEFAULT_POINT_SPACING;
  }

  /**
   * Remove old trail points based on fade duration
   * Uses animation-relative timestamps (0ms to totalDurationMs)
   */
  private pruneOldTrailPoints(currentTime: number): void {
    if (this.config.trailSettings.mode !== TrailMode.FADE) return;

    const cutoffTime = currentTime - this.config.trailSettings.fadeDurationMs;

    // O(n) but only when needed (fade mode)
    // CRITICAL FIX: Also remove points with timestamp > currentTime
    // These are leftover points from a previous loop iteration.
    // When the animation loops, animRelativeTime resets to near 0, but old points
    // from the previous loop have high timestamps (e.g., 8000ms). Without this check,
    // the cutoffTime becomes negative and those old points are incorrectly kept,
    // causing the renderer to draw lines connecting distant positions.
    const isValidPoint = (p: TrailPoint) =>
      p.timestamp > cutoffTime && p.timestamp <= currentTime;

    this.blueTrailBuffer.filterInPlace(isValidPoint);
    this.redTrailBuffer.filterInPlace(isValidPoint);
    this.secondaryBlueTrailBuffer.filterInPlace(isValidPoint);
    this.secondaryRedTrailBuffer.filterInPlace(isValidPoint);
  }
}
