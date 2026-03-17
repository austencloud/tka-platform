/**
 * VTG Transition Theory
 *
 * Created by Noel Yee and Jordan Campbell in 2010. Transition Theory
 * describes how to transfer between different timing and direction
 * combinations by knowing when to change the direction of one hand.
 *
 * Four transition types: Soft, Hard, Mixed (type 1), Mixed (type 2).
 * These operate on the four VTG categories (TS, TO, SS, SO) and also
 * affect whether a pattern has arc or loop character.
 *
 * Sources: VTG V1 pp. 5-7, flow-arts-theory-ecosystem.md
 */

import type { SourcedClaim } from "@flow-arts/core";

/**
 * The four transition types from Transition Theory.
 *
 * "soft" — both hand and prop maintain direction
 * "hard" — both hand and prop reverse direction
 * "mixed-1" — hand reverses, prop maintains (the C-CAP mechanism)
 * "mixed-2" — hand maintains, prop reverses
 */
export type TransitionType = "soft" | "hard" | "mixed-1" | "mixed-2";

export interface VTGTransition {
	/** Unique identifier */
	id: string;
	/** The transition type */
	transitionType: TransitionType;
	/** Display name */
	name: string;
	/** What the hand does during the transition */
	handBehavior: "maintains" | "reverses";
	/** What the prop does during the transition */
	propBehavior: "maintains" | "reverses";
	/** Effect on the pattern's arc/loop character */
	shapeEffect: string;
	/** Plain-language description */
	description: string;
	/** Where this transition definition comes from */
	source: SourcedClaim;
}

export interface TransitionMatrixEntry {
	/** Category transitioning from (e.g. "tog-same") */
	fromCategoryId: string;
	/** Category transitioning to (e.g. "tog-opp") */
	toCategoryId: string;
	/** Which transition type connects these categories */
	transitionType: TransitionType;
	/** What changes: "direction", "timing", or "both" */
	whatChanges: "direction" | "timing" | "both";
	/** Where this mapping comes from */
	source: SourcedClaim;
}

export interface TransitionMatrix {
	/** Which starting category this matrix describes */
	fromCategoryId: string;
	/** Description of the matrix */
	description: string;
	/** The transition entries from this starting category */
	entries: TransitionMatrixEntry[];
	/** Where this matrix comes from */
	source: SourcedClaim;
}

/**
 * The four transition types from VTG Transition Theory.
 *
 * Transition Theory trains the user to know when to change direction of one
 * hand. Each type describes what happens to the hand path and the prop path
 * during the transition. "Arcs" are extensions (hand and prop paths run
 * parallel). "Loops" are antispin petals, inspin petals, and isolations
 * (hand and prop paths intersect).
 */
export const VTG_TRANSITIONS: VTGTransition[] = [
	{
		id: "soft",
		transitionType: "soft",
		name: "Soft Transition",
		handBehavior: "maintains",
		propBehavior: "maintains",
		shapeEffect:
			"Preserves arc/loop character. Arcs stay arcs, loops stay loops.",
		description:
			"Both the hand and the prop maintain their direction of travel. The figure's character (whether it traces arcs or loops) is preserved through the transition.",
		source: {
			claim:
				"Soft transition: hand maintains direction, poi maintains direction. Preserves figure character.",
			sourceType: "document",
			sourceRef: "VTG V1 pp. 5-7",
		},
	},
	{
		id: "hard",
		transitionType: "hard",
		name: "Hard Transition",
		handBehavior: "reverses",
		propBehavior: "reverses",
		shapeEffect:
			"Creates the mirror image moving in the opposite direction. Arc/loop character is preserved.",
		description:
			"Both the hand and the prop reverse their direction of travel. The resulting pattern is a mirror image moving in the opposite direction.",
		source: {
			claim:
				"Hard transition: hand reverses, poi reverses. Creates mirror image, opposite direction.",
			sourceType: "document",
			sourceRef: "VTG V1 pp. 5-7",
		},
	},
	{
		id: "mixed-1",
		transitionType: "mixed-1",
		name: "Mixed Transition (Type 1)",
		handBehavior: "reverses",
		propBehavior: "maintains",
		shapeEffect:
			"Reverses arc/loop character. Arcs become loops, loops become arcs. This is the mechanism behind C-CAPs (Continuous Assembly Patterns).",
		description:
			"The hand reverses direction while the prop maintains its direction. This converts arcs to loops and vice versa, which is the fundamental mechanism behind C-CAPs.",
		source: {
			claim:
				"Mixed type 1 transition: hand reverses, poi maintains. Reverses arc/loop character. This is the mechanism behind C-CAP.",
			sourceType: "document",
			sourceRef: "VTG V1 pp. 5-7",
		},
	},
	{
		id: "mixed-2",
		transitionType: "mixed-2",
		name: "Mixed Transition (Type 2)",
		handBehavior: "maintains",
		propBehavior: "reverses",
		shapeEffect:
			"Reverses arc/loop character. Arcs become loops, loops become arcs.",
		description:
			"The hand maintains its direction while the prop reverses direction. Like mixed type 1, this also converts arcs to loops and vice versa.",
		source: {
			claim:
				"Mixed type 2 transition: hand maintains, poi reverses. Reverses arc/loop character.",
			sourceType: "document",
			sourceRef: "VTG V1 pp. 5-7",
		},
	},
];

/**
 * Transition matrices from VTG V1 pp. 6-7.
 *
 * VTG V1 provides four matrices, one for each starting category (TS, TO, SS, SO).
 * Each matrix shows which transition type takes you from the starting category
 * to each of the other three categories.
 *
 * The key insight: changing only direction (same -> opp or opp -> same) within
 * the same timing is a different transition type than changing timing
 * (tog -> split or split -> tog) within the same direction.
 */
export const VTG_TRANSITION_MATRICES: TransitionMatrix[] = [
	{
		fromCategoryId: "tog-same",
		description:
			"Transitions from Together/Same (TS). Covers tog/same -> tog/opp, tog/same -> split/same, and tog/same -> split/opp.",
		entries: [
			{
				fromCategoryId: "tog-same",
				toCategoryId: "tog-opp",
				transitionType: "hard",
				whatChanges: "direction",
				source: {
					claim:
						"TS to TO: both props reverse direction (hard transition). Timing stays together, direction changes from same to opposite.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
			{
				fromCategoryId: "tog-same",
				toCategoryId: "split-same",
				transitionType: "soft",
				whatChanges: "timing",
				source: {
					claim:
						"TS to SS: both props maintain direction (soft transition). Direction stays same, timing changes from together to split.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
			{
				fromCategoryId: "tog-same",
				toCategoryId: "split-opp",
				transitionType: "mixed-1",
				whatChanges: "both",
				source: {
					claim:
						"TS to SO: hand reverses, prop maintains (mixed type 1). Both timing and direction change.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
		],
		source: {
			claim:
				"Tog/Sam Hands transition matrix showing transitions from together/same to all other categories.",
			sourceType: "document",
			sourceRef: "VTG V1 p.6",
		},
	},
	{
		fromCategoryId: "tog-opp",
		description:
			"Transitions from Together/Opposite (TO). Covers tog/opp -> tog/same, tog/opp -> split/opp, and tog/opp -> split/same.",
		entries: [
			{
				fromCategoryId: "tog-opp",
				toCategoryId: "tog-same",
				transitionType: "hard",
				whatChanges: "direction",
				source: {
					claim:
						"TO to TS: both props reverse direction (hard transition). Timing stays together, direction changes from opposite to same.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
			{
				fromCategoryId: "tog-opp",
				toCategoryId: "split-opp",
				transitionType: "soft",
				whatChanges: "timing",
				source: {
					claim:
						"TO to SO: both props maintain direction (soft transition). Direction stays opposite, timing changes from together to split.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
			{
				fromCategoryId: "tog-opp",
				toCategoryId: "split-same",
				transitionType: "mixed-1",
				whatChanges: "both",
				source: {
					claim:
						"TO to SS: hand reverses, prop maintains (mixed type 1). Both timing and direction change.",
					sourceType: "document",
					sourceRef: "VTG V1 p.6",
				},
			},
		],
		source: {
			claim:
				"Tog/Opp Hands transition matrix showing transitions from together/opposite to all other categories.",
			sourceType: "document",
			sourceRef: "VTG V1 p.6",
		},
	},
	{
		fromCategoryId: "split-same",
		description:
			"Transitions from Split/Same (SS). Covers split/same -> split/opp, split/same -> tog/same, and split/same -> tog/opp.",
		entries: [
			{
				fromCategoryId: "split-same",
				toCategoryId: "split-opp",
				transitionType: "hard",
				whatChanges: "direction",
				source: {
					claim:
						"SS to SO: both props reverse direction (hard transition). Timing stays split, direction changes from same to opposite.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
			{
				fromCategoryId: "split-same",
				toCategoryId: "tog-same",
				transitionType: "soft",
				whatChanges: "timing",
				source: {
					claim:
						"SS to TS: both props maintain direction (soft transition). Direction stays same, timing changes from split to together.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
			{
				fromCategoryId: "split-same",
				toCategoryId: "tog-opp",
				transitionType: "mixed-1",
				whatChanges: "both",
				source: {
					claim:
						"SS to TO: hand reverses, prop maintains (mixed type 1). Both timing and direction change.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
		],
		source: {
			claim:
				"Split/sam Hands transition matrix showing transitions from split/same to all other categories.",
			sourceType: "document",
			sourceRef: "VTG V1 p.7",
		},
	},
	{
		fromCategoryId: "split-opp",
		description:
			"Transitions from Split/Opposite (SO). Covers split/opp -> split/same, split/opp -> tog/opp, and split/opp -> tog/same.",
		entries: [
			{
				fromCategoryId: "split-opp",
				toCategoryId: "split-same",
				transitionType: "hard",
				whatChanges: "direction",
				source: {
					claim:
						"SO to SS: both props reverse direction (hard transition). Timing stays split, direction changes from opposite to same.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
			{
				fromCategoryId: "split-opp",
				toCategoryId: "tog-opp",
				transitionType: "soft",
				whatChanges: "timing",
				source: {
					claim:
						"SO to TO: both props maintain direction (soft transition). Direction stays opposite, timing changes from split to together.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
			{
				fromCategoryId: "split-opp",
				toCategoryId: "tog-same",
				transitionType: "mixed-2",
				whatChanges: "both",
				source: {
					claim:
						"SO to TS: hand maintains, prop reverses (mixed type 2). Both timing and direction change.",
					sourceType: "document",
					sourceRef: "VTG V1 p.7",
				},
			},
		],
		source: {
			claim:
				"Split/opp Hands transition matrix showing transitions from split/opposite to all other categories.",
			sourceType: "document",
			sourceRef: "VTG V1 p.7",
		},
	},
];
