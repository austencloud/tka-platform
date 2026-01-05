/**
 * Share Options Domain Model
 *
 * Configuration options for sharing/downloading sequence images.
 * Simplified from the over-engineered export options.
 */

export interface ShareOptions {
  // === IMAGE FORMAT ===
  format: "PNG" | "JPEG" | "WebP";
  quality: number; // 0-1 for JPEG/WebP

  // === CONTENT OPTIONS ===
  includeStartPosition: boolean;
  addBeatNumbers: boolean;
  addUserInfo: boolean;
  addWord: boolean;
  addDifficultyLevel: boolean;
  customName?: string; // Optional custom name for header

  // === VISUAL OPTIONS ===
  beatSize: number; // Size of each beat in pixels
  margin: number; // Margin around the sequence
  backgroundColor: string;

  // === USER INFO ===
  userName: string;
  notes: string;
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
      addBeatNumbers: true,
      addUserInfo: false, // Keep clean for social
      addWord: true,
      addDifficultyLevel: false,
      beatSize: 950, // Always 1:1 scale
      margin: 20,
      backgroundColor: "#ffffff",
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
      addBeatNumbers: true,
      addUserInfo: true,
      addWord: true,
      addDifficultyLevel: true,
      beatSize: 950, // Always 1:1 scale
      margin: 50,
      backgroundColor: "#ffffff",
      userName: "", // Will be populated from auth state
      notes: "Created with TKA Scribe",
    },
  },

  web: {
    name: "Web Sharing",
    description: "Balanced quality and file size",
    options: {
      format: "WebP",
      quality: 0.85,
      includeStartPosition: true,
      addBeatNumbers: true,
      addUserInfo: true,
      addWord: true,
      addDifficultyLevel: false,
      beatSize: 950, // Always 1:1 scale
      margin: 30,
      backgroundColor: "#ffffff",
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
  beatSize: 950, // Always 1:1 scale - no user choice needed
  margin: 24, // Clean spacing
  backgroundColor: "#ffffff", // Clean white background

  // User-configurable content options
  includeStartPosition: true,
  addBeatNumbers: true,
  addUserInfo: false,
  addWord: true,
  addDifficultyLevel: false,
  userName: "",
  notes: "",
};
