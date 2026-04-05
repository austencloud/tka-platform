import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import {
	IDLE_THRESHOLD_BASE,
	INTERACTION_COOLDOWN_BASE,
	INVENTION_BASE_PROBABILITY,
	PERSONAL_SPACE_RADIUS,
} from "../../domain/village-constants";

const SEEK_RADIUS = 5;

export class SocialSystem {
	constructor(private config: VillageConfig) {}

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
					this.handleSocializing(entity);
					break;
				case "practicing":
					this.handlePracticing(entity);
					break;
				case "performing":
					this.handlePerforming(entity);
					break;
			}
		}
	}

	private handleIdle(
		entity: VillageEntity,
		world: World<VillageEntity>,
	): void {
		entity.social.idleTimer++;

		const threshold =
			IDLE_THRESHOLD_BASE * (1 - entity.personality.sociability * 0.5);
		if (entity.social.idleTimer < threshold) return;
		if (entity.social.interactionCooldown > 0) return;

		entity.social.idleTimer = 0;

		const roll = Math.random();
		const hasSequences = entity.knowledge.knownSequences.size > 0;
		const canInvent = entity.knowledge.knownSequences.size >= 2;

		if (
			canInvent &&
			roll < entity.personality.creativity * INVENTION_BASE_PROBABILITY * 10
		) {
			entity.social.state = "inventing";
		} else if (hasSequences && roll < 0.2) {
			entity.social.state = "performing";
			entity.social.idleTimer = 0;
		} else if (roll < 0.6 + entity.personality.sociability * 0.3) {
			entity.social.state = "seeking";
		} else {
			this.startWandering(entity);
		}
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
			// Already close enough — skip to interaction
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

			const novelSequenceId = this.findNovelSequenceId(learner, teacher);
			if (novelSequenceId) {
				teacher.social.state = "teaching";
				learner.social.state = "learning";
				teacher.social.sequenceBeingTransferred = novelSequenceId;
				learner.social.sequenceBeingTransferred = novelSequenceId;
				teacher.social.teachingProgress = 0;
				learner.social.teachingProgress = 0;
				learner.social.currentBeatIndex = 0;
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

	private handleSocializing(entity: VillageEntity): void {
		entity.social.idleTimer++;
		if (entity.social.idleTimer > 15) {
			entity.social.state = "idle";
			entity.social.partner = null;
			entity.social.idleTimer = 0;
			entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
		}
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
		entity.social.idleTimer++;
		const maxDuration = entity.lifecycle.phase === "elder" ? 40 : 25;
		if (entity.social.idleTimer > maxDuration) {
			entity.social.state = "idle";
			entity.social.idleTimer = 0;
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
