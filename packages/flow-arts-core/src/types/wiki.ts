/**
 * WikiArticle — structured representation of a wiki page
 */

import type { ExternalReference } from "./reference.js";

export interface WikiSection {
	/** Section heading */
	heading: string;
	/** Section content (plain text, markup stripped) */
	content: string;
	/** Nesting level (2 = ==, 3 = ===, etc.) */
	level: number;
}

export interface WikiArticle {
	/** Article title */
	title: string;
	/** Structured sections */
	sections: WikiSection[];
	/** MediaWiki categories */
	categories: string[];
	/** Infobox key-value pairs if present */
	infobox?: Record<string, string>;
	/** Internal wiki links found in the article */
	internalLinks: string[];
	/** External references */
	externalRefs: ExternalReference[];
}

export interface WikiSearchResult {
	/** Article title */
	title: string;
	/** Matching section heading */
	section?: string;
	/** Relevant excerpt */
	excerpt: string;
	/** Match relevance score */
	relevance: number;
}
