import { describe, expect, it } from "vitest";
import {
  MUSEUM_WALK_ROOMS,
  MUSEUM_WALK_EDGES,
} from "$lib/features/museum/data/museum-walk";
import { ROOM_PICKER_ROOMS } from "$lib/features/museum/components/room-picker-rooms";
import { resolveRoomIsolation } from "$lib/features/museum/services/room-isolation";
import { buildMuseumGrid } from "$lib/features/museum/services/museum-grid-builder";
import { attachMuseumWalkTerrain } from "$lib/features/museum/data/museum-walk";
import { buildEarthRootTerraceLayout } from "$lib/features/museum/data/earth-root-terrace-terrain";

const GRID_CONFIG = { gridWidth: 400, gridHeight: 400 } as const;

describe("room isolation", () => {
  it("offers only rooms that survive into the walk", () => {
    const walkIds = new Set(MUSEUM_WALK_ROOMS.map((r) => r.id));
    const dangling = ROOM_PICKER_ROOMS.map((r) => r.id).filter(
      (id) => !walkIds.has(id)
    );
    expect(dangling).toEqual([]);
  });

  // The two concrete faults the derived list fixes. `vulcan-cave` is the
  // placeholder the authored cave replaced; museum-walk strips it, so offering
  // it was the crash. The chambers were simply missing, so there was no way to
  // jump to the Root Terrace to review it.
  it("no longer offers the replaced cave placeholder", () => {
    expect(ROOM_PICKER_ROOMS.map((r) => r.id)).not.toContain("vulcan-cave");
  });

  it("offers the authored cave chambers", () => {
    const ids = ROOM_PICKER_ROOMS.map((r) => r.id);
    for (const chamber of [
      "cave-water",
      "cave-fire",
      "cave-earth",
      "cave-air",
      "cave-sun",
      "cave-moon",
    ]) {
      expect(ids, `picker cannot reach ${chamber}`).toContain(chamber);
    }
  });

  it("gives every offered room a real name", () => {
    for (const room of ROOM_PICKER_ROOMS) {
      expect(room.name?.trim(), `${room.id} has no name`).toBeTruthy();
      expect(room.theme?.trim(), `${room.id} has no theme`).toBeTruthy();
    }
  });

  it("builds a non-empty room set for every offered room", () => {
    for (const { id } of ROOM_PICKER_ROOMS) {
      const { rooms } = resolveRoomIsolation(
        id,
        MUSEUM_WALK_ROOMS,
        MUSEUM_WALK_EDGES
      );
      expect(rooms.length, `${id} isolated to an empty room set`).toBeGreaterThan(0);
    }
  });

  it("falls back to the whole museum when the URL names an unknown room", () => {
    const { rooms, edges } = resolveRoomIsolation(
      "no-such-room",
      MUSEUM_WALK_ROOMS,
      MUSEUM_WALK_EDGES
    );
    expect(rooms).toBe(MUSEUM_WALK_ROOMS);
    expect(edges).toBe(MUSEUM_WALK_EDGES);
  });

  it("never hands buildMuseumGrid an empty room list", () => {
    for (const id of [...ROOM_PICKER_ROOMS.map((r) => r.id), "vulcan-cave", "no-such-room"]) {
      const { rooms, edges } = resolveRoomIsolation(
        id,
        MUSEUM_WALK_ROOMS,
        MUSEUM_WALK_EDGES
      );
      expect(() => buildMuseumGrid(rooms, edges, GRID_CONFIG)).not.toThrow();
    }
  });

  it("reaches the Earth cave", () => {
    const { rooms } = resolveRoomIsolation(
      "cave-earth",
      MUSEUM_WALK_ROOMS,
      MUSEUM_WALK_EDGES
    );
    expect(rooms.map((r) => r.id)).toContain("cave-earth");
  });

  // The Root Terrace mounts its shell at the layout's plan centre. A null
  // layout collapses that origin to [0, 0, 0], the shell lands at the world
  // origin instead of around the visitor, and the isolated room renders black
  // with no error. It did: the layout required the Fire wing purely to span
  // the corridor between the two, which an isolated grid does not contain.
  it("still lays out the Root Terrace when isolated from the Fire wing", () => {
    const { rooms, edges } = resolveRoomIsolation(
      "cave-earth",
      MUSEUM_WALK_ROOMS,
      MUSEUM_WALK_EDGES
    );
    expect(rooms.map((r) => r.id)).not.toContain("cave-fire");

    const { grid } = buildMuseumGrid(rooms, edges, GRID_CONFIG);
    attachMuseumWalkTerrain(grid);
    const layout = buildEarthRootTerraceLayout(grid);

    expect(layout, "isolated cave-earth produced no layout").not.toBeNull();
    expect(layout!.corridor).toEqual([]);
    expect(layout!.stations.length).toBe(3);
  });
});