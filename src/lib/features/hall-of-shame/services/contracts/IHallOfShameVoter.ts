/**
 * IHallOfShameVoter - Vote on Hall of Shame entries
 *
 * Handles upvoting with one-vote-per-user enforcement.
 * Votes are permanent and cannot be revoked.
 */

export interface IHallOfShameVoter {
	/**
	 * Vote for a sequence (idempotent)
	 * If user has already voted, this is a no-op
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param voterId - The voting user's UID
	 * @throws If entry not found or not approved
	 */
	vote(sequenceId: string, voterId: string): Promise<void>;

	/**
	 * Check if user has voted for a sequence
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param voterId - The user's UID
	 * @returns true if user has already voted
	 */
	hasVoted(sequenceId: string, voterId: string): Promise<boolean>;

	/**
	 * Get current vote count for a sequence
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @returns Current vote count
	 */
	getVoteCount(sequenceId: string): Promise<number>;

	/**
	 * Batch check if user has voted for multiple sequences
	 * Useful for gallery display
	 *
	 * @param sequenceIds - List of Hall of Shame entry IDs
	 * @param voterId - The user's UID
	 * @returns Map of sequenceId to hasVoted boolean
	 */
	getVotedStatus(sequenceIds: string[], voterId: string): Promise<Map<string, boolean>>;
}
