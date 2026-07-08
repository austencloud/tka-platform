import { describe, it, expect, beforeEach } from "vitest";
import { LocalTunnelCollectionRepository } from "./local-tunnel-collection-repository";
import { TUNNEL_COLLECTION_STORAGE_KEY, TUNNEL_COLLECTION_SCHEMA_VERSION } from "../domain/tunnel-collection-types";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null, length: 0,
  } as Storage;
}

const entry = { id: "t1", name: "T", steps: [], snapshot: {}, poster: "", createdAt: 1 } as unknown as CollectedTunnel;

describe("LocalTunnelCollectionRepository", () => {
  let storage: Storage;
  beforeEach(() => { storage = makeStorage(); });

  it("round-trips a versioned payload", () => {
    const repo = new LocalTunnelCollectionRepository(storage);
    repo.save([entry]);
    expect(repo.load()).toEqual([entry]);
  });

  it("returns [] on a version mismatch", () => {
    storage.setItem(TUNNEL_COLLECTION_STORAGE_KEY, JSON.stringify({ version: TUNNEL_COLLECTION_SCHEMA_VERSION + 1, collection: [entry] }));
    expect(new LocalTunnelCollectionRepository(storage).load()).toEqual([]);
  });

  it("returns [] when empty or malformed, and clear() wipes", () => {
    const repo = new LocalTunnelCollectionRepository(storage);
    expect(repo.load()).toEqual([]);
    storage.setItem(TUNNEL_COLLECTION_STORAGE_KEY, "{not json");
    expect(repo.load()).toEqual([]);
    repo.save([entry]);
    repo.clear();
    expect(repo.load()).toEqual([]);
  });
});
