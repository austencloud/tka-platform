/**
 * Pattern Lookup
 *
 * Functions for retrieving 324 Patterns and 144 Atomic Hybrids
 * by ID, name, or filter criteria.
 */

import type { Pattern324 } from "../data/patterns-324.js";
import type { AtomicHybrid } from "../data/atomic-hybrids.js";
import { PATTERNS_324 } from "../data/patterns-324.js";
import { ATOMIC_HYBRIDS } from "../data/atomic-hybrids.js";

/** Get a single 324 Pattern by ID */
export function get324Pattern(id: string): Pattern324 | undefined {
	// TODO: Implement lookup once pattern data is populated
	return PATTERNS_324.find((p) => p.id === id);
}

/** Get 324 Patterns filtered by arm path, shape, or plane */
export function get324Patterns(filter?: {
	armPathId?: string;
	shapeId?: string;
	planeId?: string;
}): Pattern324[] {
	// TODO: Implement filtering once pattern data is populated
	if (!filter) return PATTERNS_324;
	return PATTERNS_324.filter(
		(p) =>
			(!filter.armPathId || p.armPathId === filter.armPathId) &&
			(!filter.shapeId || p.shapeId === filter.shapeId) &&
			(!filter.planeId || p.planeId === filter.planeId),
	);
}

export function getAtomicHybrid(id: string): AtomicHybrid | undefined {
	// TODO: Implement lookup once hybrid data is populated
	return ATOMIC_HYBRIDS.find((h) => h.id === id);
}

export function getAtomicHybrids(filter?: {
	shapeId?: string;
	armPathId?: string;
}): AtomicHybrid[] {
	// TODO: Implement filtering once hybrid data is populated
	if (!filter) return ATOMIC_HYBRIDS;
	return ATOMIC_HYBRIDS.filter(
		(h) =>
			(!filter.shapeId || h.shapeId === filter.shapeId) &&
			(!filter.armPathId || h.armPathId === filter.armPathId),
	);
}
