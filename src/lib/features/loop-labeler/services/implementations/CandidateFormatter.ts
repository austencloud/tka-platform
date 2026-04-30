import type {
  ICandidateFormatter,
  FormattedTransformations,
} from "../contracts/ICandidateFormatter";
import type { StepPairRelationship } from "../contracts/IStepPairAnalyzer";
import type { ComponentId } from "../../domain/constants/loop-components";
import type {
  CandidateDesignation,
  TransformationIntervals,
} from "../../domain/models/label-models";
import type {
  CandidateInfo,
  InternalStepPair,
} from "../../domain/models/internal-step-models";
import { TRANSFORMATION_PRIORITY } from "../../domain/constants/transformation-priority";

/**
 * Service for formatting transformations and building candidate designations.
 */
export class CandidateFormatter implements ICandidateFormatter {
  formatSingleTransformation(raw: string): string {
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

  formatBeatPairTransformations(
    rawTransformations: string[]
  ): FormattedTransformations {
    if (rawTransformations.length === 0) return { primary: [], all: [] };

    // Format ALL transformations first
    const allFormatted = rawTransformations.map((t) =>
      this.formatSingleTransformation(t)
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

    const primary = this.formatSingleTransformation(first);
    return { primary: [primary], all: allUnique };
  }

  deriveComponentsFromPattern(pattern: string): ComponentId[] {
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

  extractRotationDirection(pattern: string): "cw" | "ccw" | null {
    const upper = pattern.toUpperCase();
    if (upper.includes("CCW")) return "ccw";
    if (upper.includes("CW")) return "cw";
    return null;
  }

  formatCandidateDescription(
    transformation: string,
    _direction: "cw" | "ccw" | null
  ): string {
    const upper = transformation.toUpperCase();

    // Triple compound
    if (
      upper.includes("ROTATED_90") &&
      upper.includes("SWAPPED") &&
      upper.includes("INVERTED")
    ) {
      const dir = upper.includes("CCW")
        ? "CCW"
        : upper.includes("CW")
          ? "CW"
          : "";
      return `Rotated 90° ${dir} + Swapped + Inverted`;
    }
    if (
      upper.includes("ROTATED_180") &&
      upper.includes("SWAPPED") &&
      upper.includes("INVERTED")
    ) {
      return "Rotated 180° + Swapped + Inverted";
    }

    // Double compound: rotation + invert
    if (
      upper.includes("ROTATED_90") &&
      upper.includes("INVERTED") &&
      !upper.includes("SWAPPED")
    ) {
      const dir = upper.includes("CCW")
        ? "CCW"
        : upper.includes("CW")
          ? "CW"
          : "";
      return `Rotated 90° ${dir} + Inverted`;
    }
    if (
      upper.includes("ROTATED_180") &&
      upper.includes("INVERTED") &&
      !upper.includes("SWAPPED")
    ) {
      return "Rotated 180° + Inverted";
    }

    // Double compound: rotation + swap
    if (upper.includes("ROTATED_90") && upper.includes("SWAPPED")) {
      const dir = upper.includes("CCW")
        ? "CCW"
        : upper.includes("CW")
          ? "CW"
          : "";
      return `Rotated 90° ${dir} + Swapped`;
    }
    if (upper.includes("ROTATED_180") && upper.includes("SWAPPED")) {
      return "Rotated 180° + Swapped";
    }

    // Pure rotations
    if (upper.includes("ROTATED_90")) {
      const dir = upper.includes("CCW")
        ? "CCW"
        : upper.includes("CW")
          ? "CW"
          : "";
      return `Rotated 90° ${dir}`;
    }
    if (upper.includes("ROTATED_180")) {
      return "Rotated 180°";
    }

    // Other patterns
    if (
      upper.includes("MIRRORED") &&
      upper.includes("SWAPPED") &&
      upper.includes("INVERTED")
    )
      return "Mirrored + Swapped + Inverted";
    if (upper.includes("MIRRORED") && upper.includes("SWAPPED"))
      return "Mirrored + Swapped";
    if (upper.includes("MIRRORED") && upper.includes("INVERTED"))
      return "Mirrored + Inverted";
    if (upper.includes("MIRRORED")) return "Mirrored";
    if (upper.includes("FLIPPED") && upper.includes("INVERTED"))
      return "Flipped + Inverted";
    if (upper.includes("FLIPPED")) return "Flipped";
    if (upper.includes("SWAPPED") && upper.includes("INVERTED"))
      return "Swapped + Inverted";
    if (upper.includes("SWAPPED")) return "Swapped";
    if (upper.includes("INVERTED")) return "Inverted";
    if (upper.includes("REPEATED") || upper === "SAME") return "Repeated";

    return transformation.replace(/_/g, " ");
  }

  buildCandidateDesignations(
    allCommon: string[],
    interval: 2 | 4,
    rotationDirection: "cw" | "ccw" | null
  ): CandidateInfo[] {
    const candidates: CandidateInfo[] = [];
    const seen = new Set<string>();

    for (const transformation of allCommon) {
      const components = this.deriveComponentsFromPattern(transformation);
      if (components.length === 0) continue;

      const direction =
        this.extractRotationDirection(transformation) || rotationDirection;
      const key = components.sort().join("+") + "|" + (direction || "none");
      if (seen.has(key)) continue;
      seen.add(key);

      const intervals: TransformationIntervals = {};
      if (components.includes("rotated")) intervals.rotation = interval;
      if (components.includes("swapped")) intervals.swap = interval;
      if (components.includes("mirrored")) intervals.mirror = interval;
      if (components.includes("inverted")) intervals.invert = interval;

      // For "repeated", use a special label
      if (components.includes("repeated") && components.length === 1) {
        candidates.push({
          transformation,
          components: components as ComponentId[],
          intervals: {},
          rotationDirection: null,
          label: `repeated @${interval === 2 ? "1/2" : "1/4"}`,
          description: "Repeated (same motion)",
        });
        continue;
      }

      let label = components.join("+");
      // Only show rotation direction for 90° rotations
      if (direction && interval === 4) label += ` (${direction.toUpperCase()})`;
      if (interval === 4) label += " @1/4";
      else if (interval === 2) label += " @1/2";

      const effectiveDirection = interval === 4 ? direction : null;

      candidates.push({
        transformation,
        components,
        intervals,
        rotationDirection: effectiveDirection,
        label,
        description: this.formatCandidateDescription(
          transformation,
          effectiveDirection
        ),
      });
    }

    return candidates;
  }

  toCandidateDesignation(info: CandidateInfo): CandidateDesignation {
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

  toPublicStepPairs(internal: InternalStepPair[]): StepPairRelationship[] {
    return internal.map((p) => ({
      keyStep: p.keyStep,
      correspondingStep: p.correspondingStep,
      detectedTransformations: p.detectedTransformations,
      allValidTransformations: p.allValidTransformations,
    }));
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

export const candidateFormatter = new CandidateFormatter();
