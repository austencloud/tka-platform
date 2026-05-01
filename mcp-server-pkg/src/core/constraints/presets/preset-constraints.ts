/**
 * Preset Constraints
 *
 * Predefined constraint configurations for common use cases.
 * These can be selected by name instead of writing natural language.
 */

import type { ConstraintSet } from "../types.js";
import { ContinuityConstraint } from "../implementations/continuity-constraint.js";
import {
  MotionTypeConstraint,
  allProMotions,
  allAntiMotions,
  noDashMotions,
  preferProMotions,
  preferAntiMotions,
} from "../implementations/motion-type-constraint.js";
import {
  allClockwise,
  allCounterClockwise,
} from "../implementations/rotation-direction-constraint.js";
import { ReversalConstraint } from "../implementations/reversal-constraint.js";
import { DashPreferenceConstraint, maximizeDashes } from "../implementations/dash-preference-constraint.js";
import {
  HandPathReversalConstraint,
  maximizeHandPathContinuity,
  enforceHandPathContinuity,
} from "../implementations/hand-path-constraint.js";

/**
 * Available preset names.
 */
export type PresetName =
  | "smooth"
  | "smooth-hands"
  | "smooth-props"
  | "reversal"
  | "isolation"
  | "antispin"
  | "pro-cw"
  | "anti-ccw"
  | "no-dash"
  | "maximize-dash"
  | "maximum-chaos";

/**
 * Preset definitions.
 */
export interface PresetDefinition {
  name: PresetName;
  description: string;
  constraintSet: ConstraintSet;
}

/**
 * All available presets.
 */
export const PRESETS: PresetDefinition[] = [
  {
    name: "smooth",
    description: "Maximize overall flow - minimize both hand path and prop reversals",
    constraintSet: {
      hard: [],
      soft: [
        new ContinuityConstraint("maximize"),
        maximizeHandPathContinuity(),
      ],
    },
  },
  {
    name: "smooth-hands",
    description: "Maximize hand path continuity - allow prop reversals if hand paths stay smooth",
    constraintSet: {
      hard: [],
      soft: [maximizeHandPathContinuity()],
    },
  },
  {
    name: "smooth-props",
    description: "Maximize prop spin continuity - allow handpath reversals if prop spins stay consistent",
    constraintSet: {
      hard: [],
      soft: [new ContinuityConstraint("maximize")],
    },
  },
  {
    name: "reversal",
    description: "Maximize prop reversals - as many direction changes as the word allows",
    constraintSet: {
      hard: [],
      soft: [new ReversalConstraint("every")],
    },
  },
  {
    name: "isolation",
    description: "All pro (isolation) motions - props rotate with hand path",
    constraintSet: {
      hard: [allProMotions()],
      soft: [new ContinuityConstraint("maximize")],
    },
  },
  {
    name: "antispin",
    description: "All antispin motions - props rotate against hand path",
    constraintSet: {
      hard: [allAntiMotions()],
      soft: [new ContinuityConstraint("maximize")],
    },
  },
  {
    name: "pro-cw",
    description: "Pro motions with clockwise rotation",
    constraintSet: {
      hard: [allProMotions(), allClockwise()],
      soft: [],
    },
  },
  {
    name: "anti-ccw",
    description: "Anti motions with counter-clockwise rotation",
    constraintSet: {
      hard: [allAntiMotions(), allCounterClockwise()],
      soft: [],
    },
  },
  {
    name: "no-dash",
    description: "No dash motions - shifts only for connected movement",
    constraintSet: {
      hard: [noDashMotions()],
      soft: [new ContinuityConstraint("maximize")],
    },
  },
  {
    name: "maximize-dash",
    description: "Maximize dash motions - prefer Type 4/5 letters (Φ, Ψ, Λ) for bridges",
    constraintSet: {
      hard: [],
      soft: [maximizeDashes()],
    },
  },
  {
    name: "maximum-chaos",
    description: "Maximize all reversals (hand path + prop) - as chaotic as the word allows",
    constraintSet: {
      hard: [],
      soft: [
        new ReversalConstraint("every"),
        new HandPathReversalConstraint("every"),
      ],
    },
  },
];

export function getPreset(name: PresetName): PresetDefinition | null {
  return PRESETS.find((p) => p.name === name) ?? null;
}

export function getPresetConstraintSet(name: PresetName): ConstraintSet | null {
  const preset = getPreset(name);
  return preset?.constraintSet ?? null;
}

export function listPresetNames(): PresetName[] {
  return PRESETS.map((p) => p.name);
}

export function listPresets(): Array<{ name: PresetName; description: string }> {
  return PRESETS.map((p) => ({ name: p.name, description: p.description }));
}
