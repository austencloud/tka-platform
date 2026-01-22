import type { CreateReportInput, UserReport } from '../../domain/models/report-models';

/**
 * Handles submission of user reports from the community.
 */
export interface IReportSubmitter {
	/**
	 * Submit a new report about a user.
	 * Requires the current user to be authenticated.
	 */
	submit(input: CreateReportInput): Promise<UserReport>;

	/**
	 * Check if the current user has already reported this user recently.
	 * Prevents spam reporting of the same user.
	 */
	hasRecentReport(reportedUserId: string): Promise<boolean>;
}
