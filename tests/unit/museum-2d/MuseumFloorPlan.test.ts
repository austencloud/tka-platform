import { describe, it, expect } from "vitest";
import type { MuseumTile } from "$lib/features/museum-2d/domain/museum-grid-types";
import { tileKey } from "$lib/features/museum-2d/domain/museum-grid-types";
import { isWalkable } from "$lib/features/museum-2d/domain/tile-registry";
import {
	stampRoom,
	stampCorridor,
	carveDoor,
	placeTile,
	buildFullMuseum,
} from "$lib/features/museum-2d/data/museum-floor-plan";

describe("Museum Floor Plan Helpers", () => {
	it("stampRoom creates walls on edges and floor inside", () => {
		const tiles = new Map<string, MuseumTile>();
		stampRoom(tiles, 10, 20, 6, 4, "stone");

		// Corners are walls
		expect(tiles.get(tileKey(10, 20))?.type).toBe("wall");
		expect(tiles.get(tileKey(15, 23))?.type).toBe("wall");

		// Interior is floor
		expect(tiles.get(tileKey(12, 21))?.type).toBe("floor");
		expect(tiles.get(tileKey(12, 21))?.material).toBe("stone");

		// Total: 6*4 = 24 tiles
		expect(tiles.size).toBe(24);
	});

	it("stampCorridor fills walls on long edges", () => {
		const tiles = new Map<string, MuseumTile>();
		stampCorridor(tiles, 5, 10, 4, 8, "vertical", "marble");

		// Side walls (x=5 and x=8) are walls
		expect(tiles.get(tileKey(5, 12))?.type).toBe("wall");
		expect(tiles.get(tileKey(8, 12))?.type).toBe("wall");

		// Interior is corridor
		expect(tiles.get(tileKey(6, 12))?.type).toBe("corridor");
		expect(tiles.get(tileKey(6, 12))?.material).toBe("marble");
	});

	it("carveDoor replaces wall tiles with door tiles", () => {
		const tiles = new Map<string, MuseumTile>();
		stampRoom(tiles, 0, 0, 10, 10, "stone");

		// South wall center: x=4,5 at y=9
		carveDoor(tiles, 4, 9, 2, "horizontal");

		expect(tiles.get(tileKey(4, 9))?.type).toBe("door");
		expect(tiles.get(tileKey(5, 9))?.type).toBe("door");
	});

	it("placeTile overwrites existing tiles", () => {
		const tiles = new Map<string, MuseumTile>();
		stampRoom(tiles, 0, 0, 5, 5, "stone");

		// Floor tile at (2,2)
		expect(tiles.get(tileKey(2, 2))?.type).toBe("floor");

		// Overwrite with torch
		placeTile(tiles, 2, 2, { type: "torch" });
		expect(tiles.get(tileKey(2, 2))?.type).toBe("torch");
	});
});

describe("Full Museum Grid", () => {
	const grid = buildFullMuseum();

	it("has expected dimensions", () => {
		expect(grid.width).toBe(150);
		expect(grid.height).toBe(220);
	});

	it("spawn point is on a walkable tile", () => {
		const spawnTile = grid.tiles.get(
			tileKey(grid.spawn.x, grid.spawn.y),
		);
		expect(spawnTile).toBeDefined();
		expect(isWalkable(spawnTile!.type)).toBe(true);
	});

	it("has all 16 wing regions defined", () => {
		expect(grid.wings.length).toBe(16);
	});

	it("has all expected wing IDs", () => {
		const wingIds = grid.wings.map((w) => w.id);
		const expected = [
			"entrance",
			"cave",
			"egyptian",
			"renaissance",
			"victorian",
			"digital",
			"suppression",
			"crumble",
			"gallery",
			"fear",
			"isolation",
			"collaboration",
			"gift-shop",
			"vtg-wing",
			"construction-zone",
			"janitor",
		];
		for (const id of expected) {
			expect(wingIds, `missing wing: ${id}`).toContain(id);
		}
	});

	it("main path rooms have walkable floors", () => {
		const samplePoints = [
			{ x: 80, y: 205, name: "Lobby" },
			{ x: 80, y: 175, name: "Cave" },
			{ x: 110, y: 145, name: "Egyptian" },
			{ x: 108, y: 175, name: "Renaissance" },
			{ x: 72, y: 174, name: "Victorian" },
			{ x: 62, y: 143, name: "Digital" },
			{ x: 60, y: 110, name: "Suppression" },
			{ x: 63, y: 83, name: "Crumble" },
			{ x: 60, y: 58, name: "K's Gallery" },
			{ x: 60, y: 28, name: "Fear" },
			{ x: 92, y: 26, name: "Isolation" },
			{ x: 128, y: 20, name: "Collaboration" },
			{ x: 128, y: 48, name: "Gift Shop" },
		];
		for (const pt of samplePoints) {
			const tile = grid.tiles.get(tileKey(pt.x, pt.y));
			expect(tile, `${pt.name} at (${pt.x},${pt.y})`).toBeDefined();
			expect(
				isWalkable(tile!.type),
				`${pt.name} tile type ${tile!.type} should be walkable`,
			).toBe(true);
		}
	});

	it("has exhibits in the Vulcan Cave", () => {
		const caveExhibits = grid.exhibits.filter((e) =>
			e.id.startsWith("cave-"),
		);
		expect(caveExhibits.length).toBeGreaterThanOrEqual(2);
	});

	it("Crumble uses dirt material (decay)", () => {
		const tile = grid.tiles.get(tileKey(63, 83));
		expect(tile?.type).toBe("floor");
		expect(tile?.material).toBe("dirt");
	});

	it("VTG Wing is blocked by rope tiles", () => {
		let ropeCount = 0;
		for (let y = 140; y <= 145; y++) {
			const tile = grid.tiles.get(tileKey(48, y));
			if (tile?.type === "rope") ropeCount++;
		}
		expect(ropeCount).toBeGreaterThanOrEqual(4);
	});

	it("Collaboration room has open edges (no north wall)", () => {
		// North wall at y=10 should be deleted (open sky)
		const northTile = grid.tiles.get(tileKey(125, 10));
		expect(northTile).toBeUndefined();
	});

	it("Isolation has cubicle walls inside", () => {
		const wing = grid.wings.find((w) => w.id === "isolation");
		expect(wing).toBeDefined();
		let interiorWalls = 0;
		const b = wing!.bounds;
		for (let y = b.y + 2; y < b.y + b.height - 2; y++) {
			for (let x = b.x + 2; x < b.x + b.width - 2; x++) {
				const tile = grid.tiles.get(tileKey(x, y));
				if (tile?.type === "wall") interiorWalls++;
			}
		}
		expect(interiorWalls).toBeGreaterThan(10);
	});

	it("Janitor's Closet has the whiteboard exhibit", () => {
		const janitorExhibit = grid.exhibits.find(
			(e) => e.id === "janitor-whiteboard",
		);
		expect(janitorExhibit).toBeDefined();
		expect(janitorExhibit!.plaque?.title).toContain("FAKE MUSEUM");
	});

	it("VTG Wing has scaffolding tiles", () => {
		let scaffoldCount = 0;
		const vtgWing = grid.wings.find((w) => w.id === "vtg-wing");
		expect(vtgWing).toBeDefined();
		const b = vtgWing!.bounds;
		for (let y = b.y + 1; y < b.y + b.height - 1; y++) {
			for (let x = b.x + 1; x < b.x + b.width - 1; x++) {
				const tile = grid.tiles.get(tileKey(x, y));
				if (tile?.type === "scaffolding") scaffoldCount++;
			}
		}
		expect(scaffoldCount).toBeGreaterThan(5);
	});

	it("has a reasonable number of total tiles", () => {
		// 150x220 grid = 33,000 possible. We're sparse, but should have several thousand.
		expect(grid.tiles.size).toBeGreaterThan(3000);
		expect(grid.tiles.size).toBeLessThan(20000);
	});

	it("has exhibits with plaque content", () => {
		const withPlaques = grid.exhibits.filter((e) => e.plaque);
		expect(withPlaques.length).toBeGreaterThan(10);
	});

	it("Gift Shop has a cashier performer", () => {
		const cashier = grid.performers.find(
			(p) => p.id === "shop-cashier",
		);
		expect(cashier).toBeDefined();
	});
});
