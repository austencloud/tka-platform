import type { CollectedMandala } from "../domain/mandala-collection-types";
import {
	MANDALA_COLLECTION_STORAGE_KEY,
	MANDALA_COLLECTION_SCHEMA_VERSION,
} from "../domain/mandala-collection-types";

interface StoredPayload {
	version: number;
	collection: CollectedMandala[];
}

export class LocalMandalaCollectionRepository {
	constructor(private readonly storage: Storage = globalThis.localStorage) {}

	load(): CollectedMandala[] {
		const raw = this.storage.getItem(MANDALA_COLLECTION_STORAGE_KEY);
		if (!raw) return [];

		try {
			const parsed: unknown = JSON.parse(raw);
			if (!isStoredPayload(parsed)) return [];
			if (parsed.version !== MANDALA_COLLECTION_SCHEMA_VERSION) return [];
			return parsed.collection;
		} catch {
			return [];
		}
	}

	save(collection: CollectedMandala[]): void {
		const payload: StoredPayload = {
			version: MANDALA_COLLECTION_SCHEMA_VERSION,
			collection,
		};
		this.storage.setItem(MANDALA_COLLECTION_STORAGE_KEY, JSON.stringify(payload));
	}

	clear(): void {
		this.storage.removeItem(MANDALA_COLLECTION_STORAGE_KEY);
	}
}

function isStoredPayload(value: unknown): value is StoredPayload {
	return (
		typeof value === "object" &&
		value !== null &&
		"version" in value &&
		"collection" in value &&
		typeof (value as Record<string, unknown>).version === "number" &&
		Array.isArray((value as Record<string, unknown>).collection)
	);
}
