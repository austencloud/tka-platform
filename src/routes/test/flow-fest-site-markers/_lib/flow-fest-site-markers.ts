/**
 * Oriented site markers on the registered Flow Fest orthophoto.
 *
 * The path tracer next door owns three fixed annotation jobs, each with a
 * named-field schema and no notion of which way a thing faces. This owns a
 * different shape of answer: an open, repeatable list of placed items that
 * each carry a direction, a radius, or a run — the vocabulary Austen used when
 * he described the fire circle field (archway, dip station, safeties, exits,
 * stage, first aid, volunteer HQ) and asked to be able to "create things".
 *
 * Image/world registration is not re-derived here. It is imported from
 * `flow-fest-trace`, so every marker lands in the same frame as the traces and
 * the plan corrections, pinned to the same NAIP source hash.
 */

import {
  FLOW_FEST_IMAGE,
  imagePointToWorld,
  type ImagePoint,
  type WorldPoint,
} from "../../flow-fest-path-tracer/_lib/flow-fest-trace";

export const FLOW_FEST_SITE_MARKER_SCHEMA_VERSION = 2 as const;

/**
 * Two families of shape, because a clearing is not a circle.
 *
 * `point`, `facing`, `circle` and `run` are anchor-plus-handle: press once,
 * drag once, and only the meaning of the handle changes. `area` and `path` are
 * traced: a run of vertices the author clicks or draws, closed for an area and
 * open for a path. Forcing a traced thing into a radius was the original sin
 * here — a grass clearing that is really a lobed field became a disc, which is
 * not what is on the ground. The fire circle is the same story: the LED rope
 * reads as a circle from inside it and is nothing of the kind on the photo, so
 * it is traced. `circle` survives for the fire pit, which really is radial.
 */
export type FlowFestMarkerShape =
  | "point"
  | "facing"
  | "circle"
  | "run"
  | "area"
  | "path";

/** Traced shapes collect vertices; handle shapes do not. */
export function isTracedShape(shape: FlowFestMarkerShape): boolean {
  return shape === "area" || shape === "path";
}

export interface FlowFestMarkerPreset {
  id: string;
  label: string;
  shape: FlowFestMarkerShape;
  instruction: string;
  /** Grouping for the picker, so the fire circle's parts stay together. */
  group: "fire-circle" | "services" | "middle-earth" | "roads" | "camping";
}

/**
 * Seeded from Austen's own account of the site, 2026-09-02. Anything he names
 * that is not here goes in as `custom` with a typed label, which is the point
 * of "then I can create things such as...".
 */
export const FLOW_FEST_MARKER_PRESETS: readonly FlowFestMarkerPreset[] = [
  {
    id: "grass-field",
    label: "Grass clearing",
    shape: "area",
    instruction:
      "Trace the edge of the clearing. Click corners or drag freehand, then press Enter to close it.",
    group: "fire-circle",
  },
  {
    id: "fire-circle",
    label: "Fire circle (LED rope)",
    shape: "area",
    instruction:
      "Trace the rope where it actually lies. Click corners or drag freehand, then Enter to close it.",
    group: "fire-circle",
  },
  {
    id: "fire-pit",
    label: "Fire pit",
    shape: "circle",
    instruction: "Click the centre of the fire, then drag out to its edge.",
    group: "fire-circle",
  },
  {
    id: "archway",
    label: "Entrance archway",
    shape: "facing",
    instruction: "Place the arch, then drag the way you walk through it.",
    group: "fire-circle",
  },
  {
    id: "dip-station",
    label: "Dip station",
    shape: "facing",
    instruction: "Place the dip station, then drag toward the queue feeding it.",
    group: "fire-circle",
  },
  {
    id: "queue-line",
    label: "Queue",
    shape: "run",
    instruction: "Click where the line starts, drag to where it ends.",
    group: "fire-circle",
  },
  {
    id: "circle-exit",
    label: "Exit point",
    shape: "facing",
    instruction: "Place it on the perimeter, then drag the way people leave.",
    group: "fire-circle",
  },
  {
    id: "safety-post",
    label: "Safety",
    shape: "facing",
    instruction:
      "Place it just inside the rope, then drag the way they are facing.",
    group: "fire-circle",
  },
  {
    id: "prop-canopy",
    label: "Prop canopy",
    shape: "facing",
    instruction: "The edge canopy where people store props. Drag its opening.",
    group: "fire-circle",
  },
  {
    id: "stage",
    label: "Showcase stage",
    shape: "facing",
    instruction: "Place the stage, then drag the way it faces the crowd.",
    group: "services",
  },
  {
    id: "first-aid",
    label: "First aid tent",
    shape: "facing",
    instruction: "Place the tent, then drag toward its opening.",
    group: "services",
  },
  {
    id: "volunteer-hq",
    label: "Volunteer HQ",
    shape: "facing",
    instruction: "Place it, then drag toward its opening.",
    group: "services",
  },
  {
    id: "fuel-station",
    label: "Fuel station",
    shape: "point",
    instruction: "Place where the fuel is kept.",
    group: "services",
  },
  {
    id: "big-canopy",
    label: "Middle Earth canopy",
    shape: "area",
    instruction:
      "Trace its footprint corner to corner. It is a square circus tent, not a pop-up.",
    group: "middle-earth",
  },
  {
    id: "causeway-sculpture",
    label: "Causeway LED sculpture (to delete)",
    shape: "point",
    instruction: "Mark it so it can be found and removed.",
    group: "middle-earth",
  },
  {
    id: "performer-area",
    label: "Performer area",
    shape: "area",
    instruction: "Trace where performers actually work, inside the canopy.",
    group: "middle-earth",
  },
  {
    id: "road",
    label: "Road",
    shape: "path",
    instruction:
      "Trace the road as it actually runs. Drag freehand along it, Enter to finish.",
    group: "roads",
  },
  {
    id: "road-veer",
    label: "Road veer uphill",
    shape: "path",
    instruction:
      "Trace where the road leaves the straight and climbs. Note the grade in the note field.",
    group: "roads",
  },
  {
    id: "parking-lot",
    label: "Parking lot",
    shape: "area",
    instruction: "Trace the edge of the parking area.",
    group: "roads",
  },
  {
    id: "cabin",
    label: "Cabin",
    shape: "facing",
    instruction: "Place the cabin, then drag the way its front faces.",
    group: "roads",
  },
  {
    id: "building",
    label: "Building",
    shape: "facing",
    instruction: "Place it, drag the way it faces, and name what it is.",
    group: "roads",
  },
  {
    id: "houses",
    label: "Houses up the hill",
    shape: "point",
    instruction: "Place where the houses sit.",
    group: "roads",
  },
  {
    id: "camp-area",
    label: "Camping area",
    shape: "area",
    instruction: "Trace where people actually pitch tents.",
    group: "camping",
  },
  {
    id: "car-camping",
    label: "Car camping",
    shape: "area",
    instruction: "Trace where cars park alongside camps.",
    group: "camping",
  },
  {
    id: "vendor-village",
    label: "Vendor Village",
    shape: "area",
    instruction: "Trace the vendor area, then name individual stalls separately.",
    group: "camping",
  },
  {
    id: "custom",
    label: "Something else",
    shape: "facing",
    instruction: "Name it yourself, place it, then drag the way it faces.",
    group: "services",
  },
  {
    id: "custom-area",
    label: "Some other area",
    shape: "area",
    instruction: "Trace any area the presets do not cover, then name it.",
    group: "services",
  },
  {
    id: "custom-path",
    label: "Some other path",
    shape: "path",
    instruction: "Trace any line the presets do not cover, then name it.",
    group: "services",
  },
] as const;

export const FLOW_FEST_MARKER_GROUPS: ReadonlyArray<{
  id: FlowFestMarkerPreset["group"];
  label: string;
}> = [
  { id: "fire-circle", label: "Fire circle" },
  { id: "middle-earth", label: "Middle Earth" },
  { id: "roads", label: "Roads and buildings" },
  { id: "camping", label: "Camping" },
  { id: "services", label: "Services" },
] as const;

export interface FlowFestSiteMarker {
  id: string;
  presetId: string;
  /** Free text. Defaults to the preset label; editable so repeats can differ. */
  label: string;
  shape: FlowFestMarkerShape;
  /** First vertex for a traced shape; the placement for every other shape. */
  anchor: ImagePoint;
  /** Null until the handle is dragged. Meaningless for `point` and traced shapes. */
  handle: ImagePoint | null;
  /** Vertices after the anchor. Only traced shapes fill this. */
  points: ImagePoint[];
  /** True once an area is closed or a path is finished. */
  closed: boolean;
  note: string;
  /**
   * Milliseconds into the narration when this was placed, or null when nothing
   * was recording. This is what lets spoken words be matched to the stroke they
   * describe rather than to the whole session.
   */
  atMs: number | null;
}

/** One run of speech, stamped against the same clock the markers use. */
export interface FlowFestNarrationSegment {
  atMs: number;
  text: string;
}

export interface FlowFestNarration {
  startedAt: string;
  segments: FlowFestNarrationSegment[];
}

export interface FlowFestSiteMarkerDraft {
  markers: FlowFestSiteMarker[];
  overallNote: string;
  narration: FlowFestNarration | null;
}

/** The resolved, world-frame form an agent reads. */
export interface FlowFestSiteMarkerRecord {
  id: string;
  presetId: string;
  label: string;
  shape: FlowFestMarkerShape;
  position: WorldPoint;
  /** Compass-style degrees, 0 = north (−z), 90 = east (+x). Null when unset. */
  facingDegrees: number | null;
  /** Present for `circle` markers only. */
  radiusMeters: number | null;
  /** Present for `run` markers only. */
  endPosition: WorldPoint | null;
  runLengthMeters: number | null;
  /** Every vertex, anchor first, for `area` and `path`. Null otherwise. */
  vertices: WorldPoint[] | null;
  /** Shoelace area of a closed outline. Present for `area` only. */
  areaSquareMeters: number | null;
  /** Summed segment length. Present for `path` only. */
  pathLengthMeters: number | null;
  atMs: number | null;
  note: string;
}

export interface FlowFestSiteMarkerSubmission {
  schemaVersion: typeof FLOW_FEST_SITE_MARKER_SCHEMA_VERSION;
  sceneId: "flow-fest-sim-earth";
  capturedAt: string;
  coordinateFrame: "world metres; x east, z south";
  source: {
    path: typeof FLOW_FEST_IMAGE.sourcePath;
    sha256: typeof FLOW_FEST_IMAGE.sourceSha256;
    pixelSizeMeters: typeof FLOW_FEST_IMAGE.pixelSizeMeters;
    annotationAuthority: "austen-annotated";
  };
  markers: FlowFestSiteMarkerRecord[];
  notes: { overall: string };
  /**
   * What was said while this was drawn, on the same millisecond clock as the
   * markers' `atMs`. Null when the session was silent.
   */
  narration: FlowFestNarration | null;
}

export type FlowFestSiteMarkerValidation =
  | { valid: true; value: FlowFestSiteMarkerSubmission }
  | { valid: false; error: string };

const MAX_MARKERS = 400;
const MAX_LABEL = 80;
const MAX_NOTE = 500;
const MAX_OVERALL_NOTE = 2_000;
const MAX_VERTICES = 400;
const MAX_NARRATION_SEGMENTS = 4_000;
const MAX_SEGMENT_TEXT = 1_000;

export function getMarkerPreset(presetId: string): FlowFestMarkerPreset {
  return (
    FLOW_FEST_MARKER_PRESETS.find((preset) => preset.id === presetId) ??
    FLOW_FEST_MARKER_PRESETS.at(-1)!
  );
}

export function emptyFlowFestSiteMarkerDraft(): FlowFestSiteMarkerDraft {
  return { markers: [], overallNote: "", narration: null };
}

export function cloneFlowFestSiteMarkerDraft(
  draft: FlowFestSiteMarkerDraft
): FlowFestSiteMarkerDraft {
  return {
    markers: draft.markers.map((marker) => ({
      ...marker,
      anchor: { ...marker.anchor },
      handle: marker.handle ? { ...marker.handle } : null,
      points: marker.points.map((point) => ({ ...point })),
    })),
    overallNote: draft.overallNote,
    narration: draft.narration
      ? {
          startedAt: draft.narration.startedAt,
          segments: draft.narration.segments.map((segment) => ({ ...segment })),
        }
      : null,
  };
}

export function createSiteMarker(
  presetId: string,
  anchor: ImagePoint,
  existing: readonly FlowFestSiteMarker[],
  atMs: number | null = null
): FlowFestSiteMarker {
  const preset = getMarkerPreset(presetId);
  const sameKind = existing.filter(
    (marker) => marker.presetId === preset.id
  ).length;
  return {
    id: `${preset.id}-${sameKind + 1}-${Math.random().toString(36).slice(2, 8)}`,
    presetId: preset.id,
    label: sameKind === 0 ? preset.label : `${preset.label} ${sameKind + 1}`,
    shape: preset.shape,
    anchor: { ...anchor },
    handle: null,
    points: [],
    closed: false,
    note: "",
    atMs,
  };
}

/** Anchor first, then every traced vertex. The only ordering callers may assume. */
export function markerVertices(marker: FlowFestSiteMarker): ImagePoint[] {
  return isTracedShape(marker.shape)
    ? [marker.anchor, ...marker.points]
    : [marker.anchor];
}

/**
 * Shoelace area in square metres. The image is a north-up orthophoto at a fixed
 * ground sample distance, so pixel area scales by the square of that distance
 * with no projection correction of its own.
 */
export function markerAreaSquareMeters(
  marker: FlowFestSiteMarker
): number | null {
  const vertices = markerVertices(marker);
  if (marker.shape !== "area" || vertices.length < 3) return null;
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  const pixels = Math.abs(twiceArea) / 2;
  return Number(
    (pixels * FLOW_FEST_IMAGE.pixelSizeMeters ** 2).toFixed(1)
  );
}

export function markerPathLengthMeters(
  marker: FlowFestSiteMarker
): number | null {
  const vertices = markerVertices(marker);
  if (!isTracedShape(marker.shape) || vertices.length < 2) return null;
  let pixels = 0;
  for (let index = 1; index < vertices.length; index += 1) {
    pixels += Math.hypot(
      vertices[index]!.x - vertices[index - 1]!.x,
      vertices[index]!.y - vertices[index - 1]!.y
    );
  }
  if (marker.shape === "area" && marker.closed && vertices.length > 2) {
    pixels += Math.hypot(
      vertices[0]!.x - vertices.at(-1)!.x,
      vertices[0]!.y - vertices.at(-1)!.y
    );
  }
  return Number((pixels * FLOW_FEST_IMAGE.pixelSizeMeters).toFixed(1));
}

/**
 * Compass bearing from anchor to handle. The image's +y runs south, so north
 * is −y; this returns 0 at north and increases clockwise through east, which
 * is the direction vocabulary a person describing a site actually uses.
 */
export function markerFacingDegrees(
  marker: FlowFestSiteMarker
): number | null {
  if (!marker.handle) return null;
  const dx = marker.handle.x - marker.anchor.x;
  const dy = marker.handle.y - marker.anchor.y;
  if (Math.hypot(dx, dy) < 1) return null;
  return Number((((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360).toFixed(1));
}

export function markerHandleMeters(marker: FlowFestSiteMarker): number | null {
  if (!marker.handle) return null;
  const dx = marker.handle.x - marker.anchor.x;
  const dy = marker.handle.y - marker.anchor.y;
  return Number(
    (Math.hypot(dx, dy) * FLOW_FEST_IMAGE.pixelSizeMeters).toFixed(1)
  );
}

export function markerReadiness(marker: FlowFestSiteMarker): boolean {
  if (marker.shape === "point") return true;
  if (marker.shape === "area") return markerVertices(marker).length >= 3;
  if (marker.shape === "path") return markerVertices(marker).length >= 2;
  const meters = markerHandleMeters(marker);
  return meters !== null && meters > 0.5;
}

export function toMarkerRecord(
  marker: FlowFestSiteMarker
): FlowFestSiteMarkerRecord {
  const meters = markerHandleMeters(marker);
  const traced = isTracedShape(marker.shape);
  return {
    id: marker.id,
    presetId: marker.presetId,
    label: marker.label.trim() || getMarkerPreset(marker.presetId).label,
    shape: marker.shape,
    position: imagePointToWorld(marker.anchor),
    facingDegrees:
      marker.shape === "facing" || marker.shape === "run"
        ? markerFacingDegrees(marker)
        : null,
    radiusMeters: marker.shape === "circle" ? meters : null,
    endPosition:
      marker.shape === "run" && marker.handle
        ? imagePointToWorld(marker.handle)
        : null,
    runLengthMeters: marker.shape === "run" ? meters : null,
    vertices: traced ? markerVertices(marker).map(imagePointToWorld) : null,
    areaSquareMeters: markerAreaSquareMeters(marker),
    pathLengthMeters:
      marker.shape === "path" ? markerPathLengthMeters(marker) : null,
    atMs: marker.atMs,
    note: marker.note.trim(),
  };
}

export function createFlowFestSiteMarkerSubmission(
  draft: FlowFestSiteMarkerDraft,
  capturedAt = new Date().toISOString()
): FlowFestSiteMarkerSubmission {
  return {
    schemaVersion: FLOW_FEST_SITE_MARKER_SCHEMA_VERSION,
    sceneId: "flow-fest-sim-earth",
    capturedAt,
    coordinateFrame: "world metres; x east, z south",
    source: {
      path: FLOW_FEST_IMAGE.sourcePath,
      sha256: FLOW_FEST_IMAGE.sourceSha256,
      pixelSizeMeters: FLOW_FEST_IMAGE.pixelSizeMeters,
      annotationAuthority: "austen-annotated",
    },
    markers: draft.markers.map(toMarkerRecord),
    notes: { overall: draft.overallNote.trim() },
    narration: draft.narration,
  };
}

/**
 * Restores a browser-local draft, including one written before traced shapes
 * and narration existed. A local draft is somebody's unsaved work, so the older
 * shape is upgraded in place rather than discarded.
 */
export function parseStoredFlowFestSiteMarkerDraft(
  serialized: string
): FlowFestSiteMarkerDraft | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<FlowFestSiteMarkerDraft>;
    if (
      !Array.isArray(parsed.markers) ||
      parsed.markers.length > MAX_MARKERS ||
      typeof parsed.overallNote !== "string" ||
      parsed.overallNote.length > MAX_OVERALL_NOTE
    ) {
      return null;
    }
    const markers = parsed.markers.map(upgradeStoredMarker);
    if (markers.some((marker) => marker === null)) return null;
    return cloneFlowFestSiteMarkerDraft({
      markers: markers as FlowFestSiteMarker[],
      overallNote: parsed.overallNote,
      narration: isNarration(parsed.narration) ? parsed.narration : null,
    });
  } catch {
    return null;
  }
}

export function validateFlowFestSiteMarkerSubmission(
  value: unknown
): FlowFestSiteMarkerValidation {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "Expected a site-marker object." };
  }
  const submission = value as Partial<FlowFestSiteMarkerSubmission>;
  if (
    submission.schemaVersion !== FLOW_FEST_SITE_MARKER_SCHEMA_VERSION ||
    submission.sceneId !== "flow-fest-sim-earth" ||
    submission.coordinateFrame !== "world metres; x east, z south"
  ) {
    return { valid: false, error: "Site-marker metadata is not recognized." };
  }
  if (
    submission.source?.path !== FLOW_FEST_IMAGE.sourcePath ||
    submission.source.sha256 !== FLOW_FEST_IMAGE.sourceSha256 ||
    submission.source.annotationAuthority !== "austen-annotated"
  ) {
    return {
      valid: false,
      error: "The markers are not registered to the pinned NAIP source.",
    };
  }
  if (
    typeof submission.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(submission.capturedAt))
  ) {
    return { valid: false, error: "The capture time is invalid." };
  }
  if (
    !Array.isArray(submission.markers) ||
    submission.markers.length === 0 ||
    submission.markers.length > MAX_MARKERS
  ) {
    return { valid: false, error: "Place at least one marker before saving." };
  }
  for (const record of submission.markers) {
    const error = validateMarkerRecord(record);
    if (error) return { valid: false, error };
  }
  if (
    typeof submission.notes?.overall !== "string" ||
    submission.notes.overall.length > MAX_OVERALL_NOTE
  ) {
    return { valid: false, error: "The overall note is too long." };
  }
  if (submission.narration !== null && !isNarration(submission.narration)) {
    return { valid: false, error: "The narration transcript is malformed." };
  }
  return { valid: true, value: submission as FlowFestSiteMarkerSubmission };
}

function isNarration(value: unknown): value is FlowFestNarration {
  if (!value || typeof value !== "object") return false;
  const narration = value as Partial<FlowFestNarration>;
  return (
    typeof narration.startedAt === "string" &&
    Number.isFinite(Date.parse(narration.startedAt)) &&
    Array.isArray(narration.segments) &&
    narration.segments.length <= MAX_NARRATION_SEGMENTS &&
    narration.segments.every(
      (segment) =>
        !!segment &&
        typeof segment === "object" &&
        typeof segment.atMs === "number" &&
        Number.isFinite(segment.atMs) &&
        segment.atMs >= 0 &&
        typeof segment.text === "string" &&
        segment.text.length <= MAX_SEGMENT_TEXT
    )
  );
}

function validateMarkerRecord(value: unknown): string | null {
  if (!value || typeof value !== "object") return "A marker is not an object.";
  const record = value as Partial<FlowFestSiteMarkerRecord>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    return "A marker is missing its id.";
  }
  if (typeof record.label !== "string" || record.label.length > MAX_LABEL) {
    return `Marker "${record.id}" has an unusable label.`;
  }
  if (!isWorldPointInsideTerrain(record.position)) {
    return `Marker "${record.label ?? record.id}" is outside the registered terrain.`;
  }
  if (
    record.facingDegrees !== null &&
    (typeof record.facingDegrees !== "number" ||
      !Number.isFinite(record.facingDegrees) ||
      record.facingDegrees < 0 ||
      record.facingDegrees >= 360)
  ) {
    return `Marker "${record.label ?? record.id}" has an invalid facing.`;
  }
  if (
    record.radiusMeters !== null &&
    (typeof record.radiusMeters !== "number" ||
      !Number.isFinite(record.radiusMeters) ||
      record.radiusMeters <= 0 ||
      record.radiusMeters > 1_024)
  ) {
    return `Marker "${record.label ?? record.id}" has an invalid radius.`;
  }
  if (
    record.endPosition !== null &&
    !isWorldPointInsideTerrain(record.endPosition)
  ) {
    return `Marker "${record.label ?? record.id}" runs outside the registered terrain.`;
  }
  if (record.vertices !== null) {
    if (
      !Array.isArray(record.vertices) ||
      record.vertices.length < 2 ||
      record.vertices.length > MAX_VERTICES
    ) {
      return `Marker "${record.label ?? record.id}" has an unusable outline.`;
    }
    if (!record.vertices.every(isWorldPointInsideTerrain)) {
      return `Marker "${record.label ?? record.id}" is traced outside the registered terrain.`;
    }
  }
  if (
    record.atMs !== null &&
    (typeof record.atMs !== "number" ||
      !Number.isFinite(record.atMs) ||
      record.atMs < 0)
  ) {
    return `Marker "${record.label ?? record.id}" has an invalid narration time.`;
  }
  if (typeof record.note !== "string" || record.note.length > MAX_NOTE) {
    return `Marker "${record.label ?? record.id}" has an over-long note.`;
  }
  return null;
}

function isWorldPointInsideTerrain(value: unknown): value is WorldPoint {
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

function isStoredImagePoint(value: unknown): value is ImagePoint {
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

const STORED_SHAPES: readonly FlowFestMarkerShape[] = [
  "point",
  "facing",
  "circle",
  "run",
  "area",
  "path",
];

function upgradeStoredMarker(value: unknown): FlowFestSiteMarker | null {
  if (!value || typeof value !== "object") return null;
  const marker = value as Partial<FlowFestSiteMarker>;
  if (
    typeof marker.id !== "string" ||
    typeof marker.presetId !== "string" ||
    typeof marker.label !== "string" ||
    marker.label.length > MAX_LABEL ||
    !STORED_SHAPES.includes(marker.shape as FlowFestMarkerShape) ||
    !isStoredImagePoint(marker.anchor) ||
    !(marker.handle === null || isStoredImagePoint(marker.handle)) ||
    typeof marker.note !== "string" ||
    marker.note.length > MAX_NOTE
  ) {
    return null;
  }
  const points = Array.isArray(marker.points) ? marker.points : [];
  if (points.length > MAX_VERTICES || !points.every(isStoredImagePoint)) {
    return null;
  }
  return {
    id: marker.id,
    presetId: marker.presetId,
    label: marker.label,
    shape: marker.shape as FlowFestMarkerShape,
    anchor: marker.anchor,
    handle: marker.handle ?? null,
    points,
    closed: marker.closed === true,
    note: marker.note,
    atMs: typeof marker.atMs === "number" && marker.atMs >= 0 ? marker.atMs : null,
  };
}
