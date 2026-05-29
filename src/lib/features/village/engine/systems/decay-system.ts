import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	DECAY_GRACE_PERIOD,
	DECAY_PER_TICK,
	FORGET_THRESHOLD,
} from "../../domain/village-constants";

export class DecaySystem {
	constructor(private emitter: VillageEventEmitter) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;

			for (const [seqId, learned] of entity.knowledge.knownSequences) {
				const elapsed = currentTick - learned.lastUsedTick;
				if (elapsed <= DECAY_GRACE_PERIOD) continue;

				// Patient entities decay slower; structurally memorable sequences decay slower
				const patienceModifier = 1 - entity.personality.patience * 0.5;
				const structureBonus = this.getStructuralMemorability(seqId);
				const decayRate =
					DECAY_PER_TICK * patienceModifier * (1 - structureBonus);

				learned.proficiency = Math.max(
					0.05,
					learned.proficiency - decayRate,
				);

				if (learned.proficiency < FORGET_THRESHOLD) {
					entity.knowledge.knownSequences.delete(seqId);
					this.emitter.emit("sequence:forgotten", entity, seqId);
				}
			}
		}
	}

	/**
	 * Sequences with internal repetition (LOOPs, palindromes, mirrored structures)
	 * are easier to mentally rehearse and decay slower.
	 * Returns 0-0.5 bonus (higher = slower decay).
	 */
	private getStructuralMemorability(sequenceId: string): number {
		const mutations = sequenceId.split(":");
		const structuralMutations = mutations.filter(
			(m) => m === "mirror" || m === "invert" || m === "rewind",
		);
		return Math.min(0.5, structuralMutations.length * 0.15);
	}
}
