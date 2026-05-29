import type { BrowseFilterType } from "../domain/enums/filtering-enums";
import type { BrowseFilterValue } from "../domain/types/filtering-types";

// Simple filter history entry type
export interface FilterHistoryEntry {
  type: BrowseFilterType;
  value: BrowseFilterValue;
  appliedAt: Date;
}

// Simple browse state for persistence
export interface SimpleBrowseState {
  filterType: BrowseFilterType | null;
  filterValue: BrowseFilterValue;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortMethod: any; // Will be typed properly when we consolidate sort enums
}
