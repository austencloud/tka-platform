import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { IPersonalityGenerator } from "../../services/contracts/IPersonalityGenerator";
import type { ILineageTracker } from "../../services/contracts/ILineageTracker";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import { createAvatarEntity } from "../VillageWorld";
import {
	AVATAR_NAMES,
	PASSING_DURATION_TICKS,
} from "../../domain/village-constants";

export class PopulationSystem {
	private generation = 1;
	private nameIndex = 0;

	constructor(
		private config: VillageConfig,
		private personalityGenerator: IPersonalityGenerator,
		private lineageTracker: ILineageTracker,
		private emitter: VillageEventEmitter,
	) {}

	get currentGeneration(): number {
		return this.generation;
	}

	tick(world: World<VillageEntity>, currentTick: number): void {
		// Process passing entities
		const toRemove: VillageEntity[] = [];
		for (const entity of world.entities) {
			if (entity.social.state === "passing") {
				entity.social.idleTimer++;
				if (entity.social.idleTimer > PASSING_DURATION_TICKS) {
					toRemove.push(entity);
				}
			}
		}

		if (toRemove.length > 0) {
			// Deaths mean the next generation has arrived
			this.generation++;
			this.emitter.emit("generation:changed", this.generation);
		}

		for (const entity of toRemove) {
			this.lineageTracker.recordDeath(entity);
			this.emitter.emit("entity:died", entity);
			world.remove(entity);
		}

		// Spawn replacements as new generation
		while (world.entities.length < this.config.targetPopulation) {
			const name =
				AVATAR_NAMES[this.nameIndex % AVATAR_NAMES.length] ?? "Unknown";
			this.nameIndex++;

			const newEntity = createAvatarEntity(world, {
				name,
				generation: this.generation,
				currentTick,
				lifespanTicks: this.config.lifespanTicks,
				arenaRadius: this.config.arenaRadius,
				personalityGenerator: this.personalityGenerator,
				traitMean: this.config.traitDistribution.mean,
				traitStdDev: this.config.traitDistribution.stdDev,
			});

			this.lineageTracker.recordBirth(newEntity);
			this.emitter.emit("entity:born", newEntity);
		}
	}

	incrementGeneration(): void {
		this.generation++;
	}
}
