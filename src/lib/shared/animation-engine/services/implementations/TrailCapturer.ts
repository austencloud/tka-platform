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

import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import type {
  TrailPoint,
  TrailSettings,
} from "$lib/shared/animation-engine/domain/types/TrailTypes";
import {
  TrackingMode,
  TrailMode,
  TrailEffect,
} from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type {
  TrailCapturePropStates,
  PropDimensions,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "$lib/shared/animation-engine/domain/types/TrailCaptureTypes";

export type {
  AdditionalLayerProps,
  TrailCapturePropStates,
  PropDimensions,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "$lib/shared/animation-engine/domain/types/TrailCaptureTypes";
import {
  calculatePropCenter,
  type PropEndpointConfig,
} from "$lib/shared/animation-engine/services/prop-position-calculator";
import { getTipPoints } from "$lib/shared/animation-engine/domain/types/PropTipPoints";

/** Standard viewbox size used by the prop coordinate system */
const VIEWBOX_SIZE = 950;

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

  last(): T | undefined {
    if (this.size === 0) return undefined;
    const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
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

export class TrailCapturer {
  // Configuration
  private config: TrailCaptureConfig = {
    canvasSize: 500,
    bluePropDimensions: { width: DEFAULT_PROP_WIDTH, height: DEFAULT_PROP_HEIGHT },
    redPropDimensions: { width: DEFAULT_PROP_WIDTH, height: DEFAULT_PROP_HEIGHT },
    trailSettings: {
      mode: TrailMode.OFF,
      effect: TrailEffect.NONE,
      trackingMode: TrackingMode.RIGHT_END,
      fadeDurationMs: 3000,
      maxPoints: 1000,
      lineWidth: 2,
      glowBlur: 0,
      blueColor: "#4A9EFF",
      redColor: "#FF6B6B",
      additionalLayerColors: [],
      minOpacity: 0.2,
      maxOpacity: 0.8,
      hideProps: false,
      usePathCache: true,
      previewMode: false,
      tailLength: 20,
    },
  };

  // Trail buffers: primary layer
  private blueTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);
  private redTrailBuffer = new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY);

  // Trail buffers: additional tunnel layers (lazily created)
  private additionalLayerBuffers: Array<{
    blue: CircularBuffer<TrailPoint>;
    red: CircularBuffer<TrailPoint>;
  }> = [];

  // Last captured points for distance-based sampling
  // Key format: "propIndex-tipIndex" (e.g., "0-1" = blue prop, tip index 1)
  private lastCapturedPoints = new Map<string, LastCapturedPoint>();

  // Animation timing
  private animationStartTime: number | null = null;
  private previousBeatForLoopDetection = 0;

  // Optional dependencies for advanced features
  private animationCacheService: IAnimationCacheService | null = null;
  private performanceMonitor: IPerformanceMonitorService | null = null;

  // Memory leak prevention: Track total accumulated points
  private totalPointsCaptured = 0;

  initialize(config: TrailCaptureConfig): void {
    this.config = { ...config };
    this.clearTrails();
  }

  updateConfig(config: Partial<TrailCaptureConfig>): void {
    const oldCanvasSize = this.config.canvasSize;
    const oldBluePropType = this.config.bluePropType;
    const oldRedPropType = this.config.redPropType;
    this.config = { ...this.config, ...config };

    // If prop type changed, clear trails so old endpoint positions don't
    // jump to the new prop's differently-sized endpoints
    const bluePropChanged =
      config.bluePropType !== undefined && config.bluePropType !== oldBluePropType;
    const redPropChanged =
      config.redPropType !== undefined && config.redPropType !== oldRedPropType;
    if (bluePropChanged || redPropChanged) {
      this.clearTrails();
      return;
    }

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
    for (const layer of this.additionalLayerBuffers) {
      this.scaleBuffer(layer.blue, scaleFactor);
      this.scaleBuffer(layer.red, scaleFactor);
    }

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

    // Clear trails if mode is OFF
    if (settings.mode === TrailMode.OFF) {
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

    // Skip if trails are off
    if (trailSettings.mode === TrailMode.OFF) {
      return;
    }

    // Initialize animation start time on first call
    if (this.animationStartTime === null) {
      this.animationStartTime = currentTime;
    }

    // Calculate animation-relative time (0ms to totalDurationMs)
    const animRelativeTime = currentTime - this.animationStartTime;

    // Use current step (fallback to 0 if undefined)
    const currentBeat = currentStep ?? 0;

    // Check for loop and clear trails if:
    // - Mode is LOOP_CLEAR (user explicitly wants clearing on every loop)
    // - OR sequence is not seamlessly loopable (props jump back, trails don't connect)
    // Note: undefined is treated as "not loopable" (clear on loop) for safety
    const shouldClearOnLoop =
      trailSettings.mode === TrailMode.LOOP_CLEAR ||
      this.config.isSeamlesslyLoopable !== true;

    const loopDetected = this.detectAnimationLoop(currentBeat);

    if (shouldClearOnLoop && loopDetected) {
      this.clearTrails();
      // Reset animation start time
      this.animationStartTime = currentTime;
    }

    // Capture trail points for primary layer
    if (props.blueProp) {
      this.captureTrailPoint(
        props.blueProp,
        this.config.bluePropDimensions,
        0,
        animRelativeTime,
        currentBeat
      );
    }
    if (props.redProp) {
      this.captureTrailPoint(
        props.redProp,
        this.config.redPropDimensions,
        1,
        animRelativeTime,
        currentBeat
      );
    }

    // Capture trail points for additional tunnel layers
    if (props.additionalLayers) {
      this.ensureAdditionalLayerBuffers(props.additionalLayers.length);
      for (let i = 0; i < props.additionalLayers.length; i++) {
        const layer = props.additionalLayers[i]!;
        if (layer.blueProp) {
          this.captureTrailPointForLayer(
            layer.blueProp,
            this.config.bluePropDimensions,
            0,
            animRelativeTime,
            currentBeat,
            i
          );
        }
        if (layer.redProp) {
          this.captureTrailPointForLayer(
            layer.redProp,
            this.config.redPropDimensions,
            1,
            animRelativeTime,
            currentBeat,
            i
          );
        }
      }
    }

    // Prune old trail points (fade mode only)
    this.pruneOldTrailPoints(animRelativeTime);
  }

  getTrailPoints(propIndex: 0 | 1, tipIndex: number, layerIndex: number = 0): TrailPoint[] {
    const buffer = this.getBufferForProp(propIndex, layerIndex);
    const allPoints = buffer.toArray();

    // Filter points for this specific tip
    return allPoints.filter((p) => p.tipIndex === tipIndex);
  }

  getAllTrailPoints(): {
    blue: TrailPoint[];
    red: TrailPoint[];
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>;
  } {
    return {
      blue: this.blueTrailBuffer.toArray(),
      red: this.redTrailBuffer.toArray(),
      additionalLayers: this.additionalLayerBuffers.map((layer) => ({
        blue: layer.blue.toArray(),
        red: layer.red.toArray(),
      })),
    };
  }

  /**
   * Fill provided arrays with trail points (avoids allocation)
   * CRITICAL: Use this in hot paths to prevent GC pressure on mobile
   */
  fillTrailPointArrays(
    blue: TrailPoint[],
    red: TrailPoint[],
    additionalLayers: Array<{ blue: TrailPoint[]; red: TrailPoint[] }>
  ): void {
    // Clear arrays without deallocating
    blue.length = 0;
    red.length = 0;

    // Fill from primary buffers using iterator (no intermediate array)
    for (const p of this.blueTrailBuffer) blue.push(p);
    for (const p of this.redTrailBuffer) red.push(p);

    // Fill additional layer arrays
    for (let i = 0; i < this.additionalLayerBuffers.length; i++) {
      // Ensure the output array has an entry for this layer
      if (!additionalLayers[i]) {
        additionalLayers[i] = { blue: [], red: [] };
      }
      const out = additionalLayers[i]!;
      out.blue.length = 0;
      out.red.length = 0;
      for (const p of this.additionalLayerBuffers[i]!.blue) out.blue.push(p);
      for (const p of this.additionalLayerBuffers[i]!.red) out.red.push(p);
    }
    // Trim excess entries if fewer layers than before
    additionalLayers.length = this.additionalLayerBuffers.length;
  }

  clearTrails(): void {
    this.blueTrailBuffer.clear();
    this.redTrailBuffer.clear();
    for (const layer of this.additionalLayerBuffers) {
      layer.blue.clear();
      layer.red.clear();
    }
    this.lastCapturedPoints.clear();
    this.animationStartTime = null;
    this.totalPointsCaptured = 0;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get the appropriate buffer for a prop index and layer
   * @param propIndex - 0=blue, 1=red
   * @param layerIndex - 0=primary, 1+=additional layers
   */
  private getBufferForProp(
    propIndex: 0 | 1,
    layerIndex: number = 0
  ): CircularBuffer<TrailPoint> {
    if (layerIndex === 0) {
      return propIndex === 0 ? this.blueTrailBuffer : this.redTrailBuffer;
    }
    const additionalIndex = layerIndex - 1;
    this.ensureAdditionalLayerBuffers(additionalIndex + 1);
    const layer = this.additionalLayerBuffers[additionalIndex]!;
    return propIndex === 0 ? layer.blue : layer.red;
  }

  /**
   * Ensure additional layer buffers exist for the given count
   */
  private ensureAdditionalLayerBuffers(count: number): void {
    while (this.additionalLayerBuffers.length < count) {
      this.additionalLayerBuffers.push({
        blue: new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY),
        red: new CircularBuffer<TrailPoint>(DEFAULT_BUFFER_CAPACITY),
      });
    }
  }

  /**
   * Capture trail point for an additional tunnel layer.
   * Uses tip-based tracking: enumerates tip points from PropTipPoints
   * and filters based on legacy TrackingMode fallback.
   */
  private captureTrailPointForLayer(
    prop: PropState,
    propDimensions: PropDimensions,
    propIndex: 0 | 1,
    currentTime: number,
    currentStep: number,
    additionalLayerIndex: number
  ): void {
    const propType = propIndex === 0 ? this.config.bluePropType : this.config.redPropType;
    const tipIndicesToTrack = this.resolveTipIndices(propIndex, propType);

    this.ensureAdditionalLayerBuffers(additionalLayerIndex + 1);
    const layerBuffers = this.additionalLayerBuffers[additionalLayerIndex]!;
    const buffer = propIndex === 0 ? layerBuffers.blue : layerBuffers.red;

    const tipConfig = getTipPoints(propType);
    const tipPoints = tipConfig.points;
    const center = calculatePropCenter(prop, {
      canvasSize: this.config.canvasSize,
      propDimensions,
    });
    const gridScaleFactor = this.config.canvasSize / VIEWBOX_SIZE;
    const cosA = Math.cos(prop.staffRotationAngle);
    const sinA = Math.sin(prop.staffRotationAngle);

    const minSpacing = this.getAdaptivePointSpacing();

    for (const tipIndex of tipIndicesToTrack) {
      if (tipIndex >= tipPoints.length) continue;
      const tp = tipPoints[tipIndex]!;

      // Transform tip from prop-local to canvas space
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;

      // Use layer-prefixed key to avoid collision with primary layer
      const key = `L${additionalLayerIndex + 1}-${propIndex}-${tipIndex}`;
      const lastPoint = this.lastCapturedPoints.get(key);

      if (lastPoint === undefined) {
        if (currentTime >= INITIALIZATION_DELAY_MS) {
          buffer.push({
            x: worldX,
            y: worldY,
            timestamp: currentTime,
            propIndex,
            tipIndex,
          });
          this.totalPointsCaptured++;
        }
        this.lastCapturedPoints.set(key, {
          x: worldX,
          y: worldY,
          beat: currentStep,
          timestamp: currentTime,
        });
      } else {
        const distance = Math.hypot(worldX - lastPoint.x, worldY - lastPoint.y);
        const timeSinceLastPoint = currentTime - lastPoint.timestamp; // eslint-disable-line @typescript-eslint/no-unused-vars
        const isInitialJump = distance > INITIAL_JUMP_DISTANCE_THRESHOLD;

        if (isInitialJump) {
          this.lastCapturedPoints.set(key, {
            x: worldX,
            y: worldY,
            beat: currentStep,
            timestamp: currentTime,
          });
        } else if (distance >= minSpacing) {
          buffer.push({
            x: worldX,
            y: worldY,
            timestamp: currentTime,
            propIndex,
            tipIndex,
          });
          this.totalPointsCaptured++;
          this.lastCapturedPoints.set(key, {
            x: worldX,
            y: worldY,
            beat: currentStep,
            timestamp: currentTime,
          });
        } else {
          // Stationary or small move - update the head point's timestamp to keep it fresh.
          // This allows the tail to continue fading/pruning while the head stays at the prop.
          const lastBufferPoint = buffer.last();
          if (lastBufferPoint) {
            lastBufferPoint.timestamp = currentTime;
          }
          this.lastCapturedPoints.set(key, {
            x: worldX,
            y: worldY,
            beat: currentStep,
            timestamp: currentTime,
          });
        }
      }
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
   * Resolve which tip indices to track based on legacy TrackingMode.
   * Used as fallback when no TipEffectMap assigns specific tips to trails.
   */
  private resolveTipIndices(
    propIndex: 0 | 1,
    propType: string | null | undefined
  ): number[] {
    const { trailSettings } = this.config;
    const tipConfig = getTipPoints(propType);
    const tipCount = tipConfig.points.length;

    if (tipCount === 0) return [];

    if (trailSettings.trackingMode === TrackingMode.BOTH_ENDS) {
      // Track all tips for the prop
      return Array.from({ length: tipCount }, (_, i) => i);
    } else if (trailSettings.trackingMode === TrackingMode.LEFT_END) {
      return [0];
    } else {
      // RIGHT_END: last tip (for staff that's index 1, for club that's index 0)
      return [tipCount - 1];
    }
  }

  /**
   * Capture trail points with distance-based sampling and intelligent cache backfill.
   * Uses tip-based tracking: enumerates tip points from PropTipPoints registry
   * and transforms each from prop-local to canvas space.
   *
   * Strategy:
   * 1. Distance-based sampling: Only add points when prop moves >N pixels
   * 2. Intelligent backfill: Use cache to fill gaps during device stutters
   * 3. Adaptive density: Adjust spacing based on device performance
   */
  private captureTrailPoint(
    prop: PropState,
    propDimensions: PropDimensions,
    propIndex: 0 | 1,
    currentTime: number,
    currentStep: number
  ): void {
    const { trailSettings } = this.config;
    const propType = propIndex === 0 ? this.config.bluePropType : this.config.redPropType;

    // Resolve which tips to track using legacy TrackingMode fallback
    const tipIndicesToTrack = this.resolveTipIndices(propIndex, propType);

    // Get tip point definitions for coordinate transformation
    const tipConfig = getTipPoints(propType);
    const tipPoints = tipConfig.points;

    // Compute prop center and transformation factors
    const endpointConfig: PropEndpointConfig = {
      canvasSize: this.config.canvasSize,
      propDimensions,
    };
    const center = calculatePropCenter(prop, endpointConfig);
    const gridScaleFactor = this.config.canvasSize / VIEWBOX_SIZE;
    const cosA = Math.cos(prop.staffRotationAngle);
    const sinA = Math.sin(prop.staffRotationAngle);

    // Select buffer based on prop index (primary layer)
    const buffer = this.getBufferForProp(propIndex, 0);

    // Get adaptive point spacing
    const minSpacing = this.getAdaptivePointSpacing();

    for (const tipIndex of tipIndicesToTrack) {
      if (tipIndex >= tipPoints.length) continue;
      const tp = tipPoints[tipIndex]!;

      // Transform tip from prop-local to canvas space
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;

      const key = `${propIndex}-${tipIndex}`;
      const lastPoint = this.lastCapturedPoints.get(key);

      // FIRST POINT: Wait for animation initialization
      if (lastPoint === undefined) {
        // Only capture first point after initialization delay
        if (currentTime >= INITIALIZATION_DELAY_MS) {
          buffer.push({
            x: worldX,
            y: worldY,
            timestamp: currentTime,
            propIndex,
            tipIndex,
          });
          this.totalPointsCaptured++;
        }

        // Always update tracking position (even if we don't capture the point yet)
        this.lastCapturedPoints.set(key, {
          x: worldX,
          y: worldY,
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
          const cachedPoints = this.animationCacheService.getCachedPoints(
            propIndex,
            tipIndex,
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
              this.totalPointsCaptured++;
              lastAddedX = cachedPoint.x;
              lastAddedY = cachedPoint.y;
            }
          }

          // Update last captured point
          this.lastCapturedPoints.set(key, {
            x: worldX,
            y: worldY,
            beat: currentStep,
            timestamp: currentTime,
          });
        } else {
          // REAL-TIME SAMPLING: Normal playback - use distance-based sampling
          const distance = Math.hypot(
            worldX - lastPoint.x,
            worldY - lastPoint.y
          );
          const timeSinceLastPoint = currentTime - lastPoint.timestamp; // eslint-disable-line @typescript-eslint/no-unused-vars

          // Detect initial jump (from default position to first beat position)
          const isInitialJump = distance > INITIAL_JUMP_DISTANCE_THRESHOLD;

          if (isInitialJump) {
            // Just update the tracking position without adding a trail point
            this.lastCapturedPoints.set(key, {
              x: worldX,
              y: worldY,
              beat: currentStep,
              timestamp: currentTime,
            });
          } else if (distance >= minSpacing) {
            // Normal trail capture - add point if prop moved far enough
            buffer.push({
              x: worldX,
              y: worldY,
              timestamp: currentTime,
              propIndex,
              tipIndex,
            });

            this.totalPointsCaptured++;
            this.lastCapturedPoints.set(key, {
              x: worldX,
              y: worldY,
              beat: currentStep,
              timestamp: currentTime,
            });
          } else {
            // Stationary or small move - update the head point's timestamp to keep it fresh.
            // This allows the tail to continue fading/pruning while the head stays at the prop.
            const lastBufferPoint = buffer.last();
            if (lastBufferPoint) {
              lastBufferPoint.timestamp = currentTime;
            }
            this.lastCapturedPoints.set(key, {
              x: worldX,
              y: worldY,
              beat: currentStep,
              timestamp: currentTime,
            });
          }
        }
      }
    }

    // CRITICAL: Prevent unbounded memory growth during long playback sessions
    // If we've accumulated too many points (e.g., playing for hours), prune aggressively
    if (this.totalPointsCaptured > MAX_TOTAL_POINTS_BEFORE_PRUNE) {
      this.pruneToReasonableSize(currentTime);
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
    for (const layer of this.additionalLayerBuffers) {
      layer.blue.filterInPlace((p) => p.timestamp > cutoffTime);
      layer.red.filterInPlace((p) => p.timestamp > cutoffTime);
    }

    // Reset counter
    let total = this.blueTrailBuffer.length + this.redTrailBuffer.length;
    for (const layer of this.additionalLayerBuffers) {
      total += layer.blue.length + layer.red.length;
    }
    this.totalPointsCaptured = total;
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
    for (const layer of this.additionalLayerBuffers) {
      layer.blue.filterInPlace(isValidPoint);
      layer.red.filterInPlace(isValidPoint);
    }
  }
}
