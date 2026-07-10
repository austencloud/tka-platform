import type { CollectionEntry } from "./collection-entry";

interface StoredPayload<T> {
  version: number;
  collection: T[];
}

/**
 * Versioned localStorage store for a saved-artifact collection. Used as the
 * guest-mode persistence layer and the sign-in migration source. A version
 * mismatch or malformed payload reads as empty — guest data is best-effort.
 */
export class LocalCollectionRepository<T extends CollectionEntry> {
  constructor(
    private readonly storageKey: string,
    private readonly schemaVersion: number,
    private readonly storage: Storage = globalThis.localStorage,
  ) {}

  load(): T[] {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredPayload<T>(parsed)) return [];
      if (parsed.version !== this.schemaVersion) return [];
      return parsed.collection;
    } catch {
      return [];
    }
  }

  save(collection: T[]): void {
    const payload: StoredPayload<T> = {
      version: this.schemaVersion,
      collection,
    };
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Quota exceeded or storage unavailable (SSR) — guest persistence is
      // best-effort.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }
}

function isStoredPayload<T>(value: unknown): value is StoredPayload<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "collection" in value &&
    typeof (value as Record<string, unknown>).version === "number" &&
    Array.isArray((value as Record<string, unknown>).collection)
  );
}
