/**
 * Preset Constraints — Compositional Aliases
 *
 * Named presets are aliases for ConstraintOptions objects.
 * All presets resolve through buildConstraintSet() for consistency.
 */

import type { ConstraintSet } from "../types.js";
import type { ConstraintOptions } from "../composition/constraint-options.js";
import { buildConstraintSet } from "../composition/build-constraint-set.js";

export type PresetName =
  | "smooth"
  | "smooth-hands"
  | "smooth-props"
  | "reversal"
  | "maximum-chaos"
  | "isolation"
  | "antispin"
  | "no-dash"
  | "no-static"
  | "maximize-dash";

interface PresetDefinition {
  name: PresetName;
  description: string;
  options: ConstraintOptions;
}

const PRESETS: PresetDefinition[] = [
  {
    name: "smooth",
    description: "Maximize overall flow — minimize both hand path and prop reversals",
    options: { propContinuity: "maximize", handPathContinuity: "maximize" },
  },
  {
    name: "smooth-hands",
    description: "Maximize hand path continuity — allow prop reversals if hand paths stay smooth",
    options: { handPathContinuity: "maximize" },
  },
  {
    name: "smooth-props",
    description: "Maximize prop spin continuity — allow hand path reversals if prop spins stay consistent",
    options: { propContinuity: "maximize" },
  },
  {
    name: "reversal",
    description: "Maximize prop reversals — as many direction changes as the word allows",
    options: { propContinuity: "force-reversals" },
  },
  {
    name: "maximum-chaos",
    description: "Maximize all reversals (hand path + prop) — as chaotic as the word allows",
    options: { propContinuity: "force-reversals", handPathContinuity: "force-reversals" },
  },
  {
    name: "isolation",
    description: "Pro shifts at zero turns — props appear stationary as hands move",
    options: { motionType: "pro", turns: 0, motionFamily: { include: ["shift"] } },
  },
  {
    name: "antispin",
    description: "All anti motions with smooth prop continuity",
    options: { motionType: "anti", propContinuity: "maximize" },
  },
  {
    name: "no-dash",
    description: "Exclude dash motions — shifts and statics only",
    options: { motionFamily: { exclude: ["dash"] } },
  },
  {
    name: "no-static",
    description: "Exclude static motions — shifts and dashes only",
    options: { motionFamily: { exclude: ["static"] } },
  },
  {
    name: "maximize-dash",
    description: "Prefer dash motions — one hand stays while the other moves",
    options: { motionFamily: { include: ["dash"] } },
  },
];

export function getPreset(name: string): PresetDefinition | null {
  return PRESETS.find((p) => p.name === name) ?? null;
}

export function getPresetOptions(name: string): ConstraintOptions | null {
  return getPreset(name)?.options ?? null;
}

export function getPresetConstraintSet(name: string): ConstraintSet | null {
  const preset = getPreset(name);
  if (!preset) return null;
  return buildConstraintSet(preset.options);
}

export function listPresetNames(): PresetName[] {
  return PRESETS.map((p) => p.name);
}

export function listPresets(): Array<{ name: string; description: string }> {
  return PRESETS.map((p) => ({ name: p.name, description: p.description }));
}

export type { PresetDefinition };
