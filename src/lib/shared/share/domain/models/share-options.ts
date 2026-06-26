/**
 * Share Options Domain Model
 *
 * Configuration options for sharing/downloading sequence images.
 * Simplified from the over-engineered export options.
 */

import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";

export interface ShareOptions {
  // === IMAGE FORMAT ===
  format: "PNG" | "JPEG" | "WebP";
  quality: number; // 0-1 for JPEG/WebP

  /**
   * Complete card-render options (from buildCardRenderOptions) spread over the
   * derived options last. ShareOptions itself can't carry the LOOP/mandala/QR/
   * grid/columns/start-layout toggles, so callers that must honor those (the
   * create-module static export) pass them here. Omitted by quick-download
   * consumers, which keep the simple DEFAULT_SHARE_OPTIONS behavior.
   */
  renderOverrides?: Partial<SequenceExportOptions>;

  // === CONTENT OPTIONS ===
  includeStartPosition: boolean;
  addStepNumbers: boolean;
  addUserInfo: boolean;
  addWord: boolean;
  addDifficultyLevel: boolean;
  customName?: string; // Optional custom name for header

  // === VISUAL OPTIONS ===
  stepSize: number; // Size of each beat in pixels
  margin: number; // Margin around the sequence
  backgroundColor: string;
  darkMode: boolean; // Dark mode toggle (affects grid, text colors)

  // === USER INFO ===
  userName: string;
  notes: string;

  // === GRANULAR FOOTER CONTROLS ===
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
}

export interface SharePreset {
  name: string;
  description: string;
  options: ShareOptions;
}

// Predefined sharing presets
export const SHARE_PRESETS: Record<string, SharePreset> = {
  social: {
    name: "Social Media",
    description: "Optimized for Instagram, TikTok, etc.",
    options: {
      format: "JPEG",
      quality: 0.9,
      includeStartPosition: true,
      addStepNumbers: true,
      addUserInfo: false, // Keep clean for social
      addWord: true,
      addDifficultyLevel: false,
      stepSize: 950, // Always 1:1 scale
      margin: 20,
      backgroundColor: "#ffffff",
      darkMode: false,
      userName: "",
      notes: "",
    },
  },

  print: {
    name: "Print Quality",
    description: "High quality for printing",
    options: {
      format: "PNG",
      quality: 1.0,
      includeStartPosition: true,
      addStepNumbers: true,
      addUserInfo: true,
      addWord: true,
      addDifficultyLevel: true,
      stepSize: 950, // Always 1:1 scale
      margin: 50,
      backgroundColor: "#ffffff",
      darkMode: false,
      userName: "", // Will be populated from auth state
      notes: "Created with TKA Composer",
    },
  },

  web: {
    name: "Web Sharing",
    description: "Balanced quality and file size",
    options: {
      format: "WebP",
      quality: 0.85,
      includeStartPosition: true,
      addStepNumbers: true,
      addUserInfo: true,
      addWord: true,
      addDifficultyLevel: false,
      stepSize: 950, // Always 1:1 scale
      margin: 30,
      backgroundColor: "#ffffff",
      darkMode: false,
      userName: "", // Will be populated from auth state
      notes: "",
    },
  },
};

// Optimized default options for modern devices and sharing
export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  // Fixed sensible defaults - no user choice needed
  format: "PNG", // Best quality for clear images
  quality: 1.0, // Maximum quality
  stepSize: 950, // Always 1:1 scale - no user choice needed
  margin: 24, // Clean spacing
  backgroundColor: "#ffffff", // Clean white background
  darkMode: false, // Light mode by default

  // User-configurable content options
  includeStartPosition: true,
  addStepNumbers: true,
  addUserInfo: false,
  addWord: true,
  addDifficultyLevel: false,
  userName: "",
  notes: "",

  // Footer controls - all shown by default
  showCreatorName: true,
  showNotes: true,
  showBirthday: true,
  customNotesText: "Created using TKA Composer",
};
