/**
 * Pictograph Generation Tools
 *
 * Tools for generating pictograph images: generate_pictograph,
 * view_pictograph, generate_pictograph_url
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStandaloneRenderer, type RenderVisibilityOptions } from "../core/standalone-renderer.js";
import {
  ensureDataLoaded,
  getPreferences,
  saveAndOpenImage,
  type UserPreferences,
} from "../shared/server-context.js";

export function registerPictographTools(server: McpServer): void {
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

      const params = new URLSearchParams({
        letter,
        variation: variation.toString(),
        dark: darkMode.toString(),
        minimal: minimal.toString(),
      });

      const url = `http://localhost:5173/test/pictograph-cli?${params.toString()}`;
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

  // Tool: generate_pictograph
  server.tool(
    "generate_pictograph",
    "Generate a pictograph PNG image directly in Node.js. Uses current preferences unless overridden. Returns base64-encoded image.",
    {
      letter: z.string().describe("The letter to render (A-Z or Greek: α, β, γ, Δ, Θ, Λ, Σ, Φ, Ψ, Ω)"),
      variation: z.number().optional().default(0).describe("Variation index (0-based)"),
      darkMode: z.boolean().optional().describe("Override: dark background"),
      size: z.number().optional().describe("Override: image size in pixels"),
      showTKA: z.boolean().optional().describe("Override: show TKA letter glyph"),
      showTND: z.boolean().optional().describe("Override: show TnD (timing & direction) glyph"),
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
        const prefs = { ...getPreferences() };
        if (overrides.darkMode !== undefined) prefs.darkMode = overrides.darkMode;
        if (overrides.size !== undefined) prefs.size = overrides.size;
        if (overrides.showTKA !== undefined) prefs.showTKA = overrides.showTKA;
        if (overrides.showTND !== undefined) prefs.showTND = overrides.showTND;
        if (overrides.showPositions !== undefined) prefs.showPositions = overrides.showPositions;
        if (overrides.showReversals !== undefined) prefs.showReversals = overrides.showReversals;
        if (overrides.showGrid !== undefined) prefs.showGrid = overrides.showGrid;
        if (overrides.showNonRadialPoints !== undefined) prefs.showNonRadialPoints = overrides.showNonRadialPoints;
        if (overrides.showBlueMotion !== undefined) prefs.showBlueMotion = overrides.showBlueMotion;
        if (overrides.showRedMotion !== undefined) prefs.showRedMotion = overrides.showRedMotion;

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
            turns: 0,
            startOrientation: "in",
          },
          redMotion: {
            motionType: csvRow.redMotion.motionType,
            rotationDirection: csvRow.redMotion.rotationDirection || "no_rotation",
            startLocation: csvRow.redMotion.startLocation,
            endLocation: csvRow.redMotion.endLocation,
            color: "red",
            turns: 0,
            startOrientation: "in",
          },
        };

        const visibility: RenderVisibilityOptions = {
          darkMode: prefs.darkMode,
          size: prefs.size,
          showTKA: prefs.showTKA,
          showTND: prefs.showTND,
          showPositions: prefs.showPositions,
          showReversals: prefs.showReversals,
          showGrid: prefs.showGrid,
          showNonRadialPoints: prefs.showNonRadialPoints,
          showBlueMotion: prefs.showBlueMotion,
          showRedMotion: prefs.showRedMotion,
          bluePropType: prefs.bluePropType,
          redPropType: prefs.redPropType,
        };

        const renderer = getStandaloneRenderer();
        const pngBuffer = await renderer.renderToPng(pictographInput, visibility);

        saveAndOpenImage(pngBuffer, letter);

        const base64 = pngBuffer.toString("base64");

        const blueMotionDesc = `${csvRow.blueMotion.motionType} from ${csvRow.blueMotion.startLocation} to ${csvRow.blueMotion.endLocation}` +
          (csvRow.blueMotion.rotationDirection !== "noRotation" ? ` (${csvRow.blueMotion.rotationDirection})` : "");
        const redMotionDesc = `${csvRow.redMotion.motionType} from ${csvRow.redMotion.startLocation} to ${csvRow.redMotion.endLocation}` +
          (csvRow.redMotion.rotationDirection !== "noRotation" ? ` (${csvRow.redMotion.rotationDirection})` : "");

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

  // Tool: view_pictograph
  server.tool(
    "view_pictograph",
    "Generate a pictograph and open it in the system image viewer. Returns only confirmation text - NO image data returned. Use this when the USER needs to see the pictograph but Claude doesn't need to analyze it. Saves ~15-30k tokens compared to generate_pictograph.",
    {
      letter: z.string().describe("The letter to render (A-Z or Greek: α, β, γ, Δ, Θ, Λ, Σ, Φ, Ψ, Ω)"),
      variation: z.number().optional().default(0).describe("Variation index (0-based)"),
      darkMode: z.boolean().optional().describe("Override: dark background"),
      size: z.number().optional().describe("Override: image size in pixels"),
      showTKA: z.boolean().optional().describe("Override: show TKA letter glyph"),
      showTND: z.boolean().optional().describe("Override: show TnD (timing & direction) glyph"),
      showPositions: z.boolean().optional().describe("Override: show start→end positions glyph"),
      showReversals: z.boolean().optional().describe("Override: show reversal indicators"),
      showGrid: z.boolean().optional().describe("Override: show grid"),
      showNonRadialPoints: z.boolean().optional().describe("Override: show non-radial grid points"),
      showBlueMotion: z.boolean().optional().describe("Override: show blue motion (prop + arrow)"),
      showRedMotion: z.boolean().optional().describe("Override: show red motion (prop + arrow)"),
    },
    async ({ letter, variation = 0, ...overrides }) => {
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

      try {
        const csvRow = variations[variation];

        const prefs = { ...getPreferences() };
        if (overrides.darkMode !== undefined) prefs.darkMode = overrides.darkMode;
        if (overrides.size !== undefined) prefs.size = overrides.size;
        if (overrides.showTKA !== undefined) prefs.showTKA = overrides.showTKA;
        if (overrides.showTND !== undefined) prefs.showTND = overrides.showTND;
        if (overrides.showPositions !== undefined) prefs.showPositions = overrides.showPositions;
        if (overrides.showReversals !== undefined) prefs.showReversals = overrides.showReversals;
        if (overrides.showGrid !== undefined) prefs.showGrid = overrides.showGrid;
        if (overrides.showNonRadialPoints !== undefined) prefs.showNonRadialPoints = overrides.showNonRadialPoints;
        if (overrides.showBlueMotion !== undefined) prefs.showBlueMotion = overrides.showBlueMotion;
        if (overrides.showRedMotion !== undefined) prefs.showRedMotion = overrides.showRedMotion;

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
            turns: 0,
            startOrientation: "in",
          },
          redMotion: {
            motionType: csvRow.redMotion.motionType,
            rotationDirection: csvRow.redMotion.rotationDirection || "no_rotation",
            startLocation: csvRow.redMotion.startLocation,
            endLocation: csvRow.redMotion.endLocation,
            color: "red",
            turns: 0,
            startOrientation: "in",
          },
        };

        const visibility: RenderVisibilityOptions = {
          darkMode: prefs.darkMode,
          size: prefs.size,
          showTKA: prefs.showTKA,
          showTND: prefs.showTND,
          showPositions: prefs.showPositions,
          showReversals: prefs.showReversals,
          showGrid: prefs.showGrid,
          showNonRadialPoints: prefs.showNonRadialPoints,
          showBlueMotion: prefs.showBlueMotion,
          showRedMotion: prefs.showRedMotion,
          bluePropType: prefs.bluePropType,
          redPropType: prefs.redPropType,
        };

        const renderer = getStandaloneRenderer();
        const pngBuffer = await renderer.renderToPng(pictographInput, visibility);

        saveAndOpenImage(pngBuffer, letter);

        return {
          content: [
            {
              type: "image" as const,
              data: pngBuffer.toString("base64"),
              mimeType: "image/png",
            },
            {
              type: "text" as const,
              text: `${letter} (variation ${variation}) — ${csvRow.startPosition} → ${csvRow.endPosition}`,
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
}
