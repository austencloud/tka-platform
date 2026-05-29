import type { World } from "miniplex";
import type { VillageEntity, Season } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import type { VillageEventEmitter } from "../village-event-emitter";
import { SEASON_DURATION, SEASON_CYCLE } from "../../domain/village-constants";

export class SeasonSystem {
	currentSeason: Season = "normal";
	private seasonIndex = 0;
	private ticksInSeason = 0;

	constructor(
		private config: VillageConfig,
		private emitter: VillageEventEmitter,
	) {}

	tick(world: World<VillageEntity>, _currentTick: number): void {
		this.ticksInSeason++;

		if (this.ticksInSeason >= SEASON_DURATION) {
			this.ticksInSeason = 0;
			this.seasonIndex = (this.seasonIndex + 1) % SEASON_CYCLE.length;
			this.currentSeason = SEASON_CYCLE[this.seasonIndex]!;
			this.emitter.emit("season:changed", this.currentSeason);
			this.applySeasonEffects(world);
		}
	}

	private applySeasonEffects(world: World<VillageEntity>): void {
		switch (this.currentSeason) {
			case "migration": {
				const entities = world.entities.filter(
					(e) => e.social.state !== "passing" && e.identity.role !== "maker",
				);
				const toRelocate = entities.slice(0, Math.floor(entities.length / 2));
				for (const entity of toRelocate) {
					const angle = Math.random() * Math.PI * 2;
					const dist = Math.random() * this.config.arenaRadius * 0.8;
					entity.transform.targetX = Math.cos(angle) * dist;
					entity.transform.targetZ = Math.sin(angle) * dist;
					entity.transform.speed = 1.5;
					entity.social.state = "wandering";
				}
				break;
			}
		}
	}

	getInventionRateMultiplier(): number {
		return this.currentSeason === "festival" ? 3.0 : 1.0;
	}

	getSpeedMultiplier(): number {
		return this.currentSeason === "winter" ? 0.6 : 1.0;
	}

	getInteractionRadiusMultiplier(): number {
		return this.currentSeason === "winter" ? 0.7 : 1.0;
	}
}
