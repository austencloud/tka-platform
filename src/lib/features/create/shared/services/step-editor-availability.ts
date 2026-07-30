import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

/**
 * The Step Editor needs at least one editable beat or start position. A bare
 * sequence shell can exist briefly during creation, but it has nothing to edit.
 */
export function sequenceHasStepEditorContent(
  sequence: SequenceData | null
): boolean {
  if (!sequence) return false;

  return Boolean(
    sequence.steps?.length ||
    sequence.startingPosition ||
    sequence.startPosition
  );
}
