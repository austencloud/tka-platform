/**
 * IShameQueueManager - Admin operations for Hall of Shame
 *
 * Handles the moderation queue: reviewing, approving, rejecting,
 * featuring, and hiding entries.
 */

import type { HallOfShameEntry, ShameCategory } from '../../domain/models/hall-of-shame-models';

export interface IShameQueueManager {
	/**
	 * Get pending submissions for admin review
	 * Sorted by submittedAt ascending (oldest first)
	 *
	 * @returns List of pending entries
	 */
	getPendingQueue(): Promise<HallOfShameEntry[]>;

	/**
	 * Get count of pending submissions
	 * Used for admin nav badge
	 *
	 * @returns Number of pending entries
	 */
	getPendingCount(): Promise<number>;

	/**
	 * Approve a submission
	 * Moves entry from pending to approved status
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param adminId - The approving admin's UID
	 * @param category - Optional category override (if submitter chose wrong)
	 */
	approve(sequenceId: string, adminId: string, category?: ShameCategory): Promise<void>;

	/**
	 * Reject a submission
	 * Moves entry from pending to rejected status
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param adminId - The rejecting admin's UID
	 * @param reason - Required reason for rejection (shown to user)
	 */
	reject(sequenceId: string, adminId: string, reason: string): Promise<void>;

	/**
	 * Feature or unfeature a sequence
	 * Featured sequences appear in the "Editor's Pick" section
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param adminId - The admin's UID
	 * @param featured - true to feature, false to unfeature
	 */
	setFeatured(sequenceId: string, adminId: string, featured: boolean): Promise<void>;

	/**
	 * Hide or unhide a sequence
	 * Hidden sequences are not visible in gallery but not deleted
	 * Used for post-approval issues (reports, etc.)
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param adminId - The admin's UID
	 * @param hidden - true to hide, false to unhide
	 */
	setHidden(sequenceId: string, adminId: string, hidden: boolean): Promise<void>;

	/**
	 * Report an approved entry
	 * Increments report count and notifies admin if threshold reached
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @param reporterId - The reporting user's UID
	 * @param reason - Optional reason for report
	 */
	reportEntry(sequenceId: string, reporterId: string, reason?: string): Promise<void>;

	/**
	 * Get reported entries above threshold
	 * For admin review of problematic approved content
	 *
	 * @param threshold - Minimum report count (default 5)
	 * @returns List of reported entries
	 */
	getReportedEntries(threshold?: number): Promise<HallOfShameEntry[]>;
}
