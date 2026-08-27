import type { Direction } from "./museum-grid-types";
import type { ScreenDecade } from "./layout-types";

// ── Segment types ──

export type DoorSegment = {
	type: "door";
	edgeId: string;
	width: number;
};

export type ExhibitSegment = {
	type: "exhibit";
	refId: string;
	size: "standard" | "large" | "dev-whiteboard";
	facing: Direction;
	isAnchor?: boolean;
	group?: string;
};

export type TorchSegment = {
	type: "torch";
};

export type ScreenSegment = {
	type: "screen";
	refId: string;
	facing: Direction;
	decade?: ScreenDecade;
};

export type RopeSegment = {
	type: "rope";
	edgeId: string;
	width: number;
};

export type SignSegment = {
	type: "sign";
	refId: string;
};

export type GapSegment = {
	type: "gap";
	minTiles: number;
};

export type WallSegment =
	| DoorSegment
	| ExhibitSegment
	| TorchSegment
	| ScreenSegment
	| RopeSegment
	| SignSegment
	| GapSegment;

/** The four walls a room defines segments for, as keyed in `RoomNode.walls`. */
export type WallName = "north" | "south" | "east" | "west";

export type WallDefinition = {
	segments: WallSegment[];
	minMargin: number;
	/** How the authored segment run uses any spare wall length. */
	alignment?: "start" | "center" | "end";
};

// ── Dimension computation ──

const EXHIBIT_WIDTH: Record<ExhibitSegment["size"], number> = {
	standard: 2,
	large: 4,
	"dev-whiteboard": 6,
};

export function computeSegmentWidth(segment: WallSegment): number {
	switch (segment.type) {
		case "door":
			return segment.width;
		case "exhibit":
			return EXHIBIT_WIDTH[segment.size];
		case "torch":
			return 1;
		case "screen":
			return 3;
		case "rope":
			return segment.width;
		case "sign":
			return 2;
		case "gap":
			return segment.minTiles;
	}
}

export function computeWallLength(wall: WallDefinition): number {
	const segmentTotal = wall.segments.reduce(
		(sum, seg) => sum + computeSegmentWidth(seg),
		0,
	);
	return wall.minMargin * 2 + segmentTotal;
}

export function computeRoomDimensions(room: {
	walls: {
		north: WallDefinition;
		south: WallDefinition;
		east: WallDefinition;
		west: WallDefinition;
	};
	minInteriorWidth?: number;
	minInteriorHeight?: number;
}): { w: number; h: number } {
	const northLen = computeWallLength(room.walls.north);
	const southLen = computeWallLength(room.walls.south);
	const eastLen = computeWallLength(room.walls.east);
	const westLen = computeWallLength(room.walls.west);

	// Scale factor: makes ALL rooms proportionally larger.
	// 1.0 = original size, 1.5 = 50% bigger, 2.0 = double.
	const ROOM_SCALE = 1.5;

	const baseW = Math.max(northLen, southLen, room.minInteriorWidth ?? 0);
	const baseH = Math.max(eastLen, westLen, room.minInteriorHeight ?? 0);

	const w = Math.ceil(baseW * ROOM_SCALE) + 2;
	const h = Math.ceil(baseH * ROOM_SCALE) + 2;

	return { w, h };
}
