/**
 * Trail Overlay - WebGL2 backend.
 *
 * Drop-in replacement for `TrailOverlayCanvas`. Preserves the entire
 * prop-tip capture pipeline (ring buffers, tracking modes, bilateral-prop
 * awareness, warmup) but drives the draw via the render-graph
 * `WebGL2Backend`. Each tracked endpoint becomes one tip in a single
 * `TrailPass`; the backend keeps per-tip ping-pong FBOs and decays them
 * on the GPU so the CPU cost per frame is O(current leading edge), not
 * O(all points ever).
 *
 * Runs at the same position + z-index as the Canvas2D overlay, so the
 * containing stack (fire, LEDs, props) composites unchanged.
 *
 * @deprecated Superseded by render-graph FrameGraph + RenderBackend.executeFrame().
 * Trail capture moves into the unified per-frame graph; no standalone overlay needed.
 * Gated behind window.__TKA_UNIFIED_VIEWER.
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "./ITrailOverlayCanvas";
import type { TrailPoint } from "../domain/types/TrailTypes";
import { TrackingMode } from "../domain/types/TrailTypes";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import { calculatePropCenter } from "$lib/shared/animation-engine/services/prop-position-calculator";
import { getTipPoints } from "../domain/types/PropTipPoints";
import { getTrailPointConfig } from "../domain/types/TrailPointTypes";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
import { Canvas2DVisibilityFadeManager } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-visibility-fade-manager";
import { resolveEffect } from "../domain/types/TipEffectTypes";

import type { RenderBackend } from "$lib/shared/render-graph/domain/backend";
import type { FrameGraph } from "$lib/shared/render-graph/domain/frame-graph";
import type {
  TrailPassPayload,
  TrailTipState,
} from "$lib/shared/render-graph/domain/trail-pass";
import { Z_ORDER } from "$lib/shared/render-graph/domain/render-pass";
import { createBackend } from "$lib/shared/render-graph/services/backend-factory";
import {
  MIN_TAIL_WIDTH_RATIO,
  FADE_EXPONENT,
} from "$lib/shared/render-graph/math/trail-mesh";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";
import {
  advanceTail,
  computeVisiblePath,
  createTailState,
  type TailState,
} from "$lib/shared/animation-engine/domain/tail-recession";

/**
 * Minimum ring capacity. Actual capacity is `max(RING_BUFFER_MIN, tailLength + RING_BUFFER_HEADROOM)`
 * so the ring always has room to capture fresh motion while the full visible
 * tail is still on screen.
 */
const RING_BUFFER_MIN = 120;
const RING_BUFFER_HEADROOM = 20;
const DEFAULT_LEADING_EDGE = 20;
const GLOW_RATIO = 2.5;

/** Convert TrailSettings.fadeDurationMs to the backend's decayPerSecond. */
function decayRateFor(fadeDurationMs: number): number {
  const safeDuration = Math.max(fadeDurationMs, 16.67);
  const framesForFullFade = safeDuration / 16.67;
  const basePerFrame = 3.5 / framesForFullFade;
  if (basePerFrame <= 0 || basePerFrame >= 1) return 3.0;
  return -60 * Math.log(1 - basePerFrame);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length !== 6) return [1, 1, 1];
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [1, 1, 1];
  return [r / 255, g / 255, b / 255];
}

export class TrailOverlayWebGL2 implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private backend: RenderBackend | null = null;
  private width = 0;
  private height = 0;

  private blueLeftRing: TrailPoint[] = [];
  private blueRightRing: TrailPoint[] = [];
  private redLeftRing: TrailPoint[] = [];
  private redRightRing: TrailPoint[] = [];

  // Per-ring tail recession state. `visibleCount` shrinks from the current
  // leading edge toward 2 while the prop is stationary, so the visible
  // window actually closes from the tail end instead of staying pinned at
  // "last N ring entries." `prog` interpolates the first visible point
  // between adjacent ring entries so recession is continuous, not step-wise.
  private blueLeftTail: TailState = createTailState(DEFAULT_LEADING_EDGE);
  private blueRightTail: TailState = createTailState(DEFAULT_LEADING_EDGE);
  private redLeftTail: TailState = createTailState(DEFAULT_LEADING_EDGE);
  private redRightTail: TailState = createTailState(DEFAULT_LEADING_EDGE);

  /** Current ring capacity - derived from `trailSettings.tailLength`. */
  private ringCapacity = RING_BUFFER_MIN;

  private lastTrackingMode: TrackingMode | null = null;
  private hasPrevCenter = false;

  // Track previous per-color visibility. When a color transitions from
  // hidden back to visible, its ring buffers still contain stale points
  // from before it was hidden, and the next capture would draw a straight
  // line between the stale tail and the fresh tip. Clear on false→true.
  private lastHasBlue = true;
  private lastHasRed = true;

  // Per-color tipId epoch. Bumped once the fade-out envelope reaches
  // zero, so the next fade-in allocates a fresh accumulator FBO rather
  // than inheriting the previous cycle's residual pixels. The idle FBO
  // is reclaimed by the backend's per-tip GC after MAX_UNUSED_FRAMES_
  // BEFORE_GC idle frames.
  private blueTipEpoch = 0;
  private redTipEpoch = 0;

  // Per-color alpha envelope. Matches prop fade timing (300 ms in /
  // 200 ms out with cubic ease-out) so the trail appears and disappears
  // alongside the prop instead of snapping in/out.
  private blueEnvelope = new Canvas2DVisibilityFadeManager(300, 200);
  private redEnvelope = new Canvas2DVisibilityFadeManager(300, 200);
  // Remembers whether the envelope was fully faded out on the previous
  // frame, so we know to bump the epoch (for a clean accumulator FBO)
  // before the next fade-in begins.
  private blueEnvelopeWasZero = false;
  private redEnvelopeWasZero = false;

  private warmupFramesRemaining = 0;
  private static readonly WARMUP_FRAMES = 3;

  // Monotonic VIRTUAL clock (ms) handed to the backend so the trail accumulator's
  // decay steps on the frame's virtual dt, NOT wall-clock. The backend derives its
  // decay dt from successive timestamps; feeding it performance.now() makes the
  // fade depend on real render cadence — fine for live (≈60fps rAF) but wrong for
  // a synchronous offscreen export, where it produced trails that started late and
  // never faded. Advancing this by params.deltaTime keeps live identical (its dt is
  // the rAF delta) and makes export deterministic (its dt is the fixed 1/60 step).
  private backendClockMs = 0;

  // Per-tip trail mask from previous frame (4 bits).
  private prevTipTrailMask = 0xF;

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
    this.width = width;
    this.height = height;
    this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;

    // WebGL2Backend.initialize is synchronous despite the async signature
    // (no awaits inside). The backend is usable the moment this returns.
    void createBackend(canvas, { preferred: "webgl2" }).then((backend) => {
      if (this.canvas === canvas) {
        this.backend = backend;
      } else {
        backend.dispose();
      }
    });
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    const sizeChanged = width !== this.width || height !== this.height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.backend?.resize(width, height);
    this.width = width;
    this.height = height;

    if (sizeChanged) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.redLeftRing = [];
      this.redRightRing = [];
      this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;
    }
  }

  renderFrame(params: TrailOverlayRenderParams): void {
    if (!this.canvas || !this.backend) return;

    if (this.warmupFramesRemaining > 0) {
      this.warmupFramesRemaining--;
      return;
    }

    // Advance the monotonic VIRTUAL clock by this frame's dt. Used for both the
    // visibility envelope and the backend's decay so the trail's timing is
    // frame-rate-independent: live advances it by the rAF delta (unchanged
    // behavior), the offscreen export by the fixed 1/60 step (deterministic).
    this.backendClockMs += Math.max(0, params.deltaTime * 1000);

    const {
      trailSettings,
      canvasSize,
      hasBlue,
      hasRed,
      blueProp,
      redProp,
      bluePropType,
      redPropType,
    } = params;

    const leadingEdge = Math.max(
      2,
      Math.floor(trailSettings.tailLength ?? DEFAULT_LEADING_EDGE),
    );
    this.ringCapacity = Math.max(RING_BUFFER_MIN, leadingEdge + RING_BUFFER_HEADROOM);

    if (this.lastTrackingMode !== null && this.lastTrackingMode !== trailSettings.trackingMode) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.redLeftRing = [];
      this.redRightRing = [];
      this.blueLeftTail = createTailState(leadingEdge);
      this.blueRightTail = createTailState(leadingEdge);
      this.redLeftTail = createTailState(leadingEdge);
      this.redRightTail = createTailState(leadingEdge);
    }
    this.lastTrackingMode = trailSettings.trackingMode;

    // Advance per-color envelopes toward the current target visibility.
    this.blueEnvelope.setVisible(hasBlue);
    this.redEnvelope.setVisible(hasRed);
    const nowMs = this.backendClockMs;
    const blueAlpha = this.blueEnvelope.updateProgress(nowMs).alpha;
    const redAlpha = this.redEnvelope.updateProgress(nowMs).alpha;

    // On hidden→visible transitions: reset the ring so the fresh trail
    // starts from the current prop position (not a straight line from
    // the stale tail to the new tip). If the envelope had already fully
    // faded out before the re-enable, bump the tipId epoch so the
    // backend hands us a pristine accumulator FBO for the fade-in.
    if (hasBlue && !this.lastHasBlue) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.blueLeftTail = createTailState(leadingEdge);
      this.blueRightTail = createTailState(leadingEdge);
      if (this.blueEnvelopeWasZero) {
        this.blueTipEpoch++;
        this.blueEnvelopeWasZero = false;
      }
    }
    if (hasRed && !this.lastHasRed) {
      this.redLeftRing = [];
      this.redRightRing = [];
      this.redLeftTail = createTailState(leadingEdge);
      this.redRightTail = createTailState(leadingEdge);
      if (this.redEnvelopeWasZero) {
        this.redTipEpoch++;
        this.redEnvelopeWasZero = false;
      }
    }

    // Latch "fully faded out" the first time the envelope reaches 0
    // while the color is hidden. The next hidden→visible transition
    // consults this flag to decide whether to bump the epoch.
    if (!hasBlue && blueAlpha === 0) this.blueEnvelopeWasZero = true;
    if (!hasRed && redAlpha === 0) this.redEnvelopeWasZero = true;

    this.lastHasBlue = hasBlue;
    this.lastHasRed = hasRed;

    const blueIsBilateral = bluePropType ? isBilateralProp(bluePropType) : true;
    const redIsBilateral = redPropType ? isBilateralProp(redPropType) : true;
    const anyBilateral = blueIsBilateral || redIsBilateral;

    const trackLeft =
      anyBilateral &&
      (trailSettings.trackingMode === TrackingMode.LEFT_END ||
        trailSettings.trackingMode === TrackingMode.BOTH_ENDS);
    const trackRight =
      trailSettings.trackingMode === TrackingMode.RIGHT_END ||
      trailSettings.trackingMode === TrackingMode.BOTH_ENDS ||
      !anyBilateral;

    // Per-tip effect gating
    const tipMap = params.tipEffectMap;
    const hasMap = tipMap && Object.keys(tipMap).length > 0;
    const blueLeftTrails = !hasMap || resolveEffect(0, 0, tipMap!, {}) === "trails";
    const blueRightTrails = !hasMap || resolveEffect(0, 1, tipMap!, {}) === "trails";
    const redLeftTrails = !hasMap || resolveEffect(1, 0, tipMap!, {}) === "trails";
    const redRightTrails = !hasMap || resolveEffect(1, 1, tipMap!, {}) === "trails";

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
        this.blueLeftTail = createTailState(leadingEdge);
        this.blueRightTail = createTailState(leadingEdge);
        this.blueTipEpoch++;
      }
      if (redBitsChanged) {
        this.redLeftRing = [];
        this.redRightRing = [];
        this.redLeftTail = createTailState(leadingEdge);
        this.redRightTail = createTailState(leadingEdge);
        this.redTipEpoch++;
      }
      this.prevTipTrailMask = tipMask;
    }

    let blueLeftMoved = false;
    let blueRightMoved = false;
    let redLeftMoved = false;
    let redRightMoved = false;
    // Keep capturing while the envelope is still fading so the trail
    // tracks the prop through the fade-out instead of freezing in place.
    const blueCaptureLive = hasBlue || blueAlpha > 0;
    const redCaptureLive = hasRed || redAlpha > 0;
    if (blueProp && blueCaptureLive) {
      const r = this.capturePropTips(blueProp, canvasSize, bluePropType, 0, trackLeft && blueLeftTrails, trackRight && blueRightTrails);
      blueLeftMoved = r.leftMoved;
      blueRightMoved = r.rightMoved;
    }
    if (redProp && redCaptureLive) {
      const r = this.capturePropTips(redProp, canvasSize, redPropType, 1, trackLeft && redLeftTrails, trackRight && redRightTrails);
      redLeftMoved = r.leftMoved;
      redRightMoved = r.rightMoved;
    }

    // Advance per-ring tail recession state. Moving frames update the
    // per-ring speed EMA and keep visibleCount at LEADING_EDGE. Stationary
    // frames walk the visible endpoint forward along the captured path at
    // the pre-stop speed - so stopping on a dime reads as "the trail
    // finishes the motion" instead of freezing at constant length.
    const dtMs = Math.max(0, params.deltaTime * 1000);

    this.blueLeftTail = advanceTail(this.blueLeftTail, this.blueLeftRing, blueLeftMoved, dtMs, leadingEdge);
    this.blueRightTail = advanceTail(this.blueRightTail, this.blueRightRing, blueRightMoved, dtMs, leadingEdge);
    this.redLeftTail = advanceTail(this.redLeftTail, this.redLeftRing, redLeftMoved, dtMs, leadingEdge);
    this.redRightTail = advanceTail(this.redRightTail, this.redRightRing, redRightMoved, dtMs, leadingEdge);

    // lineWidth is authored in reference-size (500px) pixels. On smaller
    // canvases, scale it down so the trail + glow halo stay the same
    // proportion of the frame - otherwise the fixed-pixel floor (3.5) and
    // the NDC division by canvas width make the halo a bigger share of a
    // small canvas, which reads as overblown glow on mobile.
    const effectScale = computeEffectScale(this.width, this.height);
    const scaledLineWidth = Math.max(3.5, trailSettings.lineWidth) * effectScale;
    const lineWidth = Math.max(1, scaledLineWidth);
    const thicknessNdc = (lineWidth * 2) / Math.max(1, this.width);
    const decayPerSecond = decayRateFor(trailSettings.fadeDurationMs);
    const glowNdc = thicknessNdc * GLOW_RATIO;
    const [bR, bG, bB] = hexToRgb(trailSettings.blueColor);
    const [rR, rG, rB] = hexToRgb(trailSettings.redColor);
    const alpha = Math.max(0, Math.min(1, trailSettings.maxOpacity));

    const tips: TrailTipState[] = [];

    // Epoch-scoped tipIds let the backend spin up a fresh accumulator FBO
    // after a full fade-out without wiping the whole backend.
    const blueSuffix = this.blueTipEpoch > 0 ? `-e${this.blueTipEpoch}` : "";
    const redSuffix = this.redTipEpoch > 0 ? `-e${this.redTipEpoch}` : "";

    // Emit tips whenever the envelope has any visibility. Stamps go into
    // the accumulator at full alpha so the trail's shape stays consistent
    // across the fade; the envelope shows up as `blitAlpha`, which the
    // backend multiplies into the composite when copying the accumulator
    // to screen. Result: the on-screen trail dims smoothly in step with
    // the envelope during fade-out and brightens during fade-in, instead
    // of staying bright until emission stops and then popping to zero.
    const pushTip = (
      tipId: string,
      ring: TrailPoint[],
      rgb: [number, number, number],
      tail: TailState,
      envelope: number,
    ) => {
      if (envelope <= 0) return;
      const path = computeVisiblePath(ring, tail, this.width, this.height);
      if (path.length < 2) return;
      tips.push({
        tipId,
        path,
        color: [rgb[0], rgb[1], rgb[2], alpha],
        thickness: thicknessNdc,
        taperTailRatio: MIN_TAIL_WIDTH_RATIO,
        glow: glowNdc,
        decayPerSecond,
        fadeExponent: FADE_EXPONENT,
        blendMode: "alpha",
        blitAlpha: envelope,
      });
    };

    pushTip(`blue-left${blueSuffix}`, this.blueLeftRing, [bR, bG, bB], this.blueLeftTail, blueAlpha);
    pushTip(`blue-right${blueSuffix}`, this.blueRightRing, [bR, bG, bB], this.blueRightTail, blueAlpha);
    pushTip(`red-left${redSuffix}`, this.redLeftRing, [rR, rG, rB], this.redLeftTail, redAlpha);
    pushTip(`red-right${redSuffix}`, this.redRightRing, [rR, rG, rB], this.redRightTail, redAlpha);

    const payload: TrailPassPayload = { tips };
    const graph: FrameGraph = {
      passes: [
        {
          kind: "trail",
          order: Z_ORDER.TRAIL,
          target: "scene",
          payload,
        },
      ],
      targets: {
        scene: { width: this.width, height: this.height, format: "rgba8" },
      },
    };

    // Backend decay steps on the virtual clock (accumulated at the top of render),
    // so the offscreen export fades exactly like 60fps live instead of decaying on
    // wall-clock cadence.
    this.backend.executeFrame(graph, this.backendClockMs);
  }

  clear(): void {
    this.resetRingsAndTails();
    this.blueEnvelope.reset();
    this.redEnvelope.reset();
    this.blueEnvelopeWasZero = false;
    this.redEnvelopeWasZero = false;
    this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;
    this.prevTipTrailMask = 0xF;
    this.rebuildBackend();
  }

  clearBuffers(): void {
    this.hasPrevCenter = false;
    this.resetRingsAndTails();
    this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;
    this.rebuildBackend();
  }

  private resetRingsAndTails(): void {
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    // Reset to DEFAULT_LEADING_EDGE - the next renderFrame will re-seed with
    // the current tailLength setting before the first advance call.
    this.blueLeftTail = createTailState(DEFAULT_LEADING_EDGE);
    this.blueRightTail = createTailState(DEFAULT_LEADING_EDGE);
    this.redLeftTail = createTailState(DEFAULT_LEADING_EDGE);
    this.redRightTail = createTailState(DEFAULT_LEADING_EDGE);
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  setCanvasZIndex(z: number): void {
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  dispose(): void {
    this.backend?.dispose();
    this.backend = null;
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.width = 0;
    this.height = 0;
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  /** Rebuild the backend against the current canvas so per-tip FBOs
   *  are dropped. Called on sequence transitions to guarantee a blank
   *  accumulator state. */
  private rebuildBackend(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.backend?.dispose();
    this.backend = null;
    void createBackend(canvas, { preferred: "webgl2" }).then((backend) => {
      if (this.canvas === canvas) {
        this.backend = backend;
      } else {
        backend.dispose();
      }
    });
  }

  /** Returns which rings received a new point this frame. */
  private capturePropTips(
    prop: PropState,
    canvasSize: number,
    propType: string | null | undefined,
    propIndex: 0 | 1,
    trackLeft: boolean,
    trackRight: boolean,
  ): { leftMoved: boolean; rightMoved: boolean } {
    let leftMoved = false;
    let rightMoved = false;
    const tipConfig = getTipPoints(propType);
    const pts = tipConfig.points;
    if (pts.length === 0) return { leftMoved, rightMoved };

    const trailConfig = getTrailPointConfig(propType);
    const leftTipIndex = trailConfig?.left?.type === "tip" ? trailConfig.left.index : 0;
    const rightTipIndex =
      trailConfig?.right?.type === "tip"
        ? trailConfig.right.index
        : pts.length >= 2
          ? 1
          : 0;

    const center = calculatePropCenter(prop, {
      canvasSize,
      propDimensions: { width: 252.8, height: 77.8 },
    });
    const gridScaleFactor = canvasSize / 950;
    const cosA = Math.cos(prop.staffRotationAngle);
    const sinA = Math.sin(prop.staffRotationAngle);

    if (trackLeft && leftTipIndex < pts.length) {
      const tp = pts[leftTipIndex]!;
      const leftRing = propIndex === 0 ? this.blueLeftRing : this.redLeftRing;
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
      leftMoved = this.appendToRing(leftRing, worldX, worldY, canvasSize, propIndex, leftTipIndex);
    }
    if (trackRight && rightTipIndex < pts.length) {
      const tp = pts[rightTipIndex]!;
      const rightRing = propIndex === 0 ? this.blueRightRing : this.redRightRing;
      const worldX = center.x + (tp.dx * cosA - tp.dy * sinA) * gridScaleFactor;
      const worldY = center.y + (tp.dx * sinA + tp.dy * cosA) * gridScaleFactor;
      rightMoved = this.appendToRing(rightRing, worldX, worldY, canvasSize, propIndex, rightTipIndex);
    }
    return { leftMoved, rightMoved };
  }

  /** Returns true if a new point was appended (prop moved enough),
   *  false if the call was a stationary / jitter no-op. */
  private appendToRing(
    ring: TrailPoint[],
    worldX: number,
    worldY: number,
    canvasSize: number,
    propIndex: 0 | 1,
    tipIndex: number,
  ): boolean {
    if (ring.length > 0) {
      const last = ring[ring.length - 1]!;
      const dx = worldX - last.x;
      const dy = worldY - last.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > (canvasSize * 0.3) ** 2) {
        ring.length = 0;
      }

      if (ring.length > 0 && distSq < 0.25) {
        return false;
      }
    }

    ring.push({
      x: worldX,
      y: worldY,
      timestamp: performance.now(),
      propIndex,
      tipIndex,
    });

    if (ring.length > this.ringCapacity) {
      ring.splice(0, ring.length - this.ringCapacity);
    }
    return true;
  }
}

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
// Trails is the kind:"trails" exception — ITrailOverlayCanvas.initialize returns
// void (not boolean) and has no isInitialized(). The descriptor casts to
// EffectRendererLike so the registry can hold it uniformly; consumers of the
// trails branch cast back to ITrailOverlayCanvas via the kind:"trails" path.
import type { EffectPlugin } from "./effects/EffectPlugin";
import type { EffectRendererLike } from "./effects/EffectRenderer";
import type { TrailsIntent } from "$lib/shared/effects/domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { TrailOverlayCanvas } from "./trail-overlay-canvas";

export const trailsEffectPlugin: EffectPlugin<TrailsIntent> = {
  id: "trails",
  kind: "trails",
  createRenderer: (): EffectRendererLike => {
    // Runtime A/B toggle: set window.__TKA_TRAIL_GPU = false before a sequence
    // starts to use the legacy Canvas2D overlay. Default is WebGL2.
    // trails is the kind:"trails" exception — consumed via the trails branch as
    // ITrailOverlayCanvas, not the strict EffectRendererLike contract.
    const flag =
      typeof window !== "undefined"
        ? (window as { __TKA_TRAIL_GPU?: boolean }).__TKA_TRAIL_GPU
        : undefined;
    if (flag === false) {
      console.info("[TrailOverlay] using legacy Canvas2D (window.__TKA_TRAIL_GPU = false)");
      return new TrailOverlayCanvas() as unknown as EffectRendererLike;
    }
    return new TrailOverlayWebGL2() as unknown as EffectRendererLike;
  },
  defaultConfig: DEFAULT_EFFECTS_CONFIG.trails,
  // RenderLoopConfig slot name for the trail overlay instance
  configKey: "trailOverlay",
};
