import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/personal-museum-repository", () => ({
  loadPersonalMuseum: vi.fn(async () => ({
    ownerId: "u1",
    isPublic: false,
    updatedAt: 0,
    placements: { "slot-n1": { sequenceId: "seqX", assignedAt: 1 } },
  })),
  subscribePersonalMuseum: vi.fn(async () => () => {}),
  assignPlacement: vi.fn(),
  clearPlacement: vi.fn(),
}));

import { createPersonalMuseumState } from "../personal-museum-state.svelte";

describe("createPersonalMuseumState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves explicit placement first, then auto-fills the rest from favorites", async () => {
    const state = createPersonalMuseumState({
      slotIds: ["slot-n1", "slot-n2", "slot-n3"],
    });
    state.setFavorites([
      { id: "seqX", updatedAt: 9 },
      { id: "favA", updatedAt: 8 },
    ]);
    await state.init();

    const resolved = state.resolvedSlots;
    expect(resolved["slot-n1"]).toBe("seqX"); // explicit
    expect(resolved["slot-n2"]).toBe("favA"); // auto-fill, seqX not duplicated
    expect(resolved["slot-n3"]).toBeNull();
  });

  it("favoritesOrdered sorts newest-first by updatedAt", () => {
    const state = createPersonalMuseumState({ slotIds: [] });
    state.setFavorites([
      { id: "old", updatedAt: 1 },
      { id: "new", updatedAt: 9 },
    ]);
    expect(state.favoritesOrdered).toEqual(["new", "old"]);
  });
});
