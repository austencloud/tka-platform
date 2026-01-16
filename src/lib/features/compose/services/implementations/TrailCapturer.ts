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
  TrailStyle,
  TrailEffect,
  FadeStyle,
  TaperStyle,
} from "../../shared/domain/types/TrailTypes";
import type {
  ITrailCapturer,
  TrailCapturePropStates,
  PropDimensions,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "../contracts/ITrailCapturer";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

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
// TRAIL LOOPTURE SERVICE
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
  // Configuration
  private config: TrailCaptureConfig = {
    canvasSize: 500,
    bluePropDimensions: { width: 252.8, height: 77.8 },
    redPropDimensions: { width: 252.8, height: 77.8 },
    trailSettings: {
      enabled: false,
      mode: TrailMode.OFF,
      trackingMode: TrackingMode.RIGHT_END,
      style: TrailStyle.SMOOTH_LINE as TrailStyle, // Default trail style
      effect: TrailEffect.NONE, // Default to no effect
      fadeStyle: FadeStyle.EXPONENTIAL, // Exponential fade (holds brightness longer)
      taperStyle: TaperStyle.NONE, // Tapering disabled - causes visual artifacts
      fadeDurationMs: 3000,
      maxPoints: 1000,
      lineWidth: 2,
      glowEnabled: false,
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
  private blueTrailBuffer = new CircularBuffer<TrailPoint>(1000);
  private redTrailBuffer = new CircularBuffer<TrailPoint>(1000);
  private secondaryBlueTrailBuffer = new CircularBuffer<TrailPoint>(1000);
  private secondaryRedTrailBuffer = new CircularBuffer<TrailPoint>(1000);

  // Last captured points for distance-based sampling
  // Key format: "propIndex-endType" (e.g., "0-1" = blue prop, right end)
  private lastCapturedPoints = new Map<string, LastCapturedPoint>();

  // Animation timing
  private animationStartTime: number | null = null;
  private previousBeatForLoopDetection = 0;

  // Optional dependencies for advanced features
  private animationCacheService: IAnimationCacheService | null = null;
  private performanceMonitor: IPerformanceMonitorService | null = null;

  // Default point spacing (used if no performance monitor)
  private readonly DEFAULT_POINT_SPACING = 0.75;

  // Memory leak prevention: Track total accumulated points
  // CRITICAL: Lower threshold for mobile devices which have limited memory
  // 8000 points = ~133 seconds at 60fps with default spacing (plenty for most animations)
  private totalPointsCaptured = 0;
  private readonly MAX_TOTAL_POINTS_BEFORE_PRUNE = 8000; // Reduced from 15000 for mobile memory safety

  // Constants
  private readonly GRID_HALFWAY_POINT_OFFSET = 150; // Matches strict grid points
  private readonly INWARD_FACTOR = 1.0; // No inward adjustment for animation mode
  private readonly INITIALIZATION_DELAY_MS = 500; // Wait for panel open and textures
  private readonly LARGE_BEAT_GAP_THRESHOLD = 0.05; // >0.05 steps = use cache (aggressive backfill for smooth trails)
  private readonly INITIAL_JUMP_DISTANCE_THRESHOLD = 200; // Skip trails for huge jumps

  initialize(config: TrailCaptureConfig): void {
    this.config = { ...config };
    this.clearTrails();
  }

  updateConfig(config: Partial<TrailCaptureConfig>): void {
    // DEBUG: Log when isSeamlesslyLoopable changes
    if (config.isSeamlesslyLoopable !== undefined &&
        config.isSeamlesslyLoopable !== this.config.isSeamlesslyLoopable) {
      console.log('[TrailCapturer] isSeamlesslyLoopable updated:', config.isSeamlesslyLoopable);
    }

    this.config = { ...this.config, ...config };

    // If settings changed, update trail settings
    if (config.trailSettings) {
      this.updateSettings(config.trailSettings);
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

    // DEBUG: Log loop detection and clearing logic
    if (loopDetected) {
      console.log('[TrailCapturer] Loop detected!', {
        beat,
        previousStep: this.previousBeatForLoopDetection,
        isSeamlesslyLoopable: this.config.isSeamlesslyLoopable,
        trailMode: trailSettings.mode,
        shouldClearOnLoop,
      });
    }

    if (shouldClearOnLoop && loopDetected) {
      console.log('[TrailCapturer] CLEARING TRAILS on loop');
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
    this.blueTrailBuffer.clear();
    this.redTrailBuffer.clear();
    this.secondaryBlueTrailBuffer.clear();
    this.secondaryRedTrailBuffer.clear();
    this.lastCapturedPoints.clear();
    this.animationStartTime = null;
    this.totalPointsCaptured = 0; // Reset counter to prevent false positives
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

      // Calculate current endpoint position
      const endpoint = this.calculatePropEndpoint(
        prop,
        propDimensions,
        this.config.canvasSize,
        endType,
        propType
      );

      // FIRST POINT: Wait for animation initialization
      if (lastPoint === undefined) {
        // Only capture first point after initialization delay
        if (currentTime >= this.INITIALIZATION_DELAY_MS) {
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
        const hasLargeBeatGap = beatDelta > this.LARGE_BEAT_GAP_THRESHOLD;

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
          const isInitialJump = distance > this.INITIAL_JUMP_DISTANCE_THRESHOLD;

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
    if (this.totalPointsCaptured > this.MAX_TOTAL_POINTS_BEFORE_PRUNE) {
      console.warn(
        `⚠️ Trail memory limit reached (${this.totalPointsCaptured} points), pruning to prevent crash`
      );
      this.pruneToReasonableSize(currentTime);
    }
  }

  /**
   * Emergency memory pruning - keeps only recent trail points
   * Called when total points exceed safety threshold
   */
  private pruneToReasonableSize(currentTime: number): void {
    const KEEP_DURATION_MS = 5000; // Keep last 5 seconds only
    const cutoffTime = currentTime - KEEP_DURATION_MS;

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
   * Calculate an endpoint position of a prop
   * Uses strict point positioning for animation viewer
   */
  private calculatePropEndpoint(
    prop: PropState,
    propDimensions: PropDimensions,
    canvasSize: number,
    endType: 0 | 1,
    propType?: string | null
  ): { x: number; y: number } {
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const gridScaleFactor = canvasSize / 950;
    const scaledHalfwayRadius =
      this.GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;

    let propCenterX: number;
    let propCenterY: number;

    if (prop.x !== undefined && prop.y !== undefined) {
      propCenterX = centerX + prop.x * scaledHalfwayRadius * this.INWARD_FACTOR;
      propCenterY = centerY + prop.y * scaledHalfwayRadius * this.INWARD_FACTOR;
    } else {
      propCenterX =
        centerX +
        Math.cos(prop.centerPathAngle) *
          scaledHalfwayRadius *
          this.INWARD_FACTOR;
      propCenterY =
        centerY +
        Math.sin(prop.centerPathAngle) *
          scaledHalfwayRadius *
          this.INWARD_FACTOR;
    }

    if (propType?.toLowerCase() === "hand") {
      return { x: propCenterX, y: propCenterY };
    }

    const staffHalfWidth = (propDimensions.width / 2) * gridScaleFactor;
    const staffEndOffset = endType === 1 ? staffHalfWidth : -staffHalfWidth;

    const endX =
      propCenterX + Math.cos(prop.staffRotationAngle) * staffEndOffset;
    const endY =
      propCenterY + Math.sin(prop.staffRotationAngle) * staffEndOffset;

    return { x: endX, y: endY };
  }

  /**
   * Get minimum point spacing based on device performance
   * Returns distance in pixels that prop must move before adding a new trail point
   */
  private getAdaptivePointSpacing(): number {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getAdaptivePointSpacing();
    }
    return this.DEFAULT_POINT_SPACING;
  }

  /**
   * Remove old trail points based on fade duration
   * Uses animation-relative timestamps (0ms to totalDurationMs)
   */
  private pruneOldTrailPoints(currentTime: number): void {
    if (this.config.trailSettings.mode !== TrailMode.FADE) return;

    const cutoffTime = currentTime - this.config.trailSettings.fadeDurationMs;

    // O(n) but only when needed (fade mode)
    this.blueTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);
    this.redTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);
    this.secondaryBlueTrailBuffer.filterInPlace(
      (p) => p.timestamp > cutoffTime
    );
    this.secondaryRedTrailBuffer.filterInPlace((p) => p.timestamp > cutoffTime);
  }
}
