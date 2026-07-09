import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import { LocalTunnelCollectionRepository } from "../services/local-tunnel-collection-repository";
import { loadTunnels, saveTunnel, removeTunnel } from "../services/firebase-tunnel-collection-repository";

const localRepo = new LocalTunnelCollectionRepository();

export class TunnelCollectionState {
	collection = $state<CollectedTunnel[]>([]);
	// True while the Firestore hydration is in flight, so the gallery can show a
	// loading indicator instead of mistaking "not loaded yet" for "empty".
	loading = $state(false);
	private userId: string | null = null;
	private initialized = false;

	async init(userId: string): Promise<void> {
		this.userId = userId;
		this.loading = true;

		try {
			const firebaseEntries = await loadTunnels(userId);
			this.collection = firebaseEntries;

			await this.migrateFromLocalStorage(userId, firebaseEntries);
			this.initialized = true;
		} finally {
			this.loading = false;
		}
	}

	teardown(): void {
		this.collection = [];
		this.loading = false;
		this.userId = null;
		this.initialized = false;
	}

	async add(tunnel: Omit<CollectedTunnel, "id" | "createdAt">): Promise<CollectedTunnel> {
		const entry: CollectedTunnel = {
			...tunnel,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
		};
		this.collection.unshift(entry);

		if (this.userId) {
			await saveTunnel(this.userId, entry);
		}
		return entry;
	}

	async remove(id: string): Promise<void> {
		const idx = this.collection.findIndex((t) => t.id === id);
		if (idx === -1) return;
		// Optimistic removal with rollback: re-insert at the same position if the
		// Firestore delete fails, so the UI never diverges from the store.
		const [removed] = this.collection.splice(idx, 1);
		if (this.userId) {
			try {
				await removeTunnel(this.userId, id);
			} catch (error) {
				if (removed) this.collection.splice(idx, 0, removed);
				throw error;
			}
		}
	}

	/** Rename a saved tunnel (immutable entry swap so $derived consumers re-run).
	 *  Rolls the name back if the Firestore write fails. */
	async rename(id: string, name: string): Promise<CollectedTunnel | null> {
		const trimmed = name.trim();
		const idx = this.collection.findIndex((t) => t.id === id);
		if (idx === -1 || !trimmed) return null;
		const prev = this.collection[idx]!;
		if (prev.name === trimmed) return prev;
		const next: CollectedTunnel = { ...prev, name: trimmed };
		this.collection[idx] = next;
		if (this.userId) {
			try {
				await saveTunnel(this.userId, next);
			} catch (error) {
				this.collection[idx] = prev;
				throw error;
			}
		}
		return next;
	}

	get count(): number {
		return this.collection.length;
	}

	private async migrateFromLocalStorage(
		userId: string,
		existing: CollectedTunnel[],
	): Promise<void> {
		const localEntries = localRepo.load();
		if (localEntries.length === 0) return;

		const existingIds = new Set(existing.map((t) => t.id));
		const toMigrate = localEntries.filter((t) => !existingIds.has(t.id));

		for (const entry of toMigrate) {
			await saveTunnel(userId, entry);
			this.collection.push(entry);
		}

		localRepo.clear();
	}
}

export const tunnelCollectionState = new TunnelCollectionState();
