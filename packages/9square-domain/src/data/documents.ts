/**
 * 9-Square / QFT Source Documents
 *
 * Metadata for primary source documents and reference materials
 * that define the 9-Square Theory and QFT Notation frameworks.
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

// TODO: Populate with source document metadata (video transcripts, written guides)
export const NINE_SQUARE_DOCUMENTS: SourceDocument[] = [];
