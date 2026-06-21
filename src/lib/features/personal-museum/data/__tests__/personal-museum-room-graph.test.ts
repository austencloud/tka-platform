import { describe, it, expect } from "vitest";
import {
  PERSONAL_MUSEUM_ROOMS,
  PERSONAL_MUSEUM_EDGES,
  PERSONAL_MUSEUM_SLOT_IDS,
} from "../personal-museum-room-graph";

describe("personal museum room graph", () => {
  it("defines exactly one room and no edges (single-room MVP)", () => {
    expect(PERSONAL_MUSEUM_ROOMS).toHaveLength(1);
    expect(PERSONAL_MUSEUM_EDGES).toHaveLength(0);
  });

  it("exposes 6-12 exhibit slot ids, all unique", () => {
    const ids = PERSONAL_MUSEUM_SLOT_IDS;
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(ids.length).toBeLessThanOrEqual(12);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives slot ids from the room's exhibit wall segments", () => {
    const room = PERSONAL_MUSEUM_ROOMS[0]!;
    const exhibitRefIds = Object.values(room.walls)
      .flatMap((w) => w.segments)
      .filter((s): s is Extract<typeof s, { type: "exhibit" }> => s.type === "exhibit")
      .map((s) => s.refId);
    expect([...PERSONAL_MUSEUM_SLOT_IDS].sort()).toEqual([...exhibitRefIds].sort());
  });

  it("pairs every exhibit slot with a performer of the same refId", () => {
    const room = PERSONAL_MUSEUM_ROOMS[0]!;
    const performerRefIds = (room.performers ?? []).map((p) => p.refId).sort();
    expect(performerRefIds).toEqual([...PERSONAL_MUSEUM_SLOT_IDS].sort());
  });
});
