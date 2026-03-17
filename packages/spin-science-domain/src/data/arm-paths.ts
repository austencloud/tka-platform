/**
 * 27 Arm Path Theory
 *
 * Lorq Nichols' framework for arm positions and transitions.
 * 3 axes x 3 planes x 3 positions = 9 arm positions.
 * 27 arm paths = the transitions between those 9 positions.
 *
 * Each arm path describes a specific way the arm moves from
 * one position to another within a given plane.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** One of the 9 arm positions (3 axes x 3 planes) */
export interface ArmPosition {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Which axis this position is on */
	axis: string;
	/** Which plane this position exists in */
	planeId: string;
	/** Plain-language description of the body position */
	description: string;
	/** Where this definition comes from */
	source: SourcedClaim;
}

/** One of the 27 arm paths (transitions between arm positions) */
export interface ArmPath {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Starting arm position */
	fromPositionId: string;
	/** Ending arm position */
	toPositionId: string;
	/** Which plane this path travels through */
	planeId: string;
	/** Plain-language description of the arm movement */
	description: string;
	/** Where this definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 9 arm positions
export const ARM_POSITIONS: ArmPosition[] = [];

// TODO: Populate with the 27 arm paths
export const ARM_PATHS: ArmPath[] = [];
