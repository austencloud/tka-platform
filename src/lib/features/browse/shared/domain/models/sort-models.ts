/**
 * Browse Sort Methods
 *
 * Defines the different ways to sort sequences in the browse tab.
 * Ported from desktop app's BrowseSortMethod enum.
 */

import type { BrowseSortMethod } from "../enums/browse-enums";

export interface SortConfig {
  method: BrowseSortMethod;
  direction: "asc" | "desc";
  displayName: string;
}

// Helper functions moved to gallery-sorting-models.ts to avoid duplicates
// Import from gallery-sorting-models.ts if needed
