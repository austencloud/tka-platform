import { describe, it, expect, vi, beforeEach } from "vitest";

const saved: unknown[] = [];
const removed: string[] = [];
let failNextRemove = false;
let failNextSave = false;
vi.mock("../../services/firebase-tunnel-collection-repository", () => ({
  loadTunnels: vi.fn(async () => []),
  saveTunnel: vi.fn(async (_uid: string, t: unknown) => {
    if (failNextSave) { failNextSave = false; throw new Error("save denied"); }
    saved.push(t);
  }),
  removeTunnel: vi.fn(async (_uid: string, id: string) => {
    if (failNextRemove) { failNextRemove = false; throw new Error("delete denied"); }
    removed.push(id);
  }),
}));

import { TunnelCollectionState } from "../tunnel-collection-state.svelte";

const base = { name: "T", steps: [], snapshot: {} as never, poster: "" };

describe("TunnelCollectionState", () => {
  beforeEach(() => {
    saved.length = 0;
    removed.length = 0;
    failNextRemove = false;
    failNextSave = false;
  });

  it("add() prepends, assigns id + createdAt, and persists when signed in", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const entry = await s.add(base);
    expect(entry.id).toBeTruthy();
    expect(typeof entry.createdAt).toBe("number");
    expect(s.collection[0]?.id).toBe(entry.id);
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

  it("remove() rolls the entry back into place when the repo delete fails", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const a = await s.add(base);
    const b = await s.add({ ...base, name: "B" }); // b prepends → order [b, a]
    failNextRemove = true;
    await expect(s.remove(a.id)).rejects.toThrow("delete denied");
    // Restored at its original position, nothing lost.
    expect(s.collection.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it("rename() swaps the entry immutably, trims, and persists", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const entry = await s.add(base);
    saved.length = 0;
    const renamed = await s.rename(entry.id, "  Nebula  ");
    expect(renamed?.name).toBe("Nebula");
    expect(s.collection[0]?.name).toBe("Nebula");
    expect(saved).toHaveLength(1);
    // Empty / whitespace names are refused.
    expect(await s.rename(entry.id, "   ")).toBeNull();
  });

  it("rename() rolls back when the repo write fails", async () => {
    const s = new TunnelCollectionState();
    await s.init("user-1");
    const entry = await s.add(base);
    failNextSave = true;
    await expect(s.rename(entry.id, "Nope")).rejects.toThrow("save denied");
    expect(s.collection[0]?.name).toBe("T");
  });
});
