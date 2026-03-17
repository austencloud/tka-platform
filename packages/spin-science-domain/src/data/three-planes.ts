/**
 * 3 Planes System
 *
 * Lorq Nichols' spatial framework for classifying the three fundamental
 * planes of movement in prop manipulation. Each plane is defined by
 * two axes and divides the body along the third.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** One of the three fundamental movement planes */
export interface PlaneDefinition {
	/** Unique identifier: "wall", "wheel", "floor" */
	id: string;
	/** Full display name */
	name: string;
	/** Single-letter abbreviation used in notation: "W", "H", "F" */
	abbreviation: string;
	/** The two axes that define this plane */
	axes: [string, string];
	/** How this plane divides the body */
	bodyDivision: string;
	/** Plain-language description */
	description: string;
	/** Where this definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 3 plane definitions
export const PLANES: PlaneDefinition[] = [];
