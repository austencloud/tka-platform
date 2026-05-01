/**
 * Spin Science Search
 *
 * Full-text search across Spin Science domain data: patterns, shapes,
 * planes, arm paths, atomic hybrids, and glossary terms.
 */

import type { Pattern324 } from "../data/patterns-324.js";
import type { AtomicHybrid } from "../data/atomic-hybrids.js";
import type { PlaneDefinition } from "../data/three-planes.js";
import type { ShapeMatrixEntry } from "../data/shape-matrix.js";
import type { PHATPattern } from "../data/phat-chart.js";
import type { FlowArtsGlossaryEntry } from "@flow-arts/core";

export type SpinScienceSearchResultType =
	| "pattern-324"
	| "atomic-hybrid"
	| "plane"
	| "shape-matrix"
	| "phat-pattern"
	| "glossary";

export interface SpinScienceSearchResult {
	/** What kind of result this is */
	type: SpinScienceSearchResultType;
	/** Matched item ID */
	id: string;
	/** Display name */
	name: string;
	/** Short description or definition */
	summary: string;
	/** The underlying data object */
	data:
		| Pattern324
		| AtomicHybrid
		| PlaneDefinition
		| ShapeMatrixEntry
		| PHATPattern
		| FlowArtsGlossaryEntry;
}

export function searchSpinScience(
	query: string,
): SpinScienceSearchResult[] {
	// TODO: Implement search once data files are populated
	void query;
	return [];
}
