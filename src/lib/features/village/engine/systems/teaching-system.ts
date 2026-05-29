import type { World } from "miniplex";
import type { VillageEntity, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	TEACHING_SPEED_TICKS_PER_BEAT,
	PROFICIENCY_THRESHOLD,
	FUMBLE_BASE_PROBABILITY,
	FRUSTRATION_DECAY_RATE,
	FRUSTRATION_GIVE_UP_THRESHOLD,
	INTERACTION_COOLDOWN_BASE,
	STYLE_MUTATION_STDDEV,
	PROP_PREFERENCE_TRANSFER_CHANCE,
	AFFINITY_TRANSFER_STRENGTH,
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
			if (teacher?.social.state !== "teaching") {
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
					learner.social.currentStepIndex,
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
			lastUsedTick: currentTick,
			style: this.inheritStyle(teacherKnowledge.style),
		};

		learner.knowledge.knownSequences.set(sequenceId, learned);

		// Update teacher's lastUsedTick and ego
		const teacherSeq = teacher.knowledge.knownSequences.get(sequenceId);
		if (teacherSeq) {
			teacherSeq.lastUsedTick = currentTick;
		}
		teacher.personality.ego = Math.min(1, teacher.personality.ego + 0.05);

		// Prop preference spread: 30% chance teaching transfers prop preference
		if (Math.random() < PROP_PREFERENCE_TRANSFER_CHANCE) {
			learner.prop.propPreference = teacher.prop.propPreference;
		}

		// Effect affinity inheritance
		const transferStrength = teacher.effect.affinityStrength * AFFINITY_TRANSFER_STRENGTH;
		if (transferStrength > learner.effect.affinityStrength) {
			learner.effect.affinity = teacher.effect.affinity;
			learner.effect.affinityStrength = transferStrength;
		}

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

	private inheritStyle(teacherStyle: {
		amplitudeScale: number;
		tempoOffset: number;
	}): { amplitudeScale: number; tempoOffset: number } {
		// Box-Muller transform for gaussian random
		const u1 = Math.random();
		const u2 = Math.random();
		const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

		return {
			amplitudeScale: Math.max(
				0.8,
				Math.min(
					1.2,
					teacherStyle.amplitudeScale + z0 * STYLE_MUTATION_STDDEV,
				),
			),
			tempoOffset: Math.max(
				-0.1,
				Math.min(
					0.1,
					teacherStyle.tempoOffset + z1 * STYLE_MUTATION_STDDEV,
				),
			),
		};
	}

	private resetToIdle(entity: VillageEntity): void {
		entity.social.state = "idle";
		entity.social.partner = null;
		entity.social.teachingProgress = 0;
		entity.social.sequenceBeingTransferred = null;
		entity.social.frustrationLevel = 0;
		entity.social.currentStepIndex = 0;
		entity.social.idleTimer = 0;
		entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
	}
}
