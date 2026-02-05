/**
 * Browse Tab Types
 * Type definitions for the browse module tab navigation
 */

// Note: "library" removed - now integrated into Sequences via scope toggle
export type BrowseModuleType = "gallery" | "creators" | "collections";

export interface BrowseTabConfig {
  id: BrowseModuleType;
  label: string;
  icon: string;
  disabled?: boolean;
}
