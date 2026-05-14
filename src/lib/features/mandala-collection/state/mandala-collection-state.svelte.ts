import type { CollectedMandala } from "../domain/mandala-collection-types";
import { LocalMandalaCollectionRepository } from "../services/LocalMandalaCollectionRepository";

const repo = new LocalMandalaCollectionRepository();

class MandalaCollectionState {
	collection = $state<CollectedMandala[]>([]);

	constructor() {
		this.collection = repo.load();
	}

	add(mandala: Omit<CollectedMandala, "id" | "createdAt">): CollectedMandala {
		const entry: CollectedMandala = {
			...mandala,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
		};
		this.collection.push(entry);
		repo.save(this.collection);
		return entry;
	}

	remove(id: string): void {
		const idx = this.collection.findIndex((m) => m.id === id);
		if (idx !== -1) {
			this.collection.splice(idx, 1);
			repo.save(this.collection);
		}
	}

	get count(): number {
		return this.collection.length;
	}
}

export const mandalaCollectionState = new MandalaCollectionState();
