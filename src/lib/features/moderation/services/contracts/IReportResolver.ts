import type { ResolveReportInput, UserReport } from '../../domain/models/report-models';

/**
 * Handles admin actions on reports (resolution, status changes).
 */
export interface IReportResolver {
	/**
	 * Mark a report as "reviewing" (admin is looking at it).
	 */
	startReview(reportId: string): Promise<UserReport>;

	/**
	 * Resolve a report with a specific resolution.
	 * Handles any side effects (e.g., disabling account if resolution is account_disabled).
	 */
	resolve(input: ResolveReportInput): Promise<UserReport>;

	/**
	 * Add admin notes to a report without changing its status.
	 */
	addNotes(reportId: string, notes: string): Promise<UserReport>;

	/**
	 * Disable a user's account (used when resolution is account_disabled).
	 */
	disableUserAccount(userId: string, reason: string): Promise<void>;
}
