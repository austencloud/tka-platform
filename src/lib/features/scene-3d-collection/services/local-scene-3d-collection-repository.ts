import type { Collected3DScene } from "../domain/scene-3d-collection-types";
import {
  SCENE_3D_COLLECTION_STORAGE_KEY,
  SCENE_3D_COLLECTION_SCHEMA_VERSION,
} from "../domain/scene-3d-collection-types";

interface StoredPayload {
  version: number;
  collection: Collected3DScene[];
}

export class LocalScene3DCollectionRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): Collected3DScene[] {
    const raw = this.storage.getItem(SCENE_3D_COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredPayload(parsed)) return [];
      if (parsed.version !== SCENE_3D_COLLECTION_SCHEMA_VERSION) return [];
      return parsed.collection;
    } catch {
      return [];
    }
  }

  save(collection: Collected3DScene[]): void {
    const payload: StoredPayload = {
      version: SCENE_3D_COLLECTION_SCHEMA_VERSION,
      collection,
    };
    this.storage.setItem(SCENE_3D_COLLECTION_STORAGE_KEY, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(SCENE_3D_COLLECTION_STORAGE_KEY);
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
