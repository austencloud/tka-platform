import type { World } from "miniplex";
import type { VillageEntity, LifecyclePhase } from "../../domain/village-types";
import type { VillageConfig } from "../village-config";
import {
	WALK_SPEED_YOUTH,
	WALK_SPEED_ADULT,
	WALK_SPEED_ELDER,
	ARRIVAL_THRESHOLD,
	COLLISION_AVOIDANCE_RADIUS,
	COLLISION_REPULSION_STRENGTH,
} from "../../domain/village-constants";

const PHASE_SPEED: Record<LifecyclePhase, number> = {
	youth: WALK_SPEED_YOUTH,
	adult: WALK_SPEED_ADULT,
	elder: WALK_SPEED_ELDER,
};

export class MovementSystem {
	constructor(private config: VillageConfig) {}

	tick(world: World<VillageEntity>): void {
		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;
			if (entity.transform.speed === 0) continue;

			const dx = entity.transform.targetX - entity.transform.x;
			const dz = entity.transform.targetZ - entity.transform.z;
			const dist = Math.sqrt(dx * dx + dz * dz);

			if (dist < ARRIVAL_THRESHOLD) {
				entity.transform.speed = 0;
				continue;
			}

			const nx = dx / dist;
			const nz = dz / dist;

			// Collision avoidance - steer away from nearby avatars
			let steerX = 0;
			let steerZ = 0;
			for (const other of world.entities) {
				if (other.id === entity.id) continue;
				const ox = entity.transform.x - other.transform.x;
				const oz = entity.transform.z - other.transform.z;
				const oDist = Math.sqrt(ox * ox + oz * oz);
				if (oDist < COLLISION_AVOIDANCE_RADIUS && oDist > 0.01) {
					// Repulsion increases sharply as distance decreases
					const overlap =
						(COLLISION_AVOIDANCE_RADIUS - oDist) /
						COLLISION_AVOIDANCE_RADIUS;
					const force = overlap * overlap * COLLISION_REPULSION_STRENGTH;
					steerX += (ox / oDist) * force;
					steerZ += (oz / oDist) * force;
				}
			}

			const moveX = nx + steerX;
			const moveZ = nz + steerZ;
			const moveMag = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

			const phaseSpeed = PHASE_SPEED[entity.lifecycle.phase];
			// 0.3 per tick base step (3x previous 0.1) for natural walking pace
			const step = entity.transform.speed * phaseSpeed * 0.3;

			entity.transform.x += (moveX / moveMag) * step;
			entity.transform.z += (moveZ / moveMag) * step;

			// Arena bounds clamping
			const currentDist = Math.sqrt(
				entity.transform.x ** 2 + entity.transform.z ** 2,
			);
			if (currentDist > this.config.arenaRadius) {
				const scale = this.config.arenaRadius / currentDist;
				entity.transform.x *= scale;
				entity.transform.z *= scale;
			}
		}
	}
}
