/**
 * Simple Filtering Types - Keep It Simple!
 *
 * Just the essential types for basic filtering.
 */

/**
 * Simple filter value - just strings, numbers, or booleans
 */
export type BrowseFilterValue = string | number | boolean | string[] | null;

/**
 * Browse Filter Interface
 *
 * Represents the current filter state in the browse module.
 */
export interface BrowseFilter {
  showFavoritesOnly?: boolean;
  sortBy?: string;
  difficultyLevels?: number[];
}
