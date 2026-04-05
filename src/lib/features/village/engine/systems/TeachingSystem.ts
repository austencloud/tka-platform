import type { World } from "miniplex";
import type { VillageEntity, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import {
	TEACHING_SPEED_TICKS_PER_BEAT,
	PROFICIENCY_THRESHOLD,
	FUMBLE_BASE_PROBABILITY,
	FRUSTRATION_DECAY_RATE,
	FRUSTRATION_GIVE_UP_THRESHOLD,
	INTERACTION_COOLDOWN_BASE,
} from "../../domain/village-constants";

export class TeachingSystem {
	constructor(
		private config: VillageConfig,
		private emitter: VillageEventEmitter,
	) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		for (const learner of world.entities) {
			if (learner.social.state !== "learning") continue;

			const teacher = world.entities.find(
				(e) => e.id === learner.social.partner,
			);
			if (!teacher || teacher.social.state !== "teaching") {
				this.resetToIdle(learner);
				continue;
			}

			// Fumble check
			const fumbleChance =
				(1 - learner.social.teachingProgress) * FUMBLE_BASE_PROBABILITY;
			if (Math.random() < fumbleChance) {
				learner.social.frustrationLevel = Math.min(
					1,
					learner.social.frustrationLevel + 0.15,
				);
				this.emitter.emit(
					"teaching:fumble",
					learner,
					learner.social.currentBeatIndex,
				);

				if (
					learner.social.frustrationLevel >
						FRUSTRATION_GIVE_UP_THRESHOLD &&
					Math.random() < (1 - teacher.personality.patience) * 0.3
				) {
					this.resetToIdle(learner);
					this.resetToIdle(teacher);
					continue;
				}
			} else {
				const progressIncrement =
					((learner.personality.learnSpeed *
						teacher.personality.patience) /
						TEACHING_SPEED_TICKS_PER_BEAT) *
					(0.5 + Math.random());

				learner.social.teachingProgress += progressIncrement;
				learner.social.frustrationLevel = Math.max(
					0,
					learner.social.frustrationLevel - FRUSTRATION_DECAY_RATE,
				);
			}

			if (learner.social.teachingProgress >= PROFICIENCY_THRESHOLD) {
				this.completeTeaching(teacher, learner, currentTick);
			}
		}
	}

	private completeTeaching(
		teacher: VillageEntity,
		learner: VillageEntity,
		currentTick: number,
	): void {
		const sequenceId = learner.social.sequenceBeingTransferred!;
		const teacherKnowledge =
			teacher.knowledge.knownSequences.get(sequenceId);
		if (!teacherKnowledge) {
			this.resetToIdle(learner);
			this.resetToIdle(teacher);
			return;
		}

		const learned: LearnedSequence = {
			sequenceId,
			sequenceData: teacherKnowledge.sequenceData,
			proficiency: learner.social.teachingProgress,
			source: "taught",
			learnedAt: currentTick,
			learnedFrom: teacher.id,
			lineage: [...teacherKnowledge.lineage, teacher.id],
		};

		learner.knowledge.knownSequences.set(sequenceId, learned);
		this.emitter.emit("teaching:completed", teacher, learner, sequenceId);

		learner.social.state = "practicing";
		learner.social.idleTimer = 0;
		learner.social.partner = null;
		learner.social.sequenceBeingTransferred = null;

		teacher.social.state = "idle";
		teacher.social.idleTimer = 0;
		teacher.social.partner = null;
		teacher.social.sequenceBeingTransferred = null;
		teacher.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
	}

	private resetToIdle(entity: VillageEntity): void {
		entity.social.state = "idle";
		entity.social.partner = null;
		entity.social.teachingProgress = 0;
		entity.social.sequenceBeingTransferred = null;
		entity.social.frustrationLevel = 0;
		entity.social.currentBeatIndex = 0;
		entity.social.idleTimer = 0;
		entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
	}
}
