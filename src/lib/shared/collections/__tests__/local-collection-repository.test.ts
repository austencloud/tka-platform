import { describe, it, expect, beforeEach } from "vitest";
import { LocalCollectionRepository } from "../local-collection-repository";
import type { CollectionEntry } from "../collection-entry";

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

const KEY = "tka:test-collection";
const VERSION = 1;
const entry: CollectionEntry = { id: "e1", name: "E", createdAt: 1 };

describe("LocalCollectionRepository", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeStorage();
  });

  it("round-trips a versioned payload", () => {
    const repo = new LocalCollectionRepository<CollectionEntry>(KEY, VERSION, storage);
    repo.save([entry]);
    expect(repo.load()).toEqual([entry]);
  });

  it("returns [] on a version mismatch", () => {
    storage.setItem(KEY, JSON.stringify({ version: VERSION + 1, collection: [entry] }));
    expect(new LocalCollectionRepository<CollectionEntry>(KEY, VERSION, storage).load()).toEqual(
      [],
    );
  });

  it("returns [] when empty or malformed, and clear() wipes", () => {
    const repo = new LocalCollectionRepository<CollectionEntry>(KEY, VERSION, storage);
    expect(repo.load()).toEqual([]);
    storage.setItem(KEY, "{not json");
    expect(repo.load()).toEqual([]);
    repo.save([entry]);
    repo.clear();
    expect(repo.load()).toEqual([]);
  });

  it("keeps two repositories on different keys independent", () => {
    const a = new LocalCollectionRepository<CollectionEntry>("tka:a", VERSION, storage);
    const b = new LocalCollectionRepository<CollectionEntry>("tka:b", VERSION, storage);
    a.save([entry]);
    expect(b.load()).toEqual([]);
    expect(a.load()).toEqual([entry]);
  });
});
