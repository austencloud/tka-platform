/**
 * IThumbnailKeyDeriver
 *
 * Derives cache keys from thumbnail render inputs.
 * Replaces 13 prev* state variables with a single hash comparison.
 *
 * A cache key captures everything that affects the visual output of a thumbnail.
 * Same inputs always produce same key (pure function).
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ThumbnailVariant } from "./ICloudThumbnailCache";

/**
 * Visibility settings that affect pictograph rendering.
 * Each setting toggles a visual layer on/off.
 */
export interface ThumbnailVisibilitySettings {
  showTKA?: boolean;
  showReversals?: boolean;
  showGrid?: boolean;
  showNonRadialPoints?: boolean;
  handPointVisibility?: "all" | "active";
  /** Render QR code in an empty cell (if available) */
  showQRCode?: boolean;
  /** Render as hand path visualization (HAND props, float arrows, no TKA) */
  handPathMode?: boolean;
}

/**
 * All inputs that affect the visual output of a thumbnail.
 * A change to ANY of these requires a new render.
 */
export interface ThumbnailRenderInput {
  // Identity
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;

  // Prop configuration
  bluePropType: PropType | undefined;
  redPropType: PropType | undefined;
  catDogModeEnabled: boolean;

  // Visual mode
  lightMode: boolean;
  variant: ThumbnailVariant;

  // LOOP badge
  loopType?: string | null;

  // Composition overrides (undefined = use variant defaults)
  addWord?: boolean;
  addStepNumbers?: boolean;
  includeStartPosition?: boolean;
  startPositionLayout?: "row" | "column";
  addDifficultyLevel?: boolean;
  addUserInfo?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
  userName?: string;

  // Visibility overrides (undefined = use defaults: showTKA=true, showReversals=true, etc.)
  visibility?: ThumbnailVisibilitySettings;

  /** Use 5:7 playing card layout for physical card export (different from lightMode/printMode) */
  cardMode?: boolean;
}

/**
 * Immutable cache key - once computed, never changes.
 * Used for cache lookups and render deduplication.
 */
export interface ThumbnailCacheKey {
  /** Hash of all inputs that affect visual output */
  readonly hash: string;

  /** Cloud storage path (for ICloudThumbnailCache) */
  readonly cloudPath: string;

  /** Original inputs (for debugging/logging) */
  readonly inputs: Readonly<ThumbnailRenderInput>;

  /** Whether this uses default composition settings (cacheable to cloud) */
  readonly usesDefaults: boolean;

  /** Effective prop type string (for cloud cache key construction) */
  readonly propKey: string;
}

/**
 * Default composition settings for each variant.
 */
export interface CompositionDefaults {
  addWord: boolean;
  addStepNumbers: boolean;
  includeStartPosition: boolean;
  addDifficultyLevel: boolean;
  addUserInfo: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
}

export interface IThumbnailKeyDeriver {
  /**
   * Derive a cache key from render inputs.
   * Same inputs always produce same key (pure function).
   */
  deriveKey(input: ThumbnailRenderInput): ThumbnailCacheKey;

  /**
   * Check if two keys represent the same thumbnail.
   * Simple hash comparison - faster than full derivation.
   */
  keysEqual(a: ThumbnailCacheKey, b: ThumbnailCacheKey): boolean;

  /**
   * Get variant-specific default settings.
   * Used to determine if custom settings differ from cloud-cacheable defaults.
   */
  getVariantDefaults(variant: ThumbnailVariant): CompositionDefaults;

  /**
   * Check if the input uses default settings for its variant.
   * When true, the thumbnail can be cached to/retrieved from cloud.
   */
  inputUsesDefaults(input: ThumbnailRenderInput): boolean;
}
