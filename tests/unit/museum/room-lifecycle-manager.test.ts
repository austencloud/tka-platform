import { describe, it, expect, beforeEach } from "vitest";
import {
  RoomLifecycleManager,
  RoomState,
} from "$lib/features/museum/services/implementations/RoomLifecycleManager";
import type { RoomDescriptor } from "$lib/features/museum/domain/room-descriptor";
import type { RoomEdge } from "$lib/features/museum/domain/layout-types";

/**
 * Test graph:
 *
 *   lobby ── room-a ── room-c
 *     └───── room-b
 *
 * lobby is adjacent to room-a and room-b.
 * room-a is adjacent to lobby and room-c.
 * room-b is adjacent to lobby only.
 * room-c is adjacent to room-a only.
 */
const EDGES: RoomEdge[] = [
  { from: "lobby", to: "room-a", type: "main-path", fromWall: "north", toWall: "south" },
  { from: "lobby", to: "room-b", type: "side-branch", fromWall: "east", toWall: "west" },
  { from: "room-a", to: "room-c", type: "main-path", fromWall: "north", toWall: "south" },
];

/** Minimal stub that satisfies the RoomDescriptor shape. */
function makeDescriptor(roomId: string): RoomDescriptor {
  return {
    roomId,
    wingTheme: "cave",
    tileBuckets: {
      floorEntries: [],
      wallEntries: [],
      pedestalPositions: [],
      signPositions: [],
      performerPositions: [],
      totalFloorInstances: 0,
      totalWallInstances: 0,
    },
    fixtures: { torches: [], plaques: [] },
    materialKeys: [],
  };
}

describe("RoomLifecycleManager", () => {
  let manager: RoomLifecycleManager;

  beforeEach(() => {
    manager = new RoomLifecycleManager(EDGES);
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("all rooms start as Unvisited", () => {
      expect(manager.getRoomState("lobby")).toBe(RoomState.Unvisited);
      expect(manager.getRoomState("room-a")).toBe(RoomState.Unvisited);
      expect(manager.getRoomState("room-b")).toBe(RoomState.Unvisited);
      expect(manager.getRoomState("room-c")).toBe(RoomState.Unvisited);
    });

    it("unknown room also reports Unvisited", () => {
      expect(manager.getRoomState("not-a-room")).toBe(RoomState.Unvisited);
    });
  });

  // ── getAllRoomIds ───────────────────────────────────────────────────────────

  describe("getAllRoomIds()", () => {
    it("returns all 4 rooms derived from the edges", () => {
      const ids = manager.getAllRoomIds();
      expect(ids).toHaveLength(4);
      expect(ids).toContain("lobby");
      expect(ids).toContain("room-a");
      expect(ids).toContain("room-b");
      expect(ids).toContain("room-c");
    });
  });

  // ── Entering lobby ─────────────────────────────────────────────────────────

  describe("entering lobby (first visit)", () => {
    it("activates lobby, room-a, and room-b — but NOT room-c", () => {
      const update = manager.onPlayerEnteredRoom("lobby");

      expect(update.toActivate).toContain("lobby");
      expect(update.toActivate).toContain("room-a");
      expect(update.toActivate).toContain("room-b");
      expect(update.toActivate).not.toContain("room-c");
    });

    it("produces no rooms to cache on first entry", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.toCache).toHaveLength(0);
    });

    it("produces no fromCache entries on first entry (nothing was cached yet)", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.fromCache).toHaveLength(0);
    });

    it("sets lobby state to Active after entry", () => {
      manager.onPlayerEnteredRoom("lobby");
      expect(manager.getRoomState("lobby")).toBe(RoomState.Active);
    });

    it("sets adjacent rooms (room-a, room-b) to Active after entry", () => {
      manager.onPlayerEnteredRoom("lobby");
      expect(manager.getRoomState("room-a")).toBe(RoomState.Active);
      expect(manager.getRoomState("room-b")).toBe(RoomState.Active);
    });

    it("leaves room-c as Unvisited — it's two hops away", () => {
      manager.onPlayerEnteredRoom("lobby");
      expect(manager.getRoomState("room-c")).toBe(RoomState.Unvisited);
    });
  });

  // ── Moving from lobby to room-a ────────────────────────────────────────────

  describe("moving from lobby → room-a", () => {
    it("caches room-b because it left the active set", () => {
      manager.onPlayerEnteredRoom("lobby");
      const update = manager.onPlayerEnteredRoom("room-a");

      expect(update.toCache).toContain("room-b");
    });

    it("does NOT cache lobby or room-a (still adjacent)", () => {
      manager.onPlayerEnteredRoom("lobby");
      const update = manager.onPlayerEnteredRoom("room-a");

      expect(update.toCache).not.toContain("lobby");
      expect(update.toCache).not.toContain("room-a");
    });

    it("activates room-c (first visit, one hop from room-a)", () => {
      manager.onPlayerEnteredRoom("lobby");
      const update = manager.onPlayerEnteredRoom("room-a");

      expect(update.toActivate).toContain("room-c");
    });

    it("sets room-b state to Cached", () => {
      manager.onPlayerEnteredRoom("lobby");
      manager.onPlayerEnteredRoom("room-a");
      expect(manager.getRoomState("room-b")).toBe(RoomState.Cached);
    });

    it("sets room-c state to Active", () => {
      manager.onPlayerEnteredRoom("lobby");
      manager.onPlayerEnteredRoom("room-a");
      expect(manager.getRoomState("room-c")).toBe(RoomState.Active);
    });
  });

  // ── Returning to lobby (room-b cache hit) ──────────────────────────────────

  describe("returning to lobby after visiting room-a (room-b was cached)", () => {
    beforeEach(() => {
      manager.onPlayerEnteredRoom("lobby");
      manager.onPlayerEnteredRoom("room-a");
      // Store a descriptor for room-b so the cache hit is detectable.
      manager.cacheDescriptor("room-b", makeDescriptor("room-b"));
    });

    it("includes room-b in toActivate (it needs geometry rebuilt)", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.toActivate).toContain("room-b");
    });

    it("includes room-b in fromCache (descriptor is available — skip bucketing)", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.fromCache).toContain("room-b");
    });

    it("room-b state returns to Active", () => {
      manager.onPlayerEnteredRoom("lobby");
      expect(manager.getRoomState("room-b")).toBe(RoomState.Active);
    });
  });

  // ── Priorities ─────────────────────────────────────────────────────────────

  describe("priorities", () => {
    it("current room gets priority 0", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.priorities.get("lobby")).toBe(0);
    });

    it("adjacent rooms get priority 1", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.priorities.get("room-a")).toBe(1);
      expect(update.priorities.get("room-b")).toBe(1);
    });

    it("non-adjacent rooms are absent from priorities", () => {
      const update = manager.onPlayerEnteredRoom("lobby");
      expect(update.priorities.has("room-c")).toBe(false);
    });
  });

  // ── Descriptor cache ───────────────────────────────────────────────────────

  describe("descriptor cache", () => {
    it("getCachedDescriptor returns null before any descriptor is stored", () => {
      expect(manager.getCachedDescriptor("lobby")).toBeNull();
    });

    it("getCachedDescriptor returns the stored descriptor", () => {
      const desc = makeDescriptor("lobby");
      manager.cacheDescriptor("lobby", desc);
      expect(manager.getCachedDescriptor("lobby")).toBe(desc);
    });

    it("storing a second descriptor overwrites the first", () => {
      const first = makeDescriptor("lobby");
      const second = makeDescriptor("lobby");
      manager.cacheDescriptor("lobby", first);
      manager.cacheDescriptor("lobby", second);
      expect(manager.getCachedDescriptor("lobby")).toBe(second);
    });

    it("descriptors for different rooms are independent", () => {
      const a = makeDescriptor("room-a");
      const b = makeDescriptor("room-b");
      manager.cacheDescriptor("room-a", a);
      manager.cacheDescriptor("room-b", b);
      expect(manager.getCachedDescriptor("room-a")).toBe(a);
      expect(manager.getCachedDescriptor("room-b")).toBe(b);
    });
  });

  // ── Already-active rooms are not re-activated ──────────────────────────────

  describe("idempotent activation", () => {
    it("entering the same room twice does not re-add it to toActivate", () => {
      manager.onPlayerEnteredRoom("lobby");
      const update = manager.onPlayerEnteredRoom("lobby");

      // lobby and its neighbors are already Active, so toActivate should be empty
      expect(update.toActivate).toHaveLength(0);
    });
  });
});
