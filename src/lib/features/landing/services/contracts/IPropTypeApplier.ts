/**
 * Prop Type Applier Interface
 *
 * Contract for applying prop types to sequences.
 * Used to override the prop type for all motions in a sequence,
 * typically when displaying sequences with a specific prop type.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface IPropTypeApplier {
  /**
   * Apply a prop type to all motions in a sequence.
   * Returns a new sequence with the specified prop type set on all
   * blue and red motions in both the start position and steps.
   *
   * @param sequence The original sequence
   * @param propType The prop type to apply
   * @returns A new sequence with the prop type applied
   */
  applyToSequence(sequence: SequenceData, propType: PropType): SequenceData;
}
