/**
 * Pre-built wing templates for the floor plan editor.
 *
 * Each template defines a set of tiles positioned relative to (0,0).
 * The editor stamps these onto the grid at a user-chosen offset using
 * `editorState.stampTemplate()`.
 *
 * 1 tile = 0.5m. So a 20x24 template is 10m x 12m in world space.
 */

import type { MuseumTile, WingTheme } from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";

export interface WingTemplate {
	id: string;
	name: string;
	width: number;
	height: number;
	tiles: Record<string, MuseumTile>;
	theme: WingTheme;
}


function wall(x: number, y: number): [string, MuseumTile] {
	return [tileKey(x, y), { type: "wall" }];
}

function floor(
	x: number,
	y: number,
	material: MuseumTile["material"] = "stone"
): [string, MuseumTile] {
	return [tileKey(x, y), { type: "floor", material }];
}

function corridor(
	x: number,
	y: number,
	material: MuseumTile["material"] = "stone"
): [string, MuseumTile] {
	return [tileKey(x, y), { type: "corridor", material }];
}

function door(x: number, y: number): [string, MuseumTile] {
	return [tileKey(x, y), { type: "door" }];
}

function torch(x: number, y: number): [string, MuseumTile] {
	return [tileKey(x, y), { type: "torch" }];
}

function exhibit(x: number, y: number): [string, MuseumTile] {
	return [tileKey(x, y), { type: "exhibit-panel" }];
}

function pedestal(x: number, y: number): [string, MuseumTile] {
	return [tileKey(x, y), { type: "pedestal" }];
}

/**
 * Fills a rectangular area with walls around the border and floor inside.
 * Skips positions where a tile already exists in the accumulator.
 */
function fillRoom(
	w: number,
	h: number,
	floorMaterial: MuseumTile["material"] = "stone"
): [string, MuseumTile][] {
	const entries: [string, MuseumTile][] = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const isEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
			entries.push(isEdge ? wall(x, y) : floor(x, y, floorMaterial));
		}
	}
	return entries;
}

function toRecord(entries: [string, MuseumTile][]): Record<string, MuseumTile> {
	const record: Record<string, MuseumTile> = {};
	for (const [key, tile] of entries) {
		record[key] = tile;
	}
	return record;
}

// ── 1. Small Cave (20 x 24) ──
// Rough stone chamber with torches and a south entrance.

function buildSmallCave(): WingTemplate {
	const w = 20;
	const h = 24;
	const entries = fillRoom(w, h, "stone");

	// South entrance: replace the center wall tiles with a door
	const midX = Math.floor(w / 2);
	entries.push(door(midX - 1, h - 1));
	entries.push(door(midX, h - 1));

	// 4 torches in the corners (inside the walls)
	entries.push(torch(2, 2));
	entries.push(torch(w - 3, 2));
	entries.push(torch(2, h - 3));
	entries.push(torch(w - 3, h - 3));

	return {
		id: "small-cave",
		name: "Small Cave",
		width: w,
		height: h,
		tiles: toRecord(entries),
		theme: "cave",
	};
}

// ── 2. Gallery Hall (40 x 32) ──
// Grand marble hall with pillars and a wide entrance.

function buildGalleryHall(): WingTemplate {
	const w = 40;
	const h = 32;
	const entries = fillRoom(w, h, "marble");

	// Wide south entrance (6 tiles wide)
	const midX = Math.floor(w / 2);
	for (let dx = -3; dx < 3; dx++) {
		entries.push(door(midX + dx, h - 1));
	}

	// Pillar positions in two rows along the hall
	const pillarY1 = 8;
	const pillarY2 = 22;
	for (let px = 6; px < w - 5; px += 6) {
		entries.push(pedestal(px, pillarY1));
		entries.push(pedestal(px, pillarY2));
	}

	// Exhibit panels along the side walls
	for (let ey = 4; ey < h - 4; ey += 4) {
		entries.push(exhibit(1, ey));
		entries.push(exhibit(w - 2, ey));
	}

	return {
		id: "gallery-hall",
		name: "Gallery Hall",
		width: w,
		height: h,
		tiles: toRecord(entries),
		theme: "classical",
	};
}

// ── 3. Long Corridor (8 x 40) ──
// Narrow passage connecting two areas, lined with torches.

function buildLongCorridor(): WingTemplate {
	const w = 8;
	const h = 40;
	const entries: [string, MuseumTile][] = [];

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const isEdge = x === 0 || x === w - 1;
			entries.push(isEdge ? wall(x, y) : corridor(x, y, "stone"));
		}
	}

	// Open at both ends (north and south)
	for (let x = 1; x < w - 1; x++) {
		entries.push(door(x, 0));
		entries.push(door(x, h - 1));
	}

	// Torches every 8 tiles on both walls
	for (let ty = 4; ty < h - 2; ty += 8) {
		entries.push(torch(1, ty));
		entries.push(torch(w - 2, ty));
	}

	return {
		id: "long-corridor",
		name: "Long Corridor",
		width: w,
		height: h,
		tiles: toRecord(entries),
		theme: "cave",
	};
}

// ── 4. Grand Chamber (32 x 32) ──
// Large multi-purpose room with several exhibit positions.

function buildGrandChamber(): WingTemplate {
	const w = 32;
	const h = 32;
	const entries = fillRoom(w, h, "marble");

	// Two entrances: south center and east center
	const midX = Math.floor(w / 2);
	const midY = Math.floor(h / 2);
	for (let dx = -2; dx < 2; dx++) {
		entries.push(door(midX + dx, h - 1));
	}
	for (let dy = -2; dy < 2; dy++) {
		entries.push(door(w - 1, midY + dy));
	}

	// Ring of exhibit panels around a central area
	const cx = Math.floor(w / 2);
	const cy = Math.floor(h / 2);
	const radius = 8;
	const exhibitAngles = [0, 45, 90, 135, 180, 225, 270, 315];
	for (const angle of exhibitAngles) {
		const rad = (angle * Math.PI) / 180;
		const ex = cx + Math.round(Math.cos(rad) * radius);
		const ey = cy + Math.round(Math.sin(rad) * radius);
		// Only place if inside walls
		if (ex > 0 && ex < w - 1 && ey > 0 && ey < h - 1) {
			entries.push(exhibit(ex, ey));
		}
	}

	// Center pedestal
	entries.push(pedestal(cx, cy));

	// Corner torches
	entries.push(torch(2, 2));
	entries.push(torch(w - 3, 2));
	entries.push(torch(2, h - 3));
	entries.push(torch(w - 3, h - 3));

	return {
		id: "grand-chamber",
		name: "Grand Chamber",
		width: w,
		height: h,
		tiles: toRecord(entries),
		theme: "classical",
	};
}


export const WING_TEMPLATES: WingTemplate[] = [
	buildSmallCave(),
	buildGalleryHall(),
	buildLongCorridor(),
	buildGrandChamber(),
];

export function getWingTemplate(id: string): WingTemplate | undefined {
	return WING_TEMPLATES.find((t) => t.id === id);
}
