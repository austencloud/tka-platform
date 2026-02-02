/**
 * LOOP Selection Types
 *
 * Type definitions for the responsive LOOP selection modal system.
 * Includes layout configuration, preset data models, and UI state types.
 */

import type { LOOPComponent } from "./generate-models";
import type { Timestamp } from "firebase/firestore";

// ============================================================================
// LAYOUT CONFIGURATION
// ============================================================================

/**
 * Layout modes for the LOOP selection UI
 */
export type LOOPSelectionLayout =
  | "side-by-side" // 4K/ultrawide: presets left, builder right
  | "tabbed" // Desktop: tabs for Browse/Build
  | "drawer" // Mobile: bottom drawer with compact UI
  | "wizard"; // Tiny mobile: step-by-step flow

/**
 * Layout configuration returned by the layout detector
 */
export interface LOOPLayoutConfig {
  /** Whether to use modal (true) or drawer (false) */
  isDesktop: boolean;
  /** Whether to use side-by-side layout in modal (4K/ultrawide) */
  useSideBySide: boolean;
  /** Whether to use wizard mode (step-by-step) for tiny screens */
  useWizardMode: boolean;
  /** The resolved layout to render */
  layout: LOOPSelectionLayout;
}

// ============================================================================
// MODE SELECTION
// ============================================================================

/**
 * Selection mode within the LOOP selection UI
 */
export type LOOPSelectionMode = "quick-apply" | "build-combo";

/**
 * Tabs available in the preset browser
 */
export type LOOPPresetTab = "my-presets" | "trending" | "following";

// ============================================================================
// USER PRESETS (Firebase Subcollection)
// ============================================================================

/**
 * User-created LOOP preset stored in Firebase
 * Path: users/{userId}/loopPresets/{presetId}
 */
export interface UserLOOPPreset {
  /** Firestore document ID */
  id: string;
  /** Display name for the preset */
  name: string;
  /** LOOP components that make up this preset */
  components: LOOPComponent[];
  /** Optional emoji icon */
  icon?: string;
  /** When the preset was created */
  createdAt: Timestamp;
  /** How many times the user has applied this preset */
  usageCount: number;
}

/**
 * Input for creating a new user preset
 */
export interface CreateUserPresetInput {
  name: string;
  components: LOOPComponent[];
  icon?: string;
}

// ============================================================================
// POPULARITY DATA
// ============================================================================

/**
 * Popularity data for a LOOP type combination
 */
export interface LOOPPopularityData {
  /** The LOOP type string (e.g., "strict_rotated", "mirrored_inverted") */
  loopType: string;
  /** Number of public sequences using this LOOP type */
  usageCount: number;
  /** Percentage of all LOOP sequences */
  usagePercent: number;
}

/**
 * Cached popularity data with expiration
 */
export interface CachedPopularityData {
  data: LOOPPopularityData[];
  fetchedAt: number;
  expiresAt: number;
}

// ============================================================================
// SOCIAL PRESETS
// ============================================================================

/**
 * Preset from a followed user
 */
export interface FollowingPreset extends UserLOOPPreset {
  /** User ID of the preset creator */
  creatorId: string;
  /** Display name of the creator */
  creatorName: string;
  /** Creator's avatar URL */
  creatorAvatarUrl?: string;
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * State for the LOOP selection UI
 */
export interface LOOPSelectionState {
  /** Current active tab in the preset browser */
  activeTab: LOOPPresetTab;
  /** Current selection mode (quick-apply vs build-combo) */
  mode: LOOPSelectionMode;
  /** Currently selected components */
  selectedComponents: Set<LOOPComponent>;
  /** Whether the presets section is expanded (for collapsible UI) */
  presetsExpanded: boolean;

  // Loading states
  isLoadingMyPresets: boolean;
  isLoadingTrending: boolean;
  isLoadingFollowing: boolean;

  // Data
  myPresets: UserLOOPPreset[];
  trendingData: LOOPPopularityData[];
  followingPresets: FollowingPreset[];

  // Errors
  error: string | null;
}

// ============================================================================
// WIZARD STEPS (for tiny mobile)
// ============================================================================

/**
 * Steps in the wizard flow for tiny mobile screens
 */
export type LOOPWizardStep =
  | "mode" // Choose quick-apply or build-combo
  | "components" // Select LOOP components
  | "confirm"; // Review and apply

// ============================================================================
// CALLBACKS
// ============================================================================

/**
 * Callbacks for the LOOP selection UI
 */
export interface LOOPSelectionCallbacks {
  /** Called when user toggles a LOOP component */
  onToggleComponent: (component: LOOPComponent) => void;
  /** Called when user confirms their selection */
  onConfirm: () => void;
  /** Called when user closes the modal/drawer */
  onClose: () => void;
}
