import { describe, it, expect } from "vitest";
import { GraphLayoutEngine } from "$lib/features/museum-2d/services/implementations/GraphLayoutEngine";
import { CorridorRouter } from "$lib/features/museum-2d/services/implementations/CorridorRouter";
import { LayoutValidator } from "$lib/features/museum-2d/services/implementations/LayoutValidator";
import { buildMuseumGrid } from "$lib/features/museum-2d/services/implementations/MuseumGridBuilder";
import { MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG } from "$lib/features/museum-2d/data/museum-room-graph";
import { tileKey } from "$lib/features/museum-2d/domain/museum-grid-types";
import { isWalkable } from "$lib/features/museum-2d/domain/tile-registry";
import type { RoomNode, RoomEdge, GridConfig } from "$lib/features/museum-2d/domain/layout-types";

describe("GraphLayoutEngine", () => {
	const engine = new GraphLayoutEngine();

	it("assigns rooms to non-overlapping grid positions", () => {
		const layout = engine.computeLayout(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

		expect(layout.rooms.length).toBe(MUSEUM_ROOMS.length);

		// No pair of rooms should overlap
		for (let i = 0; i < layout.rooms.length; i++) {
			for (let j = i + 1; j < layout.rooms.length; j++) {
				const a = layout.rooms[i];
				const b = layout.rooms[j];
				const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
				const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
				expect(
					overlapX && overlapY,
					`${a.id} and ${b.id} overlap`,
				).toBe(false);
			}
		}
	});

	it("rooms are sized within their min/max bounds", () => {
		const layout = engine.computeLayout(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

		for (const room of layout.rooms) {
			const node = MUSEUM_ROOMS.find((r) => r.id === room.id)!;
			expect(room.w).toBeGreaterThanOrEqual(node.minWidth);
			expect(room.w).toBeLessThanOrEqual(node.maxWidth);
			expect(room.h).toBeGreaterThanOrEqual(node.minHeight);
			expect(room.h).toBeLessThanOrEqual(node.maxHeight);
		}
	});

	it("grid dimensions accommodate all rooms", () => {
		const layout = engine.computeLayout(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

		for (const room of layout.rooms) {
			expect(room.x + room.w).toBeLessThanOrEqual(layout.gridWidth);
			expect(room.y + room.h).toBeLessThanOrEqual(layout.gridHeight);
			expect(room.x).toBeGreaterThanOrEqual(0);
			expect(room.y).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("CorridorRouter", () => {
	const engine = new GraphLayoutEngine();
	const router = new CorridorRouter();

	it("produces corridor segments between connected rooms", () => {
		const layout = engine.computeLayout(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);
		const [entrance, cave] = layout.rooms;

		const segments = router.routeCorridor(entrance, cave, MUSEUM_EDGES[0]);

		expect(segments.length).toBeGreaterThan(0);
		// All segments should have positive width
		for (const seg of segments) {
			expect(seg.width).toBeGreaterThanOrEqual(3);
		}
	});
});

describe("LayoutValidator", () => {
	it("validates a connected 2-room layout", () => {
		const { grid, validation } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

		expect(validation.valid).toBe(true);
		expect(validation.unreachableRooms).toHaveLength(0);
		expect(validation.overlaps).toHaveLength(0);
		expect(validation.spawnOnWalkable).toBe(true);
		expect(validation.errors).toHaveLength(0);
	});

	it("detects unreachable rooms when corridor is removed", () => {
		// Build with no edges — rooms should be disconnected
		const { grid, validation } = buildMuseumGrid(MUSEUM_ROOMS, [], GRID_CONFIG);

		// At least one room should be unreachable (the one that isn't the spawn room)
		expect(validation.unreachableRooms.length).toBeGreaterThan(0);
		expect(validation.valid).toBe(false);
	});
});

describe("Full Museum Grid (Phase 1)", () => {
	const { grid, validation } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

	it("passes all validation checks", () => {
		expect(validation.valid).toBe(true);
	});

	it("spawn is on a walkable tile", () => {
		const spawnTile = grid.tiles.get(tileKey(grid.spawn.x, grid.spawn.y));
		expect(spawnTile).toBeDefined();
		expect(isWalkable(spawnTile!.type)).toBe(true);
	});

	it("has all wing regions", () => {
		expect(grid.wings).toHaveLength(MUSEUM_ROOMS.length);
		for (const room of MUSEUM_ROOMS) {
			expect(grid.wings.map((w) => w.id), `missing wing: ${room.id}`).toContain(room.id);
		}
	});

	it("both rooms have walkable interior tiles", () => {
		for (const wing of grid.wings) {
			const b = wing.bounds;
			let hasWalkable = false;
			for (let y = b.y + 1; y < b.y + b.height - 1; y++) {
				for (let x = b.x + 1; x < b.x + b.width - 1; x++) {
					const tile = grid.tiles.get(tileKey(x, y));
					if (tile && isWalkable(tile.type)) {
						hasWalkable = true;
						break;
					}
				}
				if (hasWalkable) break;
			}
			expect(hasWalkable, `${wing.name} should have walkable tiles`).toBe(true);
		}
	});

	it("has exhibits with plaque content", () => {
		expect(grid.exhibits.length).toBeGreaterThanOrEqual(2);
		const withPlaques = grid.exhibits.filter((e) => e.plaque);
		expect(withPlaques.length).toBeGreaterThanOrEqual(2);
	});

	it("Vulcan Cave has torches", () => {
		const caveWing = grid.wings.find((w) => w.id === "vulcan-cave")!;
		const b = caveWing.bounds;
		let torchCount = 0;
		for (let y = b.y; y < b.y + b.height; y++) {
			for (let x = b.x; x < b.x + b.width; x++) {
				const tile = grid.tiles.get(tileKey(x, y));
				if (tile?.type === "torch") torchCount++;
			}
		}
		expect(torchCount).toBeGreaterThanOrEqual(4);
	});

	it("Vulcan Cave has performers", () => {
		const cavePerformers = grid.performers.filter((p) => p.id.startsWith("cave-"));
		expect(cavePerformers.length).toBeGreaterThanOrEqual(2);
	});

	it("L-shaped corridors have walkable elbows (carve-then-wall regression)", () => {
		// This is the exact bug that broke the original implementation.
		// Add a 3rd room that forces an L-shaped corridor.
		const threeRooms: RoomNode[] = [
			{ id: "a", name: "A", minWidth: 10, maxWidth: 10, minHeight: 10, maxHeight: 10, material: "stone", theme: "cave" },
			{ id: "b", name: "B", minWidth: 10, maxWidth: 10, minHeight: 10, maxHeight: 10, material: "stone", theme: "cave" },
			{ id: "c", name: "C", minWidth: 10, maxWidth: 10, minHeight: 10, maxHeight: 10, material: "stone", theme: "cave" },
		];
		const threeEdges: RoomEdge[] = [
			{ from: "a", to: "b", type: "main-path", fromWall: "north", toWall: "south", corridorWidth: 4 },
			{ from: "b", to: "c", type: "main-path", fromWall: "east", toWall: "west", corridorWidth: 4 },
		];
		const config: GridConfig = { cellWidth: 20, cellHeight: 20, padding: 2 };

		const { validation } = buildMuseumGrid(threeRooms, threeEdges, config);

		expect(validation.valid, `Errors: ${validation.errors.join(", ")}`).toBe(true);
		expect(validation.unreachableRooms).toHaveLength(0);
	});

	it("wings have descriptions", () => {
		for (const wing of grid.wings) {
			expect(wing.description, `${wing.name} missing description`).toBeDefined();
			expect(wing.description!.length).toBeGreaterThan(20);
		}
	});
});
