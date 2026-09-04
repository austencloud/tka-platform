import type {
  FlowFestRuntimePoint,
  FlowFestRuntimeSegment,
} from "../flow-fest-graybox/flow-fest-runtime-contract";
import {
  FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY,
  type FlowFestCampPlanLine,
} from "./flow-fest-camp-plan";
import { pointInsideFlowFestEntranceFixtureClearance } from "./flow-fest-entrance-reference";
import {
  FLOW_FEST_PARKED_CAR_MODELS,
  flowFestParkedCarPaintCount,
} from "./flow-fest-parked-cars";

export interface FlowFestLowerCampPlacement2D {
  x: number;
  z: number;
  rotation: number;
}

export interface FlowFestLowerCampVehiclePlacement2D
  extends FlowFestLowerCampPlacement2D {
  modelId: string;
  paintIndex: number;
  row: number;
  stall: number;
  facing: "nose-in" | "backed-in";
  crooked: boolean;
}

export interface FlowFestLowerCampOccupancyLayout {
  centerVehicles: FlowFestLowerCampVehiclePlacement2D[];
  /** Tents pitched off a tailgate in the camp strip between paired rows. */
  centerTents: FlowFestLowerCampPlacement2D[];
  /** Pop-up canopies set up off a tailgate in the same camp strips. */
  centerCanopies: FlowFestLowerCampPlacement2D[];
  innerRoadsideTents: FlowFestLowerCampPlacement2D[];
  outerTreeLineTents: FlowFestLowerCampPlacement2D[];
  audit: {
    centerVehicleOutsideLoopCount: number;
    /** Cars whose body reaches into the central drive lane. */
    centerVehicleAisleIntrusionCount: number;
    /** Cars whose body reaches into a camp strip's walking lane. */
    centerVehicleWalkLaneIntrusionCount: number;
    /** Tents and canopies that reach into a camp strip's walking lane. */
    centerGearWalkLaneIntrusionCount: number;
    centerVehicleEmptyStallCount: number;
    innerRoadsideTentOutsideLoopCount: number;
    outerTreeLineTentInsideLoopCount: number;
  };
}

/**
 * How the open middle of the loop is parked, the way a car campground is
 * actually run. One drive lane runs down the loop's long axis, wide enough for
 * a car to pass parked cars on both sides. Each side has two rows of stalls:
 * the inner row parks off the drive, the outer row parks off the open field,
 * and the two rows back onto a shared camp strip. That strip is where people
 * live: tents and pop-up canopies go off a tailgate on either side, and the
 * middle of the strip stays clear enough to walk the row end to end.
 *
 * Across the loop, from the drive outward on one side:
 * drive half (3.75) / gap / inner row / camp strip (13) / outer row / field.
 */
const LOWER_CAMP_PARKING_LANES = Object.freeze({
  driveWidthMeters: 7.5,
  innerRowAcrossMeters: 6.9,
  campStripWidthMeters: 13,
  /** Clear band down the middle of each camp strip that nothing may enter. */
  walkLaneWidthMeters: 2.4,
  stallPitchMeters: 3.7,
  stallReachMeters: 36,
  stallJitterMeters: 0.12,
  carHalfLengthMeters: 2.35,
  loopClearanceMeters: 7,
  tentLoopClearanceMeters: 6,
  routeClearanceMeters: 2.5,
  gatehouseClearanceMeters: 5.2,
  /** Clear ground between a rear bumper and the tent pitched behind it. */
  tentBehindCarMeters: 1.2,
  tentHalfDepthMeters: 1.4,
  /** A pop-up canopy sits almost against the tailgate; that is its shade. */
  canopyBehindCarMeters: 0.5,
  canopyHalfSizeMeters: 1.5,
  gearSpacingMeters: 3.4,
  emptyStallShare: 0.12,
  backedInShare: 0.35,
  straightYawJitter: 0.035,
  crookedYawJitter: 0.2,
});

/**
 * Derive festival dressing from the registered lower loop. Exact pitches are
 * deterministic fiction; the inside/roadside/tree-line relationship is the
 * Austen-observed topology this module protects.
 */
export interface FlowFestLowerCampKeepClear {
  x: number;
  z: number;
  radiusMeters: number;
}

export function deriveFlowFestLowerCampOccupancy(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  /**
   * Open ground the parking rows must not enter: the gate check-in apron
   * where the crew stands and arriving cars queue.
   */
  keepClear?: FlowFestLowerCampKeepClear[];
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
    canopyCount: FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerCanopyCount,
  });
  const centerVehicles = lanes.vehicles;

  return {
    centerVehicles,
    centerTents: lanes.tents,
    centerCanopies: lanes.canopies,
    innerRoadsideTents,
    outerTreeLineTents,
    audit: {
      centerVehicleOutsideLoopCount: centerVehicles.filter(
        (placement) => !pointInsidePlanLoop(placement, options.loop)
      ).length,
      centerVehicleAisleIntrusionCount: lanes.driveIntrusionCount,
      centerVehicleWalkLaneIntrusionCount: lanes.vehicleWalkLaneIntrusionCount,
      centerGearWalkLaneIntrusionCount: lanes.gearWalkLaneIntrusionCount,
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

interface ParkingRow {
  across: number;
  /** +1 or -1 along `cross`: the side of this row that its camp strip is on. */
  stripSide: 1 | -1;
  /** +1 or -1 along `cross`: away from the drive, where a long body shifts. */
  outward: 1 | -1;
}

interface ParkingStall {
  row: number;
  stall: number;
  along: number;
  across: number;
}

interface ParkedCar extends ParkingStall {
  modelIndex: number;
  paintIndex: number;
  facing: "nose-in" | "backed-in";
  crooked: boolean;
  rotation: number;
  x: number;
  z: number;
}

interface CampGear {
  car: ParkedCar;
  kind: "tent" | "canopy";
  along: number;
  across: number;
  halfDepth: number;
  point: { x: number; z: number };
}

function parkingRows(): ParkingRow[] {
  const lanes = LOWER_CAMP_PARKING_LANES;
  const outerAcross =
    lanes.innerRowAcrossMeters +
    2 * lanes.carHalfLengthMeters +
    lanes.campStripWidthMeters;
  return [
    { across: -outerAcross, stripSide: 1, outward: -1 },
    { across: -lanes.innerRowAcrossMeters, stripSide: -1, outward: -1 },
    { across: lanes.innerRowAcrossMeters, stripSide: 1, outward: 1 },
    { across: outerAcross, stripSide: -1, outward: 1 },
  ];
}

/** The two camp strips' clear walking bands, as across intervals. */
function walkLanes(): Array<{ from: number; to: number }> {
  const lanes = LOWER_CAMP_PARKING_LANES;
  const stripStart = lanes.innerRowAcrossMeters + lanes.carHalfLengthMeters;
  const stripCenter = stripStart + lanes.campStripWidthMeters / 2;
  return [-1, 1].map((side) => ({
    from: side * stripCenter - lanes.walkLaneWidthMeters / 2,
    to: side * stripCenter + lanes.walkLaneWidthMeters / 2,
  }));
}

function intervalsOverlap(
  first: { from: number; to: number },
  second: { from: number; to: number }
): boolean {
  return first.from < second.to && second.from < first.to;
}

/**
 * Park the loop's middle the way people actually do it: side by side in rows
 * off a central drive, a mix of nose-in and backed-in, a few stalls still
 * empty, one car per row parked crooked, one body wearing several paints,
 * and tents and canopies set up off the tailgates that face a camp strip.
 */
function buildCenterParkingLanes(options: {
  rng: () => number;
  loop: FlowFestCampPlanLine;
  routes: FlowFestRuntimeSegment[];
  peers: FlowFestLowerCampPlacement2D[];
  keepClear?: FlowFestLowerCampKeepClear[];
  vehicleCount: number;
  tentCount: number;
  canopyCount: number;
}): {
  vehicles: FlowFestLowerCampVehiclePlacement2D[];
  tents: FlowFestLowerCampPlacement2D[];
  canopies: FlowFestLowerCampPlacement2D[];
  emptyStallCount: number;
  driveIntrusionCount: number;
  vehicleWalkLaneIntrusionCount: number;
  gearWalkLaneIntrusionCount: number;
} {
  const lanes = LOWER_CAMP_PARKING_LANES;
  const { rng, loop, routes, keepClear = [] } = options;
  const center = planLoopCenter(loop);
  const axis = planLoopPrincipalAxis(loop, center);
  const cross = { x: -axis.z, z: axis.x };
  const toWorld = (along: number, across: number) => ({
    x: center.x + axis.x * along + cross.x * across,
    z: center.z + axis.z * along + cross.z * across,
  });
  const toAcross = (point: { x: number; z: number }) =>
    (point.x - center.x) * cross.x + (point.z - center.z) * cross.z;
  const jitter = () => (rng() - 0.5) * 2 * lanes.stallJitterMeters;
  const rows = parkingRows();
  const lanesToWalk = walkLanes();
  const clearOfSite = (point: { x: number; z: number }, loopClearance: number) =>
    pointInsidePlanLoop(point, loop) &&
    distanceToPlanLine(point.x, point.z, loop) >= loopClearance &&
    !pointNearRoutes(point.x, point.z, routes, lanes.routeClearanceMeters) &&
    !pointInsideFlowFestEntranceFixtureClearance(
      point,
      lanes.gatehouseClearanceMeters
    ) &&
    keepClear.every(
      (zone) =>
        Math.hypot(point.x - zone.x, point.z - zone.z) >= zone.radiusMeters
    );

  const stalls: ParkingStall[] = [];
  const stallsPerRow = Math.floor(
    (2 * lanes.stallReachMeters) / lanes.stallPitchMeters
  );
  rows.forEach((row, rowIndex) => {
    for (let stall = 0; stall < stallsPerRow; stall += 1) {
      const along =
        -lanes.stallReachMeters +
        (stall + 0.5) * lanes.stallPitchMeters +
        jitter();
      const across = row.across + jitter();
      // A stall is only real if the whole body fits, so the far bumper of the
      // longest catalogue body is what gets tested against the loop edge.
      const farBumper = toWorld(along, across + row.outward * 3.1);
      if (!clearOfSite(toWorld(along, across), lanes.loopClearanceMeters)) {
        continue;
      }
      if (!clearOfSite(farBumper, lanes.loopClearanceMeters - 2)) continue;
      stalls.push({ row: rowIndex, stall, along, across });
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

  // Exactly the backed-in share is backed in, shuffled across the rows, so a
  // run of coin flips can never starve the strips of tailgates to camp off.
  const backedInFlags = occupied.map(
    (_, index) => index < Math.round(occupied.length * lanes.backedInShare)
  );
  for (let index = backedInFlags.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [backedInFlags[index], backedInFlags[swap]] = [
      backedInFlags[swap]!,
      backedInFlags[index]!,
    ];
  }
  let carOrdinal = 0;

  const cars: ParkedCar[] = [];
  const modelIndices = FLOW_FEST_PARKED_CAR_MODELS.map((_, index) => index);
  rows.forEach((row, rowIndex) => {
    const rowStalls = occupied
      .filter((stall) => stall.row === rowIndex)
      .sort((first, second) => first.along - second.along);
    const crookedIndex = Math.floor(rng() * rowStalls.length);
    let previousModel = -1;
    let previousPaint = -1;
    rowStalls.forEach((stall, index) => {
      const allowedModels = modelIndices.filter(
        (candidate) => candidate !== previousModel
      );
      const modelIndex =
        allowedModels[Math.floor(rng() * allowedModels.length)]!;
      const model = FLOW_FEST_PARKED_CAR_MODELS[modelIndex]!;
      // Neighbours never share a body, and a body never repeats its last paint
      // within a row, so the same car reads as a different car down the line.
      const paintCount = flowFestParkedCarPaintCount(model);
      let paintIndex = Math.floor(rng() * paintCount);
      if (paintCount > 1 && paintIndex === previousPaint) {
        paintIndex = (paintIndex + 1) % paintCount;
      }
      previousModel = modelIndex;
      previousPaint = paintIndex;
      const facing = backedInFlags[carOrdinal] ? "backed-in" : "nose-in";
      carOrdinal += 1;
      const crooked = index === crookedIndex;
      const yawJitter =
        (rng() - 0.5) *
        2 *
        (crooked ? lanes.crookedYawJitter : lanes.straightYawJitter);
      // A longer body is pulled further off the drive inside its stall, the
      // way a pickup gets nosed up to the field edge so the lane stays open.
      const acrossShift =
        (Math.max(model.lengthMeters, 2 * lanes.carHalfLengthMeters) -
          2 * lanes.carHalfLengthMeters) /
        2;
      const across = stall.across + row.outward * acrossShift;
      const along = stall.along + (crooked ? (rng() - 0.5) * 0.3 : 0);
      // Nose-in points away from the camp strip (at the drive, or at the open
      // field); backed-in points the nose at the strip.
      const noseSign = facing === "nose-in" ? -row.stripSide : row.stripSide;
      const nose = { x: cross.x * noseSign, z: cross.z * noseSign };
      cars.push({
        ...stall,
        along,
        across,
        modelIndex,
        paintIndex,
        facing,
        crooked,
        rotation: Math.atan2(-nose.z, nose.x) + yawJitter,
        ...toWorld(along, across),
      });
    });
  });

  // Camp gear goes off a tailgate that faces the strip: a tent a step back
  // from the bumper, or a pop-up canopy right against it. A backed-in car's
  // tailgate faces the drive or the field, so it gets nothing.
  const gearCandidate = (car: ParkedCar, kind: CampGear["kind"]): CampGear => {
    const row = rows[car.row]!;
    const model = FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!;
    const halfDepth =
      kind === "tent" ? lanes.tentHalfDepthMeters : lanes.canopyHalfSizeMeters;
    const gap =
      kind === "tent" ? lanes.tentBehindCarMeters : lanes.canopyBehindCarMeters;
    const across =
      car.across + row.stripSide * (model.lengthMeters / 2 + gap + halfDepth);
    return {
      car,
      kind,
      along: car.along,
      across,
      halfDepth,
      point: toWorld(car.along, across),
    };
  };
  const gearFits = (gear: CampGear, placed: CampGear[]) => {
    if (!clearOfSite(gear.point, lanes.tentLoopClearanceMeters)) return false;
    const extent = {
      from: gear.across - gear.halfDepth,
      to: gear.across + gear.halfDepth,
    };
    if (lanesToWalk.some((lane) => intervalsOverlap(lane, extent))) {
      return false;
    }
    if (
      options.peers.some(
        (peer) =>
          Math.hypot(peer.x - gear.point.x, peer.z - gear.point.z) <
          lanes.gearSpacingMeters
      )
    ) {
      return false;
    }
    return !placed.some(
      (other) =>
        Math.hypot(other.point.x - gear.point.x, other.point.z - gear.point.z) <
        lanes.gearSpacingMeters
    );
  };
  const gearHosts = cars
    .filter((car) => car.facing === "nose-in" && !car.crooked)
    .sort((first, second) => first.along - second.along);
  const placedGear: CampGear[] = [];
  const usedHosts = new Set<ParkedCar>();
  const placeGear = (kind: CampGear["kind"], count: number) => {
    const candidates = gearHosts
      .filter((car) => !usedHosts.has(car))
      .map((car) => gearCandidate(car, kind))
      .filter((gear) => gearFits(gear, placedGear));
    if (candidates.length < count) {
      throw new Error(
        `Only ${candidates.length} cars have room for a ${kind} behind them; ${count} were requested`
      );
    }
    for (let index = 0; index < count; index += 1) {
      // Spread evenly along the strips, then skip forward past any candidate
      // that a just-placed neighbour made too close.
      let pick = Math.floor(((index + 0.5) / count) * candidates.length);
      while (
        pick < candidates.length &&
        (usedHosts.has(candidates[pick]!.car) ||
          !gearFits(candidates[pick]!, placedGear))
      ) {
        pick += 1;
      }
      if (pick >= candidates.length) {
        pick = candidates.findIndex(
          (gear) => !usedHosts.has(gear.car) && gearFits(gear, placedGear)
        );
      }
      if (pick < 0) {
        throw new Error(`Ran out of room for ${kind} ${index + 1}/${count}`);
      }
      const gear = candidates[pick]!;
      usedHosts.add(gear.car);
      placedGear.push(gear);
    }
  };
  placeGear("tent", options.tentCount);
  placeGear("canopy", options.canopyCount);
  const gearPlacement = (gear: CampGear): FlowFestLowerCampPlacement2D => ({
    ...gear.point,
    rotation: Math.atan2(gear.car.x - gear.point.x, gear.car.z - gear.point.z),
  });

  const carCornersAcross = (car: ParkedCar): number[] => {
    const model = FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!;
    const halfLength = model.lengthMeters / 2;
    const halfWidth = model.widthMeters / 2;
    const cos = Math.cos(car.rotation);
    const sin = Math.sin(car.rotation);
    return [-1, 1].flatMap((lengthSign) =>
      [-1, 1].map((widthSign) => {
        const localX = lengthSign * halfLength;
        const localZ = widthSign * halfWidth;
        return toAcross({
          x: car.x + localX * cos + localZ * sin,
          z: car.z - localX * sin + localZ * cos,
        });
      })
    );
  };
  const driveIntrusionCount = cars.filter((car) =>
    carCornersAcross(car).some(
      (across) => Math.abs(across) < lanes.driveWidthMeters / 2
    )
  ).length;
  const vehicleWalkLaneIntrusionCount = cars.filter((car) =>
    carCornersAcross(car).some((across) =>
      lanesToWalk.some((lane) => across > lane.from && across < lane.to)
    )
  ).length;
  const gearWalkLaneIntrusionCount = placedGear.filter((gear) =>
    lanesToWalk.some((lane) =>
      intervalsOverlap(lane, {
        from: gear.across - gear.halfDepth,
        to: gear.across + gear.halfDepth,
      })
    )
  ).length;

  return {
    vehicles: cars.map((car) => ({
      x: car.x,
      z: car.z,
      rotation: car.rotation,
      modelId: FLOW_FEST_PARKED_CAR_MODELS[car.modelIndex]!.id,
      paintIndex: car.paintIndex,
      row: car.row,
      stall: car.stall,
      facing: car.facing,
      crooked: car.crooked,
    })),
    tents: placedGear.filter((gear) => gear.kind === "tent").map(gearPlacement),
    canopies: placedGear
      .filter((gear) => gear.kind === "canopy")
      .map(gearPlacement),
    emptyStallCount: emptyIndices.size,
    driveIntrusionCount,
    vehicleWalkLaneIntrusionCount,
    gearWalkLaneIntrusionCount,
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
