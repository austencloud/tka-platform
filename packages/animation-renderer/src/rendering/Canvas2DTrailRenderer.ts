/**
 * Canvas2D Trail Renderer
 *
 * Handles trail rendering using pure Canvas2D:
 * - Smooth trail rendering (Catmull-Rom splines)
 * - Segmented trail rendering
 * - Trail opacity calculations (fade/gradient)
 * - Multi-end trail support (both ends tracking)
 */

import type { TrailPoint, TrailSettings, QualityHints } from "@tka/types";
import { TrailMode, TrailEffect, TrackingMode } from "@tka/types";

// ============================================================================
// CATMULL-ROM SPLINE (pure math, no framework dependencies)
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

interface SplineConfig {
  alpha: number;
  subdivisionsPerSegment: number;
}

/**
 * Create smooth curve through control points using centripetal Catmull-Rom splines
 */
function createSmoothCurve(
  controlPoints: readonly Point2D[],
  config: Partial<SplineConfig> = {}
): Point2D[] {
  const alpha = config.alpha ?? 0.5;
  const subdivisions = config.subdivisionsPerSegment ?? 10;

  if (controlPoints.length < 2) return [...controlPoints];

  if (controlPoints.length === 2) {
    const points: Point2D[] = [];
    const [p0, p1] = controlPoints;
    for (let i = 0; i <= subdivisions; i++) {
      const t = i / subdivisions;
      points.push({
        x: p0!.x + (p1!.x - p0!.x) * t,
        y: p0!.y + (p1!.y - p0!.y) * t,
      });
    }
    return points;
  }

  const result: Point2D[] = [{ ...controlPoints[0]! }];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = i > 0 ? controlPoints[i - 1]! : controlPoints[i]!;
    const p1 = controlPoints[i]!;
    const p2 = controlPoints[i + 1]!;
    const p3 =
      i < controlPoints.length - 2
        ? controlPoints[i + 2]!
        : controlPoints[i + 1]!;

    const EPSILON = 1e-6;
    const getT = (t: number, pa: Point2D, pb: Point2D) => {
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return t + Math.max(EPSILON, Math.pow(dist, alpha));
    };

    const t0 = 0;
    const t1 = getT(t0, p0, p1);
    const t2 = getT(t1, p1, p2);
    const t3 = getT(t2, p2, p3);

    const safeDivide = (num: number, den: number) =>
      den === 0 ? 0 : num / den;
    const lerp = (pa: Point2D, pb: Point2D, t: number): Point2D => {
      const ct = Math.max(0, Math.min(1, t));
      return {
        x: pa.x + (pb.x - pa.x) * ct,
        y: pa.y + (pb.y - pa.y) * ct,
      };
    };

    for (let j = 1; j <= subdivisions; j++) {
      const t = t1 + (j / subdivisions) * (t2 - t1);

      const a1 = lerp(p0, p1, safeDivide(t - t0, t1 - t0));
      const a2 = lerp(p1, p2, safeDivide(t - t1, t2 - t1));
      const a3 = lerp(p2, p3, safeDivide(t - t2, t3 - t2));

      const b1 = lerp(a1, a2, safeDivide(t - t0, t2 - t0));
      const b2 = lerp(a2, a3, safeDivide(t - t1, t3 - t1));

      result.push(lerp(b1, b2, safeDivide(t - t1, t2 - t1)));
    }
  }

  return result;
}

// ============================================================================
// TRAIL RENDERING CONSTANTS
// ============================================================================

const FADE_EXPONENT = 2.5;
const MIN_TAIL_WIDTH_RATIO = 0.3;
const DEFAULT_GLOW_BLUR_MULTIPLIER = 4;
const FALLBACK_GLOW_BLUR = 8;
const MIN_SPLINE_SUBDIVISIONS = 2;
const MAX_SPLINE_SUBDIVISIONS = 10;
const TARGET_TOTAL_SUBDIVISIONS = 150;
const CATMULL_ROM_ALPHA = 0.5;

export class Canvas2DTrailRenderer {
  private controlPointsBuffer: Point2D[] = [];
  private leftEdgeBuffer: Point2D[] = [];
  private rightEdgeBuffer: Point2D[] = [];

  renderTrails(
    ctx: CanvasRenderingContext2D,
    blueTrailPoints: TrailPoint[],
    redTrailPoints: TrailPoint[],
    trailSettings: TrailSettings,
    currentTime: number,
    hasBlue: boolean,
    hasRed: boolean,
    qualityHints?: QualityHints
  ): void {
    if (!trailSettings.enabled || trailSettings.mode === TrailMode.OFF) {
      return;
    }

    if (hasBlue && blueTrailPoints.length >= 2) {
      this.renderTrailSegments(
        ctx,
        blueTrailPoints,
        trailSettings.blueColor,
        trailSettings,
        currentTime,
        qualityHints
      );
    }

    if (hasRed && redTrailPoints.length >= 2) {
      this.renderTrailSegments(
        ctx,
        redTrailPoints,
        trailSettings.redColor,
        trailSettings,
        currentTime,
        qualityHints
      );
    }
  }

  private renderTrailSegments(
    ctx: CanvasRenderingContext2D,
    points: TrailPoint[],
    colorString: string,
    settings: TrailSettings,
    currentTime: number,
    qualityHints?: QualityHints
  ): void {
    if (points.length < 2) return;

    let pointSets: TrailPoint[][];
    if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
      const leftPoints: TrailPoint[] = [];
      const rightPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 0) leftPoints.push(p);
        else rightPoints.push(p);
      }
      pointSets = [leftPoints, rightPoints];
    } else if (settings.trackingMode === TrackingMode.LEFT_END) {
      const leftPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 0) leftPoints.push(p);
      }
      pointSets = [leftPoints];
    } else {
      const rightPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 1) rightPoints.push(p);
      }
      pointSets = [rightPoints];
    }

    for (const pointSet of pointSets) {
      if (pointSet.length < 2) continue;
      this.renderSmoothTrail(
        ctx,
        pointSet,
        colorString,
        settings,
        currentTime,
        qualityHints
      );
    }
  }

  private renderSmoothTrail(
    ctx: CanvasRenderingContext2D,
    points: TrailPoint[],
    color: string,
    settings: TrailSettings,
    currentTime: number,
    qualityHints?: QualityHints
  ): void {
    if (points.length < 2) return;

    const controlPoints = this.controlPointsBuffer;
    controlPoints.length = points.length;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (controlPoints[i]) {
        controlPoints[i]!.x = p.x;
        controlPoints[i]!.y = p.y;
      } else {
        controlPoints[i] = { x: p.x, y: p.y };
      }
    }

    const targetTotal =
      qualityHints?.targetSubdivisions ?? TARGET_TOTAL_SUBDIVISIONS;
    const maxPerSegment =
      qualityHints?.maxSubdivisionsPerSegment ?? MAX_SPLINE_SUBDIVISIONS;
    const subdivisionsPerSegment = Math.max(
      MIN_SPLINE_SUBDIVISIONS,
      Math.min(maxPerSegment, Math.floor(targetTotal / points.length))
    );

    const smoothPoints = createSmoothCurve(controlPoints, {
      alpha: CATMULL_ROM_ALPHA,
      subdivisionsPerSegment,
    });

    if (smoothPoints.length < 2) return;

    const glowEnabled = qualityHints?.glowEnabled ?? true;
    const effect = !glowEnabled
      ? TrailEffect.NONE
      : (settings.effect ?? TrailEffect.GLOW);

    // Always use tapered rendering
    this.renderTaperedSmoothTrail(
      ctx,
      smoothPoints,
      points,
      color,
      settings,
      currentTime,
      effect
    );
  }

  private renderTaperedSmoothTrail(
    ctx: CanvasRenderingContext2D,
    smoothPoints: Point2D[],
    originalPoints: TrailPoint[],
    color: string,
    settings: TrailSettings,
    currentTime: number,
    effect: TrailEffect
  ): void {
    if (smoothPoints.length < 3) return;

    ctx.save();

    const avgOpacity = this.calculateOpacity(
      Math.floor(smoothPoints.length / 2),
      smoothPoints.length,
      originalPoints,
      settings,
      currentTime
    );

    const leftEdge = this.leftEdgeBuffer;
    const rightEdge = this.rightEdgeBuffer;
    leftEdge.length = smoothPoints.length;
    rightEdge.length = smoothPoints.length;

    for (let i = 0; i < smoothPoints.length; i++) {
      const curr = smoothPoints[i]!;
      const progress = i / (smoothPoints.length - 1);
      const halfWidth = this.calculateLineWidth(progress, settings) / 2;

      let dx: number, dy: number;
      if (i === 0) {
        const next = smoothPoints[1]!;
        dx = next.x - curr.x;
        dy = next.y - curr.y;
      } else if (i === smoothPoints.length - 1) {
        const prev = smoothPoints[i - 1]!;
        dx = curr.x - prev.x;
        dy = curr.y - prev.y;
      } else {
        const prev = smoothPoints[i - 1]!;
        const next = smoothPoints[i + 1]!;
        dx = next.x - prev.x;
        dy = next.y - prev.y;
      }

      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      if (leftEdge[i]) {
        leftEdge[i]!.x = curr.x + perpX * halfWidth;
        leftEdge[i]!.y = curr.y + perpY * halfWidth;
      } else {
        leftEdge[i] = {
          x: curr.x + perpX * halfWidth,
          y: curr.y + perpY * halfWidth,
        };
      }
      if (rightEdge[i]) {
        rightEdge[i]!.x = curr.x - perpX * halfWidth;
        rightEdge[i]!.y = curr.y - perpY * halfWidth;
      } else {
        rightEdge[i] = {
          x: curr.x - perpX * halfWidth,
          y: curr.y - perpY * halfWidth,
        };
      }
    }

    ctx.beginPath();

    ctx.moveTo(leftEdge[0]!.x, leftEdge[0]!.y);

    if (leftEdge.length >= 3) {
      const secondLeft = leftEdge[1]!;
      const thirdLeft = leftEdge[2]!;
      const midX = (secondLeft.x + thirdLeft.x) / 2;
      const midY = (secondLeft.y + thirdLeft.y) / 2;
      ctx.quadraticCurveTo(secondLeft.x, secondLeft.y, midX, midY);
    }

    for (let i = 2; i < leftEdge.length - 1; i++) {
      const point = leftEdge[i]!;
      const nextPoint = leftEdge[i + 1]!;
      const midX = (point.x + nextPoint.x) / 2;
      const midY = (point.y + nextPoint.y) / 2;
      ctx.quadraticCurveTo(point.x, point.y, midX, midY);
    }
    if (leftEdge.length >= 2) {
      const lastLeft = leftEdge[leftEdge.length - 1]!;
      const secondLastLeft = leftEdge[leftEdge.length - 2]!;
      ctx.quadraticCurveTo(
        secondLastLeft.x,
        secondLastLeft.y,
        lastLeft.x,
        lastLeft.y
      );
    }

    for (let i = rightEdge.length - 1; i > 1; i--) {
      const point = rightEdge[i]!;
      const prevPoint = rightEdge[i - 1]!;
      const midX = (point.x + prevPoint.x) / 2;
      const midY = (point.y + prevPoint.y) / 2;
      ctx.quadraticCurveTo(point.x, point.y, midX, midY);
    }
    if (rightEdge.length >= 2) {
      const firstRight = rightEdge[0]!;
      const secondRight = rightEdge[1]!;
      ctx.quadraticCurveTo(
        secondRight.x,
        secondRight.y,
        firstRight.x,
        firstRight.y
      );
    }

    ctx.closePath();

    if (effect === TrailEffect.GLOW) {
      const glowBlur =
        settings.glowBlur > 0
          ? settings.glowBlur * DEFAULT_GLOW_BLUR_MULTIPLIER
          : FALLBACK_GLOW_BLUR;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = avgOpacity;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = avgOpacity;
      ctx.fill();
    }

    ctx.restore();
  }

  private calculateOpacity(
    smoothPointIndex: number,
    totalSmoothPoints: number,
    originalPoints: TrailPoint[],
    settings: TrailSettings,
    currentTime: number
  ): number {
    if (settings.mode === TrailMode.FADE) {
      const originalPointIndex = Math.floor(
        (smoothPointIndex / totalSmoothPoints) * originalPoints.length
      );
      const originalPoint = originalPoints[originalPointIndex];

      if (originalPoint) {
        const age = currentTime - originalPoint.timestamp;
        const progress = Math.min(
          1,
          Math.max(0, age / settings.fadeDurationMs)
        );
        const fadeProgress = Math.pow(progress, FADE_EXPONENT);
        const opacity =
          settings.maxOpacity -
          fadeProgress * (settings.maxOpacity - settings.minOpacity);
        return Math.max(
          settings.minOpacity,
          Math.min(settings.maxOpacity, opacity)
        );
      } else {
        return settings.maxOpacity;
      }
    } else {
      const progress = smoothPointIndex / (totalSmoothPoints - 1);
      return (
        settings.minOpacity +
        progress * (settings.maxOpacity - settings.minOpacity)
      );
    }
  }

  private calculateLineWidth(
    progress: number,
    settings: TrailSettings
  ): number {
    const widthRatio =
      MIN_TAIL_WIDTH_RATIO + (1 - MIN_TAIL_WIDTH_RATIO) * progress;
    return settings.lineWidth * widthRatio;
  }
}
