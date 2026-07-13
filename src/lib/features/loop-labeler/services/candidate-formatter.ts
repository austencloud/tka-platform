import type { ComponentId } from "../domain/constants/loop-components";
import type { CandidateDesignation } from "../domain/models/label-models";
import type {
  CandidateInfo,
  InternalStepPair,
} from "../domain/models/internal-step-models";
import { TRANSFORMATION_PRIORITY } from "../domain/constants/transformation-priority";
import type { FormattedTransformations } from "./types";
import type { StepPairRelationship } from "./types";

/**
 * Format a single raw transformation string into display form.
 */
export function formatSingleTransformation(raw: string): string {
  let formatted = raw.toUpperCase();

  // Format compound transformations
  formatted = formatted.replace(
    /ROTATED_90_CCW_SWAPPED_INVERTED/,
    "ROTATED_90_CCW+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CW_SWAPPED_INVERTED/,
    "ROTATED_90_CW+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_180_SWAPPED_INVERTED/,
    "ROTATED_180+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CCW_INVERTED/,
    "ROTATED_90_CCW+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CW_INVERTED/,
    "ROTATED_90_CW+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_180_INVERTED/,
    "ROTATED_180+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CCW_SWAPPED_INVERTED/,
    "ROTATED_90_CCW+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CW_SWAPPED_INVERTED/,
    "ROTATED_90_CW+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_180_SWAPPED_INVERTED/,
    "ROTATED_180+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CCW_SWAPPED/,
    "ROTATED_90_CCW+SWAPPED"
  );
  formatted = formatted.replace(
    /ROTATED_90_CW_SWAPPED/,
    "ROTATED_90_CW+SWAPPED"
  );
  formatted = formatted.replace(/ROTATED_180_SWAPPED/, "ROTATED_180+SWAPPED");
  formatted = formatted.replace(/FLIPPED_INVERTED/, "FLIPPED+INVERTED");
  formatted = formatted.replace(/MIRRORED_INVERTED/, "MIRRORED+INVERTED");
  formatted = formatted.replace(
    /MIRRORED_SWAPPED_INVERTED/,
    "MIRRORED+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(/MIRRORED_SWAPPED/, "MIRRORED+SWAPPED");
  formatted = formatted.replace(
    /FLIPPED_SWAPPED_INVERTED/,
    "FLIPPED+SWAPPED+INVERTED"
  );
  formatted = formatted.replace(/FLIPPED_SWAPPED/, "FLIPPED+SWAPPED");
  formatted = formatted.replace(/SWAPPED_INVERTED/, "SWAPPED+INVERTED");
  formatted = formatted.replace(/_/g, " ");

  return formatted;
}

export function formatBeatPairTransformations(
  rawTransformations: string[]
): FormattedTransformations {
  if (rawTransformations.length === 0) return { primary: [], all: [] };

  // Format ALL transformations first
  const allFormatted = rawTransformations.map((t) =>
    formatSingleTransformation(t)
  );
  const allUnique = [...new Set(allFormatted)];

  // When both base and inverted variants are present, prefer BASE (non-inverted)
  // Rationale: If we can't determine inversion from rotation data, assume simpler case
  const transformationSet = new Set(rawTransformations);
  const invertedVariants = [
    { base: "rotated_180", inverted: "rotated_180_inverted" },
    { base: "rotated_90_cw", inverted: "rotated_90_cw_inverted" },
    { base: "rotated_90_ccw", inverted: "rotated_90_ccw_inverted" },
    { base: "flipped", inverted: "flipped_inverted" },
    { base: "mirrored", inverted: "mirrored_inverted" },
    { base: "mirrored_swapped", inverted: "mirrored_swapped_inverted" },
    {
      base: "rotated_90_ccw_swapped",
      inverted: "rotated_90_ccw_swapped_inverted",
    },
    {
      base: "rotated_90_cw_swapped",
      inverted: "rotated_90_cw_swapped_inverted",
    },
    { base: "rotated_180_swapped", inverted: "rotated_180_swapped_inverted" },
  ];

  // Filter OUT inverted versions when base version is also present
  const filtered = rawTransformations.filter((t) => {
    for (const pair of invertedVariants) {
      if (t === pair.inverted && transformationSet.has(pair.base)) {
        return false; // Remove inverted if base exists
      }
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const priorityA = TRANSFORMATION_PRIORITY.indexOf(a);
    const priorityB = TRANSFORMATION_PRIORITY.indexOf(b);
    return (
      (priorityA === -1 ? 999 : priorityA) -
      (priorityB === -1 ? 999 : priorityB)
    );
  });

  const first = sorted[0];
  if (!first) return { primary: [], all: allUnique };

  const primary = formatSingleTransformation(first);
  return { primary: [primary], all: allUnique };
}

/** @deprecated Pipeline Stage 6 (build-candidates) supersedes this for uniform detection. Retained for modular fallback path. */
export function deriveComponentsFromPattern(pattern: string): ComponentId[] {
  const components: ComponentId[] = [];
  const upper = pattern.toUpperCase();

  if (upper.includes("INVERTED") || upper.includes("INV")) {
    components.push("inverted");
  }
  if (upper.includes("ROTATED") || upper.includes("ROT")) {
    components.push("rotated");
  }
  if (
    upper.includes("SWAPPED") ||
    upper.includes("SWAP") ||
    upper.match(/\bSW\b/)
  ) {
    components.push("swapped");
  }
  if (upper.includes("MIRRORED") || upper.includes("MIRROR")) {
    components.push("mirrored");
  }
  if (upper.includes("FLIPPED") || upper.includes("FLIP")) {
    components.push("flipped");
  }
  if (upper.includes("REPEATED") || upper === "SAME") {
    components.push("repeated");
  }

  return components;
}

export function toCandidateDesignation(info: CandidateInfo): CandidateDesignation {
  return {
    components: info.components,
    loopType: info.components.sort().join("_"),
    transformationIntervals: info.intervals,
    label: info.label,
    description: info.description,
    rotationDirection: info.rotationDirection,
    confirmed: false,
    denied: false,
  };
}

export function toPublicStepPairs(internal: InternalStepPair[]): StepPairRelationship[] {
  return internal.map((p) => ({
    keyStep: p.keyStep,
    correspondingStep: p.correspondingStep,
    detectedTransformations: p.detectedTransformations,
    allValidTransformations: p.allValidTransformations,
  }));
}
