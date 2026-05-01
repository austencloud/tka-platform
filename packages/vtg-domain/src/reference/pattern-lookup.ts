/**
 * Pattern Lookup
 *
 * Functions for retrieving VTG patterns by ID, name, or filter criteria.
 */

import type { VTGPattern } from "../data/patterns.js";
import { VTG_PATTERNS } from "../data/patterns.js";

export function getVTGPattern(id: string): VTGPattern | undefined {
	const lower = id.toLowerCase();
	return VTG_PATTERNS.find((p) => p.id.toLowerCase() === lower);
}

export function getVTGPatterns(filter?: {
	categoryId?: string;
	shapeId?: string;
}): VTGPattern[] {
	if (!filter) return VTG_PATTERNS;
	return VTG_PATTERNS.filter(
		(p) =>
			(!filter.categoryId || p.categoryId === filter.categoryId) &&
			(!filter.shapeId || p.shapeId === filter.shapeId),
	);
}
