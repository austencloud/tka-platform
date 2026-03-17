/**
 * 8-Step CAP (Charlie Cushing's Innovation)
 *
 * Solves the problem of awkward timing transitions.
 *
 * Principle: "Two steps forward, one step back."
 * - Pattern 1 travels 3/4 circle in one direction
 * - Pattern 2 travels 1/2 circle in the opposite direction
 * - The distance mismatch cycles through both timing variations
 * - Performed in all four cardinal directions = 8 segments total
 *
 * "There are literally hundreds of possible 8-step CAPs."
 */

import type { SourcedClaim } from "@flow-arts/core";

/** A single step within an 8-step CAP */
export interface CAPStep {
	/** Step number (1-8) */
	stepNumber: number;
	/** Which pattern is active during this step */
	patternIndex: 1 | 2;
	/** Cardinal direction this step addresses */
	cardinalDirection: "north" | "east" | "south" | "west";
	/** Arc distance traveled (fraction of full circle) */
	arcDistance: string;
	/** Direction of travel for this step */
	travelDirection: "forward" | "backward";
}

/** An 8-step CAP definition */
export interface EightStepCAP {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Pattern 1: travels 3/4 circle in one direction */
	pattern1: string;
	/** Pattern 2: travels 1/2 circle in opposite direction */
	pattern2: string;
	/** The 8 steps of this CAP */
	steps: CAPStep[];
	/** Plain-language description of this specific 8-step CAP */
	description: string;
	/** Where this CAP definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with example 8-step CAPs from Charlie Cushing's series
export const EIGHT_STEP_CAPS: EightStepCAP[] = [];
