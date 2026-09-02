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

export const FLOW_FEST_SITE_MARKER_SCHEMA_VERSION = 1 as const;

/**
 * How a marker's second point is read. Every shape is placed the same way —
 * click the anchor, drag the handle — and only the meaning of the handle
 * changes, so there is one interaction to learn rather than four.
 */
export type FlowFestMarkerShape = "point" | "facing" | "circle" | "run";

export interface FlowFestMarkerPreset {
  id: string;
  label: string;
  shape: FlowFestMarkerShape;
  instruction: string;
  /** Grouping for the picker, so the fire circle's parts stay together. */
  group: "fire-circle" | "services" | "middle-earth" | "roads";
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
    shape: "circle",
    instruction: "Click the middle of the field, drag out to its edge.",
    group: "fire-circle",
  },
  {
    id: "fire-circle",
    label: "Fire circle (LED rope)",
    shape: "circle",
    instruction: "Click the centre, drag out to where the LED rope lies.",
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
    shape: "circle",
    instruction:
      "Click the middle, drag to a corner. Built at roughly a tenth of size.",
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
    id: "road-veer",
    label: "Road veer",
    shape: "run",
    instruction: "Click where the road leaves the straight, drag the way it goes.",
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
    id: "custom",
    label: "Something else",
    shape: "facing",
    instruction: "Name it yourself, place it, then drag the way it faces.",
    group: "services",
  },
] as const;

export const FLOW_FEST_MARKER_GROUPS: ReadonlyArray<{
  id: FlowFestMarkerPreset["group"];
  label: string;
}> = [
  { id: "fire-circle", label: "Fire circle" },
  { id: "services", label: "Services" },
  { id: "middle-earth", label: "Middle Earth" },
  { id: "roads", label: "Roads" },
] as const;

export interface FlowFestSiteMarker {
  id: string;
  presetId: string;
  /** Free text. Defaults to the preset label; editable so repeats can differ. */
  label: string;
  shape: FlowFestMarkerShape;
  anchor: ImagePoint;
  /** Null until the handle is dragged. Meaningless for `point`. */
  handle: ImagePoint | null;
  note: string;
}

export interface FlowFestSiteMarkerDraft {
  markers: FlowFestSiteMarker[];
  overallNote: string;
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
}

export type FlowFestSiteMarkerValidation =
  | { valid: true; value: FlowFestSiteMarkerSubmission }
  | { valid: false; error: string };

const MAX_MARKERS = 400;
const MAX_LABEL = 80;
const MAX_NOTE = 500;
const MAX_OVERALL_NOTE = 2_000;

export function getMarkerPreset(presetId: string): FlowFestMarkerPreset {
  return (
    FLOW_FEST_MARKER_PRESETS.find((preset) => preset.id === presetId) ??
    FLOW_FEST_MARKER_PRESETS.at(-1)!
  );
}

export function emptyFlowFestSiteMarkerDraft(): FlowFestSiteMarkerDraft {
  return { markers: [], overallNote: "" };
}

export function cloneFlowFestSiteMarkerDraft(
  draft: FlowFestSiteMarkerDraft
): FlowFestSiteMarkerDraft {
  return {
    markers: draft.markers.map((marker) => ({
      ...marker,
      anchor: { ...marker.anchor },
      handle: marker.handle ? { ...marker.handle } : null,
    })),
    overallNote: draft.overallNote,
  };
}

export function createSiteMarker(
  presetId: string,
  anchor: ImagePoint,
  existing: readonly FlowFestSiteMarker[]
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
    note: "",
  };
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
  const meters = markerHandleMeters(marker);
  return meters !== null && meters > 0.5;
}

export function toMarkerRecord(
  marker: FlowFestSiteMarker
): FlowFestSiteMarkerRecord {
  const meters = markerHandleMeters(marker);
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
  };
}

export function parseStoredFlowFestSiteMarkerDraft(
  serialized: string
): FlowFestSiteMarkerDraft | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<FlowFestSiteMarkerDraft>;
    if (
      !Array.isArray(parsed.markers) ||
      parsed.markers.length > MAX_MARKERS ||
      typeof parsed.overallNote !== "string" ||
      parsed.overallNote.length > MAX_OVERALL_NOTE ||
      !parsed.markers.every(isStoredMarker)
    ) {
      return null;
    }
    return cloneFlowFestSiteMarkerDraft(parsed as FlowFestSiteMarkerDraft);
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
  return { valid: true, value: submission as FlowFestSiteMarkerSubmission };
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

function isStoredMarker(value: unknown): value is FlowFestSiteMarker {
  if (!value || typeof value !== "object") return false;
  const marker = value as Partial<FlowFestSiteMarker>;
  return (
    typeof marker.id === "string" &&
    typeof marker.presetId === "string" &&
    typeof marker.label === "string" &&
    marker.label.length <= MAX_LABEL &&
    (marker.shape === "point" ||
      marker.shape === "facing" ||
      marker.shape === "circle" ||
      marker.shape === "run") &&
    isStoredImagePoint(marker.anchor) &&
    (marker.handle === null || isStoredImagePoint(marker.handle)) &&
    typeof marker.note === "string" &&
    marker.note.length <= MAX_NOTE
  );
}
