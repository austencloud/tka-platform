import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import { MONUMENT_GENERATION_THRESHOLD } from "../../domain/village-constants";

export interface Monument {
	sequenceId: string;
	worldX: number;
	worldZ: number;
	createdAtTick: number;
	inventedByName: string;
	inventedByGeneration: number;
	cohortsSurvived: Set<number>;
	extinctAtTick: number | null;
}

export class MonumentSystem {
	monuments: Monument[] = [];
	private sequenceOrigins = new Map<
		string,
		{ x: number; z: number; name: string; generation: number }
	>();

	constructor(private emitter: VillageEventEmitter) {
		this.emitter.on("sequence:invented", (inventor, seqId) => {
			this.sequenceOrigins.set(seqId, {
				x: inventor.transform.x,
				z: inventor.transform.z,
				name: inventor.identity.name,
				generation: inventor.identity.generation,
			});
		});
	}

	tick(world: World<VillageEntity>, currentTick: number): void {
		// Collect which cohorts carry each sequence
		const sequenceCohorts = new Map<string, Set<number>>();
		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;
			for (const seqId of entity.knowledge.knownSequences.keys()) {
				if (!sequenceCohorts.has(seqId))
					sequenceCohorts.set(seqId, new Set());
				sequenceCohorts.get(seqId)!.add(entity.identity.generation);
			}
		}

		// Check for new monuments
		for (const [seqId, cohorts] of sequenceCohorts) {
			const existing = this.monuments.find(
				(m) => m.sequenceId === seqId,
			);
			if (existing) {
				for (const c of cohorts) existing.cohortsSurvived.add(c);
				// Relight if previously extinct
				if (existing.extinctAtTick !== null) {
					existing.extinctAtTick = null;
					this.emitter.emit("monument:relit", seqId);
				}
			} else if (cohorts.size >= MONUMENT_GENERATION_THRESHOLD) {
				const origin = this.sequenceOrigins.get(seqId);
				if (origin) {
					const monument: Monument = {
						sequenceId: seqId,
						worldX: origin.x,
						worldZ: origin.z,
						createdAtTick: currentTick,
						inventedByName: origin.name,
						inventedByGeneration: origin.generation,
						cohortsSurvived: new Set(cohorts),
						extinctAtTick: null,
					};
					this.monuments.push(monument);
					this.emitter.emit(
						"monument:placed",
						seqId,
						origin.x,
						origin.z,
					);
				}
			}
		}

		// Check for extinctions on existing monuments
		for (const monument of this.monuments) {
			if (monument.extinctAtTick !== null) continue;
			if (!sequenceCohorts.has(monument.sequenceId)) {
				monument.extinctAtTick = currentTick;
				this.emitter.emit("monument:dimmed", monument.sequenceId);
			}
		}
	}
}
