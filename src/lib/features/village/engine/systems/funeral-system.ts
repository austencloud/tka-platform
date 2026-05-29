import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	FUNERAL_RADIUS,
} from "../../domain/village-constants";

export class FuneralSystem {
	constructor(private emitter: VillageEventEmitter) {}

	onDeath(
		deceased: VillageEntity,
		world: World<VillageEntity>,
		currentTick: number,
	): void {
		// Check for sequence extinction
		const extinctSequences: string[] = [];
		for (const seqId of deceased.knowledge.knownSequences.keys()) {
			const otherCarriers = world.entities.filter(
				(e) =>
					e.id !== deceased.id &&
					e.knowledge.knownSequences.has(seqId),
			);
			if (otherCarriers.length === 0) {
				extinctSequences.push(seqId);
			}
		}

		// Fragmented memory: mid-lesson learner retains partial knowledge
		if (
			deceased.social.state === "teaching" &&
			deceased.social.partner
		) {
			const learner = world.entities.find(
				(e) => e.id === deceased.social.partner,
			);
			if (learner?.social.sequenceBeingTransferred) {
				const seqId = learner.social.sequenceBeingTransferred;
				const teacherKnowledge =
					deceased.knowledge.knownSequences.get(seqId);
				if (
					teacherKnowledge &&
					!learner.knowledge.knownSequences.has(seqId)
				) {
					learner.knowledge.knownSequences.set(seqId, {
						sequenceId: seqId,
						sequenceData: teacherKnowledge.sequenceData,
						proficiency: learner.social.teachingProgress,
						source: "fragmented",
						learnedAt: currentTick,
						learnedFrom: deceased.id,
						lineage: [...teacherKnowledge.lineage, deceased.id],
						lastUsedTick: currentTick,
						style: { amplitudeScale: 1.0, tempoOffset: 0 },
					});
				}
				learner.social.state = "idle";
				learner.social.partner = null;
				learner.social.sequenceBeingTransferred = null;
			}
		}

		// Gather mourners
		const mourners: VillageEntity[] = [];
		for (const entity of world.entities) {
			if (entity.id === deceased.id) continue;
			if (entity.social.state === "passing") continue;
			const dist = Math.sqrt(
				(entity.transform.x - deceased.transform.x) ** 2 +
					(entity.transform.z - deceased.transform.z) ** 2,
			);
			if (dist <= FUNERAL_RADIUS) {
				entity.social.state = "mourning";
				entity.social.partner = null;
				entity.social.idleTimer = 0;
				entity.transform.speed = 0;
				entity.transform.facingAngle = Math.atan2(
					deceased.transform.z - entity.transform.z,
					deceased.transform.x - entity.transform.x,
				);
				mourners.push(entity);
			}
		}

		if (mourners.length > 0) {
			this.emitter.emit("funeral:started", deceased, mourners);
		}

		// Knowledge panic: if extinction happened, nearby curious entities seek aggressively
		if (extinctSequences.length > 0) {
			for (const entity of world.entities) {
				if (entity.social.state === "mourning") continue;
				if (entity.personality.curiosity < 0.5) continue;
				const dist = Math.sqrt(
					(entity.transform.x - deceased.transform.x) ** 2 +
						(entity.transform.z - deceased.transform.z) ** 2,
				);
				if (dist <= FUNERAL_RADIUS * 2) {
					entity.social.state = "seeking";
					entity.social.interactionCooldown = 0;
				}
			}
		}
	}
}
