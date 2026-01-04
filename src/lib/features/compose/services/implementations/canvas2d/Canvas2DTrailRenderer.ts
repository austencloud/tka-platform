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
    const getT = (t: number, pa: Point2D, pb: Point2D) => {
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      return t + Math.pow(Math.sqrt(dx * dx + dy * dy), alpha);
    };

    const t0 = 0;
    const t1 = getT(t0, p0, p1);
    const t2 = getT(t1, p1, p2);
    const t3 = getT(t2, p2, p3);

    // Linear interpolation helper
    const lerp = (pa: Point2D, pb: Point2D, t: number): Point2D => {
      const ct = Math.max(0, Math.min(1, t));
      return { x: pa.x + (pb.x - pa.x) * ct, y: pa.y + (pb.y - pa.y) * ct };
    };

    // Generate segment points
    for (let j = 1; j <= subdivisions; j++) {
      const t = t1 + (j / subdivisions) * (t2 - t1);

      const a1 = lerp(p0, p1, (t - t0) / (t1 - t0));
      const a2 = lerp(p1, p2, (t - t1) / (t2 - t1));
      const a3 = lerp(p2, p3, (t - t2) / (t3 - t2));

      const b1 = lerp(a1, a2, (t - t0) / (t2 - t0));
      const b2 = lerp(a2, a3, (t - t1) / (t3 - t1));

      result.push(lerp(b1, b2, (t - t1) / (t2 - t1)));
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

    // Calculate average opacity for the entire trail
    const avgOpacity = this.calculateOpacity(
      Math.floor(smoothPoints.length / 2),
      smoothPoints.length,
      points,
      settings,
      currentTime
    );

    // Draw as ONE continuous path
    ctx.save();
    ctx.beginPath();

    const firstPoint = smoothPoints[0]!;
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < smoothPoints.length; i++) {
      const point = smoothPoints[i]!;

      // Skip invalid points
      if (isNaN(point.x) || isNaN(point.y)) {
        continue;
      }

      ctx.lineTo(point.x, point.y);
    }

    // Apply effect based on settings
    const effect =
      settings.effect ??
      (settings.glowEnabled ? TrailEffect.GLOW : TrailEffect.NONE);

    if (effect === TrailEffect.NEON) {
      // NEON: Multi-layer ribbon effect
      // Layer 1: Outer glow (wide, diffuse)
      ctx.lineWidth = settings.lineWidth * 4;
      ctx.globalAlpha = avgOpacity * 0.2;
      ctx.strokeStyle = color;
      ctx.shadowBlur = 25;
      ctx.shadowColor = color;
      ctx.stroke();

      // Layer 2: Mid glow
      ctx.lineWidth = settings.lineWidth * 2;
      ctx.globalAlpha = avgOpacity * 0.4;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Layer 3: Core (bright white-ish)
      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = this.lightenColor(color, 0.7); // 70% toward white
      ctx.stroke();

      ctx.shadowBlur = 0;
    } else if (effect === TrailEffect.GLOW) {
      // GLOW: Simple shadowBlur effect
      const glowBlur = settings.glowBlur > 0 ? settings.glowBlur * 4 : 8;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = color;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // NONE: Standard stroke, no glow
      ctx.strokeStyle = color;
      ctx.lineWidth = settings.lineWidth;
      ctx.globalAlpha = avgOpacity;
      ctx.stroke();
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

    // Draw trail segments with varying opacity
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

      let opacity: number;

      if (settings.mode === TrailMode.FADE) {
        const age = currentTime - point.timestamp;
        const progress = age / settings.fadeDurationMs;
        opacity =
          settings.maxOpacity -
          progress * (settings.maxOpacity - settings.minOpacity);
        opacity = Math.max(
          settings.minOpacity,
          Math.min(settings.maxOpacity, opacity)
        );
      } else {
        // LOOP_CLEAR and PERSISTENT - gradient from old to new
        const progress = i / (points.length - 1);
        opacity =
          settings.minOpacity +
          progress * (settings.maxOpacity - settings.minOpacity);
      }

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);

      if (effect === TrailEffect.NEON) {
        // NEON: Multi-layer per segment
        // Layer 1: Outer glow
        ctx.lineWidth = settings.lineWidth * 4;
        ctx.globalAlpha = opacity * 0.2;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 25;
        ctx.shadowColor = color;
        ctx.stroke();

        // Layer 2: Mid glow
        ctx.lineWidth = settings.lineWidth * 2;
        ctx.globalAlpha = opacity * 0.4;
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Layer 3: Bright core
        ctx.lineWidth = settings.lineWidth;
        ctx.globalAlpha = opacity;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = this.lightenColor(color, 0.7);
        ctx.stroke();

        ctx.shadowBlur = 0;
      } else {
        // GLOW or NONE: Single stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = settings.lineWidth;
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
        const progress = age / settings.fadeDurationMs;
        const opacity =
          settings.maxOpacity -
          progress * (settings.maxOpacity - settings.minOpacity);
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
}
