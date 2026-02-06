/**
 * Filtering Domain Enums
 *
 * Core enumerations for the filtering system.
 */

/**
 * Simple filter types for Browse tab - Keep It Simple!
 */
export enum BrowseFilterType {
  STARTING_LETTER = "starting_letter",
  CONTAINS_LETTERS = "contains_letters",
  LENGTH = "length",
  DIFFICULTY = "difficulty",
  AUTHOR = "author",
  GRID_MODE = "gridMode",
  STARTING_POSITION = "startPosition",
  END_POSITION = "endPosition",
  RECENT = "recent",
  FAVORITES = "favorites",
  ALL_SEQUENCES = "all_sequences",
  /** Filter by circular sequences and LOOP type */
  LOOP_TYPE = "cap_type",
}
