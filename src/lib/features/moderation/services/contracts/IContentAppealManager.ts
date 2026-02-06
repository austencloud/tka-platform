import type {
	ContentAppeal,
	CreateAppealData,
	ResolveAppealData
} from '../../domain/models/content-moderation-models';

/**
 * Content Appeal Manager Interface
 *
 * Manages appeals for content that was flagged by moderation.
 * Users can appeal false positives; admins can approve/deny.
 */
export interface IContentAppealManager {
	/**
	 * Submit an appeal for flagged content.
	 * Called when a user believes their content was incorrectly flagged.
	 *
	 * @param userId - The user submitting the appeal (must own the content)
	 * @param data - Appeal details including content ID and reason
	 * @returns The created appeal
	 */
	submitAppeal(userId: string, data: CreateAppealData): Promise<ContentAppeal>;

	/**
	 * Get all appeals submitted by a user.
	 *
	 * @param userId - The user whose appeals to fetch
	 * @returns List of appeals (all statuses)
	 */
	getUserAppeals(userId: string): Promise<ContentAppeal[]>;

	/**
	 * Get a specific appeal by ID.
	 *
	 * @param appealId - The appeal ID
	 * @returns The appeal, or null if not found
	 */
	getAppeal(appealId: string): Promise<ContentAppeal | null>;

	/**
	 * Get all pending appeals (admin only).
	 *
	 * @returns List of appeals awaiting review
	 */
	getPendingAppeals(): Promise<ContentAppeal[]>;

	/**
	 * Resolve an appeal (admin only).
	 * If approved, the content should be whitelisted.
	 *
	 * @param appealId - The appeal to resolve
	 * @param adminId - The admin resolving it
	 * @param data - Resolution details (approved/denied + notes)
	 * @returns The updated appeal
	 */
	resolveAppeal(appealId: string, adminId: string, data: ResolveAppealData): Promise<ContentAppeal>;

	/**
	 * Check if content has an approved appeal (whitelist check).
	 *
	 * @param contentType - 'sequence' or 'act'
	 * @param contentId - The content ID
	 * @returns True if content has been approved via appeal
	 */
	isWhitelisted(contentType: 'sequence' | 'act', contentId: string): Promise<boolean>;
}
