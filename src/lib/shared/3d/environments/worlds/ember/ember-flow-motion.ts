import { Vector3 } from "three";

export interface EmberFlowPath {
  points: Vector3[];
  distances: number[];
  length: number;
}

export function measureFlowPath(points: Vector3[]): EmberFlowPath {
  const distances = [0];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const previousDistance = distances[index - 1]!;
    distances.push(previousDistance + current.distanceTo(previous));
  }
  return { points, distances, length: distances.at(-1) ?? 0 };
}

/** Distance, not vertex count, keeps a raft's speed steady around bends. */
export function sampleFlowPath(
  path: EmberFlowPath,
  distance: number,
  position: Vector3,
  tangent: Vector3
): void {
  if (path.length <= 0) {
    position.copy(path.points[0] ?? new Vector3());
    tangent.set(0, 0, -1);
    return;
  }
  const travel = ((distance % path.length) + path.length) % path.length;
  let low = 0;
  let high = path.distances.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (path.distances[middle]! <= travel) low = middle;
    else high = middle;
  }
  const lowPoint = path.points[low]!;
  const highPoint = path.points[high]!;
  const lowDistance = path.distances[low]!;
  const highDistance = path.distances[high]!;
  const span = highDistance - lowDistance;
  position.lerpVectors(
    lowPoint,
    highPoint,
    span > 0 ? (travel - lowDistance) / span : 0
  );
  tangent.subVectors(highPoint, lowPoint).normalize();
}
