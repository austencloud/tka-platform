/**
 * Persistence Domain Types
 *
 * Additional type definitions for the persistence layer that don't
 * fit into models, enums, or constants.
 */

import type { UserWorkData } from "../models/UserWorkData";
import type { UserProject } from "../models/UserProject";

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Filter options for querying user work data
 */
export interface UserWorkFilter {
  type?: string;
  tabId?: string;
  userId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Filter options for querying user projects
 */
export interface UserProjectFilter {
  userId?: string;
  isPublic?: boolean;
  tags?: string[];
  nameContains?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Sort options for queries
 */
export interface SortOptions {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  offset: number;
  limit: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Database operation result
 */
export interface OperationResult {
  success: boolean;
  error?: string;
  affectedRows?: number;
}

// ============================================================================
// BACKUP/EXPORT TYPES
// ============================================================================

/**
 * Complete database export structure
 */
export interface DatabaseExport {
  version: string;
  exportedAt: Date;
  userWork: UserWorkData[];
  userProjects: UserProject[];
  // Note: sequences, pictographs, and settings are handled separately
  // as they may come from different sources
}

/**
 * Import options for database restoration
 */
export interface ImportOptions {
  overwriteExisting?: boolean;
  validateData?: boolean;
  skipErrors?: boolean;
}
