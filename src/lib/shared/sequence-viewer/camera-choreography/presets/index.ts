/**
 * Preset registry.
 *
 * The Export popover reads this list to build its preset tile grid,
 * and the runtime resolves a selected id back to the driver here.
 */

import type { CameraPreset } from "../types";
import { autoOrbitPreset } from "./auto-orbit";
import { planeWallPreset, planeWheelPreset, planeFloorPreset } from "./plane-locked";
import { quadPlaneTourPreset } from "./quad-plane-tour";
import { ensembleFocusPreset } from "./ensemble-focus";

export type PresetId =
  | "free"
  | "auto-orbit"
  | "plane-wall"
  | "plane-wheel"
  | "plane-floor"
  | "quad-plane-tour"
  | "ensemble-focus";

export const PRESETS: readonly CameraPreset[] = [
  autoOrbitPreset,
  planeWallPreset,
  planeWheelPreset,
  planeFloorPreset,
  quadPlaneTourPreset,
  ensembleFocusPreset,
];

const BY_ID = new Map<string, CameraPreset>(PRESETS.map((p) => [p.id, p]));

export function getPresetById(id: PresetId): CameraPreset | null {
  if (id === "free") return null;
  return BY_ID.get(id) ?? null;
}

export {
  autoOrbitPreset,
  planeWallPreset,
  planeWheelPreset,
  planeFloorPreset,
  quadPlaneTourPreset,
  ensembleFocusPreset,
};
