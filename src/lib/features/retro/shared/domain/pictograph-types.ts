/**
 * Shared pictograph data model for all retro eras.
 *
 * These types represent TKA notation concepts that are era-agnostic:
 * grid locations, hand data, motion types, and pictograph structure.
 * Each era implements its own RENDERER for this data (ASCII, pixel art, vector, etc.).
 */

/** Cardinal/intercardinal grid positions + center */
export type RetroGridLocation = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "c";

/** Prop motion type */
export type RetroMotionType = "pro" | "anti" | "static" | "dash";

/** Prop orientation relative to the body */
export type RetroOrientation = "in" | "out" | "clock" | "counter";

/** One hand's state within a pictograph */
export interface RetroHandData {
	readonly color: "blue" | "red";
	readonly location: RetroGridLocation;
	readonly orientation: RetroOrientation;
	readonly motionType: RetroMotionType;
	readonly endLocation: RetroGridLocation;
	readonly turns: number;
}

/** Complete pictograph: two hands on a grid */
export interface RetroPictographData {
	readonly letter: string;
	readonly blueHand: RetroHandData;
	readonly redHand: RetroHandData;
	readonly gridMode: "diamond" | "box";
}
