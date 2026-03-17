/**
 * CAP Transition Theory
 *
 * Soft, Hard, and Mixed transitions describe how patterns connect.
 * Originally formalized by Noel Yee and Jordan Campbell (2010), this
 * framework explains what happens to hand direction and poi direction
 * at the boundary between two patterns.
 *
 * Mixed transitions are the mechanism behind CAPs: they convert arcs
 * to loops and vice versa.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** What happens to hand and poi at a transition boundary */
export type DirectionChange = "maintains" | "reverses";

/** Arc/loop character of the pattern */
export type PatternCharacter = "arc" | "loop";

export interface CAPTransition {
	/** Unique identifier */
	id: string;
	/** Transition type name */
	name: string;
	/** What the hand does at the boundary */
	handBehavior: DirectionChange;
	/** What the poi does at the boundary */
	poiBehavior: DirectionChange;
	/** Effect on pattern character (arcs vs loops) */
	characterEffect: string;
	/** Plain-language description */
	description: string;
	/**
	 * Arcs = extensions (hand and poi move parallel, don't intersect).
	 * Loops = antispin/inspin petals, isolations (poi and hand paths intersect).
	 */
	arcLoopNote?: string;
	/** Where this transition definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the four transition types:
//   1. Soft: hand maintains, poi maintains — preserves figure character
//   2. Hard: hand reverses, poi reverses — mirror image, opposite direction
//   3. Mixed (C-CAP type): hand reverses, poi maintains — reverses arc/loop character
//   4. Mixed (other): hand maintains, poi reverses — reverses arc/loop character
//   Source: Noel Yee + Jordan Campbell transition theory (2010)
export const CAP_TRANSITIONS: CAPTransition[] = [];
