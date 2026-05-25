import type { CollectedMandala } from "../domain/mandala-collection-types";
import { LocalMandalaCollectionRepository } from "../services/LocalMandalaCollectionRepository";
import { loadMandalas, saveMandala, removeMandala } from "../services/FirebaseMandalaCollectionRepository";

const localRepo = new LocalMandalaCollectionRepository();

class MandalaCollectionState {
	collection = $state<CollectedMandala[]>([]);
	private userId: string | null = null;
	private initialized = false;

	async init(userId: string): Promise<void> {
		this.userId = userId;

		const firebaseEntries = await loadMandalas(userId);
		this.collection = firebaseEntries;

		await this.migrateFromLocalStorage(userId, firebaseEntries);
		this.initialized = true;
	}

	teardown(): void {
		this.collection = [];
		this.userId = null;
		this.initialized = false;
	}

	async add(mandala: Omit<CollectedMandala, "id" | "createdAt">): Promise<CollectedMandala> {
		const entry: CollectedMandala = {
			...mandala,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
		};
		this.collection.unshift(entry);

		if (this.userId) {
			await saveMandala(this.userId, entry);
		}
		return entry;
	}

	async remove(id: string): Promise<void> {
		const idx = this.collection.findIndex((m) => m.id === id);
		if (idx !== -1) {
			this.collection.splice(idx, 1);
			if (this.userId) {
				await removeMandala(this.userId, id);
			}
		}
	}

	get count(): number {
		return this.collection.length;
	}

	private async migrateFromLocalStorage(
		userId: string,
		existing: CollectedMandala[],
	): Promise<void> {
		const localEntries = localRepo.load();
		if (localEntries.length === 0) return;

		const existingIds = new Set(existing.map((m) => m.id));
		const toMigrate = localEntries.filter((m) => !existingIds.has(m.id));

		for (const entry of toMigrate) {
			await saveMandala(userId, entry);
			this.collection.push(entry);
		}

		localRepo.clear();
	}
}

export const mandalaCollectionState = new MandalaCollectionState();
