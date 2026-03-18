/**
 * IPublicSequenceHashMatcher - Matches decoded URL sequences against the public library
 *
 * Computes a SHA-256 fingerprint from the SequenceEncoder's pipe-delimited output
 * and queries publicSequences by encoderHash. Used for progressive enrichment:
 * if a shared URL matches a published sequence, the viewer gains attribution
 * and the "Creator's choice" prop toggle.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";

export interface SequenceMatchResult {
	readonly matched: boolean;
	readonly publicRecord: PublicSequenceIndex | null;
}

export interface IPublicSequenceHashMatcher {
	findPublicMatch(sequence: SequenceData): Promise<SequenceMatchResult>;
	computeEncoderHash(sequence: SequenceData): Promise<string>;
}
