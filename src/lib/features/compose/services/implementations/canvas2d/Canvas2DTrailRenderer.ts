/**
 * Canvas2D Trail Renderer
 *
 * Handles trail rendering using pure Canvas2D:
 * - Smooth trail rendering (Catmull-Rom splines)
 * - Segmented trail rendering
 * - Trail opacity calculations (fade/gradient)
 * - Multi-end trail support (both ends tracking)
 *
 * Single Responsibility: Trail rendering logic
 */

import type {
  TrailPoint,
  TrailSettings,
} from "../../../shared/domain/types/TrailTypes";
import {
  TrailMode,
  TrailStyle,
  TrailEffect,
  TrackingMode,
  FadeStyle,
  TaperStyle,
} from "../../../shared/domain/types/TrailTypes";

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
    // Linear interpolation for 2 points
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

    // Calculate t values for centripetal parameterization
    // Add small epsilon to prevent division by zero when points are identical
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

    // Linear interpolation helper with safe division
    const safeDivide = (num: number, den: number) => den === 0 ? 0 : num / den;
    const lerp = (pa: Point2D, pb: Point2D, t: number): Point2D => {
      const ct = Math.max(0, Math.min(1, t));
      return { x: pa.x + (pb.x - pa.x) * ct, y: pa.y + (pb.y - pa.y) * ct };
    };

    // Generate segment points
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
// CANVAS 2D TRAIL RENDERER
// ============================================================================

export class Canvas2DTrailRenderer {
  renderTrails(
    ctx: CanvasRenderingContext2D,
    blueTrailPoints: TrailPoint[],
    redTrailPoints: TrailPoint[],
    trailSettings: TrailSettings,
    currentTime: number,
    hasBlue: boolean,
    hasRed: boolean
  ): void {
    if (!trailSettings.enabled || trailSettings.mode === TrailMode.OFF) {
      return;
    }

    // Render blue trail
    if (hasBlue && blueTrailPoints.length >= 2) {
      this.renderTrailSegments(
        ctx,
        blueTrailPoints,
        trailSettings.blueColor,
        trailSettings,
        currentTime
      );
    }

    // Render red trail
    if (hasRed && redTrailPoints.length >= 2) {
      this.renderTrailSegments(
        ctx,
        redTrailPoints,
        trailSettings.redColor,
        trailSettings,
        currentTime
      );
    }
  }

  private renderTrailSegments(
    ctx: CanvasRenderingContext2D,
    points: TrailPoint[],
    colorString: string,
    settings: TrailSettings,
    currentTime: number
  ): void {
    if (points.length < 2) return;

    // Separate points by endType based on tracking mode
    let pointSets: TrailPoint[][];
    if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
      // Both ends: render each end's trail separately
      const leftPoints: TrailPoint[] = [];
      const rightPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 0) leftPoints.push(p);
        else rightPoints.push(p);
      }
      pointSets = [leftPoints, rightPoints];
    } else if (settings.trackingMode === TrackingMode.LEFT_END) {
      // Left end only: filter to endType 0
      const leftPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 0) leftPoints.push(p);
      }
      pointSets = [leftPoints];
    } else {
      // Right end only: filter to endType 1
      const rightPoints: TrailPoint[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (p.endType === 1) rightPoints.push(p);
      }
      pointSets = [rightPoints];
    }

    for (const pointSet of pointSets) {
      if (pointSet.length < 2) continue;

      // Use smooth curves if enabled, otherwise line segments
      if (settings.style === TrailStyle.SMOOTH_LINE) {
        this.renderSmoothTrail(
          ctx,
          pointSet,
          colorString,
          settings,
          currentTime
        );
      } else {
        this.renderSegmentedTrail(
          ctx,
          pointSet,
          colorString,
          settings,
          currentTime
        );
      }
    }
  }

  // Reusable control points array to avoid allocations in render loop
  private controlPointsBuffer: Point2D[] = [];

  private renderSmoothTrail(
    ctx: CanvasRenderingContext2D,
    points: TrailPoint[],
    color: string,
    settings: TrailSettings,
    currentTime: number
  ): void {
    if (points.length < 2) return;

    // Reuse control points buffer (avoid creating 500+ objects per frame)
    const controlPoints = this.controlPointsBuffer;
    controlPoints.length = points.length; // Resize if needed
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (controlPoints[i]) {
        controlPoints[i]!.x = p.x;
        controlPoints[i]!.y = p.y;
      } else {
        controlPoints[i] = { x: p.x, y: p.y };
      }
    }

    // Adaptive subdivision based on point count
    const subdivisionsPerSegment = Math.max(
      2, // Minimum 2 subdivisions
      Math.min(
        10, // Maximum 10 subdivisions
        Math.floor(150 / points.length) // Scale inversely with point count
      )
    );

    const smoothPoints = createSmoothCurve(controlPoints, {
      alpha: 0.5, // Centripetal Catmull-Rom
      subdivisionsPerSegment,
    });

    if (smoothPoints.length < 2) return;

    const effect =
      settings.effect ??
      (settings.glowEnabled ? TrailEffect.GLOW : TrailEffect.NONE);

    // If tapering is enabled, we must draw segments individually
    const needsSegmentedRendering = settings.taperStyle === TaperStyle.TAPERED;

    if (needsSegmentedRendering) {
      // Segmented rendering for tapered trails
      this.renderTaperedSmoothTrail(ctx, smoothPoints, points, color, settings, currentTime, effect);
    } else {
      // Single path rendering (faster, no tapering)
      this.renderUniformSmoothTrail(ctx, smoothPoints, points, color, settings, currentTime, effect);
    }
  }

  /**
   * Render smooth trail with uniform width (single path, faster)
   * Uses quadraticCurveTo with midpoint technique for truly smooth curves
   */
  private renderUniformSmoothTrail(
    ctx: CanvasRenderingContext2D,
    smoothPoints: Point2D[],
    originalPoints: TrailPoint[],
    color: string,
    settings: TrailSettings,
    currentTime: number,
    effect: TrailEffect
  ): void {
    if (smoothPoints.length < 2) return;

    // Calculate average opacity for the entire trail
    const avgOpacity = this.calculateOpacity(
      Math.floor(smoothPoints.length / 2),
      smoothPoints.length,
      originalPoints,
      settings,
      currentTime
    );

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const firstPoint = smoothPoints[0]!;
    ctx.moveTo(firstPoint.x, firstPoint.y);

    // Use quadraticCurveTo with midpoint technique for smooth curves
    // This eliminates visible vertices at connection points
    if (smoothPoints.length === 2) {
      // Only two points - just draw a line
      const lastPoint = smoothPoints[1]!;
      ctx.lineTo(lastPoint.x, lastPoint.y);
    } else {
      // For 3+ points, use quadratic curves with midpoint technique
      //
      // IMPORTANT: Connect the first point to the second point with a curve
      // Without this, the implicit connection from moveTo(firstPoint) to the first
      // quadraticCurveTo creates a straight line artifact when the first point
      // becomes distant from subsequent points (e.g., after pruning in FADE mode)
      const secondPoint = smoothPoints[1]!;
      const thirdPoint = smoothPoints[2];
      if (!isNaN(secondPoint.x) && !isNaN(secondPoint.y)) {
        if (thirdPoint && !isNaN(thirdPoint.x) && !isNaN(thirdPoint.y)) {
          // Curve from first point toward second, ending at midpoint of second and third
          const midX = (secondPoint.x + thirdPoint.x) / 2;
          const midY = (secondPoint.y + thirdPoint.y) / 2;
          ctx.quadraticCurveTo(secondPoint.x, secondPoint.y, midX, midY);
        }
      }

      // Continue with remaining points (start at index 2 since we handled 0-1-2 above)
      for (let i = 2; i < smoothPoints.length - 1; i++) {
        const point = smoothPoints[i]!;
        const nextPoint = smoothPoints[i + 1]!;
        if (isNaN(point.x) || isNaN(point.y)) continue;
        if (isNaN(nextPoint.x) || isNaN(nextPoint.y)) continue;

        // Midpoint between current and next becomes the endpoint
        // Current point becomes the control point (curves toward it)
        const midX = (point.x + nextPoint.x) / 2;
        const midY = (point.y + nextPoint.y) / 2;
        ctx.quadraticCurveTo(point.x, point.y, midX, midY);
      }

      // Connect to the last point using a curve, not a straight line
      // The straight lineTo() was causing visible artifacts at the trail's fading end
      // when points were spaced far apart (especially after pruning in FADE mode)
      const lastPoint = smoothPoints[smoothPoints.length - 1]!;
      const secondLastPoint = smoothPoints[smoothPoints.length - 2];
      if (!isNaN(lastPoint.x) && !isNaN(lastPoint.y)) {
        if (secondLastPoint && !isNaN(secondLastPoint.x) && !isNaN(secondLastPoint.y)) {
          // Use the second-to-last point as control point for smooth curve to final point
          ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y);
        } else {
          // Fallback to line if no second-to-last point
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }
      }
    }

    if (effect === TrailEffect.NEON) {
      // NEON: Multi-layer ribbon effect
      ctx.lineWidth = settings.lineWidth * 4;
      ctx.globalAlpha = avgOpacity * 0.2;
      ctx.strokeStyle = color;
      ctx.shadowBlur = 25;
      ctx.shadowColor = color;
      ctx.stroke();

      ctx.lineWidth = settings.lineWidth * 2;
      ctx.globalAlpha = avgOpacity * 0.4;
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = this.lightenColor(color, 0.7);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (effect === TrailEffect.GLOW) {
      const glowBlur = settings.glowBlur > 0 ? settings.glowBlur * 4 : 8;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render smooth trail with tapered width.
   * Uses filled polygon approach for smooth width variation without visible segments.
   */
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

    // Calculate average opacity for the trail
    const avgOpacity = this.calculateOpacity(
      Math.floor(smoothPoints.length / 2),
      smoothPoints.length,
      originalPoints,
      settings,
      currentTime
    );

    // Build two edge curves - one on each side of the trail path
    // Offset perpendicular to the path direction by half the line width
    const leftEdge: Point2D[] = [];
    const rightEdge: Point2D[] = [];

    for (let i = 0; i < smoothPoints.length; i++) {
      const curr = smoothPoints[i]!;
      const progress = i / (smoothPoints.length - 1);
      const halfWidth = this.calculateLineWidth(progress, settings) / 2;

      // Calculate perpendicular direction from path tangent
      let dx: number, dy: number;
      if (i === 0) {
        // First point: use forward direction
        const next = smoothPoints[1]!;
        dx = next.x - curr.x;
        dy = next.y - curr.y;
      } else if (i === smoothPoints.length - 1) {
        // Last point: use backward direction
        const prev = smoothPoints[i - 1]!;
        dx = curr.x - prev.x;
        dy = curr.y - prev.y;
      } else {
        // Middle points: average of forward and backward
        const prev = smoothPoints[i - 1]!;
        const next = smoothPoints[i + 1]!;
        dx = next.x - prev.x;
        dy = next.y - prev.y;
      }

      // Normalize and rotate 90 degrees for perpendicular
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      leftEdge.push({ x: curr.x + perpX * halfWidth, y: curr.y + perpY * halfWidth });
      rightEdge.push({ x: curr.x - perpX * halfWidth, y: curr.y - perpY * halfWidth });
    }

    // Draw filled polygon using the two edges
    ctx.beginPath();

    // Left edge forward (using quadratic curves for smoothness)
    ctx.moveTo(leftEdge[0]!.x, leftEdge[0]!.y);

    // IMPORTANT: Connect first point to second with a curve (same fix as renderUniformSmoothTrail)
    // Without this, the implicit connection creates a straight line artifact when points are distant
    if (leftEdge.length >= 3) {
      const secondLeft = leftEdge[1]!;
      const thirdLeft = leftEdge[2]!;
      const midX = (secondLeft.x + thirdLeft.x) / 2;
      const midY = (secondLeft.y + thirdLeft.y) / 2;
      ctx.quadraticCurveTo(secondLeft.x, secondLeft.y, midX, midY);
    }

    // Continue with remaining left edge points (start at index 2)
    for (let i = 2; i < leftEdge.length - 1; i++) {
      const point = leftEdge[i]!;
      const nextPoint = leftEdge[i + 1]!;
      const midX = (point.x + nextPoint.x) / 2;
      const midY = (point.y + nextPoint.y) / 2;
      ctx.quadraticCurveTo(point.x, point.y, midX, midY);
    }
    // Connect to the last left edge point with a curve to avoid straight line artifacts
    if (leftEdge.length >= 2) {
      const lastLeft = leftEdge[leftEdge.length - 1]!;
      const secondLastLeft = leftEdge[leftEdge.length - 2]!;
      ctx.quadraticCurveTo(secondLastLeft.x, secondLastLeft.y, lastLeft.x, lastLeft.y);
    }

    // Right edge backward (creates closed shape)
    // Start from last point and work backward
    for (let i = rightEdge.length - 1; i > 1; i--) {
      const point = rightEdge[i]!;
      const prevPoint = rightEdge[i - 1]!;
      const midX = (point.x + prevPoint.x) / 2;
      const midY = (point.y + prevPoint.y) / 2;
      ctx.quadraticCurveTo(point.x, point.y, midX, midY);
    }
    // Connect to the first right edge point with a curve to avoid straight line artifacts
    if (rightEdge.length >= 2) {
      const firstRight = rightEdge[0]!;
      const secondRight = rightEdge[1]!;
      ctx.quadraticCurveTo(secondRight.x, secondRight.y, firstRight.x, firstRight.y);
    }

    ctx.closePath();

    if (effect === TrailEffect.NEON) {
      // NEON: Multiple fills with blur for glow layers
      ctx.fillStyle = color;
      ctx.globalAlpha = avgOpacity * 0.3;
      ctx.shadowBlur = 25;
      ctx.shadowColor = color;
      ctx.fill();

      ctx.globalAlpha = avgOpacity * 0.6;
      ctx.shadowBlur = 12;
      ctx.fill();

      ctx.fillStyle = this.lightenColor(color, 0.5);
      ctx.globalAlpha = avgOpacity;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (effect === TrailEffect.GLOW) {
      const glowBlur = settings.glowBlur > 0 ? settings.glowBlur * 4 : 8;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = avgOpacity;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // No effect - simple fill
      ctx.fillStyle = color;
      ctx.globalAlpha = avgOpacity;
      ctx.fill();
    }

    ctx.restore();
  }

  private renderSegmentedTrail(
    ctx: CanvasRenderingContext2D,
    points: TrailPoint[],
    color: string,
    settings: TrailSettings,
    currentTime: number
  ): void {
    if (points.length < 2) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Determine effect
    const effect =
      settings.effect ??
      (settings.glowEnabled ? TrailEffect.GLOW : TrailEffect.NONE);

    // Apply glow/shadow if using glow effect
    if (effect === TrailEffect.GLOW) {
      const glowBlur = settings.glowBlur > 0 ? settings.glowBlur * 4 : 8;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = color;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Draw trail segments with varying opacity and width
    for (let i = 0; i < points.length - 1; i++) {
      const point = points[i]!;
      const nextPoint = points[i + 1]!;

      // Skip invalid points
      if (
        isNaN(point.x) ||
        isNaN(point.y) ||
        isNaN(nextPoint.x) ||
        isNaN(nextPoint.y)
      ) {
        continue;
      }

      // Progress: 0 = oldest (tail), 1 = newest (head)
      const progress = i / (points.length - 1);

      let opacity: number;

      if (settings.mode === TrailMode.FADE) {
        const age = currentTime - point.timestamp;
        const rawProgress = Math.min(1, Math.max(0, age / settings.fadeDurationMs));

        // Apply fade curve based on fadeStyle
        let fadeProgress: number;
        if (settings.fadeStyle === FadeStyle.EXPONENTIAL) {
          fadeProgress = Math.pow(rawProgress, 2.5);
        } else {
          fadeProgress = rawProgress;
        }

        opacity =
          settings.maxOpacity -
          fadeProgress * (settings.maxOpacity - settings.minOpacity);
        opacity = Math.max(
          settings.minOpacity,
          Math.min(settings.maxOpacity, opacity)
        );
      } else {
        // LOOP_CLEAR and PERSISTENT - gradient from old to new
        opacity =
          settings.minOpacity +
          progress * (settings.maxOpacity - settings.minOpacity);
      }

      // Calculate line width based on taper style
      const lineWidth = this.calculateLineWidth(progress, settings);

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);

      if (effect === TrailEffect.NEON) {
        // NEON: Multi-layer per segment
        // Layer 1: Outer glow
        ctx.lineWidth = lineWidth * 4;
        ctx.globalAlpha = opacity * 0.2;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 25;
        ctx.shadowColor = color;
        ctx.stroke();

        // Layer 2: Mid glow
        ctx.lineWidth = lineWidth * 2;
        ctx.globalAlpha = opacity * 0.4;
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Layer 3: Bright core
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = opacity;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = this.lightenColor(color, 0.7);
        ctx.stroke();

        ctx.shadowBlur = 0;
      } else {
        // GLOW or NONE: Single stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = opacity;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Lighten a hex color toward white
   * @param hex - Hex color string (e.g., "#2E3192")
   * @param amount - 0 = no change, 1 = pure white
   */
  private lightenColor(hex: string, amount: number): string {
    // Parse hex color
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.substring(0, 2), 16);
    const g = parseInt(hexClean.substring(2, 4), 16);
    const b = parseInt(hexClean.substring(4, 6), 16);

    // Lerp toward white (255, 255, 255)
    const newR = Math.round(r + (255 - r) * amount);
    const newG = Math.round(g + (255 - g) * amount);
    const newB = Math.round(b + (255 - b) * amount);

    return `rgb(${newR}, ${newG}, ${newB})`;
  }

  private calculateOpacity(
    smoothPointIndex: number,
    totalSmoothPoints: number,
    originalPoints: TrailPoint[],
    settings: TrailSettings,
    currentTime: number
  ): number {
    if (settings.mode === TrailMode.FADE) {
      // Map smooth point index back to original trail point for timestamp
      const originalPointIndex = Math.floor(
        (smoothPointIndex / totalSmoothPoints) * originalPoints.length
      );
      const originalPoint = originalPoints[originalPointIndex];

      if (originalPoint) {
        const age = currentTime - originalPoint.timestamp;
        const progress = Math.min(1, Math.max(0, age / settings.fadeDurationMs));

        // Apply fade curve based on fadeStyle
        let fadeProgress: number;
        if (settings.fadeStyle === FadeStyle.EXPONENTIAL) {
          // Exponential: holds brightness longer, then drops sharply
          // Using a power curve - stays bright longer before dropping
          fadeProgress = Math.pow(progress, 2.5);
        } else {
          // Linear: steady fade
          fadeProgress = progress;
        }

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
      // LOOP_CLEAR and PERSISTENT - gradient from old to new
      const progress = smoothPointIndex / (totalSmoothPoints - 1);
      return (
        settings.minOpacity +
        progress * (settings.maxOpacity - settings.minOpacity)
      );
    }
  }

  /**
   * Calculate line width based on position and taper style
   * @param progress - 0 = oldest (tail), 1 = newest (head/prop)
   */
  private calculateLineWidth(
    progress: number,
    settings: TrailSettings
  ): number {
    if (settings.taperStyle === TaperStyle.TAPERED) {
      // Tapered: thick at head (progress=1), thin at tail (progress=0)
      // Use a minimum of 30% of the base width at the tail
      const minWidthRatio = 0.3;
      const widthRatio = minWidthRatio + (1 - minWidthRatio) * progress;
      return settings.lineWidth * widthRatio;
    }
    // No taper: constant width
    return settings.lineWidth;
  }
}
