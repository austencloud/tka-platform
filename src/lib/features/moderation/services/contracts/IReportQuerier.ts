import type {
	ReportFilters,
	ReportStatus,
	UserReport,
	PaginatedReportsResult
} from '../../domain/models/report-models';

/**
 * Queries and lists user reports (admin functionality).
 */
export interface IReportQuerier {
	/**
	 * Get a single report by ID.
	 */
	getById(reportId: string): Promise<UserReport | null>;

	/**
	 * List reports with optional filters.
	 */
	list(filters?: ReportFilters, limit?: number): Promise<UserReport[]>;

	/**
	 * List reports with pagination support.
	 * Supports compound filters (status AND category).
	 */
	listPaginated(
		filters?: ReportFilters,
		limit?: number,
		startAfter?: unknown
	): Promise<PaginatedReportsResult>;

	/**
	 * Get count of reports by status (for dashboard badges).
	 */
	getCountByStatus(status: ReportStatus): Promise<number>;

	/**
	 * Get all reports for a specific user (to see their history).
	 */
	getReportsForUser(userId: string): Promise<UserReport[]>;

	/**
	 * Subscribe to new reports (real-time updates).
	 * Returns an unsubscribe function.
	 */
	subscribeToNew(callback: (reports: UserReport[]) => void): () => void;
}
