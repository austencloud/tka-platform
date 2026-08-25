import masterplanJson from "../../../../../../../docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json";

type PlanPoint = [number, number];

interface BlossomWaterPlan {
  status: string;
  approvalGate: { productionChangesAllowed: boolean };
  site: {
    terrainBounds: { minX: number; maxX: number; minY: number; maxY: number };
  };
  water: {
    centerline: PlanPoint[];
    surfaceWidth: number;
    bankTransitionWidth: number;
    bedDepth: number;
    surfaceElevation: number;
    splineSubdivisions: number;
    shoreFadeMetres: number;
    runOut: {
      marginMetres: number;
      openFromMetres: number;
      surfaceWidth: number;
    };
    localWidenings: Array<{
      id: string;
      center: PlanPoint;
      surfaceRadius: number;
      minimumDepth: number;
    }>;
  };
}

const plan = masterplanJson as unknown as BlossomWaterPlan;

// "rejected-visual-review" renders the preserved build for comparison only.
if (
  plan.status !== "approved-for-production" &&
  plan.status !== "rejected-visual-review"
) {
  throw new Error("Blossom water plan is not at a recognized runtime gate");
}

/** Metres between run-out stations. Matches the resampled spline's density. */
const RUN_OUT_SPACING = 4;

function toReflectorPoint([x, depth]: PlanPoint): PlanPoint {
  // ReflectivePool rotates its local XY shape -90 degrees around X. Negating
  // authored depth here places north at positive world Z after that rotation.
  return [-x, -depth];
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return 0;
  const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function catmullRom(
  first: PlanPoint,
  second: PlanPoint,
  third: PlanPoint,
  fourth: PlanPoint,
  amount: number
): PlanPoint {
  const point = [0, 0] as PlanPoint;
  for (let axis = 0; axis < 2; axis += 1) {
    point[axis] =
      0.5 *
      (2 * second[axis]! +
        (-first[axis]! + third[axis]!) * amount +
        (2 * first[axis]! -
          5 * second[axis]! +
          4 * third[axis]! -
          fourth[axis]!) *
          amount *
          amount +
        (-first[axis]! + 3 * second[axis]! - 3 * third[axis]! + fourth[axis]!) *
          amount *
          amount *
          amount);
  }
  return point;
}

/**
 * Catmull-Rom the ten authored control points into the same station set the
 * Blender build walks.
 *
 * Reading the control points directly gives nine long straight segments, so the
 * runtime shoreline is a chain of facets while the baked channel underneath it
 * is a smooth curve. The two sides disagreeing is what made the water read as a
 * painted polygon rather than as a river filling its bed.
 */
function resampleAuthoredCenterline(): PlanPoint[] {
  const control = plan.water.centerline;
  const subdivisions = plan.water.splineSubdivisions;
  const samples: PlanPoint[] = [];

  for (let segment = 0; segment < control.length - 1; segment += 1) {
    const first = control[Math.max(0, segment - 1)]!;
    const second = control[segment]!;
    const third = control[segment + 1]!;
    const fourth = control[Math.min(control.length - 1, segment + 2)]!;
    for (let step = 0; step < subdivisions; step += 1) {
      samples.push(catmullRom(first, second, third, fourth, step / subdivisions));
    }
  }
  samples.push([...control[control.length - 1]!] as PlanPoint);
  return samples;
}

function isOutsideTerrain(point: PlanPoint): boolean {
  const bounds = plan.site.terrainBounds;
  const margin = plan.water.runOut.marginMetres;
  return (
    point[0] < bounds.minX - margin ||
    point[0] > bounds.maxX + margin ||
    point[1] < bounds.minY - margin ||
    point[1] > bounds.maxY + margin
  );
}

/** Stations continuing an end tangent until the water has left the site. */
function runOutStations(anchor: PlanPoint, inward: PlanPoint): PlanPoint[] {
  const dx = anchor[0] - inward[0];
  const dy = anchor[1] - inward[1];
  const length = Math.hypot(dx, dy) || 1;
  const stations: PlanPoint[] = [];

  for (let distance = RUN_OUT_SPACING; distance < 400; distance += RUN_OUT_SPACING) {
    const point: PlanPoint = [
      anchor[0] + (dx / length) * distance,
      anchor[1] + (dy / length) * distance,
    ];
    stations.push(point);
    if (isOutsideTerrain(point)) break;
  }
  return stations;
}

interface RiverCourse {
  stations: PlanPoint[];
  arcLengths: number[];
  authoredStartArc: number;
  authoredEndArc: number;
}

/**
 * The authored reach plus a run-out past the terrain boundary at each end.
 *
 * The centerline spans 85 m inside a 256 m site. Ending the water there leaves
 * two square caps floating mid-field, which is the single loudest defect in the
 * scene. Continuing the end tangents off the site lets the river arrive from
 * the hills and leave the same way.
 */
function buildCourse(): RiverCourse {
  const authored = resampleAuthoredCenterline();
  const head = runOutStations(authored[0]!, authored[1]!).reverse();
  const tail = runOutStations(
    authored[authored.length - 1]!,
    authored[authored.length - 2]!
  );
  const stations = [...head, ...authored, ...tail];

  const arcLengths: number[] = [0];
  for (let index = 1; index < stations.length; index += 1) {
    const previous = stations[index - 1]!;
    const current = stations[index]!;
    arcLengths.push(
      arcLengths[index - 1]! + Math.hypot(current[0] - previous[0], current[1] - previous[1])
    );
  }

  return {
    stations,
    arcLengths,
    authoredStartArc: arcLengths[head.length]!,
    authoredEndArc: arcLengths[head.length + authored.length - 1]!,
  };
}

const course = buildCourse();

/** 0 across the authored reach, 1 once the run-out section is fully open. */
function runOutAmount(arcLength: number): number {
  const openFrom = plan.water.runOut.openFromMetres;
  if (arcLength < course.authoredStartArc) {
    return smoothstep(0, openFrom, course.authoredStartArc - arcLength);
  }
  if (arcLength > course.authoredEndArc) {
    return smoothstep(0, openFrom, arcLength - course.authoredEndArc);
  }
  return 0;
}

function halfWidthAt(point: PlanPoint, arcLength: number): number {
  const open = runOutAmount(arcLength);
  const surfaceWidth =
    plan.water.surfaceWidth +
    (plan.water.runOut.surfaceWidth - plan.water.surfaceWidth) * open;
  let halfWidth = surfaceWidth / 2;

  for (const widening of plan.water.localWidenings) {
    const distance = Math.hypot(
      point[0] - widening.center[0],
      point[1] - widening.center[1]
    );
    const wideningHalfWidth = Math.sqrt(
      Math.max(0, widening.surfaceRadius ** 2 - distance ** 2)
    );
    halfWidth = Math.max(halfWidth, wideningHalfWidth);
  }
  return halfWidth;
}

function buildBankedOutline(): PlanPoint[] {
  const { stations, arcLengths } = course;
  const left: PlanPoint[] = [];
  const right: PlanPoint[] = [];

  for (let index = 0; index < stations.length; index += 1) {
    const current = stations[index]!;
    const previous = stations[Math.max(0, index - 1)]!;
    const next = stations[Math.min(stations.length - 1, index + 1)]!;
    const tangentX = next[0] - previous[0];
    const tangentDepth = next[1] - previous[1];
    const length = Math.hypot(tangentX, tangentDepth) || 1;
    const normalX = -tangentDepth / length;
    const normalDepth = tangentX / length;
    const halfWidth = halfWidthAt(current, arcLengths[index]!);

    left.push(
      toReflectorPoint([
        current[0] + normalX * halfWidth,
        current[1] + normalDepth * halfWidth,
      ])
    );
    right.push(
      toReflectorPoint([
        current[0] - normalX * halfWidth,
        current[1] - normalDepth * halfWidth,
      ])
    );
  }

  return [...left, ...right.reverse()];
}

const worldOutline = buildBankedOutline();

const worldBounds = {
  minX: Math.min(...worldOutline.map((point) => point[0])),
  maxX: Math.max(...worldOutline.map((point) => point[0])),
  minDepth: Math.min(...worldOutline.map((point) => point[1])),
  maxDepth: Math.max(...worldOutline.map((point) => point[1])),
};

// ReflectivePool reconstructs shoreline coordinates as (uv - 0.5) * size, which
// only equals the outline's own coordinates when the outline is centred on the
// origin. Handing it world-offset points put every shore-fade and foam sample
// roughly 16 m away from the bank it was meant to measure, so the shallow edge
// colour never appeared anywhere on the surface.
const outlineCenter = {
  x: (worldBounds.minX + worldBounds.maxX) / 2,
  depth: (worldBounds.minDepth + worldBounds.maxDepth) / 2,
};

const localOutline: PlanPoint[] = worldOutline.map(([x, depth]) => [
  x - outlineCenter.x,
  depth - outlineCenter.depth,
]);

export function getBlossomRiverSurfaceElevation(): number {
  return plan.water.surfaceElevation;
}

export function getBlossomRiverBedDepth(): number {
  return plan.water.bedDepth;
}

/** Metres over which the shallow bank colour gives way to the deep channel. */
export function getBlossomRiverShoreFade(): number {
  return plan.water.shoreFadeMetres;
}

export function getBlossomRiverCenterline(): PlanPoint[] {
  return course.stations.map(toReflectorPoint);
}

/** Local XY shoreline, centred on its own bounding box. */
export function getBlossomRiverOutline(): PlanPoint[] {
  return localOutline;
}

export function getBlossomRiverBounds(): {
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
} {
  return {
    width: worldBounds.maxX - worldBounds.minX,
    depth: worldBounds.maxDepth - worldBounds.minDepth,
    centerX: outlineCenter.x,
    centerZ: outlineCenter.depth,
  };
}
