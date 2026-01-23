/**
 * Explore Tab Types
 * Type definitions for the explore module tab navigation
 */

// Note: "library" removed - now integrated into Sequences via scope toggle
export type ExploreModuleType = "sequences" | "creators" | "collections";

export interface ExploreTabConfig {
  id: ExploreModuleType;
  label: string;
  icon: string;
  disabled?: boolean;
}
