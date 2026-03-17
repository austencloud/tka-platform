/**
 * CAP Definitions
 *
 * CAP means different things to different people. Three distinct definitions
 * circulate in the flow arts community, from the most specific (the C-CAP
 * technique) to the broadest (any composite cyclic pattern).
 *
 * Knowing which definition your conversation partner uses is the first step
 * to productive discussion about CAPs.
 */

import type { SourcedClaim } from "@flow-arts/core";

/** Which of the three community definitions this entry describes */
export type CAPDefinitionScope = "specific" | "family" | "broad";

export interface CAPDefinition {
	/** Unique identifier */
	id: string;
	/** Which scope level: specific (C-CAP), family (C-CAP variants), broad (any composite cycle) */
	scope: CAPDefinitionScope;
	/** Short label */
	name: string;
	/** Plain-language explanation */
	description: string;
	/** Key mechanical details */
	mechanism?: string;
	/** The shape or visual result */
	visualResult?: string;
	/** Where this definition comes from */
	source: SourcedClaim;
}

// TODO: Populate with the three definitions from flow-arts-theory-ecosystem.md:
//   1. Definition 1 — The C-CAP specifically (extension + antispin reversal, kidney-bean/heart shape)
//   2. Definition 2 — The C-CAP family (any two shapes with hand-reversal mechanism)
//   3. Definition 3 — The original broad concept ("any composite cyclic pattern")
export const CAP_DEFINITIONS: CAPDefinition[] = [];
