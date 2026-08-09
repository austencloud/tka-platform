/**
 * Co-exported types from retired interface contracts.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ModuleId, Section } from "../domain/types";

// === From ISheetRouter ===

export type SheetType =
  | "settings"
  | "profile-settings"
  | "auth"
  | "terms"
  | "privacy"
  | "inbox"
  | "animation"
  | null;
export interface AnimationPanelState {
  sequenceId?: string;
  speed?: number;
  isPlaying?: boolean;
  currentStep?: number;
  gridVisible?: boolean;
}
export interface RouteState {
  sheet?: SheetType;
  spotlight?: string;
  animationPanel?: AnimationPanelState;
}

// === From IDeepLinker ===

export interface ModuleMapping {
  /**
   * Module that consumes the deep-link payload. "share" and "view" are
   * pseudo-modules: "view" redirects to the standalone /sequence route and
   * "share" always navigates via navigateToModule, so neither is ever passed
   * to setCurrentModule.
   */
  moduleId: ModuleId | "share" | "view";
  tabId?: string;
  navigateToModule?: ModuleId;
}
export interface DeepLinkResult {
  moduleId: string;
  tabId: string | undefined;
  sequence: SequenceData;
}
export interface DeepLinkData {
  sequence: SequenceData;
  tabId: string | undefined;
  returnPath?: string;
}

// === From IURLSyncer ===

export interface URLSyncOptions {
  /** Milliseconds to debounce (default: 500) */
  debounce?: number;
  /** Skip debouncing and update immediately */
  immediate?: boolean;
  /** Allow clearing URL when sequence is empty (default: true) */
  allowClear?: boolean;
}
export interface DebouncedUrlSync {
  (sequence: SequenceData | null): void;
  cancel: () => void;
}

// === From ISequenceEncoder ===

export interface CompressionResult {
  encoded: string;
  compressed: boolean;
  originalLength: number;
  finalLength: number;
}
export interface ShareURLResult {
  url: string;
  length: number;
  compressed: boolean;
  savings: number;
}
export interface DeepLinkParseResult {
  module: string;
  sequence: SequenceData;
}
export interface ShareURLMetadata {
  /** Creator display name */
  creator?: string;
  /** Notes/tagline text */
  notes?: string;
  /** The intended word */
  word?: string;
  /** Dark mode preference (true/false) */
  darkMode?: boolean;
  /** Difficulty level string */
  difficulty?: string;
  /** Creation date as compact YYYYMMDD string */
  birthday?: string;
  /** BPM value */
  bpm?: number;
  /** Blue prop type (encoded as short string) */
  bluePropType?: string;
  /** Red prop type (encoded as short string) */
  redPropType?: string;
}
export interface URLPropOptions {
  bluePropType?: string;
  redPropType?: string;
  catDogMode?: boolean;
}
export interface SequenceRouteIdParseResult {
  /** Non-null if the ID is a self-contained encoded sequence */
  encoded: string | null;
  /** Non-null if the ID is a legacy session/Firebase ID or plain word */
  legacyId: string | null;
}
export interface QRSizeEstimate {
  /** Length of the encoded string (including s~ prefix) */
  encodedLength: number;
  /** Recommended QR version (1-40, higher = denser) */
  recommendedVersion: number;
  /** Whether offline mode is recommended for this sequence */
  offlineRecommended: boolean;
  /** Warning message if sequence is too large for comfortable scanning */
  warning?: string;
}

// === From ISidebarTabToggler ===

export interface TabVisibilityInfo {
  section: Section;
  isVisible: boolean;
  isRoleLocked: boolean;
}
