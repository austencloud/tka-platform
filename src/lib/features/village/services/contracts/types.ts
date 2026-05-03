/**
 * Co-exported types from retired interface contracts.
 */

// === From ISequenceMutator ===

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

