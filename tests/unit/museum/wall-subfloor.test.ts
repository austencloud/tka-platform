/**
 * Wall subfloor coverage.
 *
 * The kit wall section is thinner than a tile (0.18m vs 0.5m TILE_SIZE), so a
 * wall tile that has no floor under it exposes the floorless void — a teal gap
 * at every wall base. bucketMuseumTiles must lay a subfloor under wall /
 * exhibit-panel tiles so carpet runs continuously beneath the thin walls.
 */

import { describe, it, expect } from "vitest";
import { buildMuseumGrid } from "$lib/features/museum/services/museum-grid-builder";
import { bucketMuseumTiles } from "$lib/features/museum/services/museum-geometry-builder";
import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "$lib/features/museum/data/museum-room-graph";

const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;

describe("wall subfloor", () => {
  it("every wall tile also has a floor tile beneath it", () => {
    const rooms = MUSEUM_ROOMS.slice(0, 3);
    const roomIds = new Set(rooms.map((r) => r.id));
    const edges = MUSEUM_EDGES.filter((e) => roomIds.has(e.from) && roomIds.has(e.to));
    const { grid } = buildMuseumGrid(rooms, edges, GRID_CONFIG);

    const result = bucketMuseumTiles(grid);

    const floorKeys = new Set<string>();
    for (const [, b] of result.floorBuckets) for (const p of b.positions) floorKeys.add(key(p));

    const wallKeys: { x: number; z: number }[] = [];
    for (const [, b] of result.wallBuckets) for (const p of b.positions) wallKeys.push(p);

    expect(wallKeys.length).toBeGreaterThan(0);
    const uncovered = wallKeys.filter((p) => !floorKeys.has(key(p)));
    expect(uncovered).toHaveLength(0);
  });
});
