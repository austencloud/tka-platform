/**
 * 8-Step CAP (Charlie Cushing)
 *
 * Charlie's specific innovation for solving awkward timing transitions.
 * The principle is "two steps forward, one step back": Pattern 1 travels
 * 3/4 circle in one direction, Pattern 2 travels 1/2 circle in the opposite
 * direction. The distance mismatch cycles through both timing variations.
 * Performed in all four cardinal directions = 8 segments total.
 *
 * "There are literally hundreds of possible 8-step CAPs."
 */

import type { SourcedClaim } from "@flow-arts/core";

/** One segment of an 8-step CAP */
export interface EightStepSegment {
	/** Segment number (1-8) */
	step: number;
	/** Which pattern is active in this segment */
	patternRole: "A" | "B";
	/** Cardinal direction this segment traverses */
	direction: string;
	/** Fraction of circle covered (e.g. 3/4 or 1/2) */
	arcFraction: string;
	/** Travel direction relative to the previous segment */
	travelDirection: "forward" | "backward";
}

export interface EightStepCAP {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** The core principle: "two steps forward, one step back" */
	principle: string;
	/** Pattern A description (travels 3/4 circle) */
	patternA: string;
	/** Pattern B description (travels 1/2 circle in opposite direction) */
	patternB: string;
	/** The 8 segments */
	segments: EightStepSegment[];
	/** Why the mismatch matters (cycles through both timing variations) */
	mechanismExplanation: string;
	/** Where this comes from */
	source: SourcedClaim;
}

// TODO: Populate with Charlie Cushing's 8-step CAP structure:
//   - The "two steps forward, one step back" principle
//   - 3/4 circle + 1/2 circle in opposite direction
//   - All four cardinal directions = 8 segments
//   - Source: Charlie Cushing's 9-Square Theory video series
export const EIGHT_STEP_CAPS: EightStepCAP[] = [];
