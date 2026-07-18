/**
 * Server Context - Shared State and Utilities
 *
 * Provides shared state, utilities, and data access functions
 * that all tool modules need.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { exec, spawn } from "child_process";
import { tmpdir } from "os";
import { calculateOrientations } from "@tka/render-core";
import type { MotionData, PictographData, GridMode } from "../types/pictograph.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * User preferences for pictograph rendering.
 * These persist across tool calls within a session.
 */
export interface UserPreferences {
  darkMode: boolean;
  size: number;
  showTKA: boolean;
  showTND: boolean;
  showElemental: boolean;
  showPositions: boolean;
  showReversals: boolean;
  showGrid: boolean;
  showNonRadialPoints: boolean;
  handPointVisibility: "all" | "active" | "none";
  showBlueMotion: boolean;
  showRedMotion: boolean;
  bluePropType: string | null;
  redPropType: string | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: true,
  size: 400,
  showTKA: true,
  showTND: false,
  showElemental: false,
  showPositions: false,
  showReversals: false,
  showGrid: true,
  showNonRadialPoints: false,
  handPointVisibility: "all",
  showBlueMotion: true,
  showRedMotion: true,
  bluePropType: null,
  redPropType: null,
};

// Current session preferences (starts with defaults)
let currentPreferences: UserPreferences = { ...DEFAULT_PREFERENCES };

export function getPreferences(): UserPreferences {
  return currentPreferences;
}

export function setPreferences(prefs: UserPreferences): void {
  currentPreferences = prefs;
}

export function resetPreferences(): void {
  currentPreferences = { ...DEFAULT_PREFERENCES };
}

export function updatePreferences(partial: Partial<UserPreferences>): void {
  currentPreferences = { ...currentPreferences, ...partial };
}


export function openImageFile(filePath: string): void {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      const child = spawn("cmd", ["/c", "start", '""', filePath], {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
      child.unref();
    } else if (platform === "darwin") {
      const child = spawn("open", [filePath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      const child = spawn("xdg-open", [filePath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }
  } catch (err) {
    console.error(`[MCP] Failed to open image: ${err}`);
  }
}

export function saveAndOpenImage(pngBuffer: Buffer, label: string): string {
  const userHome = process.env.USERPROFILE || process.env.HOME || tmpdir();
  const mcpTempDir = path.join(userHome, "AppData", "Local", "Temp", "tka-mcp");
  if (!fs.existsSync(mcpTempDir)) {
    fs.mkdirSync(mcpTempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `tka-${label}-${timestamp}.png`;
  const filePath = path.join(mcpTempDir, fileName);

  fs.writeFileSync(filePath, pngBuffer);
  openImageFile(filePath);

  return filePath;
}


// Resolve paths relative to the package root
// When compiled, esbuild bundles everything to dist/index.js, so __dirname is dist
// When running source, __dirname is src/shared
const isCompiled = __dirname.includes("dist");
const PACKAGE_ROOT = isCompiled
  ? path.resolve(__dirname, "..") // dist/index.js (esbuild bundle) -> package root
  : path.resolve(__dirname, "../.."); // src/shared -> package root
const ASSETS_ROOT = path.resolve(PACKAGE_ROOT, "assets");

const DATAFRAME_PATHS: Record<GridMode, string> = {
  diamond: path.resolve(ASSETS_ROOT, "data/pictographs/DiamondPictographDataframe.csv"),
  box: path.resolve(ASSETS_ROOT, "data/pictographs/BoxPictographDataframe.csv"),
  skewed: path.resolve(ASSETS_ROOT, "data/pictographs/SkewedPictographDataframe.csv"),
};

// Cache for loaded dataframes
const pictographsByGridMode: Record<GridMode, PictographData[]> = {
  diamond: [],
  box: [],
  skewed: [],
};

let defaultGridMode: GridMode = "diamond";

export function getDefaultGridMode(): GridMode {
  return defaultGridMode;
}

export function setDefaultGridMode(mode: GridMode): void {
  defaultGridMode = mode;
}

function loadDataframe(gridMode: GridMode): PictographData[] {
  const dataframePath = DATAFRAME_PATHS[gridMode];
  try {
    const csvContent = fs.readFileSync(dataframePath, "utf-8");
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const pictographs: PictographData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      // Orientations for isolated variations default to "in" start.
      // When building sequences, orientation-propagation.ts chains each step's
      // end orientation into the next step's start, so the correct orientations
      // propagate through the sequence regardless of this default.
      const blueOrientations = calculateOrientations({
        motionType: row.blueMotionType,
        turns: 0,
        rotationDirection: row.blueRotationDirection || "cw",
        startLocation: row.blueStartLocation,
        endLocation: row.blueEndLocation,
        startOrientation: "in",
      });

      const redOrientations = calculateOrientations({
        motionType: row.redMotionType,
        turns: 0,
        rotationDirection: row.redRotationDirection || "cw",
        startLocation: row.redStartLocation,
        endLocation: row.redEndLocation,
        startOrientation: "in",
      });

      // Skip blank/separator lines in the CSV
      if (!row.letter || row.letter.trim() === "") continue;

      pictographs.push({
        letter: row.letter,
        startPosition: row.startPosition,
        endPosition: row.endPosition,
        timing: row.timing,
        direction: row.direction,
        blueMotion: {
          color: "blue",
          startLocation: row.blueStartLocation,
          endLocation: row.blueEndLocation,
          motionType: row.blueMotionType,
          rotationDirection: row.blueRotationDirection,
          startOrientation: blueOrientations.startOrientation,
          endOrientation: blueOrientations.endOrientation,
        },
        redMotion: {
          color: "red",
          startLocation: row.redStartLocation,
          endLocation: row.redEndLocation,
          motionType: row.redMotionType,
          rotationDirection: row.redRotationDirection,
          startOrientation: redOrientations.startOrientation,
          endOrientation: redOrientations.endOrientation,
        },
      });
    }

    return pictographs;
  } catch (error) {
    console.error(`[MCP] Failed to load ${gridMode} dataframe:`, error);
    return [];
  }
}

export function ensureDataLoaded(gridMode: GridMode = defaultGridMode): PictographData[] {
  if (pictographsByGridMode[gridMode].length === 0) {
    console.error(`[MCP] Loading ${gridMode} pictograph dataframe...`);
    pictographsByGridMode[gridMode] = loadDataframe(gridMode);
    console.error(`[MCP] Loaded ${pictographsByGridMode[gridMode].length} pictographs for ${gridMode} mode`);
  }
  return pictographsByGridMode[gridMode];
}

export function getAllPictographs(): PictographData[] {
  return ensureDataLoaded(defaultGridMode);
}


export const TKA_LETTER_TYPES = {
  type1: {
    name: "Type 1: Dual-Shift",
    description: "Both hands shift (move to adjacent grid point)",
    letters: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"],
  },
  type2: {
    name: "Type 2: Shift",
    description: "One hand shifts, one hand stays static",
    letters: ["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"],
  },
  type3: {
    name: "Type 3: Cross-Shift (Dash Letters)",
    description: "One hand shifts + one hand dashes. The '-' suffix indicates Type 3.",
    letters: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"],
  },
  type4: {
    name: "Type 4: Dash",
    description: "One hand dashes (moves to opposite grid point), one stays static",
    letters: ["Φ", "Ψ", "Λ"],
  },
  type5: {
    name: "Type 5: Dual-Dash",
    description: "Both hands dash simultaneously",
    letters: ["Φ-", "Ψ-", "Λ-"],
  },
  type6: {
    name: "Type 6: Static",
    description: "Both hands remain stationary (no hand motion)",
    letters: ["α", "β", "γ"],
  },
};

export const LETTER_TO_TYPE: Record<string, { type: string; name: string }> = {};
for (const [typeKey, typeInfo] of Object.entries(TKA_LETTER_TYPES)) {
  for (const letter of typeInfo.letters) {
    LETTER_TO_TYPE[letter] = { type: typeKey, name: typeInfo.name };
  }
}


export interface GlossaryEntry {
  definition: string;
  examples: string[];
  relatedTerms: string[];
  category: string;
}

export interface LetterTypeInfo {
  name: string;
  description: string;
  characteristics: string[];
  letters: string[];
  motionPattern: {
    blueMotion: string;
    redMotion: string;
    note?: string;
  };
}

const GLOSSARY_PATH = path.resolve(PACKAGE_ROOT, "./data/tka-glossary.json");
const LETTER_TYPES_PATH = path.resolve(PACKAGE_ROOT, "./data/letter-types.json");

let glossary: Record<string, GlossaryEntry> = {};
let letterTypes: Record<string, LetterTypeInfo> = {};

export function loadKnowledgeBase(): void {
  try {
    if (fs.existsSync(GLOSSARY_PATH)) {
      glossary = JSON.parse(fs.readFileSync(GLOSSARY_PATH, "utf-8"));
    }
    if (fs.existsSync(LETTER_TYPES_PATH)) {
      letterTypes = JSON.parse(fs.readFileSync(LETTER_TYPES_PATH, "utf-8"));
    }
  } catch (error) {
    console.error("[MCP] Failed to load knowledge base:", error);
  }
}

export function getGlossary(): Record<string, GlossaryEntry> {
  return glossary;
}

export function getLetterTypes(): Record<string, LetterTypeInfo> {
  return letterTypes;
}


export function generateRandomWord(length: number, excludeLetters?: string[]): string {
  const allPictographs = ensureDataLoaded();
  const allLetters = new Set<string>();
  for (const p of allPictographs) {
    allLetters.add(p.letter);
  }

  const excludeSet = new Set(excludeLetters || []);
  const availableLetters = [...allLetters].filter((l) => !excludeSet.has(l));

  if (availableLetters.length === 0) {
    return "ABCD".slice(0, length);
  }

  let word = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * availableLetters.length);
    word += availableLetters[randomIndex];
  }

  return word;
}

// Re-export types for convenience
export type { MotionData, PictographData, GridMode };
