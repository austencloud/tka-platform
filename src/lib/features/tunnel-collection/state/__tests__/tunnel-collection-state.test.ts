import { describe, it, expect, vi, beforeEach } from "vitest";

const saved: unknown[] = [];
const removed: string[] = [];
vi.mock("../../services/firebase-tunnel-collection-repository", () => ({
  loadTunnels: vi.fn(async () => []),
  saveTunnel: vi.fn(async (_uid: string, t: unknown) => { saved.push(t); }),
  removeTunnel: vi.fn(async (_uid: string, id: string) => { removed.push(id); }),
}));

import { TunnelCollectionState } from "../tunnel-collection-state.svelte";

const base = { name: "T", steps: [], snapshot: {} as never, poster: "" };

describe("TunnelCollectionState", () => {
  beforeEach(() => { saved.length = 0; removed.length = 0; });

  it("add() prepends, assigns id + createdAt, and persists when signed in", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const entry = await s.add(base);
    expect(entry.id).toBeTruthy();
    expect(typeof entry.createdAt).toBe("number");
    expect(s.collection[0].id).toBe(entry.id);
    expect(s.count).toBe(1);
    expect(saved).toHaveLength(1);
  });

  it("remove() drops the entry and calls the repo", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const entry = await s.add(base);
    await s.remove(entry.id);
    expect(s.count).toBe(0);
    expect(removed).toEqual([entry.id]);
  });

  it("teardown() clears state", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    await s.add(base);
    s.teardown();
    expect(s.count).toBe(0);
  });
});
