import type {
	ISequenceMutator,
	MutationType,
	MutationResult,
} from "../contracts/ISequenceMutator";

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
 * Phase 2+ will wire to ISequenceTransformer for real structural transforms.
 */
export class SequenceMutator implements ISequenceMutator {
	tryInventFrom(sourceSequenceId: string): MutationResult {
		const type =
			MUTATION_TYPES[Math.floor(Math.random() * MUTATION_TYPES.length)] ??
			"mirror";
		const newId = `${sourceSequenceId}:${type}`;
		return { success: true, mutationType: type, inventedId: newId };
	}
}
