import type { World } from "miniplex";
import type { VillageEntity, StyleSchool } from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	STYLE_SIMILARITY_THRESHOLD,
	STYLE_SCHOOL_MIN_MEMBERS,
} from "../../domain/village-constants";

export class StyleDriftSystem {
	schools: StyleSchool[] = [];

	constructor(private emitter: VillageEventEmitter) {}

	tick(world: World<VillageEntity>, _currentTick: number): void {
		// Compute average style per entity from all their known sequences
		const entityStyles = new Map<
			string,
			{ amplitudeScale: number; tempoOffset: number }
		>();

		for (const entity of world.entities) {
			if (entity.social.state === "passing") continue;
			if (entity.knowledge.knownSequences.size === 0) continue;

			let ampSum = 0;
			let tempoSum = 0;
			let count = 0;
			for (const seq of entity.knowledge.knownSequences.values()) {
				ampSum += seq.style.amplitudeScale;
				tempoSum += seq.style.tempoOffset;
				count++;
			}
			entityStyles.set(entity.id, {
				amplitudeScale: ampSum / count,
				tempoOffset: tempoSum / count,
			});
		}

		// Greedy pivot-based clustering: pick an unassigned entity as pivot,
		// gather all unassigned entities within STYLE_SIMILARITY_THRESHOLD,
		// form a school if the cluster has enough members.
		// PERF NOTE: O(N²) clustering rebuilt every tick (sqrt per style pair), no
		// caching or change detection. Benign at the design targetPopulation (~6);
		// a spatial partition / delta tracking is the fix if population grows. Out
		// of audit scope.
		const assigned = new Set<string>();
		const newSchools: StyleSchool[] = [];

		const entityIds = [...entityStyles.keys()];
		for (let i = 0; i < entityIds.length; i++) {
			const pivotId = entityIds[i];
			if (!pivotId) continue;
			if (assigned.has(pivotId)) continue;

			const cluster = new Set<string>([pivotId]);
			const pivot = entityStyles.get(pivotId)!;

			for (let j = i + 1; j < entityIds.length; j++) {
				const otherId = entityIds[j];
				if (!otherId) continue;
				if (assigned.has(otherId)) continue;
				const other = entityStyles.get(otherId)!;
				const dAmp = pivot.amplitudeScale - other.amplitudeScale;
				const dTempo = pivot.tempoOffset - other.tempoOffset;
				const dist = Math.sqrt(dAmp * dAmp + dTempo * dTempo);
				if (dist < STYLE_SIMILARITY_THRESHOLD) {
					cluster.add(otherId);
				}
			}

			if (cluster.size >= STYLE_SCHOOL_MIN_MEMBERS) {
				for (const id of cluster) assigned.add(id);

				const colorHue = this.hashToHue(pivotId);
				const school: StyleSchool = {
					id: pivotId,
					color: `hsl(${colorHue}, 60%, 50%)`,
					memberIds: cluster,
				};
				newSchools.push(school);
			}
		}

		// Emit events for newly formed and dissolved schools
		const oldSchoolIds = new Set(this.schools.map((s) => s.id));
		const newSchoolIds = new Set(newSchools.map((s) => s.id));

		for (const school of newSchools) {
			if (!oldSchoolIds.has(school.id)) {
				this.emitter.emit("school:formed", school);
			}
		}
		for (const school of this.schools) {
			if (!newSchoolIds.has(school.id)) {
				this.emitter.emit("school:dissolved", school.id);
			}
		}

		this.schools = newSchools;
	}

	getSchoolForEntity(entityId: string): StyleSchool | null {
		return this.schools.find((s) => s.memberIds.has(entityId)) ?? null;
	}

	private hashToHue(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
		}
		return Math.abs(hash) % 360;
	}
}
