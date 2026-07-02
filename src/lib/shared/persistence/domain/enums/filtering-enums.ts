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
  /** Filter by the owning account's display name. AUTHOR matches the legacy
   * metadata field (often a tool attribution like "TKA Explore"); OWNER is
   * the human creator shown on cards. */
  OWNER = "owner",
  GRID_MODE = "gridMode",
  STARTING_POSITION = "startPosition",
  END_POSITION = "endPosition",
  RECENT = "recent",
  FAVORITES = "favorites",
  ALL_SEQUENCES = "all_sequences",
  /** Filter by circular sequences and LOOP type */
  LOOP_TYPE = "cap_type",
  /** Filter by Timing & Direction family (split/tog/quarter × same/opp),
   * derived per step from arc geometry — a sequence matches when ANY of its
   * steps classifies into the family. Stackable (composite keys) like LOOP_TYPE. */
  TND_FAMILY = "tnd_family",
}
