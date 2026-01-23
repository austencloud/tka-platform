import { ExploreSortMethod } from "../enums/explore-enums";
import type { SortConfig } from "../models/sort-models";

// Predefined sort configurations
export const SORT_CONFIGS: Record<ExploreSortMethod, SortConfig> = {
  [ExploreSortMethod.ALPHABETICAL]: {
    method: ExploreSortMethod.ALPHABETICAL,
    direction: "asc",
    displayName: "Name A-Z",
  },
  [ExploreSortMethod.DATE_ADDED]: {
    method: ExploreSortMethod.DATE_ADDED,
    direction: "desc",
    displayName: "Recently Added",
  },
  [ExploreSortMethod.DIFFICULTY_LEVEL]: {
    method: ExploreSortMethod.DIFFICULTY_LEVEL,
    direction: "asc",
    displayName: "Difficulty",
  },
  [ExploreSortMethod.SEQUENCE_LENGTH]: {
    method: ExploreSortMethod.SEQUENCE_LENGTH,
    direction: "asc",
    displayName: "Length",
  },
  [ExploreSortMethod.AUTHOR]: {
    method: ExploreSortMethod.AUTHOR,
    direction: "asc",
    displayName: "Author",
  },
  [ExploreSortMethod.POPULARITY]: {
    method: ExploreSortMethod.POPULARITY,
    direction: "desc",
    displayName: "Popularity",
  },
};
