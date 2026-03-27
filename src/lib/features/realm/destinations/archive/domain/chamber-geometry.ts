/**
 * Discovery Chamber - Wing 1 Room Geometry
 *
 * An enclosed cave-like room with a narrow entrance corridor.
 * All coordinates are in room-local space (meters).
 * The room is centered at origin, entrance faces south (+Z).
 *
 *     North (back wall - exhibit)
 *         ┌──────────────────┐
 *         │                  │
 *    West │   [Tablets]      │ East
 *         │                  │
 *         │  🔥          🔥  │
 *         │                  │
 *         │  🔥          🔥  │
 *         │                  │
 *         │       ★ spawn    │
 *         └────┐        ┌────┘
 *              │corridor│
 *              └────────┘
 *     South (entrance)
 */

export interface WallDef {
	/** Center position */
	position: [number, number, number];
	/** Dimensions [width, height, depth] */
	size: [number, number, number];
	/** Y-axis rotation in radians */
	rotationY: number;
}

// Room dimensions
const ROOM_WIDTH = 10;
const ROOM_DEPTH = 12;
const ROOM_HEIGHT = 4.5;
const WALL_THICKNESS = 0.4;

// Entrance corridor
const CORRIDOR_WIDTH = 2.8;
const CORRIDOR_DEPTH = 4;
const CORRIDOR_HEIGHT = 3.2;

// Slight angle on side walls for organic feel (5 degrees)
const WALL_ANGLE = 0.087; // ~5 degrees in radians

export const ROOM_CONFIG = {
	width: ROOM_WIDTH,
	depth: ROOM_DEPTH,
	height: ROOM_HEIGHT,
	corridorWidth: CORRIDOR_WIDTH,
	corridorDepth: CORRIDOR_DEPTH,
	corridorHeight: CORRIDOR_HEIGHT,
} as const;

/**
 * Ground Y offset: room floor sits at this height above the terrain ground.
 * We raise it slightly so the floor mesh doesn't z-fight with terrain.
 */
export const FLOOR_Y_OFFSET = 0.05;

/**
 * All wall segments that form the chamber.
 * Walls are thick box geometries.
 */
export function getChamberWalls(groundY: number): WallDef[] {
	const baseY = groundY + ROOM_HEIGHT / 2;
	const corridorBaseY = groundY + CORRIDOR_HEIGHT / 2;
	const halfW = ROOM_WIDTH / 2;
	const halfD = ROOM_DEPTH / 2;
	const halfCorridorW = CORRIDOR_WIDTH / 2;

	return [
		// Back wall (north) - exhibit wall, full width
		{
			position: [0, baseY, -halfD],
			size: [ROOM_WIDTH + WALL_THICKNESS, ROOM_HEIGHT, WALL_THICKNESS],
			rotationY: 0,
		},

		// Left wall (west) - slight inward angle
		{
			position: [-halfW, baseY, 0],
			size: [WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH],
			rotationY: WALL_ANGLE,
		},

		// Right wall (east) - slight inward angle (opposite)
		{
			position: [halfW, baseY, 0],
			size: [WALL_THICKNESS, ROOM_HEIGHT, ROOM_DEPTH],
			rotationY: -WALL_ANGLE,
		},

		// Front wall left (south-west) - from left edge to corridor opening
		{
			position: [-(halfW + halfCorridorW) / 2, baseY, halfD],
			size: [(halfW - halfCorridorW) + WALL_THICKNESS, ROOM_HEIGHT, WALL_THICKNESS],
			rotationY: 0,
		},

		// Front wall right (south-east) - from corridor opening to right edge
		{
			position: [(halfW + halfCorridorW) / 2, baseY, halfD],
			size: [(halfW - halfCorridorW) + WALL_THICKNESS, ROOM_HEIGHT, WALL_THICKNESS],
			rotationY: 0,
		},

		// Corridor left wall
		{
			position: [-halfCorridorW, corridorBaseY, halfD + CORRIDOR_DEPTH / 2],
			size: [WALL_THICKNESS, CORRIDOR_HEIGHT, CORRIDOR_DEPTH],
			rotationY: 0,
		},

		// Corridor right wall
		{
			position: [halfCorridorW, corridorBaseY, halfD + CORRIDOR_DEPTH / 2],
			size: [WALL_THICKNESS, CORRIDOR_HEIGHT, CORRIDOR_DEPTH],
			rotationY: 0,
		},
	];
}

/**
 * Ceiling segments (room + corridor have different heights)
 */
export function getCeilingSegments(groundY: number): WallDef[] {
	const halfD = ROOM_DEPTH / 2;

	return [
		// Main room ceiling
		{
			position: [0, groundY + ROOM_HEIGHT, 0],
			size: [ROOM_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, ROOM_DEPTH + WALL_THICKNESS],
			rotationY: 0,
		},

		// Corridor ceiling (lower)
		{
			position: [0, groundY + CORRIDOR_HEIGHT, halfD + CORRIDOR_DEPTH / 2],
			size: [CORRIDOR_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, CORRIDOR_DEPTH + WALL_THICKNESS],
			rotationY: 0,
		},
	];
}

/**
 * Floor segments
 */
export function getFloorSegments(groundY: number): WallDef[] {
	const halfD = ROOM_DEPTH / 2;

	return [
		// Main room floor
		{
			position: [0, groundY + FLOOR_Y_OFFSET, 0],
			size: [ROOM_WIDTH, 0.15, ROOM_DEPTH],
			rotationY: 0,
		},

		// Corridor floor
		{
			position: [0, groundY + FLOOR_Y_OFFSET, halfD + CORRIDOR_DEPTH / 2],
			size: [CORRIDOR_WIDTH, 0.15, CORRIDOR_DEPTH],
			rotationY: 0,
		},
	];
}

/**
 * Torch light positions (wall-mounted, slightly below eye level)
 */
export function getTorchPositions(groundY: number): [number, number, number][] {
	const torchY = groundY + 2.8;
	const halfW = ROOM_WIDTH / 2 - 0.3;

	return [
		// Back pair (near exhibit)
		[-halfW, torchY, -3],
		[halfW, torchY, -3],

		// Middle pair
		[-halfW, torchY, 1.5],
		[halfW, torchY, 1.5],
	];
}

/**
 * Exhibit position (center of back wall, on a pedestal)
 */
export function getExhibitPosition(groundY: number): [number, number, number] {
	return [0, groundY, -ROOM_DEPTH / 2 + 1.5];
}

/**
 * Spotlight position (above exhibit, angled down)
 */
export function getSpotlightPosition(groundY: number): [number, number, number] {
	return [0, groundY + ROOM_HEIGHT - 0.3, -ROOM_DEPTH / 2 + 2.5];
}

/**
 * Player spawn position (inside room, facing exhibit/north)
 */
export function getSpawnPosition(groundY: number): [number, number, number] {
	return [0, groundY + 1.0, 3.5];
}
