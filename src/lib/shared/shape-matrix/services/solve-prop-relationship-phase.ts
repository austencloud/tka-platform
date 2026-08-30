import type { CsvEdge } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SVGPathData } from "$lib/shared/mandala/domain/mandala-types";
import type { TipPoint } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Flower } from "../domain/flower-signature";
import { derivePropRelationship } from "../domain/prop-relationship";
import { findExactParityCandidates } from "./verify-realization-parity";
import { MODE_FAMILY_ID, type VtgMode } from "./shape-matrix-realizations";

export interface FlowerParityTarget {
  blue: SVGPathData[];
  red: SVGPathData[];
  tipPoint?: TipPoint;
  clubTipDx: number;
}

export interface PropRelationshipPhaseSolution {
  sequence: SequenceData;
  blueOrientation: Orientation;
  redOrientation: Orientation;
}

/**
 * Build every phase that preserves the exact blue and red flowers clicked in
 * the matrix. The parity owner sorts these from the displayed phase outward,
 * so consumers can use the first candidate for hand-first exploration and
 * filter the same list by prop relationship for prop-first exploration.
 */
export function buildExactFlowerPhases(
  base: SequenceData,
  pair: { blue: Flower; red: Flower },
  edges: CsvEdge[],
  target: FlowerParityTarget
): PropRelationshipPhaseSolution[] {
  return findExactParityCandidates(
    base,
    pair,
    target.blue,
    target.red,
    edges,
    target.tipPoint ?? target.clubTipDx
  ).map((candidate) => ({
    sequence: candidate.sequence,
    blueOrientation: candidate.blueOri,
    redOrientation: candidate.redOri,
  }));
}

/** Return the nearest exact flower phase with the requested prop relationship. */
export function solvePropRelationshipPhase(
  base: SequenceData,
  pair: { blue: Flower; red: Flower },
  targetPropMode: VtgMode,
  edges: CsvEdge[],
  target: FlowerParityTarget
): PropRelationshipPhaseSolution | null {
  if (
    pair.blue.turns === "fl" ||
    pair.red.turns === "fl" ||
    pair.blue.turns !== pair.red.turns
  ) {
    return null;
  }

  const targetFamily = MODE_FAMILY_ID[targetPropMode];
  return (
    buildExactFlowerPhases(base, pair, edges, target).find((candidate) => {
      const relationship = derivePropRelationship(candidate.sequence, pair);
      return (
        relationship.kind === "full" &&
        relationship.element.familyId === targetFamily
      );
    }) ?? null
  );
}

/** Build the nearest exact phase when the hand path is the active driver. */
export function buildDefaultFlowerPhase(
  base: SequenceData,
  pair: { blue: Flower; red: Flower },
  edges: CsvEdge[],
  target: FlowerParityTarget
): PropRelationshipPhaseSolution | null {
  return buildExactFlowerPhases(base, pair, edges, target)[0] ?? null;
}
