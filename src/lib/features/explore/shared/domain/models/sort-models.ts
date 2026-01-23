/**
 * Browse Sort Methods
 *
 * Defines the different ways to sort sequences in the browse tab.
 * Ported from desktop app's ExploreSortMethod enum.
 */

import type { ExploreSortMethod } from "../enums/explore-enums";

export interface SortConfig {
  method: ExploreSortMethod;
  direction: "asc" | "desc";
  displayName: string;
}

// Helper functions moved to gallery-sorting-models.ts to avoid duplicates
// Import from gallery-sorting-models.ts if needed
