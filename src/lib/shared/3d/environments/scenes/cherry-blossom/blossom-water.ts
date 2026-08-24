import masterplanJson from "../../../../../../../docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json";

type PlanPoint = [number, number];

interface BlossomWaterPlan {
  status: string;
  approvalGate: { productionChangesAllowed: boolean };
  water: {
    centerline: PlanPoint[];
    surfaceWidth: number;
    bankTransitionWidth: number;
    bedDepth: number;
    surfaceElevation: number;
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

function toReflectorPoint([x, depth]: PlanPoint): PlanPoint {
  // ReflectivePool rotates its local XY shape -90 degrees around X. Negating
  // authored depth here places north at positive world Z after that rotation.
  return [-x, -depth];
}

function halfWidthAtPoint(point: PlanPoint): number {
  let halfWidth = plan.water.surfaceWidth / 2;
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

export function getBlossomRiverSurfaceElevation(): number {
  return plan.water.surfaceElevation;
}

export function getBlossomRiverBedDepth(): number {
  return plan.water.bedDepth;
}

export function getBlossomRiverCenterline(): PlanPoint[] {
  return plan.water.centerline.map(toReflectorPoint);
}

export function getBlossomRiverOutline(): PlanPoint[] {
  const centerline = plan.water.centerline;
  const left: PlanPoint[] = [];
  const right: PlanPoint[] = [];

  for (let index = 0; index < centerline.length; index += 1) {
    const current = centerline[index]!;
    const previous = centerline[Math.max(0, index - 1)]!;
    const next = centerline[Math.min(centerline.length - 1, index + 1)]!;
    const tangentX = next[0] - previous[0];
    const tangentDepth = next[1] - previous[1];
    const length = Math.hypot(tangentX, tangentDepth) || 1;
    const normalX = -tangentDepth / length;
    const normalDepth = tangentX / length;
    const halfWidth = halfWidthAtPoint(current);

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

export function getBlossomRiverBounds(): {
  width: number;
  depth: number;
} {
  const outline = getBlossomRiverOutline();
  const x = outline.map((point) => point[0]);
  const depth = outline.map((point) => point[1]);
  return {
    width: Math.max(...x) - Math.min(...x),
    depth: Math.max(...depth) - Math.min(...depth),
  };
}
