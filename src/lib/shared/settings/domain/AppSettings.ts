/**
 * Application Settings Domain Model
 *
 * Defines the structure for application-wide settings and configuration.
 * This is a domain type that represents the user's preferences and app state.
 */

import type { PropType } from "../../pictograph/prop/domain/enums/PropType";
import type { GridMode } from "../../pictograph/grid/domain/enums/grid-enums";
import type { BackgroundType } from "../../background/shared/domain/enums/background-enums";

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
  propPresets?: PropPreset[]; // Up to 6 saved prop configurations
  selectedPresetIndex?: number; // Index of currently active preset (0-5)
  backupFrequency?: string;
  enableFades?: boolean;
  growSequence?: boolean;
  numBeats?: number;
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

  // Accessibility & User Experience settings
  hapticFeedback?: boolean;
  reducedMotion?: boolean;

  // Keyboard shortcut settings
  singleKeyShortcuts?: boolean;
  showShortcutHints?: boolean;

  // Word Card Settings
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
    vtgGlyph?: boolean;
    elementalGlyph?: boolean;
    positionsGlyph?: boolean;
    reversalIndicators?: boolean;
    nonRadialPoints?: boolean;
  };

  // Community/Privacy Settings
  favoritesPublic?: boolean; // Whether favorites are visible to followers (default: true)

  // Workflow Settings
  skipClearConfirmation?: boolean; // Skip confirmation when clearing sequence (undo is available)

  // Global Visual Effects
  darkMode?: boolean; // Dark Mode: dark background, inverted grid, white text/outlines

  // Image Export Settings
  imageExport?: {
    addWord?: boolean;
    addBeatNumbers?: boolean;
    addDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    addUserInfo?: boolean;
    darkMode?: boolean;
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
