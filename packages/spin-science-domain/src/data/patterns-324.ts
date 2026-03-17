/**
 * 324 Patterns Framework
 *
 * Lorq Nichols' comprehensive pattern catalog:
 * 27 arm paths x 4 minimal-beat shapes x 3 planes = 324 patterns.
 *
 * The 4 minimal-beat shapes are: Extension, Isolation, 2VA, 2HA.
 * Each pattern is a unique combination of arm path, shape, and plane.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** The 4 minimal-beat shapes used in the 324 framework */
export type MinimalBeatShapeId = "extension" | "isolation" | "2va" | "2ha";

/** A single pattern from the 324 catalog */
export interface Pattern324 {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Which arm path this pattern uses */
	armPathId: string;
	/** Which minimal-beat shape */
	shapeId: MinimalBeatShapeId;
	/** Which plane this pattern is performed in */
	planeId: string;
	/** Plain-language description */
	description: string;
	/** Where this pattern definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 324 patterns (27 arm paths x 4 shapes x 3 planes)
export const PATTERNS_324: Pattern324[] = [];
