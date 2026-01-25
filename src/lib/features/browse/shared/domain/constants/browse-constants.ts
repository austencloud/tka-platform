import { BrowseSortMethod } from "../enums/browse-enums";
import type { SortConfig } from "../models/sort-models";

// Predefined sort configurations
export const SORT_CONFIGS: Record<BrowseSortMethod, SortConfig> = {
  [BrowseSortMethod.ALPHABETICAL]: {
    method: BrowseSortMethod.ALPHABETICAL,
    direction: "asc",
    displayName: "Name A-Z",
  },
  [BrowseSortMethod.DATE_ADDED]: {
    method: BrowseSortMethod.DATE_ADDED,
    direction: "desc",
    displayName: "Recently Added",
  },
  [BrowseSortMethod.DIFFICULTY_LEVEL]: {
    method: BrowseSortMethod.DIFFICULTY_LEVEL,
    direction: "asc",
    displayName: "Difficulty",
  },
  [BrowseSortMethod.SEQUENCE_LENGTH]: {
    method: BrowseSortMethod.SEQUENCE_LENGTH,
    direction: "asc",
    displayName: "Length",
  },
  [BrowseSortMethod.AUTHOR]: {
    method: BrowseSortMethod.AUTHOR,
    direction: "asc",
    displayName: "Author",
  },
  [BrowseSortMethod.POPULARITY]: {
    method: BrowseSortMethod.POPULARITY,
    direction: "desc",
    displayName: "Popularity",
  },
};
