/**
 * IHallOfShameSubmitter - Submit sequences to the Hall of Shame
 *
 * Handles submission of flagged content to the moderation queue,
 * user submission history, and withdrawal of pending submissions.
 */

import type {
	HallOfShameEntry,
	ShameSubmissionParams
} from '../../domain/models/hall-of-shame-models';

export interface IHallOfShameSubmitter {
	/**
	 * Submit a flagged sequence to Hall of Shame
	 * Requires age verification before submission
	 *
	 * @param params - Submission parameters
	 * @returns The created entry ID
	 * @throws If rate limit exceeded (3/day) or sequence already submitted
	 */
	submit(params: ShameSubmissionParams): Promise<string>;

	/**
	 * Get user's submissions (pending, approved, and rejected)
	 * @param userId - The user's UID
	 * @returns List of user's Hall of Shame entries
	 */
	getUserSubmissions(userId: string): Promise<HallOfShameEntry[]>;

	/**
	 * Withdraw a pending submission
	 * Only works for pending (not yet approved/rejected) entries
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param userId - The user's UID (must match owner)
	 * @throws If entry not found, not pending, or not owned by user
	 */
	withdraw(sequenceId: string, userId: string): Promise<void>;

	/**
	 * Check if a source sequence is already submitted
	 * Prevents duplicate submissions of the same sequence
	 *
	 * @param sourceSequenceId - The original sequence ID
	 * @returns true if sequence has a pending or approved entry
	 */
	isSubmitted(sourceSequenceId: string): Promise<boolean>;

	/**
	 * Get remaining submissions for today
	 * @param userId - The user's UID
	 * @returns Number of submissions remaining (0-3)
	 */
	getRemainingSubmissions(userId: string): Promise<number>;
}
