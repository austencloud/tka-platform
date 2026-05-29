import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";

export class LifecycleSystem {
	constructor(private config: VillageConfig) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;

			const elapsed = currentTick - entity.lifecycle.birthTick;
			entity.lifecycle.currentAge = Math.min(
				1,
				elapsed / entity.lifecycle.lifespan,
			);

			const { youthPhaseRatio, adultPhaseRatio } = this.config;
			const adultThreshold = youthPhaseRatio;
			const elderThreshold = youthPhaseRatio + adultPhaseRatio;

			if (entity.lifecycle.currentAge < adultThreshold) {
				entity.lifecycle.phase = "youth";
			} else if (entity.lifecycle.currentAge < elderThreshold) {
				entity.lifecycle.phase = "adult";
			} else {
				entity.lifecycle.phase = "elder";
			}

			// Natural ego decay: humility through aging
			entity.personality.ego = Math.max(0, entity.personality.ego - 0.002);

			// Knowledge glow: 0-1 based on sequences known vs capacity
			entity.lifecycle.knowledgeGlow = Math.min(
				1,
				entity.knowledge.knownSequences.size /
					Math.max(1, entity.knowledge.maxCapacity),
			);

			// Death
			if (elapsed >= entity.lifecycle.lifespan) {
				entity.social.state = "passing";
				entity.social.partner = null;
			}
		}
	}
}
