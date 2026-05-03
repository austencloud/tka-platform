/**
 * Public Sequence Hash Matcher Types
 *
 * Co-exported types for the sequence hash matching system.
 */

import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";

export interface SequenceMatchResult {
	readonly matched: boolean;
	readonly publicRecord: PublicSequenceIndex | null;
}
