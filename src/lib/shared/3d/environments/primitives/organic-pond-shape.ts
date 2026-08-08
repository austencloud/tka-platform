import { Shape } from "three";

export interface OrganicPondPoint {
  x: number;
  y: number;
}

export interface OrganicPondShapeOptions {
  radiusX: number;
  radiusZ: number;
  seed: number;
  pointCount?: number;
}

export function createOrganicPondPoints({
  radiusX,
  radiusZ,
  seed,
  pointCount = 20,
}: OrganicPondShapeOptions): OrganicPondPoint[] {
  return Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * Math.PI * 2;
    const variation =
      1 +
      Math.sin(angle * 2.7 + seed) * 0.075 +
      Math.cos(angle * 4.6 + seed * 1.3) * 0.045 +
      Math.sin(angle * 7.1 - seed * 0.4) * 0.025;
    return {
      x: Math.cos(angle) * radiusX * variation,
      y: Math.sin(angle) * radiusZ * variation,
    };
  });
}

export function createOrganicPondShape(
  options: OrganicPondShapeOptions
): Shape {
  const points = createOrganicPondPoints(options);
  const shape = new Shape();
  shape.moveTo(points[0]!.x, points[0]!.y);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const previous = points[(index - 1 + points.length) % points.length]!;
    const following = points[(index + 2) % points.length]!;
    shape.bezierCurveTo(
      point.x + (next.x - previous.x) / 6,
      point.y + (next.y - previous.y) / 6,
      next.x - (following.x - point.x) / 6,
      next.y - (following.y - point.y) / 6,
      next.x,
      next.y
    );
  }

  return shape;
}
