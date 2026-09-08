import type { SequenceData } from "./sequence-data";

/** Authored subject, distinct from temporarily viewing prop choreography as hands. */
export function isHandPathSequence(
  sequence: Pick<SequenceData, "sequenceKind"> | null | undefined
): boolean {
  return sequence?.sequenceKind === "hand-path";
}
