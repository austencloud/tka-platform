import type { World } from "miniplex";
import type { VillageEntity, EffectCircle, EffectAffinity } from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import { CIRCLE_RADIUS, CIRCLE_MIN_MEMBERS } from "../../domain/village-constants";

export class CircleSystem {
	circles: EffectCircle[] = [];

	constructor(private emitter: VillageEventEmitter) {}

	tick(world: World<VillageEntity>, currentTick: number): void {
		const performersByAffinity = new Map<EffectAffinity, VillageEntity[]>();

		for (const entity of world.entities) {
			const isPerforming =
				entity.social.state === "performing" ||
				entity.social.state === "practicing" ||
				entity.social.state === "jamming";
			if (!isPerforming) continue;

			const affinity = entity.effect.affinity;
			if (!performersByAffinity.has(affinity)) performersByAffinity.set(affinity, []);
			performersByAffinity.get(affinity)!.push(entity);
		}

		const newCircles: EffectCircle[] = [];

		// PERF NOTE: O(N²) clustering rebuilt every tick (sqrt per performer pair),
		// no delta tracking. Benign at the design targetPopulation (~6); a spatial
		// partition / change detection is the fix if population grows. Out of audit scope.
		for (const [affinity, performers] of performersByAffinity) {
			const assigned = new Set<string>();

			for (let i = 0; i < performers.length; i++) {
				const pivot = performers[i];
				if (!pivot) continue;
				if (assigned.has(pivot.id)) continue;
				const cluster = new Set<string>([pivot.id]);

				for (let j = 0; j < performers.length; j++) {
					const other = performers[j];
					if (!other) continue;
					if (i === j || assigned.has(other.id)) continue;
					const dx = pivot.transform.x - other.transform.x;
					const dz = pivot.transform.z - other.transform.z;
					if (Math.sqrt(dx * dx + dz * dz) <= CIRCLE_RADIUS) {
						cluster.add(other.id);
					}
				}

				if (cluster.size >= CIRCLE_MIN_MEMBERS) {
					for (const id of cluster) assigned.add(id);

					let cx = 0,
						cz = 0;
					for (const id of cluster) {
						const e = performers.find((p) => p.id === id)!;
						cx += e.transform.x;
						cz += e.transform.z;
					}
					cx /= cluster.size;
					cz /= cluster.size;

					newCircles.push({
						id: `circle-${affinity}-${currentTick}-${i}`,
						affinity,
						centerX: cx,
						centerZ: cz,
						radius: CIRCLE_RADIUS,
						memberIds: cluster,
						formedAtTick: currentTick,
					});
				}
			}
		}

		// Emit events for genuinely new circles
		for (const circle of newCircles) {
			const continued = this.circles.some(
				(old) =>
					old.affinity === circle.affinity &&
					Math.abs(old.centerX - circle.centerX) < CIRCLE_RADIUS &&
					Math.abs(old.centerZ - circle.centerZ) < CIRCLE_RADIUS,
			);
			if (!continued) {
				this.emitter.emit("circle:formed", circle);
			}
		}

		// Emit events for dissolved circles
		for (const old of this.circles) {
			const stillExists = newCircles.some(
				(n) =>
					n.affinity === old.affinity &&
					Math.abs(n.centerX - old.centerX) < CIRCLE_RADIUS &&
					Math.abs(n.centerZ - old.centerZ) < CIRCLE_RADIUS,
			);
			if (!stillExists) {
				this.emitter.emit("circle:dissolved", old.id);
			}
		}

		this.circles = newCircles;
	}
}
