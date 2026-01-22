/**
 * TKA Domain MCP Server
 *
 * Comprehensive MCP server for The Kinetic Alphabet domain.
 * Provides pictograph rendering, sequence generation, educational tools,
 * and domain knowledge queries.
 *
 * Tools:
 * - Pictograph Generation: generate_pictograph, generate_pictograph_url, generate_sequence_image
 * - Data Queries: list_available_letters, list_letter_variations, get_pictograph_data, search_pictographs
 * - Sequences: generate_sequence_data, validate_word
 * - Educational: get_alphabet_info, get_letter_explanation, get_term_definition, compare_letters
 * - Compound Letters: get_compound_info, list_compounds
 * - VTG Classification: get_vtg_classification
 * - Preferences: set_preferences, get_preferences, reset_preferences
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { tmpdir } from "os";
import { getStandaloneRenderer, type RenderVisibilityOptions } from "./src/core/standalone-renderer.js";
import { buildSequenceFromLetters, parseWordToLetters, type SequenceStep, type SequenceResult, type BridgeSelections, type BridgeInfo } from "./src/core/sequence-builder.js";
import { renderSequenceToImage, LOOPComponent } from "./src/core/sequence-renderer.js";
import { calculateOrientations } from "./src/core/orientation-calculator.js";
import { allocateTurns } from "./src/core/turn-allocator.js";
import {
  parseConstraintSet,
  parseConstraints,
  buildConstrainedSequence,
  emptyConstraintSet,
  getPresetConstraintSet,
  listPresets,
  formatConstraintReport,
  getTransitionMatrix,
  analyzeWordFeasibility,
  suggestAlternatives,
  explainConstraintImpossibility,
  type PresetName,
  type ConstraintReport,
  type WordFeasibility,
} from "./src/core/constraints/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// IMAGE AUTO-OPEN UTILITY
// ============================================================================

/**
 * Open an image file with the system's default image viewer.
 * Works cross-platform: Windows (start), macOS (open), Linux (xdg-open)
 */
function openImageFile(filePath: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "win32") {
    // Windows: use 'start' command
    command = `start "" "${filePath}"`;
  } else if (platform === "darwin") {
    // macOS: use 'open' command
    command = `open "${filePath}"`;
  } else {
    // Linux/other: use 'xdg-open'
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`[MCP] Failed to open image: ${error.message}`);
    }
  });
}

/**
 * Save PNG buffer to a temp file and open it immediately.
 * Returns the temp file path.
 */
function saveAndOpenImage(pngBuffer: Buffer, letter: string): string {
  // Create temp file with descriptive name
  const tempDir = tmpdir();
  const timestamp = Date.now();
  const fileName = `tka-${letter}-${timestamp}.png`;
  const filePath = path.join(tempDir, fileName);

  fs.writeFileSync(filePath, pngBuffer);
  openImageFile(filePath);

  return filePath;
}

// ============================================================================
// PREFERENCES SYSTEM
// ============================================================================

/**
 * User preferences for pictograph rendering.
 * These persist across tool calls within a session.
 */
interface UserPreferences {
  // Display options
  darkMode: boolean;
  size: number;

  // Glyph visibility
  showTKA: boolean;           // Letter + turn numbers
  showVTG: boolean;           // Vertical timing glyph
  showElemental: boolean;     // Elemental glyph
  showPositions: boolean;     // Start→End position glyph
  showReversals: boolean;     // Reversal indicator dots

  // Grid options
  showGrid: boolean;          // Master grid toggle
  showNonRadialPoints: boolean;
  handPointVisibility: "all" | "active" | "none";

  // Motion visibility
  showBlueMotion: boolean;
  showRedMotion: boolean;

  // Prop type overrides (null = use default staff)
  bluePropType: string | null;
  redPropType: string | null;
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: true,
  size: 400,
  showTKA: true,
  showVTG: false,
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

/**
 * Merge partial preferences with current preferences
 */
function mergePreferences(partial: Partial<UserPreferences>): UserPreferences {
  return { ...currentPreferences, ...partial };
}

// Types for pictograph data
interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
  startOrientation: string;  // "in" | "out" | "clock" | "counter"
  endOrientation: string;    // "in" | "out" | "clock" | "counter"
}

interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

// CSV loading - support for all three grid modes
type GridMode = "diamond" | "box" | "skewed";

const DATAFRAME_PATHS: Record<GridMode, string> = {
  diamond: path.resolve(__dirname, "../static/data/pictographs/DiamondPictographDataframe.csv"),
  box: path.resolve(__dirname, "../static/data/pictographs/BoxPictographDataframe.csv"),
  skewed: path.resolve(__dirname, "../static/data/pictographs/SkewedPictographDataframe.csv"),
};

// Cache for loaded dataframes
const pictographsByGridMode: Record<GridMode, PictographData[]> = {
  diamond: [],
  box: [],
  skewed: [],
};

// Default grid mode for backwards compatibility
let defaultGridMode: GridMode = "diamond";

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

      // Pre-compute orientations for blue motion
      // CSV variations are all 0 turns with "in" as default start orientation
      const blueOrientations = calculateOrientations({
        motionType: row.blueMotionType,
        turns: 0,
        rotationDirection: row.blueRotationDirection || "cw",
        startLocation: row.blueStartLocation,
        endLocation: row.blueEndLocation,
        startOrientation: "in",
      });

      // Pre-compute orientations for red motion
      const redOrientations = calculateOrientations({
        motionType: row.redMotionType,
        turns: 0,
        rotationDirection: row.redRotationDirection || "cw",
        startLocation: row.redStartLocation,
        endLocation: row.redEndLocation,
        startOrientation: "in",
      });

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

function ensureDataLoaded(gridMode: GridMode = defaultGridMode): PictographData[] {
  if (pictographsByGridMode[gridMode].length === 0) {
    console.error(`[MCP] Loading ${gridMode} pictograph dataframe...`);
    pictographsByGridMode[gridMode] = loadDataframe(gridMode);
    console.error(`[MCP] Loaded ${pictographsByGridMode[gridMode].length} pictographs for ${gridMode} mode`);
  }
  return pictographsByGridMode[gridMode];
}

// Legacy getter for backwards compatibility (uses default grid mode)
function getAllPictographs(): PictographData[] {
  return ensureDataLoaded(defaultGridMode);
}

// Create MCP server
const server = new McpServer({
  name: "tka-domain",
  version: "2.0.0",
});

// Tool: list_letter_variations
server.tool(
  "list_letter_variations",
  "List all variations of a TKA letter. Each letter can have multiple variations with different motion combinations.",
  {
    letter: z.string().describe("Letter to list variations for (A-Z, or Greek: α, β, γ, Δ, Θ, Λ, Σ, Φ, Ψ, Ω)"),
  },
  async ({ letter }) => {
    const allPictographs = ensureDataLoaded();

    const variations = allPictographs.filter((p) => p.letter === letter);

    if (variations.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No variations found for letter: ${letter}` },
        ],
      };
    }

    const variationList = variations
      .map((v, i) => {
        return `[${i}] ${v.startPosition} → ${v.endPosition}
   Blue: ${v.blueMotion.startLocation}→${v.blueMotion.endLocation} (${v.blueMotion.motionType}, ${v.blueMotion.rotationDirection})
   Red: ${v.redMotion.startLocation}→${v.redMotion.endLocation} (${v.redMotion.motionType}, ${v.redMotion.rotationDirection})`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Letter ${letter} has ${variations.length} variations:\n\n${variationList}`,
        },
      ],
    };
  }
);

// Tool: get_pictograph_data
server.tool(
  "get_pictograph_data",
  "Get detailed data for a specific pictograph variation. Returns all motion parameters.",
  {
    letter: z.string().describe("The letter (A-Z or Greek)"),
    variation: z.number().optional().default(0).describe("Variation index (0-based)"),
  },
  async ({ letter, variation = 0 }) => {
    const allPictographs = ensureDataLoaded();

    const variations = allPictographs.filter((p) => p.letter === letter);

    if (variations.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No pictograph found for letter: ${letter}` },
        ],
        isError: true,
      };
    }

    if (variation >= variations.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Variation ${variation} not found. Letter ${letter} has ${variations.length} variations (0-${variations.length - 1})`,
          },
        ],
        isError: true,
      };
    }

    const p = variations[variation];
    const data = JSON.stringify(p, null, 2);

    return {
      content: [
        { type: "text" as const, text: `Pictograph ${letter} (variation ${variation}):\n\n${data}` },
      ],
    };
  }
);

// Tool: search_pictographs
server.tool(
  "search_pictographs",
  "Search for pictographs matching specific criteria. Filter by position, motion type, or location.",
  {
    startPosition: z.string().optional().describe("Filter by start position (e.g., alpha1, alpha3, beta1)"),
    endPosition: z.string().optional().describe("Filter by end position"),
    motionType: z.enum(["pro", "anti", "static", "dash"]).optional().describe("Filter by motion type"),
    startLocation: z.string().optional().describe("Filter by motion start location (n, e, s, w, ne, se, sw, nw)"),
    endLocation: z.string().optional().describe("Filter by motion end location"),
    limit: z.number().optional().default(10).describe("Max results to return"),
  },
  async ({ startPosition, endPosition, motionType, startLocation, endLocation, limit = 10 }) => {
    const allPictographs = ensureDataLoaded();

    let results = [...allPictographs];

    if (startPosition) {
      results = results.filter(
        (p) => p.startPosition.toLowerCase() === startPosition.toLowerCase()
      );
    }

    if (endPosition) {
      results = results.filter(
        (p) => p.endPosition.toLowerCase() === endPosition.toLowerCase()
      );
    }

    if (motionType) {
      results = results.filter(
        (p) =>
          p.blueMotion.motionType === motionType ||
          p.redMotion.motionType === motionType
      );
    }

    if (startLocation) {
      results = results.filter(
        (p) =>
          p.blueMotion.startLocation === startLocation ||
          p.redMotion.startLocation === startLocation
      );
    }

    if (endLocation) {
      results = results.filter(
        (p) =>
          p.blueMotion.endLocation === endLocation ||
          p.redMotion.endLocation === endLocation
      );
    }

    const limited = results.slice(0, limit);

    if (limited.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No pictographs found matching criteria" },
        ],
      };
    }

    const resultList = limited
      .map((p) => {
        return `${p.letter}: ${p.startPosition}→${p.endPosition} | Blue: ${p.blueMotion.startLocation}→${p.blueMotion.endLocation} (${p.blueMotion.motionType}) | Red: ${p.redMotion.startLocation}→${p.redMotion.endLocation} (${p.redMotion.motionType})`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${results.length} matches (showing ${limited.length}):\n\n${resultList}`,
        },
      ],
    };
  }
);

// ============================================================================
// TKA LETTER TYPE DEFINITIONS
// ============================================================================

/**
 * The 6 TKA letter types, organized by motion characteristics.
 * This is the canonical source of truth for letter classification.
 */
const TKA_LETTER_TYPES = {
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

/**
 * Lookup table: letter -> type info (for quick resolution)
 */
const LETTER_TO_TYPE: Record<string, { type: string; name: string }> = {};
for (const [typeKey, typeInfo] of Object.entries(TKA_LETTER_TYPES)) {
  for (const letter of typeInfo.letters) {
    LETTER_TO_TYPE[letter] = { type: typeKey, name: typeInfo.name };
  }
}

// Tool: list_available_letters
server.tool(
  "list_available_letters",
  "List all letters available in the TKA alphabet dataframe",
  {
    compact: z.boolean().optional().default(false).describe("Compact output (just letter lists, no descriptions - saves ~800 tokens)"),
  },
  async ({ compact = false }) => {
    const allPictographs = ensureDataLoaded();

    // Get letters actually present in the dataframe
    const availableLetters = new Set<string>();
    for (const p of allPictographs) {
      availableLetters.add(p.letter);
    }

    // Compact mode: just the letters, minimal formatting
    if (compact) {
      const byType: string[] = [];
      for (const [_typeKey, typeInfo] of Object.entries(TKA_LETTER_TYPES)) {
        const presentLetters = typeInfo.letters.filter((l) => availableLetters.has(l));
        if (presentLetters.length > 0) {
          byType.push(`${typeInfo.name.split(":")[0]}: ${presentLetters.join(",")}`);
        }
      }
      return {
        content: [{ type: "text" as const, text: byType.join("\n") }],
      };
    }

    // Full mode: verbose with descriptions
    const output: string[] = [
      "# TKA Letters by Type",
      "",
      "IMPORTANT: When a user says '[Letter] dash' (e.g., 'Sigma dash'), they mean the Type 3 letter with '-' suffix (e.g., 'Σ-'), NOT a letter with dash motion.",
      "",
    ];

    for (const [_typeKey, typeInfo] of Object.entries(TKA_LETTER_TYPES)) {
      const presentLetters = typeInfo.letters.filter((l) => availableLetters.has(l));
      if (presentLetters.length > 0) {
        output.push(`## ${typeInfo.name}`);
        output.push(`${typeInfo.description}`);
        output.push(`Letters: ${presentLetters.join(", ")}`);
        output.push("");
      }
    }

    output.push(`Total: ${availableLetters.size} letters`);

    return {
      content: [
        {
          type: "text" as const,
          text: output.join("\n"),
        },
      ],
    };
  }
);

// Tool: get_alphabet_info
server.tool(
  "get_alphabet_info",
  "Get comprehensive information about the TKA (The Kinetic Alphabet) system. Use this to understand the domain before working with pictographs.",
  {},
  async () => {
    const info = `# The Kinetic Alphabet (TKA) - Domain Reference

## Overview

TKA is a notation system for flow arts with dual wielded props (staff, fans, clubs, etc.) that encodes hand positions and movements into letters. Each "pictograph" represents one beat of motion showing:
- Two props (blue and red) at specific grid positions
- Motion arrows showing how each hand moves
- Start and end positions (Alpha, Beta, or Gamma)

## The Grid System

Pictographs use a diamond grid with 8 points:
- **Cardinal**: North (n), East (e), South (s), West (w)
- **Intercardinal**: Northeast (ne), Southeast (se), Southwest (sw), Northwest (nw)

## Hand Positions

- **Alpha (α)**: Hands across from each other (opposite points)
- **Beta (β)**: Hands at the same point
- **Gamma (γ)**: Hands form a right angle (adjacent points)

## Motion Types

Each hand can perform one of 4 motion types:
- **Static**: Hand stays at current grid point (no motion)
- **Shift**: Hand moves to an adjacent grid point (90° movement)
- **Dash**: Hand moves to the opposite grid point (180° movement)
- **Pro/Anti**: Refers to prop rotation direction (prospin = with hand path, antispin = against)

## The 6 Letter Types

### Type 1: Dual-Shift (22 letters: A-V)
Both hands shift. The most common type.
- Letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V

### Type 2: Shift (8 letters)
One hand shifts, one hand stays static.
- Letters: W, X, Y, Z, Σ (Sigma), Δ (Delta), Θ (Theta), Ω (Omega)

### Type 3: Cross-Shift / "Dash Letters" (8 letters)
One hand shifts + one hand dashes. These have a "-" suffix.
- Letters: W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-
- **CRITICAL**: When someone says "Sigma dash" or "W dash", they mean the Type 3 letter (Σ-, W-), NOT a letter that uses dash motion.

### Type 4: Dash (3 letters)
One hand dashes, one stays static.
- Letters: Φ (Phi), Ψ (Psi), Λ (Lambda)

### Type 5: Dual-Dash (3 letters)
Both hands dash simultaneously. These also have a "-" suffix.
- Letters: Φ-, Ψ-, Λ-

### Type 6: Static (3 letters)
Both hands remain stationary.
- Letters: α (alpha), β (beta), γ (gamma)

## Naming Convention Summary

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma" or "Σ" | Σ | Type 2 (Shift) |
| "Sigma dash" or "Σ-" | Σ- | Type 3 (Cross-Shift) |
| "W" | W | Type 2 (Shift) |
| "W dash" or "W-" | W- | Type 3 (Cross-Shift) |
| "Phi" or "Φ" | Φ | Type 4 (Dash) |
| "Phi dash" or "Φ-" | Φ- | Type 5 (Dual-Dash) |

## Variations

Each letter has multiple **variations** - different ways to execute the same letter type based on:
- Starting position (alpha1, alpha3, beta1, gamma5, etc.)
- Ending position
- Rotation directions (cw = clockwise, ccw = counter-clockwise)
- Start/end locations on the grid

Use \`list_letter_variations\` to see all variations for a specific letter.`;

    return {
      content: [
        {
          type: "text" as const,
          text: info,
        },
      ],
    };
  }
);

// Tool: generate_pictograph_url
server.tool(
  "generate_pictograph_url",
  "Generate a URL to render a pictograph image. Use with Playwright to navigate and screenshot, or provide to user. The dev server must be running at localhost:5173.",
  {
    letter: z.string().describe("The letter to render (A-Z or Greek)"),
    variation: z.number().optional().default(0).describe("Variation index (0-based)"),
    darkMode: z.boolean().optional().default(false).describe("Use dark background"),
    minimal: z.boolean().optional().default(true).describe("Minimal mode (no UI, just the pictograph)"),
  },
  async ({ letter, variation = 0, darkMode = false, minimal = true }) => {
    const allPictographs = ensureDataLoaded();

    // Validate the letter exists
    const variations = allPictographs.filter((p) => p.letter === letter);
    if (variations.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No pictograph found for letter: ${letter}` },
        ],
        isError: true,
      };
    }

    if (variation >= variations.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Variation ${variation} not found. Letter ${letter} has ${variations.length} variations (0-${variations.length - 1})`,
          },
        ],
        isError: true,
      };
    }

    // Build the URL
    const params = new URLSearchParams({
      letter,
      variation: variation.toString(),
      dark: darkMode.toString(),
      minimal: minimal.toString(),
    });

    const url = `http://localhost:5173/test/pictograph-cli?${params.toString()}`;

    // Get pictograph info for context
    const p = variations[variation];

    return {
      content: [
        {
          type: "text" as const,
          text: `Pictograph URL for ${letter} (variation ${variation}):\n\n${url}\n\nTo capture as image:\n1. Use Playwright: browser_navigate to this URL, wait 2 seconds, then browser_take_screenshot\n2. Or open in browser and screenshot manually\n\nPictograph details:\n- Blue: ${p.blueMotion.startLocation}→${p.blueMotion.endLocation} (${p.blueMotion.motionType})\n- Red: ${p.redMotion.startLocation}→${p.redMotion.endLocation} (${p.redMotion.motionType})`,
        },
      ],
    };
  }
);

// Tool: generate_pictograph (pure Node.js image generation with full visibility control)
server.tool(
  "generate_pictograph",
  "Generate a pictograph PNG image directly in Node.js. Uses current preferences unless overridden. Returns base64-encoded image.",
  {
    letter: z.string().describe("The letter to render (A-Z or Greek: α, β, γ, Δ, Θ, Λ, Σ, Φ, Ψ, Ω)"),
    variation: z.number().optional().default(0).describe("Variation index (0-based)"),
    // Override preferences for this render only (optional)
    darkMode: z.boolean().optional().describe("Override: dark background"),
    size: z.number().optional().describe("Override: image size in pixels"),
    showTKA: z.boolean().optional().describe("Override: show TKA letter glyph"),
    showVTG: z.boolean().optional().describe("Override: show VTG (timing) glyph"),
    showPositions: z.boolean().optional().describe("Override: show start→end positions glyph"),
    showReversals: z.boolean().optional().describe("Override: show reversal indicators"),
    showGrid: z.boolean().optional().describe("Override: show grid"),
    showNonRadialPoints: z.boolean().optional().describe("Override: show non-radial grid points"),
    showBlueMotion: z.boolean().optional().describe("Override: show blue motion (prop + arrow)"),
    showRedMotion: z.boolean().optional().describe("Override: show red motion (prop + arrow)"),
    includeTextData: z.boolean().optional().default(true).describe("Include motion data as text (false = image only, saves tokens)"),
  },
  async ({ letter, variation = 0, includeTextData = true, ...overrides }) => {
    const allPictographs = ensureDataLoaded();

    // Validate the letter exists
    const variations = allPictographs.filter((p) => p.letter === letter);
    if (variations.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No pictograph found for letter: ${letter}` },
        ],
        isError: true,
      };
    }

    if (variation >= variations.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Variation ${variation} not found. Letter ${letter} has ${variations.length} variations (0-${variations.length - 1})`,
          },
        ],
        isError: true,
      };
    }

    try {
      const csvRow = variations[variation];

      // Merge preferences with any overrides
      const prefs = { ...currentPreferences };
      if (overrides.darkMode !== undefined) prefs.darkMode = overrides.darkMode;
      if (overrides.size !== undefined) prefs.size = overrides.size;
      if (overrides.showTKA !== undefined) prefs.showTKA = overrides.showTKA;
      if (overrides.showVTG !== undefined) prefs.showVTG = overrides.showVTG;
      if (overrides.showPositions !== undefined) prefs.showPositions = overrides.showPositions;
      if (overrides.showReversals !== undefined) prefs.showReversals = overrides.showReversals;
      if (overrides.showGrid !== undefined) prefs.showGrid = overrides.showGrid;
      if (overrides.showNonRadialPoints !== undefined) prefs.showNonRadialPoints = overrides.showNonRadialPoints;
      if (overrides.showBlueMotion !== undefined) prefs.showBlueMotion = overrides.showBlueMotion;
      if (overrides.showRedMotion !== undefined) prefs.showRedMotion = overrides.showRedMotion;

      // Convert CSV row to the simple input format for standalone renderer
      // Note: CSV doesn't have turns or startOrientation, so we default them
      const pictographInput = {
        letter: csvRow.letter,
        startPosition: csvRow.startPosition,
        endPosition: csvRow.endPosition,
        blueMotion: {
          motionType: csvRow.blueMotion.motionType,
          rotationDirection: csvRow.blueMotion.rotationDirection || "no_rotation",
          startLocation: csvRow.blueMotion.startLocation,
          endLocation: csvRow.blueMotion.endLocation,
          color: "blue",
          turns: 0, // Default - CSV basic variations are all 0 turns
          startOrientation: "in", // Default to radial orientation
        },
        redMotion: {
          motionType: csvRow.redMotion.motionType,
          rotationDirection: csvRow.redMotion.rotationDirection || "no_rotation",
          startLocation: csvRow.redMotion.startLocation,
          endLocation: csvRow.redMotion.endLocation,
          color: "red",
          turns: 0, // Default - CSV basic variations are all 0 turns
          startOrientation: "in", // Default to radial orientation
        },
      };

      // Build visibility options from preferences
      const visibility: RenderVisibilityOptions = {
        darkMode: prefs.darkMode,
        size: prefs.size,
        showTKA: prefs.showTKA,
        showVTG: prefs.showVTG,
        showPositions: prefs.showPositions,
        showReversals: prefs.showReversals,
        showGrid: prefs.showGrid,
        showNonRadialPoints: prefs.showNonRadialPoints,
        showBlueMotion: prefs.showBlueMotion,
        showRedMotion: prefs.showRedMotion,
        bluePropType: prefs.bluePropType,
        redPropType: prefs.redPropType,
      };

      // Render using standalone Node.js renderer
      const renderer = getStandaloneRenderer();
      const pngBuffer = await renderer.renderToPng(pictographInput, visibility);

      // AUTO-OPEN: Save to temp and open immediately with system viewer
      const tempPath = saveAndOpenImage(pngBuffer, letter);

      // Also convert to base64 for clients that support inline images
      const base64 = pngBuffer.toString("base64");

      // Build description of what was rendered
      const enabledFeatures = [];
      if (prefs.showTKA) enabledFeatures.push("TKA");
      if (prefs.showVTG) enabledFeatures.push("VTG");
      if (prefs.showPositions) enabledFeatures.push("positions");
      if (prefs.showReversals) enabledFeatures.push("reversals");
      if (prefs.showGrid) enabledFeatures.push("grid");

      // Build accurate motion descriptions from the actual data
      const blueMotionDesc = `${csvRow.blueMotion.motionType} from ${csvRow.blueMotion.startLocation} to ${csvRow.blueMotion.endLocation}` +
        (csvRow.blueMotion.rotationDirection !== "noRotation" ? ` (${csvRow.blueMotion.rotationDirection})` : "");
      const redMotionDesc = `${csvRow.redMotion.motionType} from ${csvRow.redMotion.startLocation} to ${csvRow.redMotion.endLocation}` +
        (csvRow.redMotion.rotationDirection !== "noRotation" ? ` (${csvRow.redMotion.rotationDirection})` : "");

      // Conditionally include text data (saves ~250 tokens when false)
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

      if (includeTextData) {
        const motionData = `## ${letter} (variation ${variation})

**Position:** ${csvRow.startPosition} → ${csvRow.endPosition}

**Blue Motion:** ${blueMotionDesc}
**Red Motion:** ${redMotionDesc}`;
        content.push({ type: "text" as const, text: motionData });
      }

      content.push({
        type: "image" as const,
        data: base64,
        mimeType: "image/png",
      });

      return { content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to generate pictograph: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: set_preferences (persist visibility settings for future pictographs)
server.tool(
  "set_preferences",
  "Set visibility preferences for all future pictograph generations in this session. Any setting not specified will keep its current value.",
  {
    darkMode: z.boolean().optional().describe("Use dark background (default: true)"),
    size: z.number().optional().describe("Image size in pixels (default: 400)"),
    showTKA: z.boolean().optional().describe("Show TKA letter glyph with turn numbers"),
    showVTG: z.boolean().optional().describe("Show VTG (vertical timing) glyph"),
    showPositions: z.boolean().optional().describe("Show start→end positions glyph"),
    showReversals: z.boolean().optional().describe("Show reversal indicator dots"),
    showGrid: z.boolean().optional().describe("Show grid (master toggle)"),
    showNonRadialPoints: z.boolean().optional().describe("Show non-radial grid points (corners)"),
    handPointVisibility: z.enum(["all", "active", "none"]).optional().describe("Hand point visibility mode"),
    showBlueMotion: z.boolean().optional().describe("Show blue motion (prop + arrow)"),
    showRedMotion: z.boolean().optional().describe("Show red motion (prop + arrow)"),
    bluePropType: z.string().nullable().optional().describe("Blue prop type (staff, fan, club, etc.) or null for default"),
    redPropType: z.string().nullable().optional().describe("Red prop type or null for default"),
  },
  async (newPrefs) => {
    // Update preferences
    const before = { ...currentPreferences };

    if (newPrefs.darkMode !== undefined) currentPreferences.darkMode = newPrefs.darkMode;
    if (newPrefs.size !== undefined) currentPreferences.size = newPrefs.size;
    if (newPrefs.showTKA !== undefined) currentPreferences.showTKA = newPrefs.showTKA;
    if (newPrefs.showVTG !== undefined) currentPreferences.showVTG = newPrefs.showVTG;
    if (newPrefs.showPositions !== undefined) currentPreferences.showPositions = newPrefs.showPositions;
    if (newPrefs.showReversals !== undefined) currentPreferences.showReversals = newPrefs.showReversals;
    if (newPrefs.showGrid !== undefined) currentPreferences.showGrid = newPrefs.showGrid;
    if (newPrefs.showNonRadialPoints !== undefined) currentPreferences.showNonRadialPoints = newPrefs.showNonRadialPoints;
    if (newPrefs.handPointVisibility !== undefined) currentPreferences.handPointVisibility = newPrefs.handPointVisibility;
    if (newPrefs.showBlueMotion !== undefined) currentPreferences.showBlueMotion = newPrefs.showBlueMotion;
    if (newPrefs.showRedMotion !== undefined) currentPreferences.showRedMotion = newPrefs.showRedMotion;
    if (newPrefs.bluePropType !== undefined) currentPreferences.bluePropType = newPrefs.bluePropType;
    if (newPrefs.redPropType !== undefined) currentPreferences.redPropType = newPrefs.redPropType;

    // Build summary of changes
    const changes: string[] = [];
    for (const key of Object.keys(newPrefs) as (keyof UserPreferences)[]) {
      if (newPrefs[key] !== undefined && before[key] !== currentPreferences[key]) {
        changes.push(`${key}: ${before[key]} → ${currentPreferences[key]}`);
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: changes.length > 0
            ? `Updated preferences:\n${changes.map(c => `  • ${c}`).join("\n")}\n\nAll future pictographs will use these settings.`
            : "No preferences changed (values were already set to these).",
        },
      ],
    };
  }
);

// Tool: get_preferences (show current visibility settings)
server.tool(
  "get_preferences",
  "Get current visibility preferences for pictograph generation.",
  {
    compact: z.boolean().optional().default(false).describe("Compact output (key:value pairs only - saves ~300 tokens)"),
  },
  async ({ compact = false }) => {
    const prefs = currentPreferences;

    // Compact mode: terse key:value format
    if (compact) {
      const pairs = [
        `dark:${prefs.darkMode}`,
        `size:${prefs.size}`,
        `tka:${prefs.showTKA}`,
        `vtg:${prefs.showVTG}`,
        `pos:${prefs.showPositions}`,
        `rev:${prefs.showReversals}`,
        `grid:${prefs.showGrid}`,
        `blue:${prefs.showBlueMotion}`,
        `red:${prefs.showRedMotion}`,
      ];
      return {
        content: [{ type: "text" as const, text: pairs.join(" ") }],
      };
    }

    // Full mode: verbose with grouping
    const summary = `Current Pictograph Preferences:

Display:
  • darkMode: ${prefs.darkMode}
  • size: ${prefs.size}px

Glyphs:
  • showTKA: ${prefs.showTKA} (letter + turn numbers)
  • showVTG: ${prefs.showVTG} (timing glyph)
  • showPositions: ${prefs.showPositions} (start→end)
  • showReversals: ${prefs.showReversals}

Grid:
  • showGrid: ${prefs.showGrid}
  • showNonRadialPoints: ${prefs.showNonRadialPoints}
  • handPointVisibility: ${prefs.handPointVisibility}

Motions:
  • showBlueMotion: ${prefs.showBlueMotion}
  • showRedMotion: ${prefs.showRedMotion}

Props:
  • bluePropType: ${prefs.bluePropType ?? "staff (default)"}
  • redPropType: ${prefs.redPropType ?? "staff (default)"}`;

    return {
      content: [
        { type: "text" as const, text: summary },
      ],
    };
  }
);

// Tool: reset_preferences (restore defaults)
server.tool(
  "reset_preferences",
  "Reset all preferences to defaults.",
  {},
  async () => {
    currentPreferences = { ...DEFAULT_PREFERENCES };

    return {
      content: [
        {
          type: "text" as const,
          text: "Preferences reset to defaults:\n" +
                "  • darkMode: true, size: 400px\n" +
                "  • showTKA: true, all other glyphs: false\n" +
                "  • showGrid: true, showNonRadialPoints: false\n" +
                "  • Both motions visible, prop type: staff",
        },
      ],
    };
  }
);

// ============================================================================
// EDUCATIONAL TOOLS (for TIKA AI Assistant)
// ============================================================================

// Load knowledge base files
const GLOSSARY_PATH = path.resolve(__dirname, "./data/tka-glossary.json");
const LETTER_TYPES_PATH = path.resolve(__dirname, "./data/letter-types.json");

interface GlossaryEntry {
  definition: string;
  examples: string[];
  relatedTerms: string[];
  category: string;
}

interface LetterTypeInfo {
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

let glossary: Record<string, GlossaryEntry> = {};
let letterTypes: Record<string, LetterTypeInfo> = {};

function loadKnowledgeBase() {
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

// Load knowledge base on startup
loadKnowledgeBase();

// Tool: get_letter_explanation
server.tool(
  "get_letter_explanation",
  "Get a comprehensive explanation of a TKA letter including its type, motion characteristics, and all variations. Perfect for teaching users about specific letters.",
  {
    letter: z.string().describe("The letter to explain (A-Z or Greek)"),
    variation: z.number().optional().default(0).describe("Specific variation to focus on (0-based, optional)"),
  },
  async ({ letter, variation = 0 }) => {
    const allPictographs = ensureDataLoaded();

    // Find all variations of this letter
    const variations = allPictographs.filter((p) => p.letter === letter);

    if (variations.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Letter "${letter}" not found in the TKA alphabet. Use list_available_letters to see all valid letters.`,
          },
        ],
        isError: true,
      };
    }

    // Get the letter's type
    const typeInfo = LETTER_TO_TYPE[letter];
    const typeNum = typeInfo?.type.replace("type", "") || "unknown";
    const fullTypeInfo = letterTypes[typeNum];

    // Get specific variation data
    const varData = variations[Math.min(variation, variations.length - 1)];

    // Build comprehensive explanation
    const explanation = `# Letter: ${letter}

## Type Information
**Type ${typeNum}: ${fullTypeInfo?.name || typeInfo?.name || "Unknown"}**

${fullTypeInfo?.description || ""}

${fullTypeInfo?.characteristics ? "**Characteristics:**\n" + fullTypeInfo.characteristics.map(c => `- ${c}`).join("\n") : ""}

## Motion Pattern
- **Blue hand:** ${varData.blueMotion.motionType}${varData.blueMotion.rotationDirection !== "noRotation" ? ` (${varData.blueMotion.rotationDirection})` : ""}
- **Red hand:** ${varData.redMotion.motionType}${varData.redMotion.rotationDirection !== "noRotation" ? ` (${varData.redMotion.rotationDirection})` : ""}

## Variation ${variation} Details
- **Start position:** ${varData.startPosition}
- **End position:** ${varData.endPosition}
- **Blue motion:** ${varData.blueMotion.startLocation} → ${varData.blueMotion.endLocation}
- **Red motion:** ${varData.redMotion.startLocation} → ${varData.redMotion.endLocation}

## All Variations (${variations.length} total)
${variations.slice(0, 5).map((v, i) => `[${i}] ${v.startPosition} → ${v.endPosition}`).join("\n")}${variations.length > 5 ? `\n... and ${variations.length - 5} more` : ""}

## Related Letters
Other Type ${typeNum} letters: ${fullTypeInfo?.letters?.filter(l => l !== letter).slice(0, 5).join(", ") || "N/A"}`;

    return {
      content: [{ type: "text" as const, text: explanation }],
    };
  }
);

// Tool: get_term_definition
server.tool(
  "get_term_definition",
  "Get the definition of a TKA domain term like alpha, pro, shift, static, etc. Returns definition, examples, and related terms.",
  {
    term: z.string().describe("The term to define (e.g., alpha, pro, shift, dash, static, beta, gamma)"),
  },
  async ({ term }) => {
    const normalizedTerm = term.toLowerCase().trim();
    const entry = glossary[normalizedTerm];

    if (!entry) {
      // Try to find partial matches
      const possibleMatches = Object.keys(glossary)
        .filter(key => key.includes(normalizedTerm) || normalizedTerm.includes(key))
        .slice(0, 5);

      return {
        content: [
          {
            type: "text" as const,
            text: `Term "${term}" not found in the TKA glossary.${
              possibleMatches.length > 0
                ? `\n\nDid you mean: ${possibleMatches.join(", ")}?`
                : "\n\nAvailable terms include: " + Object.keys(glossary).slice(0, 10).join(", ") + "..."
            }`,
          },
        ],
      };
    }

    const output = `# ${term.charAt(0).toUpperCase() + term.slice(1)}

**Definition:** ${entry.definition}

**Examples:**
${entry.examples.map(e => `- ${e}`).join("\n")}

**Related terms:** ${entry.relatedTerms.join(", ")}

**Category:** ${entry.category}`;

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Tool: compare_letters
server.tool(
  "compare_letters",
  "Compare two TKA letters side by side, explaining their differences in type, motion patterns, and characteristics.",
  {
    letter1: z.string().describe("First letter to compare"),
    letter2: z.string().describe("Second letter to compare"),
  },
  async ({ letter1, letter2 }) => {
    const allPictographs = ensureDataLoaded();

    const var1 = allPictographs.filter((p) => p.letter === letter1);
    const var2 = allPictographs.filter((p) => p.letter === letter2);

    if (var1.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Letter "${letter1}" not found.` }],
        isError: true,
      };
    }
    if (var2.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Letter "${letter2}" not found.` }],
        isError: true,
      };
    }

    const type1 = LETTER_TO_TYPE[letter1];
    const type2 = LETTER_TO_TYPE[letter2];
    const typeNum1 = type1?.type.replace("type", "") || "?";
    const typeNum2 = type2?.type.replace("type", "") || "?";

    // Get representative variations
    const rep1 = var1[0];
    const rep2 = var2[0];

    // Find similarities and differences
    const similarities: string[] = [];
    const differences: string[] = [];

    // Type comparison
    if (typeNum1 === typeNum2) {
      similarities.push(`Both are Type ${typeNum1} (${letterTypes[typeNum1]?.name || type1?.name})`);
    } else {
      differences.push(`Different types: ${letter1} is Type ${typeNum1} (${letterTypes[typeNum1]?.name}), ${letter2} is Type ${typeNum2} (${letterTypes[typeNum2]?.name})`);
    }

    // Motion type comparison
    if (rep1.blueMotion.motionType === rep2.blueMotion.motionType) {
      similarities.push(`Both have ${rep1.blueMotion.motionType} blue motion`);
    } else {
      differences.push(`Blue motion differs: ${letter1} uses ${rep1.blueMotion.motionType}, ${letter2} uses ${rep2.blueMotion.motionType}`);
    }

    if (rep1.redMotion.motionType === rep2.redMotion.motionType) {
      similarities.push(`Both have ${rep1.redMotion.motionType} red motion`);
    } else {
      differences.push(`Red motion differs: ${letter1} uses ${rep1.redMotion.motionType}, ${letter2} uses ${rep2.redMotion.motionType}`);
    }

    // Variation count comparison
    if (Math.abs(var1.length - var2.length) <= 2) {
      similarities.push(`Similar variation count: ${letter1} has ${var1.length}, ${letter2} has ${var2.length}`);
    } else {
      differences.push(`Different variation counts: ${letter1} has ${var1.length}, ${letter2} has ${var2.length}`);
    }

    const output = `# Comparison: ${letter1} vs ${letter2}

## At a Glance
| Property | ${letter1} | ${letter2} |
|----------|------------|------------|
| Type | ${typeNum1} (${letterTypes[typeNum1]?.name || "?"}) | ${typeNum2} (${letterTypes[typeNum2]?.name || "?"}) |
| Blue motion | ${rep1.blueMotion.motionType} | ${rep2.blueMotion.motionType} |
| Red motion | ${rep1.redMotion.motionType} | ${rep2.redMotion.motionType} |
| Variations | ${var1.length} | ${var2.length} |

## Similarities
${similarities.length > 0 ? similarities.map(s => `- ${s}`).join("\n") : "- No major similarities"}

## Differences
${differences.length > 0 ? differences.map(d => `- ${d}`).join("\n") : "- No major differences"}

## When to Use Each
- **${letter1}:** ${letterTypes[typeNum1]?.description || "Type " + typeNum1 + " letter"}
- **${letter2}:** ${letterTypes[typeNum2]?.description || "Type " + typeNum2 + " letter"}`;

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Tool: list_letters_by_type
server.tool(
  "list_letters_by_type",
  "List all letters of a specific type (1-6) with descriptions and motion patterns.",
  {
    type: z.number().min(1).max(6).describe("Letter type (1-6): 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static"),
  },
  async ({ type }) => {
    const typeKey = type.toString();
    const typeInfo = letterTypes[typeKey];

    if (!typeInfo) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Invalid type number. Valid types are 1-6:\n1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static`,
          },
        ],
        isError: true,
      };
    }

    const allPictographs = ensureDataLoaded();

    // Get variation counts for each letter
    const letterCounts = typeInfo.letters.map(letter => {
      const count = allPictographs.filter(p => p.letter === letter).length;
      return { letter, count };
    });

    const output = `# Type ${type}: ${typeInfo.name}

**Description:** ${typeInfo.description}

**Motion Pattern:**
- Blue hand: ${typeInfo.motionPattern.blueMotion}
- Red hand: ${typeInfo.motionPattern.redMotion}
${typeInfo.motionPattern.note ? `- Note: ${typeInfo.motionPattern.note}` : ""}

**Characteristics:**
${typeInfo.characteristics.map(c => `- ${c}`).join("\n")}

**Letters (${typeInfo.letters.length} total):**
${letterCounts.map(({ letter, count }) => `- **${letter}** (${count} variations)`).join("\n")}`;

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Tool: get_position_info
server.tool(
  "get_position_info",
  "Get detailed information about a TKA position (alpha, beta, gamma, zeta, eta) including grid configuration and examples.",
  {
    position: z.string().describe("Position name (alpha, beta, gamma, zeta, eta)"),
  },
  async ({ position }) => {
    const normalizedPos = position.toLowerCase().trim();

    // Position definitions
    const positions: Record<string, {
      name: string;
      angleDegrees: string;
      description: string;
      gridDescription: string;
      examples: string[];
      level: number;
    }> = {
      alpha: {
        name: "Alpha (α)",
        angleDegrees: "180°",
        description: "Hands are at opposite grid points, forming a straight line through the center.",
        gridDescription: "Examples: N/S, E/W, NE/SW, NW/SE. The hands are as far apart as possible.",
        examples: [
          "alpha1: Hands at N and S (diamond mode, vertical axis)",
          "alpha3: Hands at E and W (diamond mode, horizontal axis)",
          "alpha5: Hands at NE and SW (box mode, diagonal)",
        ],
        level: 1,
      },
      beta: {
        name: "Beta (β)",
        angleDegrees: "0°",
        description: "Both hands are at the same grid point, stacked on top of each other.",
        gridDescription: "Both props share a single location. This is the 'together' position.",
        examples: [
          "beta1: Both hands at N (diamond mode)",
          "beta5: Both hands at NE (box mode)",
          "beta3: Both hands at E (diamond mode)",
        ],
        level: 1,
      },
      gamma: {
        name: "Gamma (γ)",
        angleDegrees: "90°",
        description: "Hands form a right angle, positioned on adjacent grid points.",
        gridDescription: "One hand is 90° away from the other, creating an 'L' shape.",
        examples: [
          "gamma1: Hands at N and E (diamond mode)",
          "gamma5: Hands at N and NW (diamond-to-box transition)",
          "gamma9: Hands at NE and SE (box mode)",
        ],
        level: 1,
      },
      zeta: {
        name: "Zeta (ζ)",
        angleDegrees: "~135°",
        description: "Hands form an obtuse angle. Introduced in Level 4 with skewed grid mode.",
        gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle greater than 90°.",
        examples: [
          "Hands at N and SE (skewed mode, ~135°)",
          "Hands at E and NW (skewed mode)",
        ],
        level: 4,
      },
      eta: {
        name: "Eta (η)",
        angleDegrees: "~45°",
        description: "Hands form an acute angle. Introduced in Level 4 with skewed grid mode.",
        gridDescription: "One hand is on a cardinal point, the other on an intercardinal point, forming an angle less than 90°.",
        examples: [
          "Hands at N and NE (skewed mode, ~45°)",
          "Hands at E and SE (skewed mode)",
        ],
        level: 4,
      },
    };

    const posInfo = positions[normalizedPos];

    if (!posInfo) {
      const availablePositions = Object.keys(positions).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Position "${position}" not recognized. Available positions: ${availablePositions}`,
          },
        ],
      };
    }

    // Count how many pictographs use this position
    const allPictographs = ensureDataLoaded();
    const startCount = allPictographs.filter(p =>
      p.startPosition.toLowerCase().startsWith(normalizedPos)
    ).length;
    const endCount = allPictographs.filter(p =>
      p.endPosition.toLowerCase().startsWith(normalizedPos)
    ).length;

    const output = `# ${posInfo.name}

**Angle:** ${posInfo.angleDegrees} between hands

**Description:** ${posInfo.description}

**Grid Configuration:** ${posInfo.gridDescription}

**Examples:**
${posInfo.examples.map(e => `- ${e}`).join("\n")}

**Introduced:** Level ${posInfo.level}

**Usage in Pictographs:**
- Used as starting position: ${startCount} pictographs
- Used as ending position: ${endCount} pictographs

**Related:** ${Object.keys(positions).filter(p => p !== normalizedPos).join(", ")}`;

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ============================================================================
// SEQUENCE GENERATION TOOLS
// ============================================================================

// Tool: parse_constraints (debug/preview tool)
server.tool(
  "parse_constraints",
  "Parse a natural language constraint string without generating a sequence. Useful for understanding how constraints will be interpreted.",
  {
    constraints: z.string().describe('Natural language constraints to parse, e.g., "maximize flow with blue clockwise"'),
  },
  async ({ constraints }) => {
    const result = parseConstraints(constraints);

    const output = {
      recognized: result.constraints.map(c => ({
        type: c.type,
        mode: c.mode,
        description: c.description,
      })),
      unrecognized: result.unrecognized,
      confidence: Math.round(result.confidence * 100) / 100,
      normalized: result.normalized,
      warnings: result.warnings,
    };

    // Also list available presets
    const presets = listPresets();

    return {
      content: [
        {
          type: "text" as const,
          text: `## Parsed Constraints\n\n${JSON.stringify(output, null, 2)}\n\n## Available Presets\n\n${presets.map(p => `- **${p.name}**: ${p.description}`).join("\n")}`,
        },
      ],
    };
  }
);

// Tool: analyze_word_feasibility
server.tool(
  "analyze_word_feasibility",
  "Analyze whether specific constraints are achievable for a word BEFORE attempting generation. Returns detailed feasibility report including which transitions block certain constraints and suggests alternatives.",
  {
    word: z.string().describe('The word to analyze, e.g., "DICKWIPE" or "ABC"'),
    gridMode: z.enum(["diamond", "box", "skewed"]).optional().default("diamond").describe("Grid mode to analyze"),
  },
  async ({ word, gridMode = "diamond" }) => {
    const allPictographs = ensureDataLoaded(gridMode);
    const letters = parseWordToLetters(word.toUpperCase());

    if (letters.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `Cannot analyze: no valid letters in "${word}"` },
        ],
        isError: true,
      };
    }

    if (letters.length < 2) {
      return {
        content: [
          { type: "text" as const, text: `Single-letter words have no transitions to analyze. All constraints are trivially satisfiable.` },
        ],
      };
    }

    // Get or build the transition matrix
    const matrix = getTransitionMatrix(allPictographs, gridMode);

    // Analyze the word
    const feasibility = analyzeWordFeasibility(word, letters, matrix);

    // Build response
    const sections: string[] = [];

    sections.push(`## Word Feasibility Analysis: "${word}"\n`);
    sections.push(`Letters: ${letters.join(" → ")}`);
    sections.push(`Total transitions: ${letters.length - 1}\n`);

    // Constraint feasibility summary
    sections.push(`### Constraint Feasibility\n`);
    sections.push(`| Constraint | Achievable | Details |`);
    sections.push(`|------------|------------|---------|`);

    // No hand reversals
    const noHandStatus = feasibility.canAvoidAllHandReversals ? "✅ Yes" : "❌ No";
    const noHandDetails = feasibility.canAvoidAllHandReversals
      ? "All transitions can maintain continuous hand paths"
      : `${feasibility.handReversalBlockers.length} blocking transition(s)`;
    sections.push(`| No hand reversals | ${noHandStatus} | ${noHandDetails} |`);

    // No prop reversals
    const noPropStatus = feasibility.canAvoidAllPropReversals ? "✅ Yes" : "❌ No";
    const noPropDetails = feasibility.canAvoidAllPropReversals
      ? "All transitions can maintain consistent prop spin"
      : `${feasibility.propReversalBlockers.length} blocking transition(s)`;
    sections.push(`| No prop reversals | ${noPropStatus} | ${noPropDetails} |`);

    // Hand reversal every beat
    const everyHandStatus = feasibility.canHaveHandReversalEveryBeat ? "✅ Yes" : "❌ No";
    const everyHandDetails = feasibility.canHaveHandReversalEveryBeat
      ? "All transitions can produce a hand reversal"
      : `${feasibility.noHandReversalPossible.length} transition(s) are always continuous`;
    sections.push(`| Hand reversal every beat | ${everyHandStatus} | ${everyHandDetails} |`);

    // Reversal range
    sections.push(`\n### Reversal Range\n`);
    sections.push(`- **Hand reversals:** ${feasibility.minHandReversals} (minimum) to ${feasibility.maxHandReversals} (maximum) out of ${letters.length - 1} transitions`);
    sections.push(`- **Prop reversals:** ${feasibility.minPropReversals} (minimum) to ${feasibility.maxPropReversals} (maximum) out of ${letters.length - 1} transitions`);

    // Blocking transitions
    if (feasibility.handReversalBlockers.length > 0) {
      sections.push(`\n### Transitions That ALWAYS Require Hand Reversal\n`);
      sections.push(feasibility.handReversalBlockers.map(t => `- ${t}`).join("\n"));
      const explanation = explainConstraintImpossibility(feasibility, "no-hand-reversals");
      if (explanation) {
        sections.push(`\n*${explanation}*`);
      }
    }

    if (feasibility.propReversalBlockers.length > 0) {
      sections.push(`\n### Transitions That ALWAYS Require Prop Reversal\n`);
      sections.push(feasibility.propReversalBlockers.map(t => `- ${t}`).join("\n"));
    }

    if (feasibility.noHandReversalPossible.length > 0 && !feasibility.canHaveHandReversalEveryBeat) {
      sections.push(`\n### Transitions That Can NEVER Produce Hand Reversal\n`);
      sections.push(feasibility.noHandReversalPossible.map(t => `- ${t}`).join("\n"));
      const explanation = explainConstraintImpossibility(feasibility, "hand-reversal-every-beat");
      if (explanation) {
        sections.push(`\n*${explanation}*`);
      }
    }

    // Suggestions
    const suggestions = suggestAlternatives(feasibility);
    if (suggestions.length > 0) {
      sections.push(`\n### Suggestions\n`);
      sections.push(suggestions.map(s => `💡 ${s}`).join("\n\n"));
    }

    // Recommended presets
    sections.push(`\n### Recommended Presets for This Word\n`);
    if (feasibility.canAvoidAllHandReversals && feasibility.canAvoidAllPropReversals) {
      sections.push(`- **smooth** - Maximize overall flow (both hand and prop continuity achievable)`);
    } else if (feasibility.canAvoidAllHandReversals) {
      sections.push(`- **smooth-hands** - Maximize hand path continuity (achievable for this word)`);
    } else if (feasibility.canAvoidAllPropReversals) {
      sections.push(`- **smooth-props** - Maximize prop spin continuity (achievable for this word)`);
    } else {
      sections.push(`- **smooth** - Will minimize reversals even though zero isn't achievable`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: sections.join("\n"),
        },
      ],
    };
  }
);

// Tool: generate_sequence_data
server.tool(
  "generate_sequence_data",
  "Generate a valid TKA sequence from a word (letters). Supports natural language constraints like 'maximize continuity' or 'all pro motions'. Returns sequence data with constraint satisfaction report.",
  {
    word: z.string().describe('The sequence word, e.g., "ABC" or "DEFGH"'),
    gridMode: z.enum(["diamond", "box", "skewed"]).optional().default("diamond").describe("Grid mode: diamond (default), box, or skewed"),
    maxAttempts: z.number().optional().default(100).describe("Maximum generation attempts"),
    bridgeSelections: z.record(z.string(), z.number()).optional().describe('Map of bridge transition index to preferred bridge option index. E.g., {"0": 1} uses the 2nd bridge option for the first bridge needed.'),
    // NEW: Constraint options
    constraints: z.string().optional().describe('Natural language constraints, e.g., "maximize continuity, all pro motions", "smooth flow with blue clockwise"'),
    constraintPreset: z.enum(["smooth", "smooth-hands", "smooth-props", "reversal", "isolation", "antispin", "pro-cw", "anti-ccw", "no-dash", "maximize-dash", "maximum-chaos"]).optional().describe('Predefined constraint preset: smooth (maximize continuity), reversal (break every beat), isolation (all pro), antispin (all anti), pro-cw, anti-ccw, no-dash, maximize-dash (prefer Type 4/5 letters), maximum-chaos, smooth-hands (hand path continuity), smooth-props (prop spin continuity)'),
  },
  async ({ word, gridMode = "diamond", maxAttempts = 100, bridgeSelections, constraints, constraintPreset }) => {
    const allPictographs = ensureDataLoaded(gridMode);

    // Parse word to individual letters
    const letters = parseWordToLetters(word.toUpperCase());

    if (letters.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `Cannot generate sequence: no valid letters in "${word}"` },
        ],
        isError: true,
      };
    }

    // Determine which constraint set to use
    let constraintSet = emptyConstraintSet();
    let parseResult: ReturnType<typeof parseConstraints> | undefined;

    if (constraintPreset) {
      // Use preset
      const presetConstraints = getPresetConstraintSet(constraintPreset as PresetName);
      if (presetConstraints) {
        constraintSet = presetConstraints;
      }
    } else if (constraints) {
      // Parse natural language constraints
      const parsed = parseConstraintSet(constraints);
      constraintSet = parsed.constraintSet;
      parseResult = parsed.parseResult;
    }

    // Check if we should use constrained or legacy builder
    const useConstrainedBuilder = constraintSet.hard.length > 0 || constraintSet.soft.length > 0;

    if (useConstrainedBuilder) {
      // Run feasibility analysis to generate warnings
      let feasibilityWarnings: string[] = [];
      if (letters.length >= 2) {
        const matrix = getTransitionMatrix(allPictographs, gridMode);
        const feasibility = analyzeWordFeasibility(word, letters, matrix);

        // Check if user requested constraints that can't be fully satisfied
        const hasReversalConstraint = constraintSet.soft.some(c => c.type === "reversal");
        const hasHandPathEveryConstraint = constraintSet.soft.some(
          c => c.type === "handPath" && c.description.includes("every")
        );
        const hasContinuityConstraint = constraintSet.soft.some(c => c.type === "continuity");
        const hasHandPathContinuityConstraint = constraintSet.soft.some(
          c => c.type === "handPath" && c.description.includes("continuous")
        );

        // Warning for reversal preset if prop reversal every beat is impossible
        if (hasReversalConstraint && !feasibility.canHavePropReversalEveryBeat) {
          feasibilityWarnings.push(
            `Prop reversal every beat is not achievable for "${word}". ` +
            `Maximum: ${feasibility.maxPropReversals}/${letters.length - 1} transitions.`
          );
        }

        // Warning for hand path reversal every beat
        if (hasHandPathEveryConstraint && !feasibility.canHaveHandReversalEveryBeat) {
          feasibilityWarnings.push(
            `Hand path reversal every beat is not achievable for "${word}". ` +
            `Maximum: ${feasibility.maxHandReversals}/${letters.length - 1} transitions.`
          );
        }

        // Warning for smooth if no prop reversals is impossible
        if (hasContinuityConstraint && !feasibility.canAvoidAllPropReversals) {
          feasibilityWarnings.push(
            `Zero prop reversals is not achievable for "${word}". ` +
            `Minimum: ${feasibility.minPropReversals} unavoidable reversal(s).`
          );
        }

        // Warning for smooth-hands if no hand reversals is impossible
        if (hasHandPathContinuityConstraint && !feasibility.canAvoidAllHandReversals) {
          feasibilityWarnings.push(
            `Zero hand path reversals is not achievable for "${word}". ` +
            `Minimum: ${feasibility.minHandReversals} unavoidable reversal(s).`
          );
        }
      }

      // Use the new constrained builder with beam search
      const result = buildConstrainedSequence({
        letters,
        allPictographs,
        constraintSet,
        beamConfig: {
          maxBacktracks: maxAttempts,
        },
      });

      if (!result.success && !result.steps.length) {
        return {
          content: [
            { type: "text" as const, text: `Failed to generate constrained sequence for "${word}": ${result.error}` },
          ],
          isError: true,
        };
      }

      // Build response with constraint report
      const response: Record<string, unknown> = {
        word: result.word,
        steps: result.steps.map((step, i) => ({
          ...step,
          variation: result.variationIndices[i] ?? 0,
          stepNumber: i,
        })),
        startPosition: result.startPosition,
        endPosition: result.endPosition,
        stepCount: result.steps.length - 1,
        constraintReport: {
          score: result.constraintReport.score,
          satisfied: result.constraintReport.satisfied,
          details: result.constraintReport.details.map(d => ({
            constraint: d.constraint,
            score: d.score,
            description: d.description,
            mode: d.mode,
          })),
        },
      };

      // Include parse info if constraints were parsed from text
      if (parseResult) {
        (response.constraintReport as Record<string, unknown>).parseConfidence = parseResult.confidence;
        if (parseResult.unrecognized.length > 0) {
          (response.constraintReport as Record<string, unknown>).unrecognized = parseResult.unrecognized;
        }
        if (parseResult.warnings.length > 0) {
          (response.constraintReport as Record<string, unknown>).warnings = parseResult.warnings;
        }
      }

      // Include feasibility warnings if constraints can't be fully satisfied
      if (feasibilityWarnings.length > 0) {
        (response.constraintReport as Record<string, unknown>).feasibilityWarnings = feasibilityWarnings;
      }

      // Include bridge information if bridges were used
      if (result.bridges && result.bridges.length > 0) {
        response.bridges = result.bridges.map(b => ({
          transitionIndex: b.transitionIndex,
          fromLetter: b.fromLetter,
          toLetter: b.toLetter,
          availableOptions: b.availableOptions,
          selectedBridge: b.selectedBridge,
          selectedIndex: b.selectedIndex,
          constraintScored: b.constraintScored,
        }));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }

    // Fall back to legacy builder for unconstrained generation
    const parsedBridgeSelections: BridgeSelections | undefined = bridgeSelections
      ? Object.fromEntries(
          Object.entries(bridgeSelections).map(([k, v]) => [parseInt(k, 10), v])
        )
      : undefined;

    const result = buildSequenceFromLetters(letters, allPictographs, maxAttempts, parsedBridgeSelections);

    if (!result.isValid) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate sequence for "${word}": ${result.error}` },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            word: result.word,
            steps: result.steps,
            startPosition: result.startPosition,
            endPosition: result.endPosition,
            stepCount: result.steps.length - 1,
            bridges: result.bridges,
          }, null, 2),
        },
      ],
    };
  }
);

// Tool: generate_sequence_image
server.tool(
  "generate_sequence_image",
  "Generate a composite image showing all beats of a sequence (word card). Returns base64-encoded PNG.",
  {
    word: z.string().describe('The sequence word, e.g., "ABC"'),
    gridMode: z.enum(["diamond", "box", "skewed"]).optional().default("diamond").describe("Grid mode: diamond (default), box, or skewed"),
    layout: z.enum(["grid", "strip"]).optional().default("grid").describe("Layout: grid (square) or strip (single row)"),
    cellSize: z.number().optional().default(150).describe("Size of each pictograph cell in pixels"),
    showStepNumbers: z.boolean().optional().default(true).describe("Show beat numbers overlaid on each pictograph"),
    showWord: z.boolean().optional().default(true).describe("Show word header at the top"),
    darkMode: z.boolean().optional().default(true).describe("Use dark background"),
    maxAttempts: z.number().optional().default(100).describe("Maximum generation attempts"),
    // New visual parity options
    showDifficulty: z.boolean().optional().default(true).describe("Show difficulty level badge in header"),
    userName: z.string().optional().describe("Username to show in footer (bottom-left)"),
    notes: z.string().optional().describe("Notes to show in footer (bottom-center)"),
    birthday: z.string().optional().describe("Birthday/creation date in ISO format (bottom-right), e.g., '2024-01-15'"),
    bridgeSelections: z.record(z.string(), z.number()).optional().describe('Map of bridge transition index to preferred bridge option index. E.g., {"0": 1} uses the 2nd bridge option for the first bridge needed.'),
    level: z.number().min(1).max(3).optional().default(1).describe("Difficulty level: 1=beginner (0 turns only), 2=intermediate (0-3 whole turns), 3=advanced (0-3 plus halves and float)"),
    turnIntensity: z.number().min(0).max(3).optional().describe("Maximum turn intensity (0-3). Each motion gets a random turn value from 0 up to this max. Defaults to 0 for level 1, 3 for level 2-3."),
    loopComponents: z.array(z.enum(["rotated", "mirrored", "swapped", "inverted"])).optional().describe("LOOP components for the pie chart glyph in top-right corner. E.g., ['rotated', 'mirrored'] shows those two quadrants filled."),
    // Constraint options (same as generate_sequence_data)
    constraints: z.string().optional().describe('Natural language constraints, e.g., "maximize continuity, all pro motions", "smooth flow with blue clockwise"'),
    constraintPreset: z.enum(["smooth", "smooth-hands", "smooth-props", "reversal", "isolation", "antispin", "pro-cw", "anti-ccw", "no-dash", "maximize-dash", "maximum-chaos"]).optional().describe('Predefined constraint preset: smooth (maximize continuity), reversal (break every beat), isolation (all pro), antispin (all anti), pro-cw, anti-ccw, no-dash, maximize-dash (prefer Type 4/5 letters), maximum-chaos, smooth-hands (hand path continuity), smooth-props (prop spin continuity)'),
  },
  async ({ word, gridMode = "diamond", layout = "grid", cellSize = 150, showStepNumbers = true, showWord = true, darkMode = true, maxAttempts = 100, showDifficulty = true, userName, notes, birthday, bridgeSelections, level = 1, turnIntensity, loopComponents, constraints, constraintPreset }) => {
    const allPictographs = ensureDataLoaded(gridMode);

    // Parse word to individual letters
    const letters = parseWordToLetters(word.toUpperCase());

    if (letters.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `Cannot generate sequence image: no valid letters in "${word}"` },
        ],
        isError: true,
      };
    }

    // Convert string keys to numbers for bridgeSelections
    const parsedBridgeSelections: BridgeSelections | undefined = bridgeSelections
      ? Object.fromEntries(
          Object.entries(bridgeSelections).map(([k, v]) => [parseInt(k, 10), v])
        )
      : undefined;

    // Determine which constraint set to use
    let constraintSet = emptyConstraintSet();

    if (constraintPreset) {
      // Use preset
      const presetConstraints = getPresetConstraintSet(constraintPreset as PresetName);
      if (presetConstraints) {
        constraintSet = presetConstraints;
      }
    } else if (constraints) {
      // Parse natural language constraints
      const parsed = parseConstraintSet(constraints);
      constraintSet = parsed.constraintSet;
    }

    // Check if we should use constrained or legacy builder
    const useConstrainedBuilder = constraintSet.hard.length > 0 || constraintSet.soft.length > 0;

    let result: SequenceResult;

    if (useConstrainedBuilder) {
      // Use the constrained builder with beam search
      const constrainedResult = buildConstrainedSequence({
        letters,
        allPictographs,
        constraintSet,
        beamConfig: {
          maxBacktracks: maxAttempts,
        },
      });

      if (!constrainedResult.success && !constrainedResult.steps.length) {
        return {
          content: [
            { type: "text" as const, text: `Failed to generate constrained sequence for "${word}": ${constrainedResult.error}` },
          ],
          isError: true,
        };
      }

      // Convert constrained result to SequenceResult format
      result = {
        word: constrainedResult.word,
        steps: constrainedResult.steps.map((step, i) => ({
          letter: step.letter,
          variation: constrainedResult.variationIndices[i] ?? 0,
          startPosition: step.startPosition,
          endPosition: step.endPosition,
          blueMotion: step.blueMotion,
          redMotion: step.redMotion,
          stepNumber: i,
          isBridge: constrainedResult.bridges?.some(b => b.selectedBridge === step.letter && i > 0) ?? false,
        })),
        startPosition: constrainedResult.startPosition,
        endPosition: constrainedResult.endPosition,
        isValid: true,
        bridges: constrainedResult.bridges?.map(b => ({
          transitionIndex: b.transitionIndex,
          fromLetter: b.fromLetter,
          toLetter: b.toLetter,
          availableOptions: b.availableOptions,
          selectedBridge: b.selectedBridge,
          selectedIndex: b.selectedIndex,
        })),
      };
    } else {
      // Fall back to legacy builder for unconstrained generation
      result = buildSequenceFromLetters(letters, allPictographs, maxAttempts, parsedBridgeSelections);
    }

    if (!result.isValid) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate sequence for "${word}": ${result.error}` },
        ],
        isError: true,
      };
    }

    try {
      // Parse birthday string to Date if provided
      const birthdayDate = birthday ? new Date(birthday) : undefined;

      // Allocate turns for each step (excluding start position)
      // Each motion gets a random turn value based on level and max intensity
      const stepCount = result.steps.length - 1; // Exclude start position (step 0)
      const turnAllocation = allocateTurns(stepCount, level, turnIntensity);

      // Convert loopComponents strings to enum values
      const parsedLoopComponents = loopComponents?.map(c => {
        switch (c) {
          case "rotated": return LOOPComponent.ROTATED;
          case "mirrored": return LOOPComponent.MIRRORED;
          case "swapped": return LOOPComponent.SWAPPED;
          case "inverted": return LOOPComponent.INVERTED;
          default: return LOOPComponent.ROTATED; // Fallback
        }
      });

      // Render composite image with visual parity features
      const pngBuffer = await renderSequenceToImage(result.steps, result.word, {
        layout,
        cellSize,
        showStepNumbers,
        showWord,
        darkMode,
        padding: 8,
        // Visual parity options
        showDifficulty,
        userName,
        notes,
        birthday: birthdayDate,
        // Difficulty level and turn allocations
        level,
        turnAllocation,
        // LOOP glyph
        loopComponents: parsedLoopComponents,
      });

      // AUTO-OPEN: Save to temp and open immediately with system viewer
      const tempPath = saveAndOpenImage(pngBuffer, `seq-${word}`);

      // Convert to base64
      const base64 = pngBuffer.toString("base64");

      return {
        content: [
          {
            type: "text" as const,
            text: `## Sequence: ${word}\n\n${result.steps.length - 1} beats, ${layout} layout, ${cellSize}px cells`,
          },
          {
            type: "image" as const,
            data: base64,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          { type: "text" as const, text: `Failed to render sequence image: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// LOOP (CIRCULAR SEQUENCE) TOOLS
// ============================================================================

import {
  LOOPType,
  SliceSize,
  LOOP_TYPE_LABELS,
  LOOP_TYPE_DESCRIPTIONS,
  SUPPORTED_LOOP_TYPES,
  getLOOPOptionsForPositionPair,
  executeLOOP,
} from "./src/core/loop/index.js";

// Tool: validate_loop_options
server.tool(
  "validate_loop_options",
  "Given a sequence's start/end positions, return which LOOP types are valid. LOOPs are circular sequence patterns that transform the first half/quarter of a sequence to create a complete circular motion.",
  {
    startPosition: z.string().describe("Start position of the sequence (e.g., alpha1, beta3, gamma5)"),
    endPosition: z.string().describe("End position of the sequence (e.g., alpha5, beta7, gamma13)"),
    sliceSize: z.enum(["halved", "quartered"]).optional().default("halved").describe('Slice size: "halved" for 180° rotation (default), "quartered" for 90° rotation'),
  },
  async ({ startPosition, endPosition, sliceSize = "halved" }) => {
    const slice = sliceSize === "quartered" ? SliceSize.QUARTERED : SliceSize.HALVED;
    const result = getLOOPOptionsForPositionPair(startPosition, endPosition, slice);

    const output = {
      startPosition,
      endPosition,
      sliceSize,
      available: result.available.map((opt) => ({
        loopType: opt.loopType,
        name: opt.name,
        description: opt.description,
      })),
      unavailable: result.unavailable.map((opt) => ({
        loopType: opt.loopType,
        name: opt.name,
        reason: opt.reason || "Position pair not valid for this LOOP type",
      })),
      supportedTypes: SUPPORTED_LOOP_TYPES.map((t) => ({
        loopType: t,
        name: LOOP_TYPE_LABELS[t],
      })),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  }
);

// Tool: generate_loop_sequence
server.tool(
  "generate_loop_sequence",
  "Generate a complete LOOP sequence from a word + LOOP type. Returns the circular sequence with all transformed steps. Currently supports REWOUND and STRICT_ROTATED.",
  {
    word: z.string().describe('The sequence word, e.g., "CAKE"'),
    loopType: z.enum(["rewound", "strict_rotated"]).describe('LOOP type to apply: "rewound" (reverses and appends) or "strict_rotated" (180°/90° rotation)'),
    sliceSize: z.enum(["halved", "quartered"]).optional().default("halved").describe('Slice size: "halved" for 180° rotation (default), "quartered" for 90° rotation'),
    gridMode: z.enum(["diamond", "box", "skewed"]).optional().default("diamond").describe("Grid mode: diamond (default), box, or skewed"),
    maxAttempts: z.number().optional().default(100).describe("Maximum generation attempts"),
  },
  async ({ word, loopType, sliceSize = "halved", gridMode = "diamond", maxAttempts = 100 }) => {
    const allPictographs = ensureDataLoaded(gridMode);

    // Parse word to individual letters
    const letters = parseWordToLetters(word.toUpperCase());

    if (letters.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `Cannot generate sequence: no valid letters in "${word}"` },
        ],
        isError: true,
      };
    }

    // Build the base sequence first
    const baseResult = buildSequenceFromLetters(letters, allPictographs, maxAttempts);

    if (!baseResult.isValid) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate base sequence for "${word}": ${baseResult.error}` },
        ],
        isError: true,
      };
    }

    // Determine LOOP type enum
    const loopTypeEnum = loopType === "rewound" ? LOOPType.REWOUND : LOOPType.STRICT_ROTATED;
    const slice = sliceSize === "quartered" ? SliceSize.QUARTERED : SliceSize.HALVED;

    // Execute the LOOP transformation (pass pictograph data for letter derivation)
    const loopResult = executeLOOP(baseResult.steps, baseResult.word, loopTypeEnum, slice, allPictographs);

    if (!loopResult.success) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate LOOP sequence: ${loopResult.error}` },
        ],
        isError: true,
      };
    }

    // Format output
    const output = {
      word: loopResult.word,
      loopWord: loopResult.loopWord,
      seedWord: loopResult.seedWord,
      derivedWord: loopResult.derivedWord,
      loopType: loopResult.loopType,
      sliceSize: loopResult.sliceSize,
      isCircular: loopResult.isCircular,
      stepCount: loopResult.steps.length - 1, // Exclude start position
      startPosition: baseResult.startPosition,
      endPosition: loopResult.steps[loopResult.steps.length - 1]?.endPosition || "",
      derivedBeatIndices: loopResult.derivedBeatIndices,
      steps: loopResult.steps.map((step, i) => ({
        stepNumber: i,
        letter: step.letter,
        isDerived: loopResult.derivedBeatIndices.includes(i),
        startPosition: step.startPosition,
        endPosition: step.endPosition,
        blueMotion: {
          startLocation: step.blueMotion.startLocation,
          endLocation: step.blueMotion.endLocation,
          motionType: step.blueMotion.motionType,
          rotationDirection: step.blueMotion.rotationDirection,
        },
        redMotion: {
          startLocation: step.redMotion.startLocation,
          endLocation: step.redMotion.endLocation,
          motionType: step.redMotion.motionType,
          rotationDirection: step.redMotion.rotationDirection,
        },
      })),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  }
);

// Tool: generate_loop_image
server.tool(
  "generate_loop_image",
  "Generate a word card image for a LOOP sequence. Displays the complete circular sequence as a composite image.",
  {
    word: z.string().describe('The sequence word, e.g., "CAKE"'),
    loopType: z.enum(["rewound", "strict_rotated"]).describe('LOOP type to apply'),
    sliceSize: z.enum(["halved", "quartered"]).optional().default("halved").describe('Slice size'),
    gridMode: z.enum(["diamond", "box", "skewed"]).optional().default("diamond").describe("Grid mode"),
    layout: z.enum(["grid", "strip"]).optional().default("grid").describe("Layout: grid (square) or strip (single row)"),
    cellSize: z.number().optional().default(150).describe("Size of each pictograph cell in pixels"),
    showStepNumbers: z.boolean().optional().default(true).describe("Show beat numbers"),
    showWord: z.boolean().optional().default(true).describe("Show word header"),
    darkMode: z.boolean().optional().default(true).describe("Use dark background"),
    maxAttempts: z.number().optional().default(100).describe("Maximum generation attempts"),
    loopComponents: z.array(z.enum(["rotated", "mirrored", "swapped", "inverted"])).optional().describe("LOOP components for the pie chart glyph"),
    level: z.number().min(1).max(3).optional().default(1).describe("Difficulty level"),
    userName: z.string().optional().describe("Username for footer"),
    notes: z.string().optional().describe("Notes for footer"),
    birthday: z.string().optional().describe("Birthday/creation date in ISO format"),
  },
  async ({ word, loopType, sliceSize = "halved", gridMode = "diamond", layout = "grid", cellSize = 150, showStepNumbers = true, showWord = true, darkMode = true, maxAttempts = 100, loopComponents, level = 1, userName, notes, birthday }) => {
    const allPictographs = ensureDataLoaded(gridMode);

    // Parse word to individual letters
    const letters = parseWordToLetters(word.toUpperCase());

    if (letters.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `Cannot generate sequence: no valid letters in "${word}"` },
        ],
        isError: true,
      };
    }

    // Build the base sequence
    const baseResult = buildSequenceFromLetters(letters, allPictographs, maxAttempts);

    if (!baseResult.isValid) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate base sequence for "${word}": ${baseResult.error}` },
        ],
        isError: true,
      };
    }

    // Execute the LOOP transformation (pass pictograph data for letter derivation)
    const loopTypeEnum = loopType === "rewound" ? LOOPType.REWOUND : LOOPType.STRICT_ROTATED;
    const slice = sliceSize === "quartered" ? SliceSize.QUARTERED : SliceSize.HALVED;

    const loopResult = executeLOOP(baseResult.steps, baseResult.word, loopTypeEnum, slice, allPictographs);

    if (!loopResult.success) {
      return {
        content: [
          { type: "text" as const, text: `Failed to generate LOOP sequence: ${loopResult.error}` },
        ],
        isError: true,
      };
    }

    try {
      // Parse birthday string to Date if provided
      const birthdayDate = birthday ? new Date(birthday) : undefined;

      // For rewound LOOP, don't use loopComponents since it's not a spatial transformation
      // loopComponents only apply to spatial transformations (rotated, mirrored, swapped, inverted)
      const parsedLoopComponents = loopType === "rewound" ? undefined : loopComponents?.map((c) => {
        switch (c) {
          case "rotated":
            return LOOPComponent.ROTATED;
          case "mirrored":
            return LOOPComponent.MIRRORED;
          case "swapped":
            return LOOPComponent.SWAPPED;
          case "inverted":
            return LOOPComponent.INVERTED;
          default:
            return LOOPComponent.ROTATED;
        }
      });

      // Allocate turns for each step
      const stepCount = loopResult.steps.length - 1;
      const turnAllocation = allocateTurns(stepCount, level);

      // Render composite image
      const pngBuffer = await renderSequenceToImage(loopResult.steps, loopResult.loopWord, {
        layout,
        cellSize,
        showStepNumbers,
        showWord,
        darkMode,
        padding: 8,
        showDifficulty: true,
        userName,
        notes,
        birthday: birthdayDate,
        level,
        turnAllocation,
        loopComponents: parsedLoopComponents,
      });

      // AUTO-OPEN: Save to temp and open immediately
      const tempPath = saveAndOpenImage(pngBuffer, `loop-${word}`);

      // Convert to base64
      const base64 = pngBuffer.toString("base64");

      return {
        content: [
          {
            type: "text" as const,
            text: `## LOOP Sequence: ${loopResult.loopWord}\n\n**Original word:** ${word}\n**LOOP type:** ${loopType}\n**Slice size:** ${sliceSize}\n**Beats:** ${stepCount}`,
          },
          {
            type: "image" as const,
            data: base64,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          { type: "text" as const, text: `Failed to render LOOP image: ${errorMessage}` },
        ],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  console.error("[MCP] Starting TKA Domain MCP Server v2.0.0...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP] Server connected and ready");
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
