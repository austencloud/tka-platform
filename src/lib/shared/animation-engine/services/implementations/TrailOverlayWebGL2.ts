/**
 * Trail Overlay — WebGL2 backend.
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
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "../contracts/ITrailOverlayCanvas";
import type { TrailPoint } from "../../domain/types/TrailTypes";
import { TrackingMode } from "../../domain/types/TrailTypes";
import type { PropState } from "$lib/features/compose/shared/domain/types/PropState";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import { getTipPoints } from "../../domain/types/PropTipPoints";
import { getTrailPointConfig } from "../../domain/types/TrailPointTypes";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

import type { RenderBackend } from "$lib/shared/render-graph/domain/Backend";
import type { FrameGraph } from "$lib/shared/render-graph/domain/FrameGraph";
import type {
  TrailPassPayload,
  TrailTipState,
} from "$lib/shared/render-graph/domain/TrailPass";
import { Z_ORDER } from "$lib/shared/render-graph/domain/RenderPass";
import { createBackend } from "$lib/shared/render-graph/services/implementations/BackendFactory";
import {
  MIN_TAIL_WIDTH_RATIO,
  FADE_EXPONENT,
} from "$lib/shared/render-graph/math/trail-mesh";

const RING_BUFFER_SIZE = 120;
const LEADING_EDGE = 20;
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
  private propPositionCalculator = new PropPositionCalculator();
  private width = 0;
  private height = 0;

  private blueLeftRing: TrailPoint[] = [];
  private blueRightRing: TrailPoint[] = [];
  private redLeftRing: TrailPoint[] = [];
  private redRightRing: TrailPoint[] = [];

  private lastTrackingMode: TrackingMode | null = null;
  private hasPrevCenter = false;

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

    if (this.lastTrackingMode !== null && this.lastTrackingMode !== trailSettings.trackingMode) {
      this.blueLeftRing = [];
      this.blueRightRing = [];
      this.redLeftRing = [];
      this.redRightRing = [];
    }
    this.lastTrackingMode = trailSettings.trackingMode;

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

    if (blueProp && hasBlue) {
      this.capturePropTips(blueProp, canvasSize, bluePropType, 0, trackLeft, trackRight);
    }
    if (redProp && hasRed) {
      this.capturePropTips(redProp, canvasSize, redPropType, 1, trackLeft, trackRight);
    }

    const lineWidth = Math.max(3.5, trailSettings.lineWidth);
    const thicknessNdc = (lineWidth * 2) / Math.max(1, this.width);
    const decayPerSecond = decayRateFor(trailSettings.fadeDurationMs);
    const glowNdc = thicknessNdc * GLOW_RATIO;
    const [bR, bG, bB] = hexToRgb(trailSettings.blueColor);
    const [rR, rG, rB] = hexToRgb(trailSettings.redColor);
    const alpha = Math.max(0, Math.min(1, trailSettings.maxOpacity));

    const tips: TrailTipState[] = [];

    const push = (tipId: string, ring: TrailPoint[], rgb: [number, number, number]) => {
      const path = this.ringToNdcPath(ring);
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
      });
    };

    if (hasBlue) {
      push("blue-left", this.blueLeftRing, [bR, bG, bB]);
      push("blue-right", this.blueRightRing, [bR, bG, bB]);
    }
    if (hasRed) {
      push("red-left", this.redLeftRing, [rR, rG, rB]);
      push("red-right", this.redRightRing, [rR, rG, rB]);
    }

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

    this.backend.executeFrame(graph, performance.now());
  }

  clear(): void {
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;
    this.rebuildBackend();
  }

  clearBuffers(): void {
    this.hasPrevCenter = false;
    this.blueLeftRing = [];
    this.blueRightRing = [];
    this.redLeftRing = [];
    this.redRightRing = [];
    this.warmupFramesRemaining = TrailOverlayWebGL2.WARMUP_FRAMES;
    this.rebuildBackend();
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
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

  private ringToNdcPath(ring: TrailPoint[]): Array<[number, number]> {
    if (ring.length < 2) return [];
    const start = Math.max(0, ring.length - LEADING_EDGE);
    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return [];

    // Walk backward trimming at any large gap.
    let gapStart = start;
    const maxGapSq = (Math.max(w, h) * 0.3) ** 2;
    for (let i = ring.length - 1; i > gapStart; i--) {
      const curr = ring[i]!;
      const prev = ring[i - 1]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > maxGapSq) {
        gapStart = i;
        break;
      }
    }

    const out: Array<[number, number]> = [];
    for (let i = gapStart; i < ring.length; i++) {
      const p = ring[i]!;
      const ndcX = (p.x / w) * 2 - 1;
      const ndcY = 1 - (p.y / h) * 2;
      out.push([ndcX, ndcY]);
    }
    return out;
  }

  private capturePropTips(
    prop: PropState,
    canvasSize: number,
    propType: string | null | undefined,
    propIndex: 0 | 1,
    trackLeft: boolean,
    trackRight: boolean,
  ): void {
    const tipConfig = getTipPoints(propType);
    const pts = tipConfig.points;
    if (pts.length === 0) return;

    const trailConfig = getTrailPointConfig(propType);
    const leftTipIndex = trailConfig?.left?.type === "tip" ? trailConfig.left.index : 0;
    const rightTipIndex =
      trailConfig?.right?.type === "tip"
        ? trailConfig.right.index
        : pts.length >= 2
          ? 1
          : 0;

    const center = this.propPositionCalculator.calculateCenter(prop, {
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
    tipIndex: number,
  ): void {
    if (ring.length > 0) {
      const last = ring[ring.length - 1]!;
      const dx = worldX - last.x;
      const dy = worldY - last.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > (canvasSize * 0.3) ** 2) {
        ring.length = 0;
      }

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
}
