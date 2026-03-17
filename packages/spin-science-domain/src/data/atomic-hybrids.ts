/**
 * 144 Atomic Hybrids
 *
 * Lorq Nichols' atomic hybrid catalog: 12 shapes x 12 arm paths = 144.
 *
 * Core insight: "IF YOU KNOW A QUARTER OF A PATTERN, YOU KNOW THE
 * WHOLE PATTERN." Each atomic hybrid is the smallest repeating unit
 * of a hybrid pattern. Knowing the atomic form lets you reconstruct
 * the full pattern by repetition.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** One of the 12 shapes used in the atomic hybrid system */
export interface AtomicShape {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Plain-language description */
	description: string;
	/** Where this shape definition comes from */
	source: SourcedClaim;
}

/** A single atomic hybrid: one shape combined with one arm path */
export interface AtomicHybrid {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Which shape this hybrid uses */
	shapeId: string;
	/** Which arm path this hybrid uses */
	armPathId: string;
	/** Plain-language description */
	description: string;
	/** Where this hybrid definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 12 atomic shapes
export const ATOMIC_SHAPES: AtomicShape[] = [];

// TODO: Populate with the 144 atomic hybrids (12 shapes x 12 arm paths)
export const ATOMIC_HYBRIDS: AtomicHybrid[] = [];
