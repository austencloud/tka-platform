/**
 * Explore Type Aliases
 *
 * Type aliases and utility types for gallery functionality.
 * Separated from interfaces and enums for clean architecture.
 */

// Re-export filtering types for compatibility
export type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

// Explore-specific type aliases
export type SortDirection = "asc" | "desc";
export type FilterPreset =
  | "all"
  | "favorites"
  | "practice"
  | "easy"
  | "medium"
  | "hard"
  | "recent";
export type NavigationSection = "top" | "bottom" | string;
