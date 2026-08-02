import { describe, it, expect } from "vitest";
import { stampRoom } from "../../../src/lib/features/museum/services/wall-segment-stamper";
import type { MuseumTile } from "../../../src/lib/features/museum/domain/museum-grid-types";
import { tileKey } from "../../../src/lib/features/museum/domain/museum-grid-types";
import type { PlacedRoom } from "../../../src/lib/features/museum/domain/layout-types";
import type { WallDefinition } from "../../../src/lib/features/museum/domain/wall-segment-types";

function emptyWall(): WallDefinition {
	return { segments: [], minMargin: 0 };
}

function makeRoom(overrides: Partial<PlacedRoom> & Pick<PlacedRoom, "x" | "y" | "w" | "h">): PlacedRoom {
	return {
		id: "test-room",
		name: "Test Room",
		material: "stone",
		theme: "cave",
		walls: {
			north: emptyWall(),
			south: emptyWall(),
			east: emptyWall(),
			west: emptyWall(),
		},
		...overrides,
	};
}

describe("WallSegmentStamper", () => {

	it("stamps exhibit-panel tiles on north wall at correct positions", () => {
		const room = makeRoom({
			x: 0,
			y: 0,
			w: 16,
			h: 12,
			walls: {
				north: {
					segments: [
						{ type: "gap", minTiles: 3 },
						{ type: "exhibit", refId: "test-ex", size: "standard", facing: "south" },
					],
					minMargin: 1,
				},
				south: emptyWall(),
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		const result = stampRoom(tiles, room, []);

		// North wall: fixed Y = 0, cursor starts at room.x + 1 + minMargin = 0 + 1 + 1 = 2
		// gap(3): cursor advances 3 tiles (no tiles stamped), cursor now at 5
		// exhibit(standard, width=2): stamps at X=5 and X=6, cursor now at 7
		expect(tiles.get(tileKey(5, 0))?.type).toBe("exhibit-panel");
		expect(tiles.get(tileKey(6, 0))?.type).toBe("exhibit-panel");
		expect(tiles.get(tileKey(5, 0))?.refId).toBe("test-ex");
		expect(tiles.get(tileKey(5, 0))?.facing).toBe("south");

		// Should produce one exhibit definition
		expect(result.exhibits).toHaveLength(1);
		expect(result.exhibits[0].id).toBe("test-ex");
	});

	it("stamps door tiles and reports door position", () => {
		const room = makeRoom({
			id: "door-room",
			x: 10,
			y: 20,
			w: 20,
			h: 14,
			walls: {
				north: {
					segments: [
						{ type: "gap", minTiles: 3 },
						{ type: "door", edgeId: "edge-1", width: 4 },
					],
					minMargin: 2,
				},
				south: emptyWall(),
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		const result = stampRoom(tiles, room, []);

		// North wall: fixed Y = 20, cursor starts at 10 + 1 + 2 = 13
		// gap(3): cursor now at 16
		// door(width=4): stamps at X=16,17,18,19
		expect(tiles.get(tileKey(16, 20))?.type).toBe("door");
		expect(tiles.get(tileKey(17, 20))?.type).toBe("door");
		expect(tiles.get(tileKey(18, 20))?.type).toBe("door");
		expect(tiles.get(tileKey(19, 20))?.type).toBe("door");

		// Door position should be center of the door segment
		expect(result.doorPositions).toHaveLength(1);
		expect(result.doorPositions[0].edgeId).toBe("edge-1");
		expect(result.doorPositions[0].wall).toBe("north");
		// Center of 4 tiles at X=16..19: Math.floor(4/2) = 2, so 16 + 2 = 18
		expect(result.doorPositions[0].x).toBe(18);
		expect(result.doorPositions[0].y).toBe(20);
	});

	it("throws if segments exceed wall length", () => {
		const room = makeRoom({
			x: 0,
			y: 0,
			w: 6,
			h: 6,
			walls: {
				north: {
					segments: [{ type: "door", edgeId: "e1", width: 10 }],
					minMargin: 2,
				},
				south: emptyWall(),
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		expect(() => stampRoom(tiles, room, [])).toThrow();
	});

	it("stamps along Y axis on east wall", () => {
		const room = makeRoom({
			x: 0,
			y: 0,
			w: 10,
			h: 16,
			walls: {
				north: emptyWall(),
				south: emptyWall(),
				east: {
					segments: [
						{ type: "exhibit", refId: "east-ex", size: "standard", facing: "west" },
					],
					minMargin: 1,
				},
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		const result = stampRoom(tiles, room, []);

		// East wall: fixed X = room.x + room.w - 1 = 9, cursor starts at room.y + 1 + 1 = 2
		// exhibit(standard, width=2): stamps at Y=2 and Y=3
		expect(tiles.get(tileKey(9, 2))?.type).toBe("exhibit-panel");
		expect(tiles.get(tileKey(9, 3))?.type).toBe("exhibit-panel");
		expect(tiles.get(tileKey(9, 2))?.facing).toBe("west");

		expect(result.exhibits).toHaveLength(1);
		expect(result.exhibits[0].tileX).toBe(9);
	});

	it("stamps rope tiles for rope segments", () => {
		const room = makeRoom({
			x: 0,
			y: 0,
			w: 16,
			h: 12,
			walls: {
				north: emptyWall(),
				south: {
					segments: [
						{ type: "rope", edgeId: "rope-1", width: 3 },
					],
					minMargin: 1,
				},
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		stampRoom(tiles, room, []);

		// South wall: fixed Y = 0 + 12 - 1 = 11, cursor starts at 0 + 1 + 1 = 2
		// rope(width=3): stamps at X=2,3,4
		expect(tiles.get(tileKey(2, 11))?.type).toBe("rope");
		expect(tiles.get(tileKey(3, 11))?.type).toBe("rope");
		expect(tiles.get(tileKey(4, 11))?.type).toBe("rope");
	});

	it("centers a segment run when the wall has spare length", () => {
		const room = makeRoom({
			x: 10,
			y: 20,
			w: 20,
			h: 12,
			walls: {
				north: emptyWall(),
				south: {
					segments: [{ type: "door", edgeId: "street->lobby", width: 6 }],
					minMargin: 1,
					alignment: "center",
				},
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		const result = stampRoom(tiles, room, []);

		// Available run is X=12..27 (16 tiles). A centered 6-tile door starts at 17.
		for (let x = 17; x <= 22; x++) {
			expect(tiles.get(tileKey(x, 31))?.type).toBe("door");
		}
		expect(result.doorPositions[0]).toMatchObject({ x: 20, y: 31 });
	});

	it("end-aligns a segment run without consuming the trailing margin", () => {
		const room = makeRoom({
			x: 0,
			y: 0,
			w: 18,
			h: 12,
			walls: {
				north: {
					segments: [
						{ type: "gap", minTiles: 2 },
						{ type: "door", edgeId: "lobby->cave", width: 5 },
					],
					minMargin: 1,
					alignment: "end",
				},
				south: emptyWall(),
				east: emptyWall(),
				west: emptyWall(),
			},
		});

		const tiles = new Map<string, MuseumTile>();
		const result = stampRoom(tiles, room, []);

		// Corner 17 and trailing margin 16 stay clear; the door occupies 11..15.
		for (let x = 11; x <= 15; x++) {
			expect(tiles.get(tileKey(x, 0))?.type).toBe("door");
		}
		expect(tiles.has(tileKey(16, 0))).toBe(false);
		expect(result.doorPositions[0]).toMatchObject({ x: 13, y: 0 });
	});
});
