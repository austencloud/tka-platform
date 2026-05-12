import type { PopulationStats, VillageEntity } from "../domain/village-types";

export class LineageTracker {
	private everKnownSequences = new Set<string>();
	private sequenceTransmissions = new Map<string, string[]>();

	recordBirth(entity: VillageEntity): void {
		for (const id of entity.knowledge.knownSequences.keys()) {
			this.everKnownSequences.add(id);
		}
	}

	recordDeath(_entity: VillageEntity): void {
		// Death recorded for future analytics
	}

	recordSequenceLearned(entityId: string, sequenceId: string): void {
		this.everKnownSequences.add(sequenceId);
		const chain = this.sequenceTransmissions.get(sequenceId) ?? [];
		chain.push(entityId);
		this.sequenceTransmissions.set(sequenceId, chain);
	}

	recordSequenceInvented(entityId: string, sequenceId: string): void {
		this.everKnownSequences.add(sequenceId);
		this.sequenceTransmissions.set(sequenceId, [entityId]);
	}

	getStats(entities: VillageEntity[], generation: number): PopulationStats {
		const alive = entities.length;
		const totalAge = entities.reduce(
			(sum, e) => sum + e.lifecycle.currentAge,
			0,
		);
		const currentlyKnown = new Set<string>();
		let totalKnowledge = 0;

		for (const entity of entities) {
			totalKnowledge += entity.knowledge.knownSequences.size;
			for (const id of entity.knowledge.knownSequences.keys()) {
				currentlyKnown.add(id);
			}
		}

		let extinctionCount = 0;
		for (const id of this.everKnownSequences) {
			if (!currentlyKnown.has(id)) extinctionCount++;
		}

		return {
			alive,
			averageAge: alive > 0 ? totalAge / alive : 0,
			totalKnowledge,
			uniqueSequences: currentlyKnown.size,
			extinctionCount,
			currentGeneration: generation,
		};
	}

	getSequenceLineage(sequenceId: string): string[] {
		return this.sequenceTransmissions.get(sequenceId) ?? [];
	}

	getAllKnownSequenceIds(): Set<string> {
		return new Set(this.everKnownSequences);
	}
}
