/**
 * Spin Science Source Documents
 *
 * Metadata for primary source documents: Book of P.H.A.T. Vol 1,
 * and other foundational texts that define the Spin Science frameworks.
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

// TODO: Populate with Book of P.H.A.T. Vol 1 metadata, supplementary documents
export const SPIN_SCIENCE_DOCUMENTS: SourceDocument[] = [];
