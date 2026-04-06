import type { VillageEventMap, VillageEventKey } from "../domain/village-types";

export interface VillageEventEmitter {
	emit<K extends VillageEventKey>(
		event: K,
		...args: Parameters<VillageEventMap[K]>
	): void;
	on<K extends VillageEventKey>(
		event: K,
		handler: VillageEventMap[K],
	): void;
}
