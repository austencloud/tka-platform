import type {
  FlowFestRuntimePoint,
  FlowFestRuntimeSegment,
} from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY,
  type FlowFestCampPlanLine,
} from "./flow-fest-camp-plan";

export interface FlowFestLowerCampPlacement2D {
  x: number;
  z: number;
  rotation: number;
}

export interface FlowFestLowerCampOccupancyLayout {
  centerVehicles: FlowFestLowerCampPlacement2D[];
  centerTents: FlowFestLowerCampPlacement2D[];
  innerRoadsideTents: FlowFestLowerCampPlacement2D[];
  outerTreeLineTents: FlowFestLowerCampPlacement2D[];
  audit: {
    centerVehicleOutsideLoopCount: number;
    innerRoadsideTentOutsideLoopCount: number;
    outerTreeLineTentInsideLoopCount: number;
  };
}

/**
 * Derive festival dressing from the registered lower loop. Exact pitches are
 * deterministic fiction; the inside/roadside/tree-line relationship is the
 * Austen-observed topology this module protects.
 */
export function deriveFlowFestLowerCampOccupancy(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
}): FlowFestLowerCampOccupancyLayout {
  const outerTreeLineTents = Array.from(
    {
      length: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.outerTreeLineTentCount,
    },
    (_, index) =>
      findLoopTentPlacement({
        ...options,
        index,
        count: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.outerTreeLineTentCount,
        side: "outer",
      })
  );
  const innerRoadsideTents = Array.from(
    {
      length: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.innerRoadsideTentCount,
    },
    (_, index) =>
      findLoopTentPlacement({
        ...options,
        index,
        count: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.innerRoadsideTentCount,
        side: "inner",
      })
  );
  const occupiedTents = [...outerTreeLineTents, ...innerRoadsideTents];
  const centerTents = Array.from(
    { length: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerTentCount },
    (_, index) => {
      const placement = findCenterTentPlacement({
        ...options,
        peers: occupiedTents,
        index,
        count: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerTentCount,
      });
      occupiedTents.push(placement);
      return placement;
    }
  );
  const centerVehicles = buildCenterVehiclePlacements({
    ...options,
    tents: centerTents,
    count: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerVehicleCount,
  });

  return {
    centerVehicles,
    centerTents,
    innerRoadsideTents,
    outerTreeLineTents,
    audit: {
      centerVehicleOutsideLoopCount: centerVehicles.filter(
        (placement) => !pointInsidePlanLoop(placement, options.loop)
      ).length,
      innerRoadsideTentOutsideLoopCount: innerRoadsideTents.filter(
        (placement) => !pointInsidePlanLoop(placement, options.loop)
      ).length,
      outerTreeLineTentInsideLoopCount: outerTreeLineTents.filter((placement) =>
        pointInsidePlanLoop(placement, options.loop)
      ).length,
    },
  };
}

function findLoopTentPlacement(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  index: number;
  count: number;
  side: "inner" | "outer";
}): FlowFestLowerCampPlacement2D {
  const center = planLoopCenter(options.loop);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const fraction =
      (options.index + 1) / (options.count + 1) +
      (options.rng() - 0.5) * 0.018 +
      attempt * 0.007;
    const sample = sampleClosedPlanLine(options.loop.points, fraction);
    const tangentLength = Math.hypot(sample.tangentX, sample.tangentZ) || 1;
    const left = {
      x: -sample.tangentZ / tangentLength,
      z: sample.tangentX / tangentLength,
    };
    const outwardDot =
      left.x * (sample.x - center.x) + left.z * (sample.z - center.z);
    const outward = outwardDot >= 0 ? left : { x: -left.x, z: -left.z };
    const direction =
      options.side === "outer" ? outward : { x: -outward.x, z: -outward.z };
    const offset =
      options.loop.widthMeters / 2 +
      (options.side === "outer" ? 4.6 : 4.1) +
      options.rng() * (options.side === "outer" ? 1.35 : 1.1);
    const x = sample.x + direction.x * offset;
    const z = sample.z + direction.z * offset;
    if (pointNearRoutes(x, z, options.routes, 1.4)) continue;
    const isInside = pointInsidePlanLoop({ x, z }, options.loop);
    if (
      (options.side === "outer" && isInside) ||
      (options.side === "inner" && !isInside)
    ) {
      continue;
    }
    return {
      x,
      z,
      rotation: Math.atan2(center.x - x, center.z - z),
    };
  }
  throw new Error(
    `Could not place lower-${options.side} tent ${options.index + 1}/${options.count}`
  );
}

function findCenterTentPlacement(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  peers: FlowFestLowerCampPlacement2D[];
  index: number;
  count: number;
}): FlowFestLowerCampPlacement2D {
  const center = planLoopCenter(options.loop);
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const angle =
      (options.index / options.count) * Math.PI * 2 +
      (options.rng() - 0.5) * 0.35 +
      attempt * 0.41;
    const radius = 8 + options.rng() * 7;
    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;
    if (!pointInsidePlanLoop({ x, z }, options.loop)) continue;
    if (distanceToPlanLine(x, z, options.loop) < 12) continue;
    if (pointNearRoutes(x, z, options.routes, 1.4)) continue;
    if (
      options.peers.some((peer) => Math.hypot(peer.x - x, peer.z - z) < 3.4)
    ) {
      continue;
    }
    return {
      x,
      z,
      rotation: Math.atan2(center.x - x, center.z - z),
    };
  }
  throw new Error(
    `Could not place lower-center tent ${options.index + 1}/${options.count}`
  );
}

function buildCenterVehiclePlacements(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  tents: FlowFestLowerCampPlacement2D[];
  count: number;
}): FlowFestLowerCampPlacement2D[] {
  const center = planLoopCenter(options.loop);
  const axis = planLoopPrincipalAxis(options.loop, center);
  const cross = { x: -axis.z, z: axis.x };
  const candidates: Array<{ x: number; z: number; order: number }> = [];

  for (let row = -3; row <= 3; row += 1) {
    for (let column = -4; column <= 4; column += 1) {
      const along = column * 6.25 + (options.rng() - 0.5) * 0.34;
      const across = row * 4.45 + (options.rng() - 0.5) * 0.28;
      candidates.push({
        x: center.x + axis.x * along + cross.x * across,
        z: center.z + axis.z * along + cross.z * across,
        order: Math.hypot(column / 4, row / 3),
      });
    }
  }
  candidates.sort((first, second) => first.order - second.order);

  const placements: FlowFestLowerCampPlacement2D[] = [];
  const baseRotation = -Math.atan2(axis.z, axis.x);
  for (const candidate of candidates) {
    if (placements.length === options.count) break;
    if (!pointInsidePlanLoop(candidate, options.loop)) continue;
    if (distanceToPlanLine(candidate.x, candidate.z, options.loop) < 7.4) {
      continue;
    }
    if (pointNearRoutes(candidate.x, candidate.z, options.routes, 2.5)) {
      continue;
    }
    if (
      options.tents.some(
        (tent) => Math.hypot(tent.x - candidate.x, tent.z - candidate.z) < 3.2
      ) ||
      placements.some(
        (vehicle) =>
          Math.hypot(vehicle.x - candidate.x, vehicle.z - candidate.z) < 4.05
      )
    ) {
      continue;
    }
    placements.push({
      x: candidate.x,
      z: candidate.z,
      rotation: baseRotation + (options.rng() - 0.5) * 0.09,
    });
  }

  if (placements.length !== options.count) {
    throw new Error(
      `Could only place ${placements.length}/${options.count} lower-center vehicles inside the road loop`
    );
  }
  return placements;
}

function openPlanLoopPoints(
  loop: FlowFestCampPlanLine
): Array<Pick<FlowFestRuntimePoint, "x" | "z">> {
  return distanceBetweenPlanPoints(loop.points[0]!, loop.points.at(-1)!) < 0.15
    ? loop.points.slice(0, -1)
    : [...loop.points];
}

function planLoopCenter(loop: FlowFestCampPlanLine): { x: number; z: number } {
  const points = openPlanLoopPoints(loop);
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }),
    { x: 0, z: 0 }
  );
  return { x: center.x / points.length, z: center.z / points.length };
}

function planLoopPrincipalAxis(
  loop: FlowFestCampPlanLine,
  center: { x: number; z: number }
): { x: number; z: number } {
  const points = openPlanLoopPoints(loop);
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const point of points) {
    const dx = point.x - center.x;
    const dz = point.z - center.z;
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  }
  const angle = 0.5 * Math.atan2(2 * xz, xx - zz);
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function pointInsidePlanLoop(
  point: { x: number; z: number },
  loop: FlowFestCampPlanLine
): boolean {
  const polygon = openPlanLoopPoints(loop);
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const first = polygon[current]!;
    const second = polygon[previous]!;
    const crosses =
      first.z > point.z !== second.z > point.z &&
      point.x <
        ((second.x - first.x) * (point.z - first.z)) / (second.z - first.z) +
          first.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function sampleClosedPlanLine(
  points: ReadonlyArray<{ x: number; z: number }>,
  fraction: number
): { x: number; z: number; tangentX: number; tangentZ: number } {
  const segments = points.slice(1).map((end, index) => {
    const start = points[index]!;
    return {
      start,
      end,
      length: distanceBetweenPlanPoints(start, end),
    };
  });
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0
  );
  let remaining =
    (((fraction % 1) + 1) % 1) * Math.max(totalLength, Number.EPSILON);
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const progress = segment.length > 0 ? remaining / segment.length : 0;
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * progress,
      z: segment.start.z + (segment.end.z - segment.start.z) * progress,
      tangentX: segment.end.x - segment.start.x,
      tangentZ: segment.end.z - segment.start.z,
    };
  }
  const first = points[0]!;
  const second = points[1] ?? first;
  return {
    x: first.x,
    z: first.z,
    tangentX: second.x - first.x,
    tangentZ: second.z - first.z,
  };
}

function distanceBetweenPlanPoints(
  first: { x: number; z: number },
  second: { x: number; z: number }
): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function distanceToPlanLine(
  x: number,
  z: number,
  line: FlowFestCampPlanLine
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.points.length; index += 1) {
    minimum = Math.min(
      minimum,
      distanceToSegment(x, z, line.points[index - 1]!, line.points[index]!)
    );
  }
  return minimum;
}

function pointNearRoutes(
  x: number,
  z: number,
  routes: FlowFestRuntimeSegment[],
  extraClearance: number
): boolean {
  return routes.some((route) => {
    const clearance = route.widthMeters / 2 + extraClearance;
    for (let index = 1; index < route.points.length; index += 1) {
      if (
        distanceToSegment(
          x,
          z,
          route.points[index - 1]!,
          route.points[index]!
        ) <= clearance
      ) {
        return true;
      }
    }
    return false;
  });
}

function distanceToSegment(
  x: number,
  z: number,
  start: Pick<FlowFestRuntimePoint, "x" | "z">,
  end: Pick<FlowFestRuntimePoint, "x" | "z">
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(x - start.x, z - start.z);
  const t = Math.max(
    0,
    Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared)
  );
  return Math.hypot(x - (start.x + dx * t), z - (start.z + dz * t));
}
