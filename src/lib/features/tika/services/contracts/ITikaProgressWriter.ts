/**
 * Contract for server-side TIKA knowledge verification write-back.
 *
 * Validates concept IDs and writes verified completions to Firestore
 * after TIKA confirms a user's knowledge through conversation challenges.
 */

export interface VerificationResult {
  success: boolean;
  completedConcepts: string[];
  rejectedConcepts: Array<{ id: string; reason: string }>;
  errors: string[];
  newMajorLevel?: number;
}

export interface ITikaProgressWriter {
  /**
   * Validate concept IDs against the knowledge graph.
   * Checks existence, prerequisites, and deduplication.
   */
  validateConceptIds(
    conceptIds: string[],
    alreadyCompleted: string[]
  ): { valid: string[]; rejected: Array<{ id: string; reason: string }> };

  /**
   * Write verified concept completions to Firestore.
   * Creates progress update + audit trail entry.
   */
  writeCompletions(
    userId: string,
    conceptIds: string[],
    alreadyCompleted: string[],
    summary: string
  ): Promise<VerificationResult>;
}
