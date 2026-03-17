/**
 * SourcedClaim — provenance tracking for domain knowledge
 *
 * Every factual claim in a flow arts domain package must have a source.
 * This prevents misattribution and lets consumers distinguish between
 * original system documentation, community extensions, and cross-system interpretations.
 */

/** How a claim was sourced */
export type ClaimSourceType = "document" | "community" | "tka-interpretation";

/** A factual claim with provenance */
export interface SourcedClaim {
	/** The factual statement */
	claim: string;
	/** Where this claim comes from */
	sourceType: ClaimSourceType;
	/** Specific source reference: "VTG V1 p.4", URL, or person name */
	sourceRef?: string;
}
