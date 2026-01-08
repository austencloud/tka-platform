/**
 * BodyOutlineCalculator - Computes body outline from spine chain
 *
 * Uses parametric equations to generate left/right boundaries
 * perpendicular to spine direction at each joint.
 */

import type { SpineChain, SpineJoint } from "./SpineChain";

export interface Point {
  x: number;
  y: number;
}

export interface BodyOutline {
  leftPoints: Point[];
  rightPoints: Point[];
  headPoint: Point;
  tailPoint: Point;
}

export class BodyOutlineCalculator {
  /**
   * Calculate body outline from spine chain
   * Creates smooth left and right boundaries based on joint positions and widths
   */
  calculateOutline(spine: SpineChain): BodyOutline {
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];

    for (const joint of spine.joints) {
      const perpAngle = joint.angle + Math.PI / 2;

      // Left boundary (perpendicular to direction)
      leftPoints.push({
        x: joint.x + joint.width * Math.cos(perpAngle),
        y: joint.y + joint.width * Math.sin(perpAngle),
      });

      // Right boundary (opposite perpendicular)
      rightPoints.push({
        x: joint.x - joint.width * Math.cos(perpAngle),
        y: joint.y - joint.width * Math.sin(perpAngle),
      });
    }

    const head = spine.joints[0];
    const tail = spine.joints[spine.joints.length - 1];

    return {
      leftPoints,
      rightPoints,
      headPoint: head ? { x: head.x, y: head.y } : { x: 0, y: 0 },
      tailPoint: tail ? { x: tail.x, y: tail.y } : { x: 0, y: 0 },
    };
  }

  /**
   * Draw smooth body path through outline points
   * Uses quadratic curves for organic appearance
   */
  drawBodyPath(
    ctx: CanvasRenderingContext2D,
    outline: BodyOutline
  ): void {
    const { leftPoints, rightPoints } = outline;

    if (leftPoints.length < 2) return;

    ctx.beginPath();

    // Start at head (first left point)
    const startPoint = leftPoints[0]!;
    ctx.moveTo(startPoint.x, startPoint.y);

    // Draw left side (head to tail)
    this.drawSmoothCurve(ctx, leftPoints);

    // Connect to tail point
    const tailLeft = leftPoints[leftPoints.length - 1]!;
    const tailRight = rightPoints[rightPoints.length - 1]!;
    const tailCenter = outline.tailPoint;

    // Rounded tail cap
    ctx.quadraticCurveTo(
      tailCenter.x + (tailCenter.x - outline.headPoint.x) * 0.1,
      tailCenter.y + (tailCenter.y - outline.headPoint.y) * 0.1,
      tailRight.x,
      tailRight.y
    );

    // Draw right side (tail to head) - reversed
    const reversedRight = [...rightPoints].reverse();
    this.drawSmoothCurve(ctx, reversedRight);

    // Connect back to start with rounded head
    const headLeft = leftPoints[0]!;
    const headRight = rightPoints[0]!;
    const headCenter = outline.headPoint;

    ctx.quadraticCurveTo(
      headCenter.x + (headCenter.x - outline.tailPoint.x) * 0.15,
      headCenter.y,
      headLeft.x,
      headLeft.y
    );

    ctx.closePath();
  }

  /**
   * Draw a smooth curve through points using quadratic beziers
   */
  private drawSmoothCurve(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (points.length < 2) return;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;

      // Use midpoint as control point for smooth curves
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;

      if (i === 1) {
        // First segment - line to midpoint
        ctx.lineTo(midX, midY);
      } else {
        // Subsequent segments - curve through previous point to midpoint
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
    }

    // Final segment to last point
    const last = points[points.length - 1]!;
    ctx.lineTo(last.x, last.y);
  }

  /**
   * Get point along outline for fin attachment
   * @param outline - Body outline
   * @param t - Position from 0 (head) to 1 (tail)
   * @param side - 'left' or 'right' side
   */
  getAttachmentPoint(
    outline: BodyOutline,
    t: number,
    side: "left" | "right"
  ): Point {
    const points = side === "left" ? outline.leftPoints : outline.rightPoints;

    if (points.length === 0) {
      return { x: 0, y: 0 };
    }

    if (t <= 0) return points[0]!;
    if (t >= 1) return points[points.length - 1]!;

    const index = t * (points.length - 1);
    const i = Math.floor(index);
    const localT = index - i;

    const curr = points[i]!;
    const next = points[i + 1] ?? curr;

    return {
      x: curr.x + (next.x - curr.x) * localT,
      y: curr.y + (next.y - curr.y) * localT,
    };
  }

  /**
   * Get center point along spine for eye/gill placement
   */
  getCenterPoint(spine: SpineChain, t: number): Point & { angle: number } {
    const pos = spine.getPositionAt(t);
    return { x: pos.x, y: pos.y, angle: pos.angle };
  }
}
