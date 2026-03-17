/**
 * Book of P.H.A.T. (Patterns, Hybrids, And Transitions)
 *
 * Lorq Nichols' 64-pattern catalog organized in Tech Tiles format.
 * Color-coded 8x8 grid. Part 1 is a theory manual covering the
 * foundations; Part 2 catalogs all 64 patterns with Tech Tiles diagrams.
 *
 * Published as part of VTG supplementary materials.
 * Covers the 1:3 pattern set (64 patterns).
 */

import type { SourcedClaim } from "@flow-arts/core";

/** A single pattern from the P.H.A.T. Chart */
export interface PHATPattern {
	/** Unique identifier */
	id: string;
	/** Pattern name */
	name: string;
	/** Row index in the 8x8 grid (0-7) */
	row: number;
	/** Column index in the 8x8 grid (0-7) */
	column: number;
	/** Color code assigned in the chart */
	colorCode?: string;
	/** Plain-language description of the pattern */
	description: string;
	/** VTG category this pattern falls under (TS, TO, SS, SO) */
	vtgCategory?: string;
	/** Where this pattern definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the 64 P.H.A.T. patterns from the Book of P.H.A.T. Vol 1
export const PHAT_PATTERNS: PHATPattern[] = [];
