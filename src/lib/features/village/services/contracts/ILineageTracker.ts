import type { PopulationStats, VillageEntity } from "../../domain/village-types";

export interface ILineageTracker {
	recordBirth(entity: VillageEntity): void;
	recordDeath(entity: VillageEntity): void;
	recordSequenceLearned(entityId: string, sequenceId: string): void;
	recordSequenceInvented(entityId: string, sequenceId: string): void;
	getStats(entities: VillageEntity[], generation: number): PopulationStats;
	getSequenceLineage(sequenceId: string): string[];
	getAllKnownSequenceIds(): Set<string>;
}
