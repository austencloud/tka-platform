import type { World } from "miniplex";
import type { VillageEntity, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { SequenceMutator } from "../../services/implementations/SequenceMutator";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import { INTERACTION_COOLDOWN_BASE } from "../../domain/village-constants";

export class RecombinationSystem {
	constructor(
		private config: VillageConfig,
		private mutator: SequenceMutator,
		private emitter: VillageEventEmitter,
	) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		for (const entity of world.entities) {
			if (entity.social.state !== "inventing") continue;

			const sequences = Array.from(
				entity.knowledge.knownSequences.values(),
			);
			if (sequences.length < 2) {
				entity.social.state = "idle";
				continue;
			}

			const source =
				sequences[Math.floor(Math.random() * sequences.length)];
			if (!source) {
				entity.social.state = "idle";
				continue;
			}
			const result = this.mutator.tryInventFrom(source.sequenceId);

			if (result.success) {
				const newId = result.inventedId;

				if (
					!entity.knowledge.knownSequences.has(newId) &&
					entity.knowledge.knownSequences.size <
						entity.knowledge.maxCapacity
				) {
					const learned: LearnedSequence = {
						sequenceId: newId,
						sequenceData: null,
						proficiency: 0.5,
						source: "invented",
						learnedAt: currentTick,
						learnedFrom: null,
						lineage: [],
						lastUsedTick: currentTick,
						style: { amplitudeScale: 1.0, tempoOffset: 0 },
					};
					entity.knowledge.knownSequences.set(newId, learned);
					this.emitter.emit("sequence:invented", entity, newId);
				}
			}

			entity.social.state = "idle";
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
	}
}
