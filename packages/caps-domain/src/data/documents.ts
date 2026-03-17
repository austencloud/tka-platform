/**
 * CAP Source Documents
 *
 * Metadata for primary source documents that define or formalize
 * Continuous Assembly Patterns theory.
 */

import type { ExternalReference } from "@flow-arts/core";

export interface SourceDocument extends ExternalReference {
	/** Document version or edition */
	version?: string;
	/** Number of pages */
	pageCount?: number;
	/** Brief summary of the document's scope */
	summary: string;
}

// TODO: Populate with CAP source documents:
//   - Zaltymbunk's mathematical CAP framework (Home of Poi forums)
//   - "What are CAPs?" forum thread
//   - Charlie Cushing's 9-Square Theory video series (covers 8-step CAP)
//   - Transition Theory documentation
//   - Encyclo-poi-dia Vol 2 (Alien Jon + Zan Moore)
export const CAP_DOCUMENTS: SourceDocument[] = [];
