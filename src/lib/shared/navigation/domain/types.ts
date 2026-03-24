/**
 * Navigation Domain Types
 *
 * Core types for the navigation system.
 * This is the canonical source for ModuleId, TabId, and related navigation types.
 */

/**
 * Metadata for tabs that controls behavior-based filtering
 * Rather than hardcoding tab IDs in business logic, mark tabs with semantic metadata
 */
export interface SectionMetadata {
  /** Tab is a creation entry point (assemble, construct, generate, spell) */
  isCreationMethod?: boolean;
}

/**
 * Tab within a module
 * Represents a navigation tab within a specific module (e.g., "Construct" tab in Create module)
 */
export interface Section {
  id: string;
  label: string;
  icon: string;
  description?: string;
  color?: string;
  gradient?: string; // Optional gradient for colorful icons
  disabled?: boolean; // For conditional tab accessibility
  metadata?: SectionMetadata; // Semantic metadata for behavior-based filtering
}

// Module-based navigation types
// Should match MODULE_DEFINITIONS in navigation-state.svelte.ts
export type ModuleId =
  | "create"
  | "browse"
  | "learn"
  | "tika" // Tika AI tutor (TKA Intelligent Knowledge Assistant)
  | "premium"
  | "compose"
  | "train"
  | "choreo_card" // Choreography reference cards (printable)
  | "word_card" // Legacy alias for choreo_card
  | "write"
  | "feedback"
  | "admin"
  | "settings"
  | "watch" // Watch videos and performances
  | "moderation" // Content moderation (admin)
  | "arena" // Community pairwise ranking
  | "festivals" // Festival Hub — discover and apply to flow festivals
  | "lab"; // Experimental features lab (all experiments consolidated here)
  // Consolidated into Lab (Feb 2026): community, ml-training, connect

/**
 * Module Definition
 * Represents a top-level module with its sections
 */
export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: string;
  color?: string; // Module theme color (e.g., "#f59e0b" for amber)
  description?: string;
  isMain: boolean;
  sections: Section[]; // Sections within this module
  disabled?: boolean; // For conditional module accessibility (e.g., coming soon for non-admin)
  disabledMessage?: string; // Message to show when module is disabled
  adminOnly?: boolean; // Admin-only modules skip translation warnings (not user-facing)
}

export interface ModuleSelectorState {
  isOpen: boolean;
  showDiscoveryHint: boolean;
}

/**
 * Legacy tab IDs (for backwards compatibility during migration)
 * Maps old tab names to module concepts
 */
export type LegacyTabId =
  | "construct" // Legacy ID that maps to "build" module
  | "browse" // Legacy ID for browse/browse
  | "word-card" // Legacy hyphenated version (now choreo_card)
  | "word_card" // Legacy underscore version (now choreo_card)
  | "choreo-card" // Legacy hyphenated version of choreo_card
  | "about" // About page (not a proper module)
  | "animator"; // Animator feature

/**
 * All possible tab/module IDs (includes both new ModuleId and legacy IDs)
 * @deprecated Prefer using ModuleId for new code
 */
export type TabId = ModuleId | LegacyTabId;
