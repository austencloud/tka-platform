/**
 * Room Description Format
 *
 * Semantic room definitions for indoor scenes. Rooms are described
 * in terms of walls, entrances, objects, and lighting - not coordinates.
 * The RoomGeometryBuilder converts these to grid-snapped geometry.
 */

// ── Input types (what you write to define a room) ──

export type WallId = "north" | "south" | "east" | "west";

export type WallMaterialId = "stone" | "marble" | "wood" | "metal" | "sandstone";

export interface RoomDefinition {
	id: string;
	name: string;
	shape: "rectangular";
	/** East-west dimension in meters */
	width: number;
	/** North-south dimension in meters */
	depth: number;
	/** Floor to ceiling in meters */
	height: number;
	walls: {
		thickness: number;
		material: WallMaterialId;
	};
	entrance: EntranceDefinition;
	/** Future wing-to-wing doors */
	connections?: ConnectionDefinition[];
	objects: RoomObjectDefinition[];
	lighting: RoomLightDefinition[];
	spawn: {
		wall: WallId;
		distance: number;
		facing: WallId;
	};
}

export interface EntranceDefinition {
	wall: WallId;
	/** Opening width in meters */
	width: number;
	/** Opening height in meters */
	height: number;
	/** "center" or meters from wall start */
	offset: "center" | number;
	corridor?: {
		depth: number;
		height: number;
		width?: number;
	};
}

export interface ConnectionDefinition {
	toWingId: string;
	wall: WallId;
	width: number;
	height: number;
	offset: "center" | number;
}

export interface RoomObjectDefinition {
	id: string;
	type: RoomObjectType;
	placement: ObjectPlacement;
}

export type ObjectPlacement =
	| { anchor: "wall"; wall: WallId; position: "center" | number; distance: number; height?: number }
	| { anchor: "center"; offsetX?: number; offsetZ?: number; height?: number }
	| { anchor: "corner"; walls: [WallId, WallId]; distance: number; height?: number };

export type RoomObjectType =
	| "pedestal"
	| "torch-mount"
	| "bench"
	| "pillar"
	| "display-case"
	| "alcove";

export type RoomLightDefinition =
	| { type: "torch"; targetObjectId: string; intensity?: number }
	| { type: "spotlight"; target: string; angle: number; intensity?: number; color?: string }
	| { type: "ambient"; color: string; intensity: number }
	| { type: "hemisphere"; color: string; intensity: number };

// ── Output types (what the builder produces) ──

export interface SolvedRoom {
	walls: SolvedWallSegment[];
	floor: SolvedSurface;
	ceiling: SolvedSurface;
	entrance: SolvedEntrance;
	objects: SolvedObject[];
	objectsById: Map<string, SolvedObject>;
	colliders: ColliderDefinition[];
	spawnPoint: { x: number; y: number; z: number };
	spawnFacing: number;
	worldOffset: { x: number; y: number; z: number };
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
	gridCellSize: number;
}

export interface SolvedWallSegment {
	position: [number, number, number];
	size: [number, number, number];
	rotationY: number;
	materialId: WallMaterialId;
}

export interface SolvedSurface {
	position: [number, number, number];
	size: [number, number, number];
	materialId: WallMaterialId;
}

export interface SolvedEntrance {
	segments: SolvedWallSegment[];
	opening: {
		position: [number, number, number];
		size: [number, number];
		facing: number;
	};
	corridor?: {
		walls: SolvedWallSegment[];
		floor: SolvedSurface;
		ceiling: SolvedSurface;
	};
}

export interface SolvedObject {
	id: string;
	type: RoomObjectType;
	position: [number, number, number];
	rotationY: number;
}

export interface ColliderDefinition {
	shape: "box";
	position: [number, number, number];
	size: [number, number, number];
}


export const GRID_CELL = 0.5;

export function snapToGrid(value: number): number {
	return Math.round(value / GRID_CELL) * GRID_CELL;
}
