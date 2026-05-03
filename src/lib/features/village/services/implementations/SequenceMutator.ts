import type {
	MutationType,
	MutationResult,
} from "../contracts/types";

const MUTATION_TYPES: MutationType[] = [
	"mirror",
	"flip",
	"rotate",
	"swap",
	"invert",
	"rewind",
];

/**
 * Phase 1: Lightweight synchronous mutator that generates novel sequence IDs.
 * Phase 2+ will wire to SequenceTransformer for real structural transforms.
 */
export class SequenceMutator {
	tryInventFrom(sourceSequenceId: string): MutationResult {
		const type =
			MUTATION_TYPES[Math.floor(Math.random() * MUTATION_TYPES.length)] ??
			"mirror";
		const newId = `${sourceSequenceId}:${type}`;
		return { success: true, mutationType: type, inventedId: newId };
	}
}
