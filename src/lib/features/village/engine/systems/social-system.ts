import type { World } from "miniplex";
import type { VillageEntity, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	IDLE_THRESHOLD_BASE,
	INTERACTION_COOLDOWN_BASE,
	INVENTION_BASE_PROBABILITY,
	MAKER_CRAFT_DURATION,
	MOURNING_DURATION,
	PERSONAL_SPACE_RADIUS,
	STYLE_INCOMPATIBILITY_REFUSE_CHANCE,
	STYLE_INCOMPATIBILITY_THRESHOLD,
} from "../../domain/village-constants";

import type { VillageDecisionEngine } from "../llm/village-decision-engine";

const SEEK_RADIUS = 5;

export class SocialSystem {
	decisionEngine: VillageDecisionEngine | null = null;

	constructor(
		private config: VillageConfig,
		private emitter: VillageEventEmitter,
	) {}

	tick(world: World<VillageEntity>, _currentTick: number): void {
		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;

			if (entity.social.interactionCooldown > 0) {
				entity.social.interactionCooldown--;
			}

			switch (entity.social.state) {
				case "idle":
					this.handleIdle(entity, world);
					break;
				case "wandering":
					this.handleWandering(entity);
					break;
				case "seeking":
					this.handleSeeking(entity, world);
					break;
				case "approaching":
					this.handleApproaching(entity, world);
					break;
				case "socializing":
					this.handleSocializing(entity, world, _currentTick);
					break;
				case "practicing":
					this.handlePracticing(entity);
					break;
				case "performing":
					this.handlePerforming(entity);
					break;
				case "watching":
					this.handleWatching(entity);
					break;
				case "jamming":
					this.handleJamming(entity);
					break;
				case "commissioning":
					this.handleCommissioning(entity);
					break;
				case "mourning":
					this.handleMourning(entity);
					break;
				case "pilgrim":
					// PilgrimageSystem handles movement; SocialSystem just skips
					break;
			}
		}
	}

	private handleIdle(
		entity: VillageEntity,
		world: World<VillageEntity>,
	): void {
		if (entity.identity.role === "maker") return;

		// Check for pending LLM decision first
		if (this.decisionEngine) {
			const pending = this.decisionEngine.consumeDecision(entity.id);
			if (pending) {
				this.applyIdleDecision(entity, pending.action, world);
				return;
			}
		}

		entity.social.idleTimer++;

		const threshold =
			IDLE_THRESHOLD_BASE * (1 - entity.personality.sociability * 0.5);
		if (entity.social.idleTimer < threshold) return;
		if (entity.social.interactionCooldown > 0) return;

		entity.social.idleTimer = 0;

		// If LLM enabled, fire async decision and wait
		if (this.decisionEngine?.enabled) {
			this.decisionEngine.requestIdleDecision(
				entity,
				world.entities,
				"normal", // TODO: read from season system
				world.entities.length,
				0,
			);
			return; // entity stays idle until response arrives
		}

		// Deterministic fallback (original probability rolls)
		this.rollIdleDecision(entity, world);
	}

	private rollIdleDecision(entity: VillageEntity, _world: World<VillageEntity>): void {
		const roll = Math.random();
		const hasSequences = entity.knowledge.knownSequences.size > 0;
		const canInvent = entity.knowledge.knownSequences.size >= 2;

		if (
			canInvent &&
			roll < entity.personality.creativity * INVENTION_BASE_PROBABILITY * 10
		) {
			entity.social.state = "inventing";
		} else if (hasSequences && roll < 0.2) {
			this.startPerforming(entity);
		} else if (roll < 0.6 + entity.personality.sociability * 0.3) {
			entity.social.state = "seeking";
		} else {
			this.startWandering(entity);
		}
	}

	private applyIdleDecision(entity: VillageEntity, action: string, _world: World<VillageEntity>): void {
		switch (action) {
			case "seek":
				entity.social.state = "seeking";
				break;
			case "perform":
				this.startPerforming(entity);
				break;
			case "invent":
				if (entity.knowledge.knownSequences.size >= 2) {
					entity.social.state = "inventing";
				} else {
					entity.social.state = "seeking"; // can't invent, seek instead
				}
				break;
			case "wander":
			default:
				this.startWandering(entity);
				break;
		}
	}

	private startPerforming(entity: VillageEntity): void {
		entity.social.state = "performing";
		entity.social.idleTimer = 0;
		const bestSeq = [...entity.knowledge.knownSequences.entries()]
			.sort((a, b) => b[1].proficiency - a[1].proficiency)[0];
		entity.social.performingSequenceId = bestSeq?.[0] ?? null;
	}

	private handleWandering(entity: VillageEntity): void {
		if (entity.transform.speed === 0) {
			entity.social.state = "idle";
			entity.social.idleTimer = 0;
		}
	}

	private handleSeeking(
		entity: VillageEntity,
		world: World<VillageEntity>,
	): void {
		const candidates = world.entities.filter(
			(other) =>
				other.id !== entity.id &&
				other.social.state === "seeking" &&
				other.social.interactionCooldown === 0 &&
				this.distance(entity, other) < SEEK_RADIUS,
		);

		if (candidates.length === 0) {
			this.startWandering(entity);
			return;
		}

		const partner = candidates.reduce((best, candidate) => {
			const novelty =
				this.countNovelSequences(entity, candidate) +
				this.countNovelSequences(candidate, entity);
			const bestNovelty =
				this.countNovelSequences(entity, best) +
				this.countNovelSequences(best, entity);
			if (novelty > bestNovelty) return candidate;
			if (
				novelty === bestNovelty &&
				this.distance(entity, candidate) < this.distance(entity, best)
			)
				return candidate;
			return best;
		});

		// Approach to conversation distance, not exact position.
		// Each avatar walks to a point PERSONAL_SPACE_RADIUS from the midpoint.
		const midX = (entity.transform.x + partner.transform.x) / 2;
		const midZ = (entity.transform.z + partner.transform.z) / 2;
		const pairDist = this.distance(entity, partner);
		const halfStop = PERSONAL_SPACE_RADIUS * 0.5;

		if (pairDist > PERSONAL_SPACE_RADIUS) {
			// Walk toward partner but stop at personal space
			const toPartnerX = partner.transform.x - entity.transform.x;
			const toPartnerZ = partner.transform.z - entity.transform.z;
			const norm = Math.sqrt(toPartnerX * toPartnerX + toPartnerZ * toPartnerZ) || 1;

			entity.social.state = "approaching";
			entity.social.partner = partner.id;
			entity.transform.targetX = midX - (toPartnerX / norm) * halfStop;
			entity.transform.targetZ = midZ - (toPartnerZ / norm) * halfStop;
			entity.transform.speed = 1;

			partner.social.state = "approaching";
			partner.social.partner = entity.id;
			partner.transform.targetX = midX + (toPartnerX / norm) * halfStop;
			partner.transform.targetZ = midZ + (toPartnerZ / norm) * halfStop;
			partner.transform.speed = 1;
		} else {
			// Already close enough - skip to interaction
			entity.social.state = "approaching";
			entity.social.partner = partner.id;
			entity.transform.speed = 0;

			partner.social.state = "approaching";
			partner.social.partner = entity.id;
			partner.transform.speed = 0;
		}
	}

	private handleApproaching(
		entity: VillageEntity,
		world: World<VillageEntity>,
	): void {
		if (entity.transform.speed > 0) return;

		const partner = world.entities.find(
			(e) => e.id === entity.social.partner,
		);
		if (!partner || partner.social.state === "passing") {
			entity.social.state = "idle";
			entity.social.partner = null;
			return;
		}

		if (partner.transform.speed > 0) return;

		const entityCanTeach =
			this.countNovelSequences(partner, entity) > 0;
		const partnerCanTeach =
			this.countNovelSequences(entity, partner) > 0;

		if (entityCanTeach || partnerCanTeach) {
			const teacher =
				entityCanTeach &&
				(!partnerCanTeach ||
					entity.knowledge.knownSequences.size >=
						partner.knowledge.knownSequences.size)
					? entity
					: partner;
			const learner = teacher === entity ? partner : entity;

			// Ego gates: divas never teach, high-ego demands hierarchy
			if (teacher.personality.ego > 0.9) {
				// Diva mode: skip teaching, just socialize
				entity.social.state = "socializing";
				partner.social.state = "socializing";
				entity.social.idleTimer = 0;
				partner.social.idleTimer = 0;
				return;
			}
			if (
				teacher.personality.ego > 0.7 &&
				learner.knowledge.knownSequences.size >= teacher.knowledge.knownSequences.size
			) {
				// Ego demands hierarchy: won't teach someone who knows as much
				entity.social.state = "socializing";
				partner.social.state = "socializing";
				entity.social.idleTimer = 0;
				partner.social.idleTimer = 0;
				return;
			}

			// Style compatibility gate
			const styleDist = this.styleDistance(teacher, learner);
			if (
				styleDist > STYLE_INCOMPATIBILITY_THRESHOLD &&
				Math.random() < STYLE_INCOMPATIBILITY_REFUSE_CHANCE
			) {
				entity.social.state = "socializing";
				partner.social.state = "socializing";
				entity.social.idleTimer = 0;
				partner.social.idleTimer = 0;
				return;
			}

			const novelSequenceId = this.findNovelSequenceId(learner, teacher);
			if (novelSequenceId) {
				teacher.social.state = "teaching";
				learner.social.state = "learning";
				teacher.social.sequenceBeingTransferred = novelSequenceId;
				learner.social.sequenceBeingTransferred = novelSequenceId;
				teacher.social.teachingProgress = 0;
				learner.social.teachingProgress = 0;
				learner.social.currentStepIndex = 0;
				learner.social.frustrationLevel = 0;

				teacher.transform.facingAngle = Math.atan2(
					learner.transform.z - teacher.transform.z,
					learner.transform.x - teacher.transform.x,
				);
				learner.transform.facingAngle = Math.atan2(
					teacher.transform.z - learner.transform.z,
					teacher.transform.x - learner.transform.x,
				);
				return;
			}
		}

		entity.social.state = "socializing";
		partner.social.state = "socializing";
		entity.social.idleTimer = 0;
		partner.social.idleTimer = 0;
	}

	private handleSocializing(
		entity: VillageEntity,
		world: World<VillageEntity>,
		currentTick: number,
	): void {
		entity.social.idleTimer++;

		// Gift check: high-sociability entities can spontaneously gift a sequence
		if (entity.personality.sociability > 0.8 && entity.social.partner) {
			const partner = world.entities.find((e) => e.id === entity.social.partner);
			if (partner && Math.random() < entity.personality.sociability * 0.03) {
				const giftable = this.findGiftableSequence(entity, partner);
				if (giftable) {
					partner.knowledge.knownSequences.set(giftable.sequenceId, {
						...giftable,
						proficiency: giftable.proficiency * 0.4,
						source: "gifted",
						learnedFrom: entity.id,
						learnedAt: currentTick,
						lineage: [...giftable.lineage, entity.id],
						lastUsedTick: currentTick,
						style: { amplitudeScale: 1.0, tempoOffset: 0 },
					});
					this.emitter.emit("teaching:completed", entity, partner, giftable.sequenceId);
				}
			}
		}

		if (entity.social.idleTimer > 15) {
			entity.social.state = "idle";
			entity.social.partner = null;
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
	}

	private findGiftableSequence(
		gifter: VillageEntity,
		receiver: VillageEntity,
	): LearnedSequence | null {
		for (const [id, seq] of gifter.knowledge.knownSequences) {
			if (!receiver.knowledge.knownSequences.has(id)) return seq;
		}
		return null;
	}

	private handlePracticing(entity: VillageEntity): void {
		entity.social.idleTimer++;
		if (entity.social.idleTimer > 20) {
			entity.social.state = "idle";
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
	}

	private handlePerforming(entity: VillageEntity): void {
		if (entity.social.inJam) return; // jam system manages duration
		entity.social.idleTimer++;
		const maxDuration = entity.lifecycle.phase === "elder" ? 40 : 25;
		if (entity.social.idleTimer > maxDuration) {
			entity.social.state = "idle";
			entity.social.performingSequenceId = null;
			entity.social.idleTimer = 0;
		}
	}

	private handleWatching(entity: VillageEntity): void {
		// Watchers stay put until the performer they're watching stops
		entity.social.idleTimer++;
		if (entity.social.idleTimer > 50) {
			entity.social.state = "idle";
			entity.social.partner = null;
			entity.social.idleTimer = 0;
		}
	}

	private handleJamming(entity: VillageEntity): void {
		// Jam watchers stay in place; PerformanceSystem manages exit
		entity.social.idleTimer++;
	}

	private handleMourning(entity: VillageEntity): void {
		entity.social.idleTimer++;
		if (entity.social.idleTimer > MOURNING_DURATION) {
			entity.social.state = "idle";
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
	}

	private handleCommissioning(entity: VillageEntity): void {
		entity.social.idleTimer++;
		if (entity.social.idleTimer > MAKER_CRAFT_DURATION) {
			entity.social.state = "idle";
			entity.social.partner = null;
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
	}

	private startWandering(entity: VillageEntity): void {
		const angle = Math.random() * Math.PI * 2;
		const dist = Math.random() * this.config.arenaRadius * 0.6;
		entity.transform.targetX = Math.cos(angle) * dist;
		entity.transform.targetZ = Math.sin(angle) * dist;
		entity.transform.speed = 1;
		entity.social.state = "wandering";
	}

	private getAverageStyle(entity: VillageEntity): {
		amplitudeScale: number;
		tempoOffset: number;
	} {
		const sequences = [...entity.knowledge.knownSequences.values()];
		if (sequences.length === 0) return { amplitudeScale: 1.0, tempoOffset: 0 };
		let ampSum = 0;
		let tempoSum = 0;
		for (const seq of sequences) {
			ampSum += seq.style.amplitudeScale;
			tempoSum += seq.style.tempoOffset;
		}
		return {
			amplitudeScale: ampSum / sequences.length,
			tempoOffset: tempoSum / sequences.length,
		};
	}

	private styleDistance(a: VillageEntity, b: VillageEntity): number {
		const styleA = this.getAverageStyle(a);
		const styleB = this.getAverageStyle(b);
		const dAmp = styleA.amplitudeScale - styleB.amplitudeScale;
		const dTempo = styleA.tempoOffset - styleB.tempoOffset;
		return Math.sqrt(dAmp * dAmp + dTempo * dTempo);
	}

	private distance(a: VillageEntity, b: VillageEntity): number {
		const dx = a.transform.x - b.transform.x;
		const dz = a.transform.z - b.transform.z;
		return Math.sqrt(dx * dx + dz * dz);
	}

	private countNovelSequences(
		learner: VillageEntity,
		teacher: VillageEntity,
	): number {
		let count = 0;
		for (const id of teacher.knowledge.knownSequences.keys()) {
			if (!learner.knowledge.knownSequences.has(id)) count++;
		}
		return count;
	}

	private findNovelSequenceId(
		learner: VillageEntity,
		teacher: VillageEntity,
	): string | null {
		for (const id of teacher.knowledge.knownSequences.keys()) {
			if (!learner.knowledge.knownSequences.has(id)) return id;
		}
		return null;
	}
}
