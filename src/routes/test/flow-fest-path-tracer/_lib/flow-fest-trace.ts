export const FLOW_FEST_TRACE_SCHEMA_VERSION = 1 as const;

export const FLOW_FEST_IMAGE = {
  width: 2048,
  height: 2048,
  pixelSizeMeters: 0.5,
  worldMinX: -512,
  worldMinZ: -512,
  sourcePath: "static/data/flow-fest-sim/ortho.webp",
  sourceSha256:
    "abbf63d78d4d4cc29f3df591e2c19687cba8ce63811748008a8bc6235e18fd2f",
} as const;

export const FLOW_FEST_TRACE_VIEW = {
  x: 684,
  y: 574,
  width: 1080,
  height: 560,
} as const;

export type FlowFestPathId = "upper-to-middle" | "middle-to-lower";

export interface ImagePoint {
  x: number;
  y: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export type FlowFestImageTraces = Record<FlowFestPathId, ImagePoint[]>;

export interface FlowFestTraceSubmission {
  schemaVersion: typeof FLOW_FEST_TRACE_SCHEMA_VERSION;
  sceneId: "flow-fest-sim-earth";
  capturedAt: string;
  coordinateFrame: "world metres; x east, z south";
  source: {
    path: typeof FLOW_FEST_IMAGE.sourcePath;
    sha256: typeof FLOW_FEST_IMAGE.sourceSha256;
    pixelSizeMeters: typeof FLOW_FEST_IMAGE.pixelSizeMeters;
  };
  paths: {
    upperClearingToMiddleEarth: WorldPoint[];
    middleEarthToLowerClearing: WorldPoint[];
  };
}

export type TraceValidationResult =
  | { valid: true; value: FlowFestTraceSubmission }
  | { valid: false; error: string };

const TRACE_ANCHORS: Record<
  FlowFestPathId,
  { start: ImagePoint; end: ImagePoint }
> = {
  "upper-to-middle": {
    start: { x: 900, y: 876 },
    end: { x: 1224, y: 794 },
  },
  "middle-to-lower": {
    start: { x: 1224, y: 794 },
    end: { x: 1596, y: 764 },
  },
};

export function emptyFlowFestTraces(): FlowFestImageTraces {
  return {
    "upper-to-middle": [],
    "middle-to-lower": [],
  };
}

function distance(left: ImagePoint, right: ImagePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function traceLengthMeters(points: readonly ImagePoint[]): number {
  let pixels = 0;
  for (let index = 1; index < points.length; index += 1) {
    pixels += distance(points[index - 1]!, points[index]!);
  }
  return pixels * FLOW_FEST_IMAGE.pixelSizeMeters;
}

function perpendicularDistance(
  point: ImagePoint,
  start: ImagePoint,
  end: ImagePoint
): number {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) return distance(point, start);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        lengthSquared
    )
  );
  return distance(point, {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  });
}

export function simplifyTrace(
  points: readonly ImagePoint[],
  tolerancePixels = 1.25
): ImagePoint[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));

  let farthestDistance = 0;
  let farthestIndex = 0;
  const start = points[0]!;
  const end = points[points.length - 1]!;
  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = perpendicularDistance(points[index]!, start, end);
    if (currentDistance > farthestDistance) {
      farthestDistance = currentDistance;
      farthestIndex = index;
    }
  }

  if (farthestDistance <= tolerancePixels) return [{ ...start }, { ...end }];
  const left = simplifyTrace(
    points.slice(0, farthestIndex + 1),
    tolerancePixels
  );
  const right = simplifyTrace(points.slice(farthestIndex), tolerancePixels);
  return [...left.slice(0, -1), ...right];
}

export function normalizeTraceDirection(
  pathId: FlowFestPathId,
  points: readonly ImagePoint[]
): ImagePoint[] {
  if (points.length < 2) return points.map((point) => ({ ...point }));
  const anchor = TRACE_ANCHORS[pathId];
  const forwardCost =
    distance(points[0]!, anchor.start) +
    distance(points[points.length - 1]!, anchor.end);
  const reverseCost =
    distance(points[0]!, anchor.end) +
    distance(points[points.length - 1]!, anchor.start);
  const ordered =
    reverseCost < forwardCost ? [...points].reverse() : [...points];
  return ordered.map((point) => ({ ...point }));
}

export function imagePointToWorld(point: ImagePoint): WorldPoint {
  return {
    x: Number(
      (
        FLOW_FEST_IMAGE.worldMinX +
        point.x * FLOW_FEST_IMAGE.pixelSizeMeters
      ).toFixed(1)
    ),
    z: Number(
      (
        FLOW_FEST_IMAGE.worldMinZ +
        point.y * FLOW_FEST_IMAGE.pixelSizeMeters
      ).toFixed(1)
    ),
  };
}

export function createTraceSubmission(
  traces: FlowFestImageTraces,
  capturedAt = new Date().toISOString()
): FlowFestTraceSubmission {
  return {
    schemaVersion: FLOW_FEST_TRACE_SCHEMA_VERSION,
    sceneId: "flow-fest-sim-earth",
    capturedAt,
    coordinateFrame: "world metres; x east, z south",
    source: {
      path: FLOW_FEST_IMAGE.sourcePath,
      sha256: FLOW_FEST_IMAGE.sourceSha256,
      pixelSizeMeters: FLOW_FEST_IMAGE.pixelSizeMeters,
    },
    paths: {
      upperClearingToMiddleEarth:
        traces["upper-to-middle"].map(imagePointToWorld),
      middleEarthToLowerClearing:
        traces["middle-to-lower"].map(imagePointToWorld),
    },
  };
}

function isFinitePoint(value: unknown, secondAxis: "y" | "z"): boolean {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point[secondAxis] === "number" &&
    Number.isFinite(point[secondAxis])
  );
}

function isImageTrace(value: unknown): value is ImagePoint[] {
  return (
    Array.isArray(value) &&
    value.every((candidate) => {
      if (!isFinitePoint(candidate, "y")) return false;
      const point = candidate as ImagePoint;
      return (
        point.x >= 0 &&
        point.x <= FLOW_FEST_IMAGE.width &&
        point.y >= 0 &&
        point.y <= FLOW_FEST_IMAGE.height
      );
    })
  );
}

export function parseStoredTraces(
  serialized: string
): FlowFestImageTraces | null {
  try {
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !isImageTrace(parsed["upper-to-middle"]) ||
      !isImageTrace(parsed["middle-to-lower"])
    ) {
      return null;
    }
    return {
      "upper-to-middle": parsed["upper-to-middle"].map((point) => ({
        ...point,
      })),
      "middle-to-lower": parsed["middle-to-lower"].map((point) => ({
        ...point,
      })),
    };
  } catch {
    return null;
  }
}

function validateWorldPath(value: unknown, label: string): string | null {
  if (!Array.isArray(value) || value.length < 2) {
    return `${label} needs a drawn path.`;
  }
  if (value.length > 2_000) return `${label} has too many points.`;
  for (const point of value) {
    if (!isFinitePoint(point, "z"))
      return `${label} contains an invalid point.`;
    const worldPoint = point as WorldPoint;
    if (
      worldPoint.x < FLOW_FEST_IMAGE.worldMinX ||
      worldPoint.x > -FLOW_FEST_IMAGE.worldMinX ||
      worldPoint.z < FLOW_FEST_IMAGE.worldMinZ ||
      worldPoint.z > -FLOW_FEST_IMAGE.worldMinZ
    ) {
      return `${label} leaves the registered terrain footprint.`;
    }
  }
  return null;
}

export function validateTraceSubmission(value: unknown): TraceValidationResult {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "Expected a trace submission object." };
  }
  const submission = value as Partial<FlowFestTraceSubmission>;
  if (
    submission.schemaVersion !== FLOW_FEST_TRACE_SCHEMA_VERSION ||
    submission.sceneId !== "flow-fest-sim-earth" ||
    submission.coordinateFrame !== "world metres; x east, z south"
  ) {
    return {
      valid: false,
      error: "Trace metadata does not match Flow Fest Sim.",
    };
  }
  if (
    !submission.source ||
    submission.source.path !== FLOW_FEST_IMAGE.sourcePath ||
    submission.source.sha256 !== FLOW_FEST_IMAGE.sourceSha256 ||
    submission.source.pixelSizeMeters !== FLOW_FEST_IMAGE.pixelSizeMeters
  ) {
    return {
      valid: false,
      error: "Trace source does not match the pinned orthophoto.",
    };
  }
  if (!submission.paths) {
    return { valid: false, error: "Trace submission has no paths." };
  }
  const upperError = validateWorldPath(
    submission.paths.upperClearingToMiddleEarth,
    "Upper-to-middle"
  );
  if (upperError) return { valid: false, error: upperError };
  const lowerError = validateWorldPath(
    submission.paths.middleEarthToLowerClearing,
    "Middle-to-lower"
  );
  if (lowerError) return { valid: false, error: lowerError };
  if (
    typeof submission.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(submission.capturedAt))
  ) {
    return { valid: false, error: "Trace capture time is invalid." };
  }
  return { valid: true, value: submission as FlowFestTraceSubmission };
}
