import type { SequenceData } from "../../domain/models/SequenceData";

export interface ISequenceHydrator {
	/**
	 * Load-time: if compositional fields (blueSoloProp, redSoloProp, stepPairings)
	 * exist, re-derives `steps` from them so that compositional fields are the
	 * single source of truth. If compositional fields are absent, returns the
	 * sequence unchanged (steps remain as stored).
	 */
	hydrate(sequence: SequenceData): SequenceData;

	/**
	 * Save-time: recomputes compositional fields (blueSoloProp, redSoloProp,
	 * stepPairings, content hashes) from the current `steps` array. Call this
	 * before persisting to ensure Firestore always has fresh compositional data,
	 * even if the sequence was mutated through the old steps-based API.
	 */
	ensureComposition(sequence: SequenceData): SequenceData;
}
