/**
 * FlowArtsGlossaryEntry — term definitions with source tracking
 */

import type { SourcedClaim } from "./sourced-claim.js";

export interface FlowArtsGlossaryEntry {
	/** The term being defined */
	term: string;
	/** Plain-language definition */
	definition: string;
	/** Where this definition comes from */
	source: SourcedClaim;
	/** Alternative names for this term */
	aliases?: string[];
	/** Related terms in the same or other frameworks */
	relatedTerms?: string[];
	/** Grouping category */
	category: string;
	/** Which framework this term belongs to */
	framework: string;
}
