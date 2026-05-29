/**
 * Activity Log Service Types
 *
 * Co-exported types for the activity logging system.
 */

import type {
  ActivityEventType,
  ActivityCategory,
} from "../domain/models/activity-event";

/**
 * Options for querying activity events
 */
export interface ActivityQueryOptions {
  /** Filter by user ID */
  userId?: string;

  /** Filter by category */
  category?: ActivityCategory;

  /** Filter by event type */
  eventType?: ActivityEventType;

  /** Start date (inclusive) */
  startDate?: Date;

  /** End date (inclusive) */
  endDate?: Date;

  /** Maximum number of results */
  limit?: number;

  /** Order by timestamp */
  orderDirection?: "asc" | "desc";
}
