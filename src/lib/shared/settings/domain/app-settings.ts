/**
 * Application Settings Domain Model
 *
 * Defines the structure for application-wide settings and configuration.
 * This is a domain type that represents the user's preferences and app state.
 */

import type { PropType } from "../../pictograph/prop/domain/enums/prop-type";
import type { CompositionRecipe } from "../../pictograph/prop/domain/prop-composition-recipes";
import type { GridMode, GridPosition } from "../../pictograph/grid/domain/enums/grid-enums";
import type { BackgroundType } from "@austencloud/backgrounds";
import type { BackgroundLabSettings } from "$lib/shared/background-builder/domain/lab-settings-types";
import type { TimeSignatureKey } from "../../foundation/domain/models/time-signature";

/**
 * Prop Preset - A saved prop configuration for quick switching
 */
export interface PropPreset {
  bluePropType: PropType;
  redPropType: PropType;
  catDogMode: boolean;
  blueBuugengFlipped?: boolean; // Flip buugeng for blue hand (asymmetric prop)
  redBuugengFlipped?: boolean; // Flip buugeng for red hand (asymmetric prop)
}

export interface AppSettings {
  // Metadata for sync tracking (not persisted to Firebase)
  _localTimestamp?: number;

  gridMode: GridMode;
  userName?: string;
  propType?: PropType; // Legacy - kept for backward compatibility
  bluePropType?: PropType; // Per-color prop type for blue motions
  redPropType?: PropType; // Per-color prop type for red motions
  catDogMode?: boolean; // Whether CatDog Mode is enabled in prop type settings
  blueBuugengFlipped?: boolean; // Flip buugeng for blue hand (asymmetric prop)
  redBuugengFlipped?: boolean; // Flip buugeng for red hand (asymmetric prop)
  propPresets?: (PropPreset | null)[]; // Up to 10 saved prop configurations (nulls preserve slot indices)
  selectedPresetIndex?: number; // Index of currently active preset (0-9)
  backupFrequency?: string;
  enableFades?: boolean;
  growSequence?: boolean;
  numSteps?: number;
  beatLayout?: string;

  // Background settings
  backgroundCategory?: "animated" | "simple";
  backgroundType?: BackgroundType;
  backgroundQuality?: "high" | "medium" | "low" | "minimal";
  backgroundEnabled?: boolean;

  // Simple background settings
  backgroundColor?: string; // For solid color backgrounds
  gradientColors?: string[]; // For gradient backgrounds (2-4 colors)
  gradientDirection?: number; // Gradient angle in degrees (0-360)

  // Background Builder lab settings (persisted toggle states)
  backgroundLabSettings?: BackgroundLabSettings;

  // Accessibility & User Experience settings
  hapticFeedback?: boolean;
  reducedMotion?: boolean;

  // Keyboard shortcut settings
  singleKeyShortcuts?: boolean;
  showShortcutHints?: boolean;

  // Choreo Card Settings
  WordCard?: {
    defaultColumnCount?: number;
    defaultLayoutMode?: "grid" | "list" | "printable";
    enableTransparency?: boolean;
    cacheEnabled?: boolean;
    cacheSizeLimit?: number;
    exportQuality?: "low" | "medium" | "high";
    exportFormat?: "PNG" | "JPG" | "WebP";
    defaultPaperSize?: "A4" | "Letter" | "Legal" | "Tabloid";
  };

  // Pictograph Visibility Settings
  visibility?: {
    tkaGlyph?: boolean; // TKA Glyph includes turn numbers
    tndGlyph?: boolean;
    elementalGlyph?: boolean;
    positionsGlyph?: boolean;
    reversalIndicators?: boolean;
    showGrid?: boolean; // Master toggle for grid visibility
    nonRadialPoints?: boolean;
    handPointVisibility?: "all" | "active" | "none"; // all hand points, only where props are, or hidden
    stepNumbers?: boolean; // Show beat numbers on pictographs in sequences
    beatPositionGlyph?: boolean; // Show beat position glyph (musical timeline position)
  };

  // Community/Privacy Settings
  favoritesPublic?: boolean; // Whether favorites are visible to followers (default: true)

  // Workflow Settings
  skipClearConfirmation?: boolean; // Skip confirmation when clearing sequence (undo is available)
  skipLoopConfirmation?: boolean; // Skip confirmation when applying LOOP auto-completion (undo is available)

  // Generator Settings
  blockedStartPositions?: GridPosition[]; // Custom blocked positions for sequence generation

  // Global Visual Effects
  darkMode?: boolean; // Dark Mode: dark background, inverted grid, white text/outlines

  // Timing Display Settings
  musicianMode?: boolean; // Show positions as "1 e & a" instead of decimals (1.25, 1.5)
  defaultTimeSignature?: TimeSignatureKey; // Default time signature for sequences (default: "4/4")

  // Voice Control
  voiceControlEnabled?: boolean; // Enable "Hey Tika" voice control (opt-in, default false)

  // Prop Composition Recipes (lab-tuned overrides per family)
  compositionRecipeOverrides?: Record<string, CompositionRecipe>;

  // Assemble Grid Preferences (persisted from wizard)
  preferredGridMode?: GridMode; // Last-used grid mode in assemble
  preferredShowCenter?: boolean; // Last-used center toggle in assemble

  // Browse Grid Settings
  gridZoomLevel?: number; // DEPRECATED (2026-07-13): global density let a phone pinch pin desktops at 2 columns. Superseded by gridZoomByBucket; no longer read.
  gridColumnsExplicit?: boolean; // DEPRECATED (2026-07-13): global explicit-choice flag; superseded by gridZoomByBucket; no longer read.
  gridZoomByBucket?: Record<string, number>; // Chosen column density per width bucket (key = getWidthBucketKey). Widths without a choice auto-adapt to the bucket default.

  // Image Export Settings
  imageExport?: {
    addWord?: boolean;
    addStepNumbers?: boolean;
    addDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    darkMode?: boolean;
    customName?: string; // Optional custom name for header

    // Granular footer controls (replaces single addUserInfo toggle)
    showCreatorName?: boolean; // Bottom-left: creator name
    showNotes?: boolean; // Bottom-center: notes text
    showBirthday?: boolean; // Bottom-right: birthday date
    customNotesText?: string; // Custom text for notes (default: "Created using Flow Arts Composer")
    showLoopGlyph?: boolean; // Show LOOP glyph indicator
  };
}

/**
 * Accessibility Settings
 * Subset of AppSettings focused on accessibility features
 */
export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  visibleParticleSize?: number;
}
