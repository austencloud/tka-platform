/**
 * Trail Overlay Canvas
 *
 * Dedicated Canvas2D overlay for trail rendering. Accumulates trail pixels
 * and fades them with the `destination-out` composite operation, producing
 * smooth trail decay that persists across sequence boundaries.
 *
 * Architecture follows the fire renderer pattern: reads prop tip positions
 * directly from PropState each frame (via PropPositionCalculator), maintaining
 * its own internal ring buffer. This makes it completely independent of the
 * SequenceCache/TrailCapturer pipeline, so sequence transitions are seamless.
 *
 * Follows the same overlay pattern as WebGLFireRenderer and LedOverlayRenderer:
 * position: absolute, pointer-events: none, z-index: 1.
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "../contracts/ITrailOverlayCanvas";
import type { TrailPoint } from "../../domain/types/TrailTypes";
import { TrackingMode } from "../../domain/types/TrailTypes";
import type { PropState } from "$lib/features/compose/shared/domain/types/PropState";
import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import { getTipPoints } from "../../domain/types/PropTipPoints";
import { getTrailPointConfig } from "../../domain/types/TrailPointTypes";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

/** Max points stored in each color's ring buffer */
const RING_BUFFER_SIZE = 120;

/** Points fed to the tapered renderer each frame */
const LEADING_EDGE = 20;

export class TrailOverlayCanvas implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  // Offscreen buffer for the tapered renderer — prevents polygon-edge
  // seams from accumulating on the overlay.
  private bufferCanvas: OffscreenCanvas | null = null;
  private bufferCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null;
  private trailRenderer = new Canvas2DTrailRenderer();
  private propPositionCalculator = new PropPositionCalculator();
  private width = 0;
  private height = 0;

  // Per-end ring buffers — separate buffers for left/right ends to prevent
  // the renderer from zigzagging between endpoints. Filled from PropState
  // each frame (fire-renderer pattern), independent of the SequenceCache.
  private blueLeftRing: TrailPoint[] = [];
  private blueRightRing: TrailPoint[] = [];
  private redLeftRing: TrailPoint[] = [];
  private redRightRing: TrailPoint[] = [];

  // Track previous tracking mode to detect changes
  private lastTrackingMode: TrackingMode | null = null;

  // Skip trail capture for the first few frames after initialization so
  // props can settle into their correct starting positions. Without this,
  // the very first frame captures props at an intermediate location (e.g.
  // origin or default coords) and the jump to the real position draws a
  // brief straight-line artifact that fades out.
  private warmupFramesRemaining = 0;
  private static readonly WARMUP_FRAMES = 3;

  initialize(container: HTMLElement, width: number, height: number): void {
    this.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute("aria-hidden", "true");

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "1";
    canvas.style.background = "transparent";

    container.appendChild(canvas);

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.bufferCanvas = new OffscreenCanvas(width, height);
    this.bufferCtx = this.bufferCanvas.getContext("2d");
    this.width = width;
    this.height = height;
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    const sizeChanged = width !== this.width || height !== this.height;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.bufferCanvas) {
      this.bufferCanvas.width = width;
      this.bufferCanvas.height = height;
    }
    this.width = width;
    this.height = height;

    // Canvas resize invalidates all ring buffer positions — they were
    // computed at the old canvas size and would cause artifact lines
    // when the next point is captured at the new size.
    if (sizeChanged) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.redLeftRing = [];
      this.redRightRing = [];
      this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
    }
  }

  renderFrame(params: TrailOverlayRenderParams): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Let props settle before capturing trail data. The first few frames
    // often have props at intermediate positions (default coords before the
    // animation engine places them), which produces a straight-line artifact.
    if (this.warmupFramesRemaining > 0) {
      this.warmupFramesRemaining--;
      return;
    }

    const {
      trailSettings,
      deltaTime,
      canvasSize,
      hasBlue,
      hasRed,
      blueProp,
      redProp,
      bluePropType,
      redPropType,
    } = params;

    // ---------------------------------------------------------------
    // 1. Capture current prop tip positions into ring buffers
    //    (fire-renderer pattern: always read from PropState directly)
    // ---------------------------------------------------------------
    // Clear ring buffers when tracking mode changes so stale points
    // don't create artifact lines. The overlay's painted pixels fade
    // naturally via destination-out.
    if (this.lastTrackingMode !== null && this.lastTrackingMode !== trailSettings.trackingMode) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.redLeftRing = [];
      this.redRightRing = [];
    }
    this.lastTrackingMode = trailSettings.trackingMode;

    // Unilateral props (club, fan, etc.) only have one tip — force single-end
    const blueIsBilateral = bluePropType ? isBilateralProp(bluePropType) : true;
    const redIsBilateral = redPropType ? isBilateralProp(redPropType) : true;
    const anyBilateral = blueIsBilateral || redIsBilateral;

    const trackLeft = anyBilateral &&
      (trailSettings.trackingMode === TrackingMode.LEFT_END ||
       trailSettings.trackingMode === TrackingMode.BOTH_ENDS);
    const trackRight =
      trailSettings.trackingMode === TrackingMode.RIGHT_END ||
      trailSettings.trackingMode === TrackingMode.BOTH_ENDS ||
      !anyBilateral; // unilateral always tracks the single tip

    if (blueProp && hasBlue) {
      this.capturePropTips(blueProp, canvasSize, bluePropType, 0, trackLeft, trackRight);
    }
    if (redProp && hasRed) {
      this.capturePropTips(redProp, canvasSize, redPropType, 1, trackLeft, trackRight);
    }

    // ---------------------------------------------------------------
    // 2. Fade existing content using destination-out
    // ---------------------------------------------------------------
    const fadeAmount = this.computeFadeAmount(
      trailSettings.fadeDurationMs,
      deltaTime
    );

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = fadeAmount;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    this.smoothAlphaDecay(ctx);

    // ---------------------------------------------------------------
    // 3. Draw leading edge from internal ring buffers
    //    Each end is drawn as a separate renderTrails pass to prevent
    //    the tapered polygon from zigzagging between endpoints.
    // ---------------------------------------------------------------
    const overlaySettings = {
      ...trailSettings,
      glowBlur: 0,
      lineWidth: Math.max(3.5, trailSettings.lineWidth),
    };

    const bCtx = this.bufferCtx;
    if (bCtx) {
      bCtx.clearRect(0, 0, this.width, this.height);
      let drew = false;

      // Draw each tracked end as a separate pass
      const endRings = this.getActiveRings(hasBlue, hasRed);
      for (const { blueRing, redRing } of endRings) {
        const blueLeading = this.getLeadingEdge(blueRing, canvasSize);
        const redLeading = this.getLeadingEdge(redRing, canvasSize);
        if (blueLeading.length >= 2 || redLeading.length >= 2) {
          this.trailRenderer.renderTrails(
            bCtx as CanvasRenderingContext2D,
            blueLeading,
            redLeading,
            overlaySettings,
            performance.now(),
            hasBlue && blueLeading.length >= 2,
            hasRed && redLeading.length >= 2,
            canvasSize
          );
          drew = true;
        }
      }

      if (drew) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.drawImage(this.bufferCanvas!, 0, 0);
        ctx.restore();
      }
    }
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
  }

  /** Flush stale trail data on sequence change. Applies a short warmup
   *  to let canvas sizing and prop state propagate before capturing. */
  clearBuffers(): void {
    if (!this.ctx) return;
    this.hasPrevCenter = false;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    // Always apply warmup — the orchestrator sets angles synchronously but
    // the canvas size may still be settling (resize events arrive async)
    // and Svelte reactive props may not have propagated yet.
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.width = 0;
    this.height = 0;
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  /**
   * Return the active ring buffer pairs based on which ends are being
   * drawn. Each pair gets its own renderTrails pass.
   */
  private getActiveRings(
    hasBlue: boolean,
    hasRed: boolean
  ): Array<{ blueRing: TrailPoint[]; redRing: TrailPoint[] }> {
    const result: Array<{ blueRing: TrailPoint[]; redRing: TrailPoint[] }> = [];

    // Left-end pass (if any left-end points exist)
    if (
      (hasBlue && this.blueLeftRing.length >= 2) ||
      (hasRed && this.redLeftRing.length >= 2)
    ) {
      result.push({
        blueRing: hasBlue ? this.blueLeftRing : [],
        redRing: hasRed ? this.redLeftRing : [],
      });
    }

    // Right-end pass
    if (
      (hasBlue && this.blueRightRing.length >= 2) ||
      (hasRed && this.redRightRing.length >= 2)
    ) {
      result.push({
        blueRing: hasBlue ? this.blueRightRing : [],
        redRing: hasRed ? this.redRightRing : [],
      });
    }

    return result;
  }

  /**
   * Capture tip positions for a single prop into the appropriate ring
   * buffers. Uses tip points directly (like FireTipTracker) and consults
   * the trail point config for which tip index to use (user's "Tip 3"
   * selection is honored via getTrailPointConfig).
   */
  private capturePropTips(
    prop: PropState,
    canvasSize: number,
    propType: string | null | undefined,
    propIndex: 0 | 1,
    trackLeft: boolean,
    trackRight: boolean
  ): void {
    const tipConfig = getTipPoints(propType);
    const pts = tipConfig.points;
    if (pts.length === 0) return;

    // Check if user has configured specific tip indices via trail point config
    const trailConfig = getTrailPointConfig(propType);

    // Resolve which tip point index to use for each end
    const leftTipIndex = trailConfig?.left?.type === "tip" ? trailConfig.left.index : 0;
    const rightTipIndex = trailConfig?.right?.type === "tip"
      ? trailConfig.right.index
      : (pts.length >= 2 ? 1 : 0);

    const center = this.propPositionCalculator.calculateCenter(
      prop,
      { canvasSize, propDimensions: { width: 252.8, height: 77.8 } }
    );
    const gridScaleFactor = canvasSize / 950;
    const cosA = Math.cos(prop.staffRotationAngle);
    const sinA = Math.sin(prop.staffRotationAngle);

    if (trackLeft && leftTipIndex < pts.length) {
      const tp = pts[leftTipIndex]!;
      const leftRing = propIndex === 0 ? this.blueLeftRing : this.redLeftRing;
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
      this.appendToRing(leftRing, worldX, worldY, canvasSize, propIndex, leftTipIndex);
    }
    if (trackRight && rightTipIndex < pts.length) {
      const tp = pts[rightTipIndex]!;
      const rightRing = propIndex === 0 ? this.blueRightRing : this.redRightRing;
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
      this.appendToRing(rightRing, worldX, worldY, canvasSize, propIndex, rightTipIndex);
    }
  }

  private appendToRing(
    ring: TrailPoint[],
    worldX: number,
    worldY: number,
    canvasSize: number,
    propIndex: 0 | 1,
    tipIndex: number
  ): void {

    if (ring.length > 0) {
      const last = ring[ring.length - 1]!;
      const dx = worldX - last.x;
      const dy = worldY - last.y;
      const distSq = dx * dx + dy * dy;

      // Skip discontinuities (teleports)
      if (distSq > (canvasSize * 0.3) ** 2) {
        ring.length = 0;
      }

      // Skip near-duplicate points. When props are stationary, floating
      // point jitter produces near-identical positions each frame. The
      // tapered renderer computes direction from consecutive points — if
      // they're sub-pixel apart, the direction is arbitrary and draws
      // visible artifact lines in random directions.
      // Minimum 0.5px movement required.
      if (ring.length > 0 && distSq < 0.25) {
        return;
      }
    }

    ring.push({
      x: worldX,
      y: worldY,
      timestamp: performance.now(),
      propIndex,
      tipIndex,
    });

    if (ring.length > RING_BUFFER_SIZE) {
      ring.splice(0, ring.length - RING_BUFFER_SIZE);
    }
  }

  /**
   * Extract the leading edge from a ring buffer, sanitized for
   * discontinuities. Returns at most LEADING_EDGE points.
   */
  private getLeadingEdge(
    ring: TrailPoint[],
    canvasSize: number
  ): TrailPoint[] {
    if (ring.length < 2) return ring;

    const start = Math.max(0, ring.length - LEADING_EDGE);
    const slice = ring.slice(start);

    // Walk backward from the newest point, trimming at any large gap
    const maxGapSq = (canvasSize * 0.3) ** 2;
    for (let i = slice.length - 1; i > 0; i--) {
      const curr = slice[i]!;
      const prev = slice[i - 1]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > maxGapSq) {
        return slice.slice(i);
      }
    }

    return slice;
  }

  private computeFadeAmount(
    fadeDurationMs: number,
    deltaTime: number
  ): number {
    const safeDuration = Math.max(fadeDurationMs, 16.67);
    const framesForFullFade = safeDuration / 16.67;
    const baseFade = 3.5 / framesForFullFade;
    return 1 - Math.pow(1 - baseFade, deltaTime * 60);
  }

  /**
   * Subtract a constant from every non-zero alpha pixel in the stuck zone.
   * Destination-out's multiplicative fade can never reach 0 due to 8-bit
   * integer rounding. Constant subtraction guarantees every pixel reaches 0.
   */
  private smoothAlphaDecay(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const DECAY = 2;
    let dirty = false;

    for (let i = 3; i < data.length; i += 4) {
      const a = data[i]!;
      if (a > 0 && a <= 28) {
        data[i] = Math.max(0, a - DECAY);
        dirty = true;
      }
    }

    if (dirty) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
}
