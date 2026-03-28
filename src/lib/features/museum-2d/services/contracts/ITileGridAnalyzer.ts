/**
 * ITileGridAnalyzer
 *
 * Converts a 2D MuseumGrid (tile map + wing regions) into 3D geometry
 * that the IndoorScene renderer can display. This is the bridge between
 * the 2D floor-plan editor and the 3D walkthrough.
 */

import type { MuseumGrid } from "../../domain/museum-grid-types";
import type { RoomDefinition } from "$lib/shared/3d/indoor/domain/room-types";

export interface AnalyzedMuseum {
	rooms: RoomDefinition[];
	connections: ConnectionDef[];
	exhibits: ExhibitPlacement[];
	performers: PerformerPlacement[];
	lights: LightPlacement[];
}

export interface ExhibitPlacement {
	id: string;
	position: [number, number, number];
	facing: number;
	sequenceId?: string;
}

export interface PerformerPlacement {
	id: string;
	position: [number, number, number];
	facing: number;
	sequenceId?: string;
	autoPlay: boolean;
}

export interface LightPlacement {
	type: "torch" | "spotlight";
	position: [number, number, number];
	intensity?: number;
}

export interface ConnectionDef {
	fromWingId: string;
	toWingId: string;
	position: [number, number, number];
}

export interface ITileGridAnalyzer {
	analyze(grid: MuseumGrid): AnalyzedMuseum;
}
