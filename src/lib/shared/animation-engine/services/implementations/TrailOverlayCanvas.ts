/**
 * Trail Overlay Canvas
 *
 * Dedicated Canvas2D overlay for trail rendering. Instead of clearing and
 * redrawing every trail point each frame (as the main canvas does), this
 * accumulates trail pixels and fades them with the `destination-out`
 * composite operation. The result is smooth, natural trail decay that
 * preserves trails across sequence boundaries.
 *
 * Follows the same overlay pattern as WebGLFireRenderer and LedOverlayRenderer:
 * position: absolute, pointer-events: none, z-index: 1.
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "../contracts/ITrailOverlayCanvas";
import type { TrailPoint } from "../../domain/types/TrailTypes";
import type { PropState } from "$lib/features/compose/shared/domain/types/PropState";
import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";

export class TrailOverlayCanvas implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private trailRenderer = new Canvas2DTrailRenderer();
  private propPositionCalculator = new PropPositionCalculator();
  private width = 0;
  private height = 0;

  // Track last known prop tip positions for gap-bridging
  private lastBluePos: { x: number; y: number } | null = null;
  private lastRedPos: { x: number; y: number } | null = null;

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
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  renderFrame(params: TrailOverlayRenderParams): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const {
      blueTrailPoints,
      redTrailPoints,
      trailSettings,
      deltaTime,
      canvasSize,
      hasBlue,
      hasRed,
      additionalLayers,
      blueProp,
      redProp,
    } = params;

    const hasPoints = blueTrailPoints.length >= 2 || redTrailPoints.length >= 2;

    // ---------------------------------------------------------------
    // 1. Fade existing content using destination-out
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

    // Smooth ghost cleanup: subtract a constant 2 from every non-zero
    // alpha pixel. Unlike the hard threshold approach, this creates a
    // smooth linear fade at the tail instead of visible jumps.
    this.smoothAlphaDecay(ctx);

    // ---------------------------------------------------------------
    // 2. Draw new trail segments
    // ---------------------------------------------------------------
    if (hasPoints) {
      // Cache has trail points — use full-quality renderer
      const LEADING_EDGE = 20;
      const blueLeading = this.sanitizeLeadingEdge(
        blueTrailPoints.length > LEADING_EDGE
          ? blueTrailPoints.slice(-LEADING_EDGE)
          : blueTrailPoints,
        canvasSize
      );
      const redLeading = this.sanitizeLeadingEdge(
        redTrailPoints.length > LEADING_EDGE
          ? redTrailPoints.slice(-LEADING_EDGE)
          : redTrailPoints,
        canvasSize
      );

      const overlaySettings = {
        ...trailSettings,
        glowBlur: 0,
        lineWidth: Math.max(3.5, trailSettings.lineWidth),
      };

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      this.trailRenderer.renderTrails(
        ctx,
        blueLeading,
        redLeading,
        overlaySettings,
        performance.now(),
        hasBlue,
        hasRed,
        canvasSize,
        undefined,
        additionalLayers?.map(layer => ({
          ...layer,
          blueTrailPoints: layer.blueTrailPoints.length > LEADING_EDGE
            ? layer.blueTrailPoints.slice(-LEADING_EDGE)
            : layer.blueTrailPoints,
          redTrailPoints: layer.redTrailPoints.length > LEADING_EDGE
            ? layer.redTrailPoints.slice(-LEADING_EDGE)
            : layer.redTrailPoints,
        }))
      );
      ctx.restore();

      // Update last known positions from trail points
      if (blueLeading.length > 0) {
        const last = blueLeading[blueLeading.length - 1]!;
        this.lastBluePos = { x: last.x, y: last.y };
      }
      if (redLeading.length > 0) {
        const last = redLeading[redLeading.length - 1]!;
        this.lastRedPos = { x: last.x, y: last.y };
      }
    } else if (blueProp || redProp) {
      // Cache is rebuilding — draw directly from prop positions to
      // bridge the gap. This keeps trails continuous across sequence
      // transitions instead of leaving an empty break.
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;

      const scale = canvasSize / 950;
      const lineWidth = Math.max(3.5, trailSettings.lineWidth) * scale * 0.6;

      if (blueProp && hasBlue) {
        this.drawPropBridge(ctx, blueProp, this.lastBluePos, trailSettings.blueColor, lineWidth, canvasSize);
        // Update last position from prop
        const endpoint = this.propPositionCalculator.calculateEndpoint(
          blueProp, { canvasSize, propDimensions: { width: 252.8, height: 77.8 } }, 1
        );
        this.lastBluePos = { x: endpoint.x, y: endpoint.y };
      }
      if (redProp && hasRed) {
        this.drawPropBridge(ctx, redProp, this.lastRedPos, trailSettings.redColor, lineWidth, canvasSize);
        const endpoint = this.propPositionCalculator.calculateEndpoint(
          redProp, { canvasSize, propDimensions: { width: 252.8, height: 77.8 } }, 1
        );
        this.lastRedPos = { x: endpoint.x, y: endpoint.y };
      }

      ctx.restore();
    }
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.lastBluePos = null;
    this.lastRedPos = null;
  }

  /**
   * Draw a connecting line from last known position to current prop endpoint.
   * Bridges the cache-rebuild gap during sequence transitions.
   */
  private drawPropBridge(
    ctx: CanvasRenderingContext2D,
    prop: PropState,
    lastPos: { x: number; y: number } | null,
    color: string,
    lineWidth: number,
    canvasSize: number
  ): void {
    const endpoint = this.propPositionCalculator.calculateEndpoint(
      prop, { canvasSize, propDimensions: { width: 252.8, height: 77.8 } }, 1
    );

    if (!lastPos) {
      // No previous position — just record, don't draw
      return;
    }

    // Skip if positions are too far apart (discontinuity)
    const dx = endpoint.x - lastPos.x;
    const dy = endpoint.y - lastPos.y;
    if (dx * dx + dy * dy > (canvasSize * 0.3) ** 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(endpoint.x, endpoint.y);
    ctx.stroke();
  }

  private sanitizeLeadingEdge(
    points: TrailPoint[],
    canvasSize: number
  ): TrailPoint[] {
    if (points.length < 2) return points;

    const maxGap = canvasSize * 0.3;
    const maxGapSq = maxGap * maxGap;

    for (let i = points.length - 1; i > 0; i--) {
      const curr = points[i]!;
      const prev = points[i - 1]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > maxGapSq) {
        return points.slice(i);
      }
    }

    return points;
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
    this.width = 0;
    this.height = 0;
    this.lastBluePos = null;
    this.lastRedPos = null;
  }

  private computeFadeAmount(fadeDurationMs: number, deltaTime: number): number {
    const safeDuration = Math.max(fadeDurationMs, 16.67);
    const framesForFullFade = safeDuration / 16.67;
    const baseFade = 3.5 / framesForFullFade;
    return 1 - Math.pow(1 - baseFade, deltaTime * 60);
  }

  /**
   * Subtract a constant from every non-zero alpha pixel.
   * Unlike a hard threshold (which creates visible jumps when chunks of
   * pixels cross the boundary simultaneously), constant subtraction creates
   * a smooth linear fade at the tail. And unlike multiplicative destination-out
   * (which can never reach zero due to 8-bit rounding), subtraction guarantees
   * every pixel eventually reaches alpha 0.
   */
  private smoothAlphaDecay(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const DECAY = 2; // subtract 2 per frame — reaches zero in ~14 frames from alpha 28
    let dirty = false;

    for (let i = 3; i < data.length; i += 4) {
      const a = data[i]!;
      if (a > 0 && a <= 28) {
        // Only apply constant decay in the zone where destination-out stalls
        data[i] = Math.max(0, a - DECAY);
        dirty = true;
      }
    }

    if (dirty) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
}
