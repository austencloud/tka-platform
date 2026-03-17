/**
 * CAP Search
 *
 * Full-text search across CAP domain data: definitions, math constructs,
 * transitions, glossary terms, and contributors.
 */

import type { CAPDefinition } from "../data/definitions.js";
import type { CAPTransition } from "../data/transitions.js";
import type { EightStepCAP } from "../data/eight-step-cap.js";
import type { FlowArtsGlossaryEntry } from "@flow-arts/core";

export type CAPSearchResultType =
	| "definition"
	| "transition"
	| "eight-step"
	| "glossary";

export interface CAPSearchResult {
	/** What kind of result this is */
	type: CAPSearchResultType;
	/** Matched item ID */
	id: string;
	/** Display name */
	name: string;
	/** Short description or definition */
	summary: string;
	/** The underlying data object */
	data: CAPDefinition | CAPTransition | EightStepCAP | FlowArtsGlossaryEntry;
}

/** Search across all CAP domain data */
export function searchCAPs(query: string): CAPSearchResult[] {
	// TODO: Implement search once data files are populated
	void query;
	return [];
}
