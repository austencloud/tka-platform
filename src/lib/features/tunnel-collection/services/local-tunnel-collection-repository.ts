import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import {
  TUNNEL_COLLECTION_STORAGE_KEY,
  TUNNEL_COLLECTION_SCHEMA_VERSION,
} from "../domain/tunnel-collection-types";

interface StoredPayload {
  version: number;
  collection: CollectedTunnel[];
}

export class LocalTunnelCollectionRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): CollectedTunnel[] {
    const raw = this.storage.getItem(TUNNEL_COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredPayload(parsed)) return [];
      if (parsed.version !== TUNNEL_COLLECTION_SCHEMA_VERSION) return [];
      return parsed.collection;
    } catch {
      return [];
    }
  }

  save(collection: CollectedTunnel[]): void {
    const payload: StoredPayload = { version: TUNNEL_COLLECTION_SCHEMA_VERSION, collection };
    this.storage.setItem(TUNNEL_COLLECTION_STORAGE_KEY, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(TUNNEL_COLLECTION_STORAGE_KEY);
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
