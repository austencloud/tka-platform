export type MutationType =
	| "mirror"
	| "flip"
	| "rotate"
	| "swap"
	| "invert"
	| "rewind";

export interface MutationResult {
	success: boolean;
	mutationType: MutationType;
	inventedId: string;
}

/**
 * Phase 1: synchronous, operates on sequence IDs only.
 * Phase 2+ will accept full SequenceData and wire to ISequenceTransformer.
 */
export interface ISequenceMutator {
	tryInventFrom(sourceSequenceId: string): MutationResult;
}
