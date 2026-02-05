/**
 * IHallOfShameLoader - Load and query Hall of Shame entries
 *
 * Handles gallery loading with filtering, sorting, and pagination.
 * All queries respect age verification requirement.
 */

import type {
	HallOfShameEntry,
	ShameLoadParams,
	PaginatedShameResult,
	ShameCategoryCounts
} from '../../domain/models/hall-of-shame-models';

export interface IHallOfShameLoader {
	/**
	 * Load approved sequences with filtering and pagination
	 * Only returns non-hidden, approved entries
	 *
	 * @param params - Load parameters (category, sort, limit, cursor)
	 * @returns Paginated result with entries and cursor
	 */
	loadApproved(params: ShameLoadParams): Promise<PaginatedShameResult>;

	/**
	 * Load featured sequences
	 * Returns entries marked as "Editor's Pick"
	 *
	 * @param limit - Max number to return (default 10)
	 * @returns List of featured entries, sorted by featuredAt desc
	 */
	loadFeatured(limit?: number): Promise<HallOfShameEntry[]>;

	/**
	 * Get a single entry by ID
	 * Returns null if not found, not approved, or hidden
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 * @returns The entry or null
	 */
	getEntry(sequenceId: string): Promise<HallOfShameEntry | null>;

	/**
	 * Get entry count by category
	 * Only counts approved, non-hidden entries
	 *
	 * @returns Counts per category
	 */
	getCategoryCounts(): Promise<ShameCategoryCounts>;

	/**
	 * Increment view count for an entry
	 * Called when user views the full sequence
	 *
	 * @param sequenceId - The Hall of Shame entry ID
	 */
	incrementViewCount(sequenceId: string): Promise<void>;
}
