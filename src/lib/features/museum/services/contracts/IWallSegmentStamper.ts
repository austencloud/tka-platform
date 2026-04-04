import type { MuseumTile, ExhibitDefinition } from "../../domain/museum-grid-types";
import type { PlacedRoom, RoomEdge } from "../../domain/layout-types";

export interface DoorPosition {
	x: number;
	y: number;
	wall: string;
	edgeId: string;
}

export interface StampResult {
	exhibits: ExhibitDefinition[];
	doorPositions: DoorPosition[];
}

export interface IWallSegmentStamper {
	stampRoom(
		tiles: Map<string, MuseumTile>,
		room: PlacedRoom,
		edges: RoomEdge[],
	): StampResult;
}
