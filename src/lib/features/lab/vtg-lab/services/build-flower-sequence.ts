import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CsvEdge } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { prepareMandalaClubSequence } from "./prepare-mandala-club-sequence";
import { flowerTurnPattern, type Flower } from "../domain/flower-signature";

/**
 * archetype (two-hand pure-pro or pure-anti seed) + flower → a single-hand
 * club SequenceData, south-anchored, at the flower's turns + start orientation.
 * `hand` is which axis this flower lives on (blue = rows, red = columns).
 */
export function buildFlowerSequence(
  archetype: SequenceData,
  flower: Flower,
  hand: "blue" | "red",
  edges: CsvEdge[],
): SequenceData {
  // Apply turns + start orientation to the FULL two-hand archetype first (the
  // proven rosetta order — applyVariationDescriptor's per-hand turn/closure logic
  // expects both hands present), THEN strip to the single shown hand as a club.
  const { sequence } = applyVariationDescriptor(
    archetype,
    {
      turnPattern: flowerTurnPattern(flower),
      turnLabel: flowerTurnPattern(flower),
      gridMode: flower.grid,
      startOriPair: hand === "blue" ? { blue: flower.ori } : { red: flower.ori },
    },
    edges,
  );
  return prepareMandalaClubSequence(sequence, { show: hand, pathShape: "arc" });
}
