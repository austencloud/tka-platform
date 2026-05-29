/**
 * Per-entity event history for LLM prompt context.
 * Without social memory, every LLM decision is amnesiac.
 * With it, entities remember who taught them, who refused them, who died.
 */
export class VillageEventLog {
	private logs = new Map<string, string[]>();
	private maxEventsPerEntity = 10;

	addEvent(entityId: string, description: string): void {
		if (!this.logs.has(entityId)) {
			this.logs.set(entityId, []);
		}
		const log = this.logs.get(entityId)!;
		log.push(description);
		if (log.length > this.maxEventsPerEntity) {
			log.shift();
		}
	}

	getEvents(entityId: string): string[] {
		return this.logs.get(entityId) ?? [];
	}

	removeEntity(entityId: string): void {
		this.logs.delete(entityId);
	}

	clear(): void {
		this.logs.clear();
	}
}
