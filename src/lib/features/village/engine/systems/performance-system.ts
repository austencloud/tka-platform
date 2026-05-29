import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	PERFORMANCE_ATTRACTION_RADIUS,
	JAM_WATCHER_THRESHOLD,
	CREATIVITY_JAM_BOOST,
	INTERACTION_COOLDOWN_BASE,
} from "../../domain/village-constants";

interface JamCircle {
	centerX: number;
	centerZ: number;
	formedAtTick: number;
	performerIds: Set<string>;
}

export class PerformanceSystem {
	activeJams: JamCircle[] = [];

	constructor(
		private config: VillageConfig,
		private emitter: VillageEventEmitter,
	) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		this.attractWatchers(world);
		this.escalateToJam(world, currentTick);
		this.dissolveJams(world);
		this.applyJamBonuses(world, currentTick);
	}

	private attractWatchers(world: World<VillageEntity>): void {
		for (const performer of world.entities) {
			if (performer.social.state !== "performing") continue;

			for (const candidate of world.entities) {
				if (candidate.id === performer.id) continue;
				if (candidate.social.state !== "idle") continue;
				if (candidate.personality.curiosity < 0.3) continue;

				const dist = this.distance(candidate, performer);
				if (dist > PERFORMANCE_ATTRACTION_RADIUS) continue;

				candidate.social.state = "watching";
				candidate.social.partner = performer.id;
				candidate.transform.targetX = candidate.transform.x;
				candidate.transform.targetZ = candidate.transform.z;
				candidate.transform.speed = 0;
				candidate.transform.facingAngle = Math.atan2(
					performer.transform.z - candidate.transform.z,
					performer.transform.x - candidate.transform.x,
				);
			}
		}
	}

	private escalateToJam(
		world: World<VillageEntity>,
		currentTick: number,
	): void {
		const soloPerformers = world.entities.filter(
			(e) => e.social.state === "performing" && !e.social.inJam,
		);

		for (const performer of soloPerformers) {
			const watchers = world.entities.filter(
				(e) =>
					e.social.state === "watching" &&
					e.social.partner === performer.id,
			);

			if (watchers.length >= JAM_WATCHER_THRESHOLD) {
				const jam: JamCircle = {
					centerX: performer.transform.x,
					centerZ: performer.transform.z,
					formedAtTick: currentTick,
					performerIds: new Set([performer.id]),
				};

				performer.social.inJam = true;

				for (const watcher of watchers) {
					const creativityBoosted =
						watcher.personality.creativity + CREATIVITY_JAM_BOOST;
					if (
						creativityBoosted > 0.7 &&
						watcher.knowledge.knownSequences.size > 0
					) {
						watcher.social.state = "performing";
						watcher.social.inJam = true;
						watcher.social.performingSequenceId =
							this.pickBestSequence(watcher);
						jam.performerIds.add(watcher.id);
					} else {
						watcher.social.state = "jamming";
					}
				}

				this.activeJams.push(jam);
				this.emitter.emit(
					"jam:formed",
					world.entities.filter((e) => jam.performerIds.has(e.id)),
					{ x: jam.centerX, z: jam.centerZ },
				);
			}
		}
	}

	private dissolveJams(world: World<VillageEntity>): void {
		this.activeJams = this.activeJams.filter((jam) => {
			const performers = world.entities.filter(
				(e) =>
					jam.performerIds.has(e.id) &&
					e.social.state === "performing",
			);
			const allParticipants = world.entities.filter(
				(e) =>
					jam.performerIds.has(e.id) ||
					e.social.state === "jamming" ||
					e.social.state === "watching",
			);

			if (performers.length < 2 || allParticipants.length < 4) {
				for (const entity of world.entities) {
					if (entity.social.inJam) {
						entity.social.inJam = false;
						entity.social.state = "idle";
						entity.social.performingSequenceId = null;
						entity.social.idleTimer = 0;
						entity.social.interactionCooldown =
							INTERACTION_COOLDOWN_BASE;
					}
				}
				this.emitter.emit("jam:dissolved", {
					x: jam.centerX,
					z: jam.centerZ,
				});
				return false;
			}
			return true;
		});
	}

	private applyJamBonuses(
		world: World<VillageEntity>,
		currentTick: number,
	): void {
		for (const entity of world.entities) {
			if (!entity.social.inJam) continue;

			if (
				entity.social.state === "performing" &&
				entity.social.performingSequenceId
			) {
				const seq = entity.knowledge.knownSequences.get(
					entity.social.performingSequenceId,
				);
				if (seq) {
					seq.proficiency = Math.min(1, seq.proficiency + 0.01);
					seq.lastUsedTick = currentTick;
				}
			}
		}
	}

	private pickBestSequence(entity: VillageEntity): string | null {
		let best: [string, number] | null = null;
		for (const [id, seq] of entity.knowledge.knownSequences) {
			if (!best || seq.proficiency > best[1]) best = [id, seq.proficiency];
		}
		return best?.[0] ?? null;
	}

	private distance(a: VillageEntity, b: VillageEntity): number {
		const dx = a.transform.x - b.transform.x;
		const dz = a.transform.z - b.transform.z;
		return Math.sqrt(dx * dx + dz * dz);
	}
}
