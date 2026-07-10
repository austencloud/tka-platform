import { describe, it, expect, beforeEach } from "vitest";
import { LocalScene3DCollectionRepository } from "../local-scene-3d-collection-repository";
import {
  SCENE_3D_COLLECTION_STORAGE_KEY,
  SCENE_3D_COLLECTION_SCHEMA_VERSION,
} from "../../domain/scene-3d-collection-types";
import type { Collected3DScene } from "../../domain/scene-3d-collection-types";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const entry = { id: "s1", name: "S", snapshot: {}, poster: "", createdAt: 1 } as unknown as Collected3DScene;

describe("LocalScene3DCollectionRepository", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeStorage();
  });

  it("round-trips a versioned payload", () => {
    const repo = new LocalScene3DCollectionRepository(storage);
    repo.save([entry]);
    expect(repo.load()).toEqual([entry]);
  });

  it("returns [] on a version mismatch", () => {
    storage.setItem(
      SCENE_3D_COLLECTION_STORAGE_KEY,
      JSON.stringify({ version: SCENE_3D_COLLECTION_SCHEMA_VERSION + 1, collection: [entry] }),
    );
    expect(new LocalScene3DCollectionRepository(storage).load()).toEqual([]);
  });

  it("returns [] when empty or malformed, and clear() wipes", () => {
    const repo = new LocalScene3DCollectionRepository(storage);
    expect(repo.load()).toEqual([]);
    storage.setItem(SCENE_3D_COLLECTION_STORAGE_KEY, "{not json");
    expect(repo.load()).toEqual([]);
    repo.save([entry]);
    repo.clear();
    expect(repo.load()).toEqual([]);
  });
});
