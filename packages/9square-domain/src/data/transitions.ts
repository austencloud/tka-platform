/**
 * Position-Based Transitions
 *
 * How movements connect via grid positions. The 9-Square grid enables
 * finding transitions between movements, switching between box and diamond
 * mode via soft transitions, and algorithms for changing timing/direction
 * through CAPs and polyrhythm hybrids.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** How the transition is executed */
export type GridTransitionMethod = "soft" | "hard" | "mixed" | "cap" | "polyrhythm-hybrid";

/** A transition between two grid positions or modes */
export interface GridTransition {
	/** Unique identifier */
	id: string;
	/** Grid position or mode transitioning from */
	fromId: string;
	/** Grid position or mode transitioning to */
	toId: string;
	/** Method of transition */
	method: GridTransitionMethod;
	/** Whether this is a mode switch (diamond <-> box) or position move */
	isModeSwitch: boolean;
	/** Plain-language description */
	description: string;
	/** Technique required to execute this transition */
	technique?: string;
	/** Where this transition definition comes from */
	source: SourcedClaim;
}

// TODO: Populate from Charlie Cushing's 9-Square Theory video series
export const NINE_SQUARE_TRANSITIONS: GridTransition[] = [];
