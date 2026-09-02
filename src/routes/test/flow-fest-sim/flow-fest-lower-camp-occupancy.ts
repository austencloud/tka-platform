import type {
  FlowFestRuntimePoint,
  FlowFestRuntimeSegment,
} from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY,
  type FlowFestCampPlanLine,
} from "./flow-fest-camp-plan";
import { FLOW_FEST_PARKED_CAR_MODELS } from "./flow-fest-parked-cars";

export interface FlowFestLowerCampPlacement2D {
  x: number;
  z: number;
  rotation: number;
}

export interface FlowFestLowerCampVehiclePlacement2D
  extends FlowFestLowerCampPlacement2D {
  modelId: string;
  row: number;
  stall: number;
  facing: "nose-in" | "backed-in";
  crooked: boolean;
}

export interface FlowFestLowerCampOccupancyLayout {
  centerVehicles: FlowFestLowerCampVehiclePlacement2D[];
  centerTents: FlowFestLowerCampPlacement2D[];
  innerRoadsideTents: FlowFestLowerCampPlacement2D[];
  outerTreeLineTents: FlowFestLowerCampPlacement2D[];
  audit: {
    centerVehicleOutsideLoopCount: number;
    centerVehicleAisleIntrusionCount: number;
    centerVehicleEmptyStallCount: number;
    innerRoadsideTentOutsideLoopCount: number;
    outerTreeLineTentInsideLoopCount: number;
  };
}

/**
 * How the open middle of the loop is parked. Three rows of stalls run along
 * the loop's long axis; the two drive aisles between them are what a car
 * actually needs to get in and out. Outer rows park off their aisle, so the
 * back of an outer-row car faces open field, which is where its tent goes.
 */
const LOWER_CAMP_PARKING_LANES = Object.freeze({
  rowAcrossMeters: [-11.4, 0, 11.4] as const,
  aisleCenterAcrossMeters: [-5.7, 5.7] as const,
  aisleWidthMeters: 6,
  stallPitchMeters: 3.55,
  stallReachMeters: 31,
  stallJitterMeters: 0.12,
  carHalfLengthMeters: 2.35,
  /** The middle row sits between two aisles, so only short bodies park there. */
  middleRowMaxLengthMeters: 4.8,
  loopClearanceMeters: 7.4,
  tentLoopClearanceMeters: 6,
  routeClearanceMeters: 2.5,
  /** Clear ground between a rear bumper and the tent pitched behind it. */
  tentBehindCarMeters: 1.6,
  emptyStallShare: 0.1,
  backedInShare: 0.35,
  straightYawJitter: 0.035,
  crookedYawJitter: 0.2,
});

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
  const lanes = buildCenterParkingLanes({
    ...options,
    peers: [...outerTreeLineTents, ...innerRoadsideTents],
    vehicleCount: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerVehicleCount,
    tentCount: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerTentCount,
  });
  const centerVehicles = lanes.vehicles;
  const centerTents = lanes.tents;

  return {
    centerVehicles,
    centerTents,
    innerRoadsideTents,
    outerTreeLineTents,
    audit: {
      centerVehicleOutsideLoopCount: centerVehicles.filter(
        (placement) => !pointInsidePlanLoop(placement, options.loop)
      ).length,
      centerVehicleAisleIntrusionCount: lanes.aisleIntrusionCount,
      centerVehicleEmptyStallCount: lanes.emptyStallCount,
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

interface ParkingStall {
  row: number;
  stall: number;
  along: number;
  across: number;
  /** +1 or -1 along `cross`: the side of this stall away from its aisle. */
  outward: 1 | -1;
}

interface ParkedCar extends ParkingStall {
  modelIndex: number;
  facing: "nose-in" | "backed-in";
  crooked: boolean;
  rotation: number;
  x: number;
  z: number;
}

/**
 * Park the loop's middle the way people actually do it: side by side in rows,
 * a drive aisle between rows, a mix of nose-in and backed-in, a few stalls
 * still empty, one car per row parked crooked, and the handful of centre
 * tents pitched off the back of a car rather than dropped at random.
 */
function buildCenterParkingLanes(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  peers: FlowFestLowerCampPlacement2D[];
  vehicleCount: number;
  tentCount: number;
}): {
  vehicles: FlowFestLowerCampVehiclePlacement2D[];
  tents: FlowFestLowerCampPlacement2D[];
  emptyStallCount: number;
  aisleIntrusionCount: number;
} {
  const lanes = LOWER_CAMP_PARKING_LANES;
  const { rng, loop, routes } = options;
  const center = planLoopCenter(loop);
  const axis = planLoopPrincipalAxis(loop, center);
  const cross = { x: -axis.z, z: axis.x };
  const toWorld = (along: number, across: number) => ({
    x: center.x + axis.x * along + cross.x * across,
    z: center.z + axis.z * along + cross.z * across,
  });
  const jitter = () => (rng() - 0.5) * 2 * lanes.stallJitterMeters;

  const stalls: ParkingStall[] = [];
  const stallsPerRow = Math.floor(
    (2 * lanes.stallReachMeters) / lanes.stallPitchMeters
  );
  lanes.rowAcrossMeters.forEach((rowAcross, row) => {
    for (let stall = 0; stall < stallsPerRow; stall += 1) {
      const along =
        -lanes.stallReachMeters + (stall + 0.5) * lanes.stallPitchMeters + jitter();
      const across = rowAcross + jitter();
      const point = toWorld(along, across);
      if (!pointInsidePlanLoop(point, loop)) continue;
      if (
        distanceToPlanLine(point.x, point.z, loop) < lanes.loopClearanceMeters
      ) {
        continue;
      }
      if (pointNearRoutes(point.x, point.z, routes, lanes.routeClearanceMeters)) {
        continue;
      }
      const outward: 1 | -1 =
        rowAcross === 0 ? (rng() < 0.5 ? 1 : -1) : rowAcross > 0 ? 1 : -1;
      stalls.push({ row, stall, along, across, outward });
    }
  });
  if (stalls.length < options.vehicleCount) {
    throw new Error(
      `Only ${stalls.length} parking stalls fit inside the road loop; ${options.vehicleCount} vehicles were requested`
    );
  }

  // Leave a few stalls empty, then trim the row ends until the count is exact.
  const spareStalls = stalls.length - options.vehicleCount;
  const emptyTarget = Math.min(
    spareStalls,
    Math.round(stalls.length * lanes.emptyStallShare)
  );
  const emptyIndices = new Set<number>();
  while (emptyIndices.size < emptyTarget) {
    emptyIndices.add(Math.floor(rng() * stalls.length));
  }
  let occupied = stalls.filter((_, index) => !emptyIndices.has(index));
  while (occupied.length > options.vehicleCount) {
    let farthest = 0;
    occupied.forEach((stall, index) => {
      if (Math.abs(stall.along) > Math.abs(occupied[farthest]!.along)) {
        farthest = index;
      }
    });
    occupied = occupied.filter((_, index) => index !== farthest);
  }

  const cars: ParkedCar[] = [];
  const modelIndices = FLOW_FEST_PARKED_CAR_MODELS.map((_, index) => index);
  lanes.rowAcrossMeters.forEach((rowAcross, row) => {
    const rowStalls = occupied
      .filter((stall) => stall.row === row)
      .sort((first, second) => first.along - second.along);
    const crookedIndex = Math.floor(rng() * rowStalls.length);
    let previousModel = -1;
    rowStalls.forEach((stall, index) => {
      const allowedModels = modelIndices.filter(
        (candidate) =>
          candidate !== previousModel &&
          (rowAcross !== 0 ||
            FLOW_FEST_PARKED_CAR_MODELS[candidate]!.lengthMeters <=
              lanes.middleRowMaxLengthMeters)
      );
      const modelIndex =
        allowedModels[Math.floor(rng() * allowedModels.length)]!;
      previousModel = modelIndex;
      const facing = rng() < lanes.backedInShare ? "backed-in" : "nose-in";
      const crooked = index === crookedIndex;
      const yawJitter =
        (rng() - 0.5) *
        2 *
        (crooked ? lanes.crookedYawJitter : lanes.straightYawJitter);
      // A longer body is pulled further off the aisle inside its stall, the
      // way a pickup gets nosed up to the field edge so the lane stays open.
      const model = FLOW_FEST_PARKED_CAR_MODELS[modelIndex]!;
      const acrossShift =
        (Math.max(model.lengthMeters, 2 * lanes.carHalfLengthMeters) -
          2 * lanes.carHalfLengthMeters) /
        2;
      const across = stall.across + stall.outward * acrossShift;
      const along = stall.along + (crooked ? (rng() - 0.5) * 0.3 : 0);
      const noseSign = facing === "nose-in" ? stall.outward : -stall.outward;
      const nose = { x: cross.x * noseSign, z: cross.z * noseSign };
      cars.push({
        ...stall,
        along,
        across,
        modelIndex,
        facing,
        crooked,
        rotation: Math.atan2(-nose.z, nose.x) + yawJitter,
        ...toWorld(along, across),
      });
    });
  });

  // Centre tents pitch behind an outer-row car, in the open ground that row
  // backs onto, never in the aisle a neighbour needs to leave by.
  const tentCandidates = cars
    .filter((car) => car.row !== 1 && !car.crooked)
    .map((car) => {
      const model = FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!;
      const across =
        car.across +
        car.outward * (model.lengthMeters / 2 + lanes.tentBehindCarMeters);
      const point = toWorld(car.along, across);
      return { car, point };
    })
    .filter(({ point }) => {
      if (!pointInsidePlanLoop(point, loop)) return false;
      if (
        distanceToPlanLine(point.x, point.z, loop) < lanes.tentLoopClearanceMeters
      ) {
        return false;
      }
      if (pointNearRoutes(point.x, point.z, routes, 1.4)) return false;
      return !options.peers.some(
        (peer) => Math.hypot(peer.x - point.x, peer.z - point.z) < 3.4
      );
    })
    .sort((first, second) => first.car.along - second.car.along);
  if (tentCandidates.length < options.tentCount) {
    throw new Error(
      `Only ${tentCandidates.length} cars have room for a tent behind them; ${options.tentCount} centre tents were requested`
    );
  }
  const tents: FlowFestLowerCampPlacement2D[] = [];
  for (let index = 0; index < options.tentCount; index += 1) {
    const pick = Math.floor(
      ((index + 0.5) / options.tentCount) * tentCandidates.length
    );
    const { car, point } = tentCandidates[pick]!;
    tents.push({
      ...point,
      rotation: Math.atan2(car.x - point.x, car.z - point.z),
    });
  }

  const aisleIntrusionCount = cars.filter((car) => {
    const model = FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!;
    const halfLength = model.lengthMeters / 2;
    const halfWidth = model.widthMeters / 2;
    const cos = Math.cos(car.rotation);
    const sin = Math.sin(car.rotation);
    return [-1, 1].some((lengthSign) =>
      [-1, 1].some((widthSign) => {
        const localX = lengthSign * halfLength;
        const localZ = widthSign * halfWidth;
        const worldX = car.x + localX * cos + localZ * sin;
        const worldZ = car.z - localX * sin + localZ * cos;
        const across =
          (worldX - center.x) * cross.x + (worldZ - center.z) * cross.z;
        return lanes.aisleCenterAcrossMeters.some(
          (aisle) => Math.abs(across - aisle) < lanes.aisleWidthMeters / 2
        );
      })
    );
  }).length;

  return {
    vehicles: cars.map((car) => ({
      x: car.x,
      z: car.z,
      rotation: car.rotation,
      modelId: FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!.id,
      row: car.row,
      stall: car.stall,
      facing: car.facing,
      crooked: car.crooked,
    })),
    tents,
    emptyStallCount: emptyIndices.size,
    aisleIntrusionCount,
  };
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
