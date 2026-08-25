/**
 * Curated camera presets.
 *
 * The previous framing derived every shot from a bounding box scaled by a
 * shot-size multiplier, with no bound on the result: a wide cast pushed the
 * camera arbitrarily far and a solo pulled it arbitrarily close, while
 * elevation stayed fixed regardless of distance. These presets place the
 * camera at explicit angles instead, fit distance to a target framing, and
 * clamp that distance to a range each preset declares.
 *
 * Spec: docs/superpowers/specs/active/2026-08-25-director-control-surface-design.md
 */

import type { DirectorCameraPreset } from "./film-director-schema";
import { DIRECTOR_FORMATIONS } from "./film-director-schema";

export type DirectorFormation = (typeof DIRECTOR_FORMATIONS)[number];

/**
 * What actually decides whether a shot works is the cast's shape relative to
 * the view axis, not the formation's name: a 4-person line and a 4-person
 * side-by-side present the camera with the same problem. Presets declare the
 * classes they are approved for, so approval is verified per class rather
 * than per formation.
 */
export type CastGeometryClass = "single" | "wide" | "deep" | "ringed" | "unknown";

export const CAST_GEOMETRY_CLASS: Record<DirectorFormation, CastGeometryClass> = {
  solo: "single",
  line: "wide",
  "side-by-side": "wide",
  "stage-lr": "wide",
  "v-shape": "wide",
  diagonal: "wide",
  "tunnel-stack": "deep",
  "back-to-back": "deep",
  "facing-each-other": "deep",
  circle: "ringed",
  "grid-2x2": "ringed",
  custom: "unknown",
};

export type PresetMotion =
  | { kind: "hold" }
  /**
   * Opens at the fitted distance and pushes in to this fraction of it. Stated
   * against the fitted distance rather than as a second fill fraction because
   * a small cast fits on its height, not its width — two fill fractions there
   * clamp to the same distance and the move disappears.
   */
  | { kind: "dolly"; closeDistanceMultiplier: number }
  /** Opens at `fromElevationDegrees` and settles at the preset's own elevation. */
  | { kind: "descend"; fromElevationDegrees: number }
  | { kind: "orbit"; degrees: number };

export interface DirectorCameraPresetDefinition {
  id: Exclude<DirectorCameraPreset, "custom">;
  label: string;
  summary: string;
  /** Degrees off the audience axis. 0 looks straight up the -Z side; positive swings toward +X. */
  azimuthDegrees: number;
  elevationDegrees: number;
  /** Aim height as a fraction of the cast's full floor-to-prop-tip extent. */
  targetHeightFraction: number;
  /** Cast width as a fraction of the frame's width once fitted. */
  fillFraction: number;
  /** Hard bound on the fitted distance, in meters. This is what makes absurd framing unreachable. */
  distanceRangeMeters: readonly [number, number];
  fovDeg: number;
  motion: PresetMotion;
  /** Cast shapes this preset has been looked at against and approved for. */
  approvedFor: readonly CastGeometryClass[];
}

/**
 * `front-lockoff` is approved for every class deliberately: it is the fallback
 * a film resolves to when it names a combination no preset covers, so it must
 * never itself be the unavailable one.
 */
export const DIRECTOR_CAMERA_PRESET_LIBRARY: readonly DirectorCameraPresetDefinition[] = [
  {
    id: "front-lockoff",
    label: "Front lockoff",
    summary: "Static, eye level, straight on.",
    azimuthDegrees: 0,
    elevationDegrees: 6,
    targetHeightFraction: 0.5,
    fillFraction: 0.86,
    distanceRangeMeters: [2.5, 20],
    fovDeg: 50,
    motion: { kind: "hold" },
    approvedFor: ["single", "wide", "deep", "ringed", "unknown"],
  },
  {
    id: "three-quarter",
    label: "Three-quarter",
    summary: "Static, off the audience axis so a flat row reads as depth.",
    azimuthDegrees: 35,
    elevationDegrees: 8,
    targetHeightFraction: 0.5,
    fillFraction: 0.8,
    distanceRangeMeters: [2.6, 20],
    fovDeg: 50,
    motion: { kind: "hold" },
    approvedFor: ["single", "wide", "unknown"],
  },
  {
    id: "hero-dolly-in",
    label: "Hero dolly in",
    summary: "Opens wide and closes to a medium on the subject.",
    azimuthDegrees: 0,
    elevationDegrees: 5,
    targetHeightFraction: 0.52,
    fillFraction: 0.78,
    distanceRangeMeters: [2.2, 18],
    fovDeg: 48,
    motion: { kind: "dolly", closeDistanceMultiplier: 0.68 },
    approvedFor: ["single", "wide", "deep", "unknown"],
  },
  {
    id: "high-reveal",
    label: "High reveal",
    summary: "Starts above the formation and settles toward eye level.",
    azimuthDegrees: 12,
    elevationDegrees: 22,
    targetHeightFraction: 0.5,
    fillFraction: 0.76,
    distanceRangeMeters: [3, 22],
    fovDeg: 52,
    motion: { kind: "descend", fromElevationDegrees: 40 },
    approvedFor: ["wide", "ringed", "deep"],
  },
  {
    id: "group-orbit",
    label: "Group orbit",
    summary: "A bounded arc around the cast at a fixed height.",
    azimuthDegrees: -55,
    elevationDegrees: 12,
    targetHeightFraction: 0.5,
    fillFraction: 0.78,
    distanceRangeMeters: [3, 22],
    fovDeg: 50,
    motion: { kind: "orbit", degrees: 110 },
    approvedFor: ["single", "wide", "deep", "ringed", "unknown"],
  },
];

const PRESETS_BY_ID = new Map(
  DIRECTOR_CAMERA_PRESET_LIBRARY.map((preset) => [preset.id, preset])
);

export const FALLBACK_PRESET_ID = "front-lockoff" as const;

export function getCameraPreset(
  id: DirectorCameraPreset
): DirectorCameraPresetDefinition | undefined {
  return PRESETS_BY_ID.get(id as DirectorCameraPresetDefinition["id"]);
}

export function isPresetApprovedFor(
  preset: DirectorCameraPresetDefinition,
  formation: DirectorFormation
): boolean {
  return preset.approvedFor.includes(CAST_GEOMETRY_CLASS[formation]);
}

/** The presets offered for a formation, in library order. */
export function presetsForFormation(
  formation: DirectorFormation
): DirectorCameraPresetDefinition[] {
  return DIRECTOR_CAMERA_PRESET_LIBRARY.filter((preset) =>
    isPresetApprovedFor(preset, formation)
  );
}

/**
 * The preset a scene gets when it names none. Cast size no longer picks it:
 * the fit policy already handles size, so the choice is about shape.
 */
export function defaultPresetForFormation(
  formation: DirectorFormation
): DirectorCameraPresetDefinition["id"] {
  const geometry = CAST_GEOMETRY_CLASS[formation];
  if (geometry === "ringed") return "high-reveal";
  if (geometry === "single") return "hero-dolly-in";
  return "front-lockoff";
}

export interface PresetResolution {
  preset: DirectorCameraPresetDefinition;
  /** Set when the requested preset is not approved for this formation. */
  substitutedFor: DirectorCameraPreset | null;
}

/**
 * A saved film can name a combination the library does not cover — the film
 * predates the preset, or its formation changed underneath it. Falling back is
 * correct; doing it silently is not, so the substitution is reported for the
 * control surface to surface.
 */
export function resolvePresetForFormation(
  requested: DirectorCameraPreset | undefined,
  formation: DirectorFormation
): PresetResolution {
  const id = requested ?? defaultPresetForFormation(formation);
  const preset = getCameraPreset(id);
  if (preset && isPresetApprovedFor(preset, formation)) {
    return { preset, substitutedFor: null };
  }
  return {
    preset: PRESETS_BY_ID.get(FALLBACK_PRESET_ID)!,
    substitutedFor: id,
  };
}
