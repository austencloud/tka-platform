import {
  FLOW_FEST_IMAGE,
  imagePointToWorld,
  simplifyTrace,
  traceLengthMeters,
  type ImagePoint,
  type WorldPoint,
} from "../../flow-fest-path-tracer/_lib/flow-fest-trace";

export const FLOW_FEST_LOWER_LOOP_TRACE_SCHEMA_VERSION = 1 as const;

export interface FlowFestLowerLoopTraceSubmission {
  schemaVersion: typeof FLOW_FEST_LOWER_LOOP_TRACE_SCHEMA_VERSION;
  sceneId: "flow-fest-sim-earth";
  capturedAt: string;
  coordinateFrame: "registered orthophoto pixels; columns east, rows south";
  source: {
    path: typeof FLOW_FEST_IMAGE.sourcePath;
    sha256: typeof FLOW_FEST_IMAGE.sourceSha256;
    pixelSizeMeters: typeof FLOW_FEST_IMAGE.pixelSizeMeters;
    annotationAuthority: "austen-annotated";
  };
  lowerCampgroundLoop: {
    imagePixels: ImagePoint[];
    worldMeters: WorldPoint[];
    lengthMeters: number;
  };
}

export type FlowFestLowerLoopTraceValidation =
  | { valid: true; value: FlowFestLowerLoopTraceSubmission }
  | { valid: false; error: string };

export function createFlowFestLowerLoopTraceSubmission(
  drawnPoints: readonly ImagePoint[],
  capturedAt = new Date().toISOString()
): FlowFestLowerLoopTraceSubmission {
  const imagePixels = closeLoop(simplifyTrace(drawnPoints, 1.1));
  return {
    schemaVersion: FLOW_FEST_LOWER_LOOP_TRACE_SCHEMA_VERSION,
    sceneId: "flow-fest-sim-earth",
    capturedAt,
    coordinateFrame: "registered orthophoto pixels; columns east, rows south",
    source: {
      path: FLOW_FEST_IMAGE.sourcePath,
      sha256: FLOW_FEST_IMAGE.sourceSha256,
      pixelSizeMeters: FLOW_FEST_IMAGE.pixelSizeMeters,
      annotationAuthority: "austen-annotated",
    },
    lowerCampgroundLoop: {
      imagePixels,
      worldMeters: imagePixels.map(imagePointToWorld),
      lengthMeters: traceLengthMeters(imagePixels),
    },
  };
}

export function validateFlowFestLowerLoopTraceSubmission(
  value: unknown
): FlowFestLowerLoopTraceValidation {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "Expected a lower-loop trace object." };
  }

  const submission = value as Partial<FlowFestLowerLoopTraceSubmission>;
  if (
    submission.schemaVersion !== FLOW_FEST_LOWER_LOOP_TRACE_SCHEMA_VERSION ||
    submission.sceneId !== "flow-fest-sim-earth" ||
    submission.coordinateFrame !==
      "registered orthophoto pixels; columns east, rows south"
  ) {
    return {
      valid: false,
      error: "Lower-loop trace metadata is not recognized.",
    };
  }
  if (
    submission.source?.path !== FLOW_FEST_IMAGE.sourcePath ||
    submission.source.sha256 !== FLOW_FEST_IMAGE.sourceSha256 ||
    submission.source.pixelSizeMeters !== FLOW_FEST_IMAGE.pixelSizeMeters ||
    submission.source.annotationAuthority !== "austen-annotated"
  ) {
    return {
      valid: false,
      error: "The trace is not registered to the pinned aerial.",
    };
  }
  if (
    typeof submission.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(submission.capturedAt))
  ) {
    return { valid: false, error: "The trace capture time is invalid." };
  }

  const pixels = submission.lowerCampgroundLoop?.imagePixels;
  const world = submission.lowerCampgroundLoop?.worldMeters;
  const length = submission.lowerCampgroundLoop?.lengthMeters;
  if (!Array.isArray(pixels) || pixels.length < 4 || pixels.length > 2_000) {
    return { valid: false, error: "Draw one complete loop around the road." };
  }
  if (!pixels.every(pointInsideRegisteredImage)) {
    return { valid: false, error: "The line leaves the registered aerial." };
  }
  if (!samePoint(pixels[0]!, pixels.at(-1)!)) {
    return { valid: false, error: "The lower road line must be closed." };
  }
  if (!Array.isArray(world) || world.length !== pixels.length) {
    return { valid: false, error: "The world-coordinate trace is incomplete." };
  }
  const expectedWorld = pixels.map(imagePointToWorld);
  if (
    !world.every(
      (point, index) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.z) &&
        samePoint(point, expectedWorld[index]!)
    )
  ) {
    return {
      valid: false,
      error: "The world coordinates do not match the aerial.",
    };
  }
  const expectedLength = traceLengthMeters(pixels);
  if (
    typeof length !== "number" ||
    !Number.isFinite(length) ||
    Math.abs(length - expectedLength) > 0.01 ||
    length < 150 ||
    length > 600
  ) {
    return {
      valid: false,
      error: "The drawn road loop has an implausible length.",
    };
  }

  return { valid: true, value: submission as FlowFestLowerLoopTraceSubmission };
}

function closeLoop(points: readonly ImagePoint[]): ImagePoint[] {
  if (points.length === 0) return [];
  const closed = points.map((point) => ({ ...point }));
  if (!samePoint(closed[0]!, closed.at(-1)!)) {
    closed.push({ ...closed[0]! });
  }
  return closed;
}

function pointInsideRegisteredImage(point: ImagePoint): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= FLOW_FEST_IMAGE.width &&
    point.y >= 0 &&
    point.y <= FLOW_FEST_IMAGE.height
  );
}

function samePoint(
  left: { x: number; y?: number; z?: number },
  right: { x: number; y?: number; z?: number }
): boolean {
  const leftSecond = left.y ?? left.z;
  const rightSecond = right.y ?? right.z;
  return left.x === right.x && leftSecond === rightSecond;
}
