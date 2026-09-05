import { Vector3 } from "three";

export interface EmberFlowPath {
  points: Vector3[];
  distances: number[];
  length: number;
}

export function measureFlowPath(points: Vector3[]): EmberFlowPath {
  const distances = [0];
  for (let index = 1; index < points.length; index++) {
    distances.push(
      distances[index - 1] + points[index].distanceTo(points[index - 1])
    );
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
    if (path.distances[middle] <= travel) low = middle;
    else high = middle;
  }
  const span = path.distances[high] - path.distances[low];
  position.lerpVectors(
    path.points[low],
    path.points[high],
    span > 0 ? (travel - path.distances[low]) / span : 0
  );
  tangent.subVectors(path.points[high], path.points[low]).normalize();
}
