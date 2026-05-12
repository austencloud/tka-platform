import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import {
	PROXIMITY_LEARNING_RADIUS,
	YOUTH_ABSORPTION_RATE,
	YOUTH_ABSORPTION_THRESHOLD,
} from "../../domain/village-constants";

export class ProximityLearningSystem {
	// Partial absorption progress for youth entities
	// Key: `${entityId}:${sequenceId}`
	private absorptionProgress = new Map<
		string,
		{ progress: number; sourceId: string }
	>();

	tick(world: World<VillageEntity>, currentTick: number): void {
		for (const youth of world.entities) {
			if (youth.lifecycle.phase !== "youth") continue;
			if (youth.social.state === "passing") continue;

			for (const adult of world.entities) {
				if (adult.id === youth.id) continue;
				if (
					adult.social.state !== "performing" &&
					adult.social.state !== "teaching"
				)
					continue;

				const dx = youth.transform.x - adult.transform.x;
				const dz = youth.transform.z - adult.transform.z;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist > PROXIMITY_LEARNING_RADIUS) continue;

				const activeSeqId =
					adult.social.sequenceBeingTransferred ??
					adult.social.performingSequenceId;
				if (!activeSeqId) continue;
				if (youth.knowledge.knownSequences.has(activeSeqId)) continue;

				const key = `${youth.id}:${activeSeqId}`;
				const rate =
					(1 - dist / PROXIMITY_LEARNING_RADIUS) *
					YOUTH_ABSORPTION_RATE;
				const existing = this.absorptionProgress.get(key);
				const newProgress = (existing?.progress ?? 0) + rate;

				if (newProgress >= YOUTH_ABSORPTION_THRESHOLD) {
					const teacherKnowledge =
						adult.knowledge.knownSequences.get(activeSeqId);
					youth.knowledge.knownSequences.set(activeSeqId, {
						sequenceId: activeSeqId,
						sequenceData: teacherKnowledge?.sequenceData ?? null,
						proficiency: YOUTH_ABSORPTION_THRESHOLD,
						source: "taught",
						learnedAt: currentTick,
						learnedFrom: adult.id,
						lineage: teacherKnowledge
							? [...teacherKnowledge.lineage, adult.id]
							: [adult.id],
						lastUsedTick: currentTick,
						style: { amplitudeScale: 1.0, tempoOffset: 0 },
					});
					this.absorptionProgress.delete(key);
				} else {
					this.absorptionProgress.set(key, {
						progress: newProgress,
						sourceId: adult.id,
					});
				}
			}
		}

		// Clean up progress for dead/aged-up entities
		for (const key of this.absorptionProgress.keys()) {
			const entityId = key.split(":")[0];
			const entity = world.entities.find((e) => e.id === entityId);
			if (entity?.lifecycle.phase !== "youth") {
				this.absorptionProgress.delete(key);
			}
		}
	}
}
