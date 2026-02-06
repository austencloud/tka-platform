/**
 * Simple Filtering Models - Keep It Simple!
 *
 * Just the essential models for basic filtering.
 */

import type { BrowseFilterType } from "../enums/FilteringEnums";
import type { BrowseFilterValue } from "../types/FilteringTypes";

/**
 * Simple active filter - just type and value
 */
export interface ActiveFilter {
  type: BrowseFilterType;
  value: BrowseFilterValue;
  appliedAt: Date;
}

/**
 * Simple filter option for dropdowns
 */
export interface FilterOptionItem {
  label: string;
  value: BrowseFilterValue;
  count: number;
}
