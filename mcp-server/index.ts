/**
 * TKA Pictograph MCP Server
 *
 * Exposes pictograph data as MCP tools that Claude can call.
 *
 * Tools:
 * - list_available_letters: List all TKA letters
 * - list_letter_variations: List variations for a letter
 * - get_pictograph_data: Get detailed motion data
 * - search_pictographs: Search by criteria
 * - generate_pictograph_url: Get URL for browser rendering
 * - generate_pictograph: Generate PNG image directly (no browser needed!)
 * - set_preferences: Set visibility preferences for future pictographs
 * - get_preferences: Get current visibility preferences
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getStandalonePictographRenderer, type RenderVisibilityOptions } from "./StandalonePictographRenderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// CSV loading
const DATAFRAME_PATH = path.resolve(
  __dirname,
  "../static/data/pictographs/DiamondPictographDataframe.csv"
);

let allPictographs: PictographData[] = [];

function loadDataframe(): PictographData[] {
  try {
    const csvContent = fs.readFileSync(DATAFRAME_PATH, "utf-8");
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
        },
        redMotion: {
          color: "red",
          startLocation: row.redStartLocation,
          endLocation: row.redEndLocation,
          motionType: row.redMotionType,
          rotationDirection: row.redRotationDirection,
        },
      });
    }

    return pictographs;
  } catch (error) {
    console.error("[MCP] Failed to load dataframe:", error);
    return [];
  }
}

function ensureDataLoaded() {
  if (allPictographs.length === 0) {
    console.error("[MCP] Loading pictograph dataframe...");
    allPictographs = loadDataframe();
    console.error(`[MCP] Loaded ${allPictographs.length} pictographs`);
  }
}

// Create MCP server
const server = new McpServer({
  name: "tka-pictograph",
  version: "1.0.0",
});

// Tool: list_letter_variations
server.tool(
  "list_letter_variations",
  "List all variations of a TKA letter. Each letter can have multiple variations with different motion combinations.",
  {
    letter: z.string().describe("Letter to list variations for (A-Z, or Greek: α, β, γ, Δ, Θ, Λ, Σ, Φ, Ψ, Ω)"),
  },
  async ({ letter }) => {
    ensureDataLoaded();

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
    ensureDataLoaded();

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
    ensureDataLoaded();

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

// Tool: list_available_letters
server.tool(
  "list_available_letters",
  "List all letters available in the TKA alphabet dataframe",
  {},
  async () => {
    ensureDataLoaded();

    const letters = new Set<string>();
    for (const p of allPictographs) {
      letters.add(p.letter);
    }

    const sorted = Array.from(letters).sort();

    return {
      content: [
        {
          type: "text" as const,
          text: `Available letters (${sorted.length} total):\n\n${sorted.join(", ")}`,
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
    ensureDataLoaded();

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
  },
  async ({ letter, variation = 0, ...overrides }) => {
    ensureDataLoaded();

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
        },
        redMotion: {
          motionType: csvRow.redMotion.motionType,
          rotationDirection: csvRow.redMotion.rotationDirection || "no_rotation",
          startLocation: csvRow.redMotion.startLocation,
          endLocation: csvRow.redMotion.endLocation,
          color: "red",
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
      };

      // Render using standalone Node.js renderer
      const renderer = getStandalonePictographRenderer();
      const base64 = await renderer.renderToBase64(pictographInput, visibility);

      // Build description of what was rendered
      const enabledFeatures = [];
      if (prefs.showTKA) enabledFeatures.push("TKA");
      if (prefs.showVTG) enabledFeatures.push("VTG");
      if (prefs.showPositions) enabledFeatures.push("positions");
      if (prefs.showReversals) enabledFeatures.push("reversals");
      if (prefs.showGrid) enabledFeatures.push("grid");

      return {
        content: [
          {
            type: "text" as const,
            text: `Generated pictograph ${letter} (variation ${variation})\n` +
                  `Size: ${prefs.size}x${prefs.size}px, ${prefs.darkMode ? "dark" : "light"} mode\n` +
                  `Showing: ${enabledFeatures.join(", ") || "base only"}`,
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
  {},
  async () => {
    const prefs = currentPreferences;

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

// Start the server
async function main() {
  console.error("[MCP] Starting TKA Pictograph MCP Server...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP] Server connected and ready");
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
