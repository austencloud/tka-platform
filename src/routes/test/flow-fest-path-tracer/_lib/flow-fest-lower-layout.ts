import {
  FLOW_FEST_IMAGE,
  imagePointToWorld,
  simplifyTrace,
  traceLengthMeters,
  type ImagePoint,
  type WorldPoint,
} from "./flow-fest-trace";

export const FLOW_FEST_LOWER_LAYOUT_SCHEMA_VERSION = 1 as const;

export type FlowFestLowerLayoutFeatureId =
  | "lower-road-loop"
  | "tent-perimeter-band"
  | "car-camping-area"
  | "lower-loop-entrance";

export interface FlowFestLowerLayoutDraft {
  lowerRoadLoop: ImagePoint[];
  tentPerimeterBand: ImagePoint[];
  carCampingArea: ImagePoint[];
  lowerLoopEntrance: ImagePoint | null;
  tentBandWidthMeters: number;
  featureNotes: Record<FlowFestLowerLayoutFeatureId, string>;
  overallNote: string;
}

export interface FlowFestLowerLayoutSubmission {
  schemaVersion: typeof FLOW_FEST_LOWER_LAYOUT_SCHEMA_VERSION;
  sceneId: "flow-fest-sim-earth";
  capturedAt: string;
  coordinateFrame: "world metres; x east, z south";
  coordinateFingerprint: string;
  source: {
    path: typeof FLOW_FEST_IMAGE.sourcePath;
    sha256: typeof FLOW_FEST_IMAGE.sourceSha256;
    annotationAuthority: "austen-annotated";
  };
  layout: {
    lowerRoadLoop: WorldPoint[];
    tentCampingPerimeter: {
      centerline: WorldPoint[];
      widthMeters: number;
    };
    carCampingArea: WorldPoint[];
    lowerLoopEntrance: WorldPoint;
  };
  notes: {
    features: Record<FlowFestLowerLayoutFeatureId, string>;
    overall: string;
  };
}

export type FlowFestLowerLayoutValidation =
  | { valid: true; value: FlowFestLowerLayoutSubmission }
  | { valid: false; error: string };

export const FLOW_FEST_LOWER_LAYOUT_FEATURES: ReadonlyArray<{
  id: FlowFestLowerLayoutFeatureId;
  label: string;
  instruction: string;
  geometry: "closed-line" | "band" | "polygon" | "point";
}> = [
  {
    id: "lower-road-loop",
    label: "Vehicle road loop",
    instruction: "Trace one complete lap of the actual lower campground road.",
    geometry: "closed-line",
  },
  {
    id: "tent-perimeter-band",
    label: "Tent perimeter",
    instruction:
      "Trace the tree-line band where ordinary tent camping belongs.",
    geometry: "band",
  },
  {
    id: "car-camping-area",
    label: "Car-camping interior",
    instruction:
      "Outline the interior field reserved for car-and-tent camping setups.",
    geometry: "polygon",
  },
  {
    id: "lower-loop-entrance",
    label: "Loop entrance",
    instruction: "Place the exact point where vehicles enter the lower loop.",
    geometry: "point",
  },
] as const;

const FEATURE_IDS = FLOW_FEST_LOWER_LAYOUT_FEATURES.map(
  (feature) => feature.id
);

export function emptyFlowFestLowerLayoutDraft(): FlowFestLowerLayoutDraft {
  return {
    lowerRoadLoop: [],
    tentPerimeterBand: [],
    carCampingArea: [],
    lowerLoopEntrance: null,
    tentBandWidthMeters: 10,
    featureNotes: {
      "lower-road-loop": "",
      "tent-perimeter-band": "",
      "car-camping-area": "",
      "lower-loop-entrance": "",
    },
    overallNote: "",
  };
}

export function cloneFlowFestLowerLayoutDraft(
  draft: FlowFestLowerLayoutDraft
): FlowFestLowerLayoutDraft {
  return {
    lowerRoadLoop: draft.lowerRoadLoop.map(copyImagePoint),
    tentPerimeterBand: draft.tentPerimeterBand.map(copyImagePoint),
    carCampingArea: draft.carCampingArea.map(copyImagePoint),
    lowerLoopEntrance: draft.lowerLoopEntrance
      ? copyImagePoint(draft.lowerLoopEntrance)
      : null,
    tentBandWidthMeters: draft.tentBandWidthMeters,
    featureNotes: { ...draft.featureNotes },
    overallNote: draft.overallNote,
  };
}

export function getFlowFestLowerLayoutFeaturePoints(
  draft: FlowFestLowerLayoutDraft,
  featureId: FlowFestLowerLayoutFeatureId
): ImagePoint[] {
  switch (featureId) {
    case "lower-road-loop":
      return draft.lowerRoadLoop;
    case "tent-perimeter-band":
      return draft.tentPerimeterBand;
    case "car-camping-area":
      return draft.carCampingArea;
    case "lower-loop-entrance":
      return draft.lowerLoopEntrance ? [draft.lowerLoopEntrance] : [];
  }
}

export function replaceFlowFestLowerLayoutFeature(
  draft: FlowFestLowerLayoutDraft,
  featureId: FlowFestLowerLayoutFeatureId,
  points: readonly ImagePoint[]
): FlowFestLowerLayoutDraft {
  const next = cloneFlowFestLowerLayoutDraft(draft);
  const copied = points.map(copyImagePoint);
  switch (featureId) {
    case "lower-road-loop":
      next.lowerRoadLoop = copied;
      break;
    case "tent-perimeter-band":
      next.tentPerimeterBand = copied;
      break;
    case "car-camping-area":
      next.carCampingArea = copied;
      break;
    case "lower-loop-entrance":
      next.lowerLoopEntrance = copied[0] ?? null;
      break;
  }
  return next;
}

export function flowFestLowerLayoutReadiness(
  draft: FlowFestLowerLayoutDraft
): Record<FlowFestLowerLayoutFeatureId, boolean> {
  return {
    "lower-road-loop":
      draft.lowerRoadLoop.length >= 3 &&
      traceLengthMeters(draft.lowerRoadLoop) >= 20,
    "tent-perimeter-band":
      draft.tentPerimeterBand.length >= 2 &&
      traceLengthMeters(draft.tentPerimeterBand) >= 5,
    "car-camping-area":
      draft.carCampingArea.length >= 3 &&
      polygonAreaMeters(draft.carCampingArea) >= 25,
    "lower-loop-entrance": draft.lowerLoopEntrance !== null,
  };
}

export function parseStoredFlowFestLowerLayoutDraft(
  serialized: string
): FlowFestLowerLayoutDraft | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<FlowFestLowerLayoutDraft>;
    if (
      !isImagePath(parsed.lowerRoadLoop) ||
      !isImagePath(parsed.tentPerimeterBand) ||
      !isImagePath(parsed.carCampingArea) ||
      !isOptionalImagePoint(parsed.lowerLoopEntrance) ||
      typeof parsed.tentBandWidthMeters !== "number" ||
      !Number.isFinite(parsed.tentBandWidthMeters) ||
      parsed.tentBandWidthMeters < 2 ||
      parsed.tentBandWidthMeters > 30 ||
      !isFeatureNotes(parsed.featureNotes) ||
      typeof parsed.overallNote !== "string" ||
      parsed.overallNote.length > 1_000
    ) {
      return null;
    }
    return cloneFlowFestLowerLayoutDraft(parsed as FlowFestLowerLayoutDraft);
  } catch {
    return null;
  }
}

export function createFlowFestLowerLayoutSubmission(
  draft: FlowFestLowerLayoutDraft,
  coordinateFingerprint: string,
  capturedAt = new Date().toISOString()
): FlowFestLowerLayoutSubmission {
  const lowerRoadLoop = closeImagePath(
    simplifyTrace(draft.lowerRoadLoop, 1.1)
  ).map(imagePointToWorld);
  const carCampingArea = closeImagePath(
    simplifyTrace(draft.carCampingArea, 1.1)
  ).map(imagePointToWorld);
  return {
    schemaVersion: FLOW_FEST_LOWER_LAYOUT_SCHEMA_VERSION,
    sceneId: "flow-fest-sim-earth",
    capturedAt,
    coordinateFrame: "world metres; x east, z south",
    coordinateFingerprint,
    source: {
      path: FLOW_FEST_IMAGE.sourcePath,
      sha256: FLOW_FEST_IMAGE.sourceSha256,
      annotationAuthority: "austen-annotated",
    },
    layout: {
      lowerRoadLoop,
      tentCampingPerimeter: {
        centerline: simplifyTrace(draft.tentPerimeterBand, 1.1).map(
          imagePointToWorld
        ),
        widthMeters: draft.tentBandWidthMeters,
      },
      carCampingArea,
      lowerLoopEntrance: draft.lowerLoopEntrance
        ? imagePointToWorld(draft.lowerLoopEntrance)
        : { x: Number.NaN, z: Number.NaN },
    },
    notes: {
      features: Object.fromEntries(
        FEATURE_IDS.map((featureId) => [
          featureId,
          draft.featureNotes[featureId].trim(),
        ])
      ) as Record<FlowFestLowerLayoutFeatureId, string>,
      overall: draft.overallNote.trim(),
    },
  };
}

export function validateFlowFestLowerLayoutSubmission(
  value: unknown,
  expectedFingerprint: string
): FlowFestLowerLayoutValidation {
  if (!value || typeof value !== "object") {
    return {
      valid: false,
      error: "Expected a lower-campground layout object.",
    };
  }
  const submission = value as Partial<FlowFestLowerLayoutSubmission>;
  if (
    submission.schemaVersion !== FLOW_FEST_LOWER_LAYOUT_SCHEMA_VERSION ||
    submission.sceneId !== "flow-fest-sim-earth" ||
    submission.coordinateFrame !== "world metres; x east, z south"
  ) {
    return {
      valid: false,
      error: "Lower-campground metadata is not recognized.",
    };
  }
  if (submission.coordinateFingerprint !== expectedFingerprint) {
    return {
      valid: false,
      error:
        "The registered camp coordinates changed after this layout was started.",
    };
  }
  if (
    submission.source?.path !== FLOW_FEST_IMAGE.sourcePath ||
    submission.source.sha256 !== FLOW_FEST_IMAGE.sourceSha256 ||
    submission.source.annotationAuthority !== "austen-annotated"
  ) {
    return {
      valid: false,
      error: "The layout is not registered to the pinned NAIP source.",
    };
  }
  if (
    typeof submission.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(submission.capturedAt))
  ) {
    return { valid: false, error: "The layout capture time is invalid." };
  }
  if (!submission.layout) {
    return { valid: false, error: "The layout has no campground geometry." };
  }
  const roadError = validateClosedWorldPath(
    submission.layout.lowerRoadLoop,
    "Draw the complete lower campground vehicle loop.",
    20
  );
  if (roadError) return { valid: false, error: roadError };
  const tentError = validateOpenWorldPath(
    submission.layout.tentCampingPerimeter?.centerline,
    "Trace the tent perimeter beside the tree line.",
    5
  );
  if (tentError) return { valid: false, error: tentError };
  const width = submission.layout.tentCampingPerimeter?.widthMeters;
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width < 2 ||
    width > 30
  ) {
    return {
      valid: false,
      error: "Tent perimeter width must be between 2 and 30 metres.",
    };
  }
  const carError = validateClosedWorldPath(
    submission.layout.carCampingArea,
    "Outline the car-camping interior.",
    15
  );
  if (carError) return { valid: false, error: carError };
  if (polygonAreaWorld(submission.layout.carCampingArea) < 25) {
    return {
      valid: false,
      error: "The car-camping interior is too small to be a usable area.",
    };
  }
  if (!pointInsideTerrain(submission.layout.lowerLoopEntrance)) {
    return { valid: false, error: "Place the lower loop entrance." };
  }
  if (!submission.notes || !isFeatureNotes(submission.notes.features)) {
    return { valid: false, error: "The feature-note record is invalid." };
  }
  if (
    typeof submission.notes.overall !== "string" ||
    submission.notes.overall.length > 1_000
  ) {
    return { valid: false, error: "The overall note is too long." };
  }
  return { valid: true, value: submission as FlowFestLowerLayoutSubmission };
}

function copyImagePoint(point: ImagePoint): ImagePoint {
  return { x: point.x, y: point.y };
}

function closeImagePath(points: readonly ImagePoint[]): ImagePoint[] {
  if (points.length === 0) return [];
  const closed = points.map(copyImagePoint);
  const first = closed[0]!;
  const last = closed.at(-1)!;
  if (Math.hypot(first.x - last.x, first.y - last.y) <= 12) {
    closed[closed.length - 1] = copyImagePoint(first);
  } else {
    closed.push(copyImagePoint(first));
  }
  return closed;
}

function isImagePoint(value: unknown): value is ImagePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<ImagePoint>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    point.x >= 0 &&
    point.x <= FLOW_FEST_IMAGE.width &&
    typeof point.y === "number" &&
    Number.isFinite(point.y) &&
    point.y >= 0 &&
    point.y <= FLOW_FEST_IMAGE.height
  );
}

function isImagePath(value: unknown): value is ImagePoint[] {
  return Array.isArray(value) && value.every(isImagePoint);
}

function isOptionalImagePoint(value: unknown): value is ImagePoint | null {
  return value === null || isImagePoint(value);
}

function isFeatureNotes(
  value: unknown
): value is Record<FlowFestLowerLayoutFeatureId, string> {
  if (!value || typeof value !== "object") return false;
  const notes = value as Record<string, unknown>;
  return FEATURE_IDS.every(
    (featureId) =>
      typeof notes[featureId] === "string" && notes[featureId].length <= 500
  );
}

function pointInsideTerrain(value: unknown): value is WorldPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<WorldPoint>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    point.x >= FLOW_FEST_IMAGE.worldMinX &&
    point.x <= -FLOW_FEST_IMAGE.worldMinX &&
    typeof point.z === "number" &&
    Number.isFinite(point.z) &&
    point.z >= FLOW_FEST_IMAGE.worldMinZ &&
    point.z <= -FLOW_FEST_IMAGE.worldMinZ
  );
}

function validateOpenWorldPath(
  value: unknown,
  missingMessage: string,
  minimumLengthMeters: number
): string | null {
  if (!Array.isArray(value) || value.length < 2) return missingMessage;
  if (value.length > 2_000) return "The annotation has too many points.";
  if (!value.every(pointInsideTerrain))
    return "The annotation leaves the registered terrain footprint.";
  if (worldPathLength(value) < minimumLengthMeters) return missingMessage;
  return null;
}

function validateClosedWorldPath(
  value: unknown,
  missingMessage: string,
  minimumLengthMeters: number
): string | null {
  const openError = validateOpenWorldPath(
    value,
    missingMessage,
    minimumLengthMeters
  );
  if (openError) return openError;
  const points = value as WorldPoint[];
  if (points.length < 4 || worldDistance(points[0]!, points.at(-1)!) > 0.15) {
    return `${missingMessage} The saved geometry must close back on itself.`;
  }
  return null;
}

function worldDistance(left: WorldPoint, right: WorldPoint): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function worldPathLength(points: readonly WorldPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += worldDistance(points[index - 1]!, points[index]!);
  }
  return length;
}

function polygonAreaMeters(points: readonly ImagePoint[]): number {
  return polygonAreaWorld(points.map(imagePointToWorld));
}

function polygonAreaWorld(points: readonly WorldPoint[]): number {
  if (points.length < 3) return 0;
  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubledArea += current.x * next.z - next.x * current.z;
  }
  return Math.abs(doubledArea) / 2;
}
