/**
 * Tech Tiles 3D Pattern Player
 *
 * Lorq Nichols' interactive Unity-based visualization tool for
 * poi patterns. Each "tile" represents a pattern configuration
 * defined by 4 elements: left hand, right hand, left prop, right prop.
 *
 * For each element, you specify: beginning position, plane,
 * rotation direction, and speed.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** Rotation direction for a hand or prop */
export type RotationDirection = "clockwise" | "counterclockwise";

/** Configuration for a single element (hand or prop) in a Tech Tile */
export interface TechTileElement {
	/** Which element: left hand, right hand, left prop, right prop */
	element: "left-hand" | "right-hand" | "left-prop" | "right-prop";
	/** Starting position identifier */
	beginningPosition: string;
	/** Which plane this element moves in */
	planeId: string;
	/** Direction of rotation */
	rotationDirection: RotationDirection;
	/** Rotation speed (relative to base tempo) */
	speed: number;
}

/** A complete Tech Tile configuration: all 4 elements defining one pattern */
export interface TechTilesConfig {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** The 4 element configurations */
	elements: TechTileElement[];
	/** Plain-language description of this pattern */
	description: string;
	/** Which prop types this tile supports */
	supportedProps?: string[];
	/** Where this configuration comes from */
	source: SourcedClaim;
}

// TODO: Populate with Tech Tiles configurations from the Book of P.H.A.T.
export const TECH_TILES_CONFIGS: TechTilesConfig[] = [];
