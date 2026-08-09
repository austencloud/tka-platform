import { Path, Shape } from "three";

export interface IcePlatformOutlinePoint {
  x: number;
  y: number;
}

const OUTLINE_POINTS = 32;

function appendSmoothLoop(
  target: Shape | Path,
  points: readonly IcePlatformOutlinePoint[]
): void {
  target.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const previous = points[(index - 1 + points.length) % points.length]!;
    const following = points[(index + 2) % points.length]!;
    target.bezierCurveTo(
      point.x + (next.x - previous.x) / 7,
      point.y + (next.y - previous.y) / 7,
      next.x - (following.x - point.x) / 7,
      next.y - (following.y - point.y) / 7,
      next.x,
      next.y
    );
  }
}

/**
 * The configured radius remains a guaranteed performer-clearance radius.
 * Irregularity only grows outward, so widening a multi-performer stage never
 * creates a hidden narrow spot at one edge.
 */
export function createIcePlatformOutline(
  radius: number
): IcePlatformOutlinePoint[] {
  const raw = Array.from({ length: OUTLINE_POINTS }, (_, index) => {
    const angle = (index / OUTLINE_POINTS) * Math.PI * 2;
    const ripple =
      1 +
      Math.sin(angle * 3 + 0.72) * 0.065 +
      Math.cos(angle * 5 - 0.38) * 0.038 +
      Math.sin(angle * 8 + 1.16) * 0.018;
    return {
      x: Math.cos(angle) * 1.035 * ripple,
      y: Math.sin(angle) * 0.97 * ripple,
    };
  });
  const minimumDistance = Math.min(
    ...raw.map((point) => Math.hypot(point.x, point.y))
  );
  const clearanceScale = radius / minimumDistance;
  return raw.map((point) => ({
    x: point.x * clearanceScale,
    y: point.y * clearanceScale,
  }));
}

export function createIcePlatformShape(radius: number): Shape {
  const shape = new Shape();
  appendSmoothLoop(shape, createIcePlatformOutline(radius));
  return shape;
}

/**
 * A variable-width snow shelf hides the manufactured seam where runtime ice
 * meets the authored clearing. It follows the same ice outline without forming
 * another perfect ring.
 */
export function createIcePlatformSnowCollarShape(radius: number): Shape {
  const ice = createIcePlatformOutline(radius);
  const outer = ice.map((point, index) => {
    const angle = (index / ice.length) * Math.PI * 2;
    const distance = Math.hypot(point.x, point.y);
    const shelfWidth =
      radius *
      (0.055 +
        (Math.sin(angle * 4 - 0.5) * 0.5 + 0.5) * 0.055 +
        (Math.cos(angle * 7 + 0.8) * 0.5 + 0.5) * 0.025);
    const scale = (distance + shelfWidth) / distance;
    return { x: point.x * scale, y: point.y * scale };
  });
  const inner = ice
    .map((point) => {
      const distance = Math.hypot(point.x, point.y);
      const scale = (distance - radius * 0.018) / distance;
      return { x: point.x * scale, y: point.y * scale };
    })
    .reverse();

  const collar = new Shape();
  appendSmoothLoop(collar, outer);
  const hole = new Path();
  appendSmoothLoop(hole, inner);
  collar.holes.push(hole);
  return collar;
}
