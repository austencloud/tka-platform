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
 *
 * @deprecated Superseded by render-graph TrailPassExecutor + WebGL2Backend/WebGPUBackend.
 * Trail capture → TrailTranslator → TrailPass → GPU ping-pong decay.
 * Gated behind window.__TKA_UNIFIED_VIEWER.
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "./ITrailOverlayCanvas";
import type { TrailPoint, TrailSettings } from "../domain/types/trail-types";
import { TrackingMode } from "../domain/types/trail-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
import { Canvas2DVisibilityFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-visibility-fade-manager";
import { calculatePropCenter } from "$lib/shared/animation-engine/services/prop-position-calculator";
import { getTipPoints } from "../domain/types/prop-tip-points";
import { getTrailPointConfig } from "../domain/types/trail-point-types";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
import { resolveEffect } from "../domain/types/tip-effect-types";

/** Minimum ring capacity; actual capacity grows with `trailSettings.tailLength`. */
const RING_BUFFER_MIN = 120;
const RING_BUFFER_HEADROOM = 20;

/** Default visible leading edge when no settings have been applied yet. */
const DEFAULT_LEADING_EDGE = 20;

/**
 * Export-fidelity diagnostic. Counts how many times the trail accumulator is
 * actually stamped (one stamp per active color per time-advanced frame) and
 * records the last fade input (deltaTime) / output (fadeAmount). Enable from
 * the console before exporting:
 *   window.__tka_trail_diag.enable()
 * The video exporter reads this per captured frame and logs the stamp count,
 * so any value above the active-color count (1 or 2) proves duplicate stamping
 * — the cause of the "doubly opaque" export trail.
 */
const trailDiag = {
  enabled: false,
  stamps: 0,
  lastDt: 0,
  lastFade: 0,
};

function ensureTrailDiagHook(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  if (w.__tka_trail_diag) return;
  w.__tka_trail_diag = {
    enable() {
      trailDiag.enabled = true;
      trailDiag.stamps = 0;
    },
    disable() {
      trailDiag.enabled = false;
    },
    reset() {
      trailDiag.stamps = 0;
    },
    /** Read the accumulated stamp count + last fade values, then reset the count. */
    read() {
      const snapshot = {
        stamps: trailDiag.stamps,
        lastDt: trailDiag.lastDt,
        lastFade: trailDiag.lastFade,
      };
      trailDiag.stamps = 0;
      return snapshot;
    },
  };
}

export class TrailOverlayCanvas implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  // Per-color offscreen accumulator canvases. Each color owns its own
  // trail pixels so they can be composited with an independent alpha
  // envelope, giving smooth per-color fade-in / fade-out without the
  // two colors affecting each other.
  private blueAccumCanvas: OffscreenCanvas | null = null;
  private blueAccumCtx: OffscreenCanvasRenderingContext2D | null = null;
  private redAccumCanvas: OffscreenCanvas | null = null;
  private redAccumCtx: OffscreenCanvasRenderingContext2D | null = null;
  // Scratch buffer used by the tapered renderer on each accumulator to
  // prevent polygon-edge seams on the stamp pass.
  private bufferCanvas: OffscreenCanvas | null = null;
  private bufferCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null;
  private trailRenderer = new Canvas2DTrailRenderer();
  private width = 0;
  private height = 0;

  // Per-color alpha envelope. Matches prop fade timing (300 ms in / 200 ms
  // out with cubic ease-out) so the trail's appearance/disappearance
  // tracks the prop's motion-visibility transition.
  private blueEnvelope = new Canvas2DVisibilityFadeManager(300, 200);
  private redEnvelope = new Canvas2DVisibilityFadeManager(300, 200);
  // Tracks whether the previous frame's composite alpha was fully faded
  // out, so we can do a one-shot accumulator clear exactly when the
  // envelope reaches zero (guards against residual pixels bleeding into
  // the next fade-in cycle).
  private blueAccumClearedWhileHidden = true;
  private redAccumClearedWhileHidden = true;

  // Per-end ring buffers - separate buffers for left/right ends to prevent
  // the renderer from zigzagging between endpoints. Filled from PropState
  // each frame (fire-renderer pattern), independent of the SequenceCache.
  private blueLeftRing: TrailPoint[] = [];
  private blueRightRing: TrailPoint[] = [];
  private redLeftRing: TrailPoint[] = [];
  private redRightRing: TrailPoint[] = [];

  // Track previous tracking mode to detect changes
  private lastTrackingMode: TrackingMode | null = null;

  // Track previous per-color visibility. When a color transitions from
  // hidden back to visible, its ring buffers still contain stale points
  // from before it was hidden, and the next capture would draw a straight
  // line between the stale tail and the fresh tip. Clear on false→true.
  private lastHasBlue = true;
  private lastHasRed = true;

  // Tracks whether a previous center position exists for the center-point
  // smoothing path (used by clearBuffers to reset inter-sequence state).
  private hasPrevCenter = false;

  // smoothAlphaDecay does a full-canvas getImageData/putImageData roundtrip
  // - a GPU↔CPU sync of ~3.6MB at 950². Running it every frame dominated
  // render time (40-60ms). Amortize over N frames with a proportionally
  // larger DECAY step so observable fade rate is unchanged.
  private blueAlphaDecayFrameCounter = 0;
  private redAlphaDecayFrameCounter = 0;
  private static readonly SMOOTH_ALPHA_DECAY_INTERVAL = 10;
  private static readonly SMOOTH_ALPHA_DECAY_STEP = 20;

  // Skip trail capture for the first few frames after initialization so
  // props can settle into their correct starting positions. Without this,
  // the very first frame captures props at an intermediate location (e.g.
  // origin or default coords) and the jump to the real position draws a
  // brief straight-line artifact that fades out.
  private warmupFramesRemaining = 0;
  private static readonly WARMUP_FRAMES = 3;

  // Current per-settings leading edge and ring capacity; refreshed from
  // trailSettings.tailLength each renderFrame.
  private leadingEdge = DEFAULT_LEADING_EDGE;
  private ringCapacity = RING_BUFFER_MIN;

  // Per-tip trail flags from previous frame, encoded as a 4-bit mask
  // (bit0=blue-left, bit1=blue-right, bit2=red-left, bit3=red-right).
  // When the mask changes, accumulators for affected colors are cleared
  // so stale pixels from deactivated tips don't persist.
  private prevTipTrailMask = 0xF;

  initialize(container: HTMLElement, width: number, height: number): void {
    this.dispose();
    ensureTrailDiagHook();

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
    this.blueAccumCanvas = new OffscreenCanvas(width, height);
    this.blueAccumCtx = this.blueAccumCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.redAccumCanvas = new OffscreenCanvas(width, height);
    this.redAccumCtx = this.redAccumCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.width = width;
    this.height = height;
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
    // Envelopes start at fully visible; the first renderFrame will
    // immediately animate them toward the actual hasBlue/hasRed state.
    this.blueEnvelope.reset();
    this.redEnvelope.reset();
    this.blueAccumClearedWhileHidden = true;
    this.redAccumClearedWhileHidden = true;
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
    if (this.blueAccumCanvas) {
      this.blueAccumCanvas.width = width;
      this.blueAccumCanvas.height = height;
    }
    if (this.redAccumCanvas) {
      this.redAccumCanvas.width = width;
      this.redAccumCanvas.height = height;
    }
    this.width = width;
    this.height = height;

    // Canvas resize invalidates all ring buffer positions - they were
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
      currentTime,
    } = params;

    this.leadingEdge = Math.max(
      2,
      Math.floor(trailSettings.tailLength ?? DEFAULT_LEADING_EDGE),
    );
    this.ringCapacity = Math.max(
      RING_BUFFER_MIN,
      this.leadingEdge + RING_BUFFER_HEADROOM,
    );

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

    // Advance per-color alpha envelopes toward their target visibility.
    // The envelope drives the final composite alpha, so toggling a color
    // off animates the trail's opacity down over 200 ms and toggling it
    // back on animates it up over 300 ms (matching prop fade timing).
    // The envelope manager records setVisible() with performance.now()
    // internally, so updateProgress() must also read wall-clock time -
    // params.currentTime can be virtual/animation time and would make
    // the transition complete in a single frame if used here.
    const envelopeNow = performance.now();
    this.blueEnvelope.setVisible(hasBlue);
    this.redEnvelope.setVisible(hasRed);
    const blueFade = this.blueEnvelope.updateProgress(envelopeNow);
    const redFade = this.redEnvelope.updateProgress(envelopeNow);

    // When a color transitions false→true and its accumulator still
    // holds residual pixels from before the fade-out completed, clear
    // the accumulator so the fade-in doesn't reveal a ghost of the old
    // trail. We only guarantee a clear after the envelope reaches 0,
    // so a rapid toggle-off/on mid-fade keeps the old trail in place
    // and lets the envelope animate it back up seamlessly.
    const blueBecameVisible = hasBlue && !this.lastHasBlue;
    const redBecameVisible = hasRed && !this.lastHasRed;
    if (blueBecameVisible) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      if (this.blueAccumClearedWhileHidden && this.blueAccumCtx) {
        this.blueAccumCtx.clearRect(0, 0, this.width, this.height);
      }
      this.blueAccumClearedWhileHidden = false;
    }
    if (redBecameVisible) {
      this.redLeftRing = [];
      this.redRightRing = [];
      if (this.redAccumClearedWhileHidden && this.redAccumCtx) {
        this.redAccumCtx.clearRect(0, 0, this.width, this.height);
      }
      this.redAccumClearedWhileHidden = false;
    }
    this.lastHasBlue = hasBlue;
    this.lastHasRed = hasRed;

    // Unilateral props (club, fan, etc.) only have one tip - force single-end
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

    // Per-tip effect gating: only capture tips assigned to "trails" in
    // the tip effect map. When no map is provided, all tips are eligible.
    const tipMap = params.tipEffectMap;
    const hasMap = tipMap && Object.keys(tipMap).length > 0;
    const blueLeftTrails = !hasMap || resolveEffect(0, 0, tipMap!, {}) === "trails";
    const blueRightTrails = !hasMap || resolveEffect(0, 1, tipMap!, {}) === "trails";
    const redLeftTrails = !hasMap || resolveEffect(1, 0, tipMap!, {}) === "trails";
    const redRightTrails = !hasMap || resolveEffect(1, 1, tipMap!, {}) === "trails";

    // Detect tip-set changes. When a tip transitions from trailing to
    // non-trailing, its already-painted pixels are baked into the
    // accumulator. Clear the affected color's accumulator + ring buffers
    // so those stale pixels don't persist.
    const tipMask =
      (blueLeftTrails ? 1 : 0) |
      (blueRightTrails ? 2 : 0) |
      (redLeftTrails ? 4 : 0) |
      (redRightTrails ? 8 : 0);
    if (tipMask !== this.prevTipTrailMask) {
      const blueBitsChanged = (tipMask & 0x3) !== (this.prevTipTrailMask & 0x3);
      const redBitsChanged = (tipMask & 0xC) !== (this.prevTipTrailMask & 0xC);
      if (blueBitsChanged) {
        this.blueLeftRing = [];
        this.blueRightRing = [];
        this.blueAccumCtx?.clearRect(0, 0, this.width, this.height);
      }
      if (redBitsChanged) {
        this.redLeftRing = [];
        this.redRightRing = [];
        this.redAccumCtx?.clearRect(0, 0, this.width, this.height);
      }
      this.prevTipTrailMask = tipMask;
    }

    // Capture while the color is visible OR while its fade-out envelope
    // is still transitioning - this keeps the trail tracking the prop's
    // actual motion during the fade rather than freezing the last tail.
    // Capture stops once the envelope reaches zero (prop fully hidden),
    // so the ring doesn't keep growing invisibly in the background.
    const blueCaptureLive = hasBlue || blueFade.alpha > 0;
    const redCaptureLive = hasRed || redFade.alpha > 0;
    if (blueProp && blueCaptureLive) {
      this.capturePropTips(blueProp, canvasSize, bluePropType, 0, trackLeft && blueLeftTrails, trackRight && blueRightTrails, currentTime);
    }
    if (redProp && redCaptureLive) {
      this.capturePropTips(redProp, canvasSize, redPropType, 1, trackLeft && redLeftTrails, trackRight && redRightTrails, currentTime);
    }

    const fadeAmount = this.computeFadeAmount(
      trailSettings.fadeDurationMs,
      deltaTime
    );
    if (trailDiag.enabled) {
      trailDiag.lastDt = deltaTime;
      trailDiag.lastFade = fadeAmount;
    }
    const overlaySettings = {
      ...trailSettings,
      glowBlur: 0,
      lineWidth: Math.max(3.5, trailSettings.lineWidth),
    };

    // Advance each per-color accumulator: fade existing pixels, stamp
    // the current leading edge. Envelope doesn't touch the accumulator
    // contents - it only modulates the final composite alpha below.
    this.advanceAccumulator(
      this.blueAccumCtx,
      blueCaptureLive,
      blueFade.alpha > 0,
      this.blueLeftRing,
      this.blueRightRing,
      overlaySettings,
      currentTime,
      canvasSize,
      fadeAmount,
      /* isBlue */ true,
    );
    this.advanceAccumulator(
      this.redAccumCtx,
      redCaptureLive,
      redFade.alpha > 0,
      this.redLeftRing,
      this.redRightRing,
      overlaySettings,
      currentTime,
      canvasSize,
      fadeAmount,
      /* isBlue */ false,
    );

    // Mark each accumulator as "fully cleared while hidden" once its
    // envelope has finished animating out. Next hidden→visible transition
    // will do the safety clear so the fade-in starts from a blank canvas.
    if (!hasBlue && blueFade.alpha === 0 && !blueFade.isTransitioning) {
      if (!this.blueAccumClearedWhileHidden && this.blueAccumCtx) {
        this.blueAccumCtx.clearRect(0, 0, this.width, this.height);
        this.blueAccumClearedWhileHidden = true;
      }
    }
    if (!hasRed && redFade.alpha === 0 && !redFade.isTransitioning) {
      if (!this.redAccumClearedWhileHidden && this.redAccumCtx) {
        this.redAccumCtx.clearRect(0, 0, this.width, this.height);
        this.redAccumClearedWhileHidden = true;
      }
    }

    // Composite the two per-color accumulators onto the visible canvas
    // with their independent envelope alphas. This is where the fade
    // in/out animation actually shows up on screen.
    ctx.clearRect(0, 0, this.width, this.height);
    if (blueFade.alpha > 0 && this.blueAccumCanvas) {
      ctx.save();
      ctx.globalAlpha = blueFade.alpha;
      ctx.drawImage(this.blueAccumCanvas, 0, 0);
      ctx.restore();
    }
    if (redFade.alpha > 0 && this.redAccumCanvas) {
      ctx.save();
      ctx.globalAlpha = redFade.alpha;
      ctx.drawImage(this.redAccumCanvas, 0, 0);
      ctx.restore();
    }
  }

  /**
   * Fade + stamp one color's accumulator. `hasColor` gates whether a
   * new stamp is drawn this frame (false means the prop is toggled off
   * and the trail should freeze in place while the envelope fades out).
   * `envelopeLive` gates the fade pass - once the envelope is at zero
   * and the accumulator has been cleared, there is no point continuing
   * to run the costly smoothAlphaDecay read/write every frame.
   */
  private advanceAccumulator(
    accumCtx: OffscreenCanvasRenderingContext2D | null,
    hasColor: boolean,
    envelopeLive: boolean,
    leftRing: TrailPoint[],
    rightRing: TrailPoint[],
    overlaySettings: TrailSettings,
    currentTime: number,
    canvasSize: number,
    fadeAmount: number,
    isBlue: boolean,
  ): void {
    if (!accumCtx) return;
    if (!hasColor && !envelopeLive) {
      // Nothing on screen, nothing to draw - skip the whole pass.
      return;
    }

    accumCtx.save();
    accumCtx.globalCompositeOperation = "destination-out";
    accumCtx.globalAlpha = fadeAmount;
    accumCtx.fillStyle = "black";
    accumCtx.fillRect(0, 0, this.width, this.height);
    accumCtx.restore();

    this.smoothAlphaDecay(accumCtx, isBlue);

    if (!hasColor) return; // frozen trail fades out via the steps above

    const bCtx = this.bufferCtx;
    if (!bCtx) return;

    bCtx.clearRect(0, 0, this.width, this.height);
    let drew = false;

    const leftLeading = this.getLeadingEdge(leftRing, canvasSize);
    const rightLeading = this.getLeadingEdge(rightRing, canvasSize);
    const passes: TrailPoint[][] = [];
    if (leftLeading.length >= 2) passes.push(leftLeading);
    if (rightLeading.length >= 2) passes.push(rightLeading);

    for (const leading of passes) {
      // renderTrails takes a blue ring and a red ring separately - pass
      // the leading edge in only the active color's slot and an empty
      // array (with its `has*` flag set false) in the other.
      this.trailRenderer.renderTrails(
        bCtx as CanvasRenderingContext2D,
        isBlue ? leading : [],
        isBlue ? [] : leading,
        overlaySettings,
        currentTime,
        isBlue,
        !isBlue,
        canvasSize,
      );
      drew = true;
    }

    if (drew) {
      accumCtx.save();
      accumCtx.globalCompositeOperation = "source-over";
      accumCtx.globalAlpha = 1.0;
      accumCtx.drawImage(this.bufferCanvas!, 0, 0);
      accumCtx.restore();
      if (trailDiag.enabled) trailDiag.stamps++;
    }
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.blueAccumCtx?.clearRect(0, 0, this.width, this.height);
    this.redAccumCtx?.clearRect(0, 0, this.width, this.height);
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    this.blueEnvelope.reset();
    this.redEnvelope.reset();
    this.blueAccumClearedWhileHidden = true;
    this.redAccumClearedWhileHidden = true;
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
    this.prevTipTrailMask = 0xF;
  }

  /** Flush stale trail data on sequence change. Applies a short warmup
   *  to let canvas sizing and prop state propagate before capturing. */
  clearBuffers(): void {
    if (!this.ctx) return;
    this.hasPrevCenter = false;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.blueAccumCtx?.clearRect(0, 0, this.width, this.height);
    this.redAccumCtx?.clearRect(0, 0, this.width, this.height);
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    this.blueAccumClearedWhileHidden = true;
    this.redAccumClearedWhileHidden = true;
    // Always apply warmup - the orchestrator sets angles synchronously but
    // the canvas size may still be settling (resize events arrive async)
    // and Svelte reactive props may not have propagated yet.
    this.warmupFramesRemaining = TrailOverlayCanvas.WARMUP_FRAMES;
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  setCanvasZIndex(z: number): void {
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.blueAccumCanvas = null;
    this.blueAccumCtx = null;
    this.redAccumCanvas = null;
    this.redAccumCtx = null;
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
    trackRight: boolean,
    currentTime: number
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

    const center = calculatePropCenter(
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
      this.appendToRing(leftRing, worldX, worldY, canvasSize, propIndex, leftTipIndex, currentTime);
    }
    if (trackRight && rightTipIndex < pts.length) {
      const tp = pts[rightTipIndex]!;
      const rightRing = propIndex === 0 ? this.blueRightRing : this.redRightRing;
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
      this.appendToRing(rightRing, worldX, worldY, canvasSize, propIndex, rightTipIndex, currentTime);
    }
  }

  private appendToRing(
    ring: TrailPoint[],
    worldX: number,
    worldY: number,
    canvasSize: number,
    propIndex: 0 | 1,
    tipIndex: number,
    currentTime: number
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
      // point jitter produces near-identical positions each frame.
      // Update the timestamp of the last point instead of adding a new one
      // to allow the trail to fade into the prop when stationary.
      if (ring.length > 0 && distSq < 0.25) {
        last.timestamp = currentTime;
        return;
      }
    }

    ring.push({
      x: worldX,
      y: worldY,
      timestamp: currentTime,
      propIndex,
      tipIndex,
    });

    if (ring.length > this.ringCapacity) {
      ring.splice(0, ring.length - this.ringCapacity);
    }
  }

  /**
   * Extract the leading edge from a ring buffer, sanitized for
   * discontinuities. Returns at most `this.leadingEdge` points.
   */
  private getLeadingEdge(
    ring: TrailPoint[],
    canvasSize: number
  ): TrailPoint[] {
    if (ring.length < 2) return ring;

    const start = Math.max(0, ring.length - this.leadingEdge);
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
   *
   * Throttled to every SMOOTH_ALPHA_DECAY_INTERVAL frames - the full-canvas
   * getImageData/putImageData is a GPU↔CPU roundtrip (~3.6MB at 950²) that
   * dominated render time at 60fps. Killswitch: window.__TKA_DISABLE_SMOOTH_DECAY = true
   */
  private smoothAlphaDecay(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    isBlue: boolean,
  ): void {
    if (
      typeof window !== "undefined" &&
      (window as { __TKA_DISABLE_SMOOTH_DECAY?: boolean }).__TKA_DISABLE_SMOOTH_DECAY === true
    ) {
      return;
    }

    if (isBlue) {
      this.blueAlphaDecayFrameCounter++;
      if (this.blueAlphaDecayFrameCounter < TrailOverlayCanvas.SMOOTH_ALPHA_DECAY_INTERVAL) return;
      this.blueAlphaDecayFrameCounter = 0;
    } else {
      this.redAlphaDecayFrameCounter++;
      if (this.redAlphaDecayFrameCounter < TrailOverlayCanvas.SMOOTH_ALPHA_DECAY_INTERVAL) return;
      this.redAlphaDecayFrameCounter = 0;
    }

    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const DECAY = TrailOverlayCanvas.SMOOTH_ALPHA_DECAY_STEP;
    const THRESHOLD = DECAY + 10;
    let dirty = false;

    for (let i = 3; i < data.length; i += 4) {
      const a = data[i]!;
      if (a > 0 && a <= THRESHOLD) {
        data[i] = Math.max(0, a - DECAY);
        dirty = true;
      }
    }

    if (dirty) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
}
