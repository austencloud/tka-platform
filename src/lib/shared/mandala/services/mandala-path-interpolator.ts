import type {
  MandalaPaths,
  MandalaPoint,
  SVGPathData,
} from "../domain/mandala-types";
import { pointsToSVGPath } from "./mandala-geometry-calculator";
import { parsePoints } from "./mandala-fingerprint";

const PATH_GROUPS = ["left", "right", "purple"] as const;

function interpolatePoint(
  from: MandalaPoint,
  to: MandalaPoint,
  t: number
): MandalaPoint {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function resamplePoints(
  points: readonly MandalaPoint[],
  count: number
): MandalaPoint[] {
  if (points.length === 0 || count === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: count }, () => ({ ...points[0]! }));
  }
  if (count === 1) return [{ ...points[0]! }];

  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * (points.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(points.length - 1, Math.ceil(position));
    const progress = position - lowerIndex;
    return interpolatePoint(points[lowerIndex]!, points[upperIndex]!, progress);
  });
}

function collapsedPoints(point: MandalaPoint, count: number): MandalaPoint[] {
  return Array.from({ length: count }, () => ({ ...point }));
}

function pathsByTipIndex(
  paths: readonly SVGPathData[]
): Map<number, SVGPathData> {
  return new Map(paths.map((path) => [path.tipIndex, path]));
}

function interpolatePathGroup(
  fromPaths: readonly SVGPathData[],
  toPaths: readonly SVGPathData[],
  t: number
): SVGPathData[] {
  const fromByTip = pathsByTipIndex(fromPaths);
  const toByTip = pathsByTipIndex(toPaths);
  const tipIndices = [
    ...new Set([...fromByTip.keys(), ...toByTip.keys()]),
  ].sort((a, b) => a - b);

  return tipIndices.flatMap((tipIndex) => {
    const fromPath = fromByTip.get(tipIndex);
    const toPath = toByTip.get(tipIndex);

    if (fromPath?.d === toPath?.d) return toPath ? [toPath] : [];

    const fromPoints = fromPath ? parsePoints(fromPath.d) : [];
    const toPoints = toPath ? parsePoints(toPath.d) : [];
    const pointCount = Math.max(fromPoints.length, toPoints.length, 2);
    const fallbackPoint = fromPoints[0] ?? toPoints[0];
    if (!fallbackPoint) return [];

    const normalizedFrom = fromPath
      ? resamplePoints(fromPoints, pointCount)
      : collapsedPoints(toPoints[0] ?? fallbackPoint, pointCount);
    const normalizedTo = toPath
      ? resamplePoints(toPoints, pointCount)
      : collapsedPoints(fromPoints[0] ?? fallbackPoint, pointCount);
    const points = normalizedFrom.map((point, index) =>
      interpolatePoint(point, normalizedTo[index]!, t)
    );
    const d = pointsToSVGPath(points);

    return d ? [{ d, tipIndex }] : [];
  });
}

export function mandalaPathsEqual(
  left: MandalaPaths,
  right: MandalaPaths
): boolean {
  return PATH_GROUPS.every((group) => {
    const leftPaths = left[group];
    const rightPaths = right[group];
    return (
      leftPaths.length === rightPaths.length &&
      leftPaths.every(
        (path, index) =>
          path.tipIndex === rightPaths[index]!.tipIndex &&
          path.d === rightPaths[index]!.d
      )
    );
  });
}

/**
 * Interpolate the visible mandala between two calculated geometries. Paths are
 * paired by prop tip, and unequal sample counts are normalized before the
 * points move. A hand whose geometry did not change is returned untouched.
 */
export function interpolateMandalaPaths(
  from: MandalaPaths,
  to: MandalaPaths,
  t: number
): MandalaPaths {
  if (t <= 0) return from;
  if (t >= 1) return to;

  return {
    left: interpolatePathGroup(from.left, to.left, t),
    right: interpolatePathGroup(from.right, to.right, t),
    purple: interpolatePathGroup(from.purple, to.purple, t),
  };
}
