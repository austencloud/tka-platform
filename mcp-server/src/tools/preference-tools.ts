/**
 * Preference Tools
 *
 * Tools for managing pictograph rendering preferences:
 * set_preferences, get_preferences, reset_preferences
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "../shared/server-context.js";

export function registerPreferenceTools(server: McpServer): void {
  // Tool: set_preferences
  server.tool(
    "set_preferences",
    "Set visibility preferences for all future pictograph generations in this session. Any setting not specified will keep its current value.",
    {
      darkMode: z.boolean().optional().describe("Use dark background (default: true)"),
      size: z.number().optional().describe("Image size in pixels (default: 400)"),
      showTKA: z.boolean().optional().describe("Show TKA letter glyph with turn numbers"),
      showTND: z.boolean().optional().describe("Show TnD (timing & direction) glyph"),
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
      const before = { ...getPreferences() };

      // Build updates object
      const updates: Partial<UserPreferences> = {};
      if (newPrefs.darkMode !== undefined) updates.darkMode = newPrefs.darkMode;
      if (newPrefs.size !== undefined) updates.size = newPrefs.size;
      if (newPrefs.showTKA !== undefined) updates.showTKA = newPrefs.showTKA;
      if (newPrefs.showTND !== undefined) updates.showTND = newPrefs.showTND;
      if (newPrefs.showPositions !== undefined) updates.showPositions = newPrefs.showPositions;
      if (newPrefs.showReversals !== undefined) updates.showReversals = newPrefs.showReversals;
      if (newPrefs.showGrid !== undefined) updates.showGrid = newPrefs.showGrid;
      if (newPrefs.showNonRadialPoints !== undefined) updates.showNonRadialPoints = newPrefs.showNonRadialPoints;
      if (newPrefs.handPointVisibility !== undefined) updates.handPointVisibility = newPrefs.handPointVisibility;
      if (newPrefs.showBlueMotion !== undefined) updates.showBlueMotion = newPrefs.showBlueMotion;
      if (newPrefs.showRedMotion !== undefined) updates.showRedMotion = newPrefs.showRedMotion;
      if (newPrefs.bluePropType !== undefined) updates.bluePropType = newPrefs.bluePropType;
      if (newPrefs.redPropType !== undefined) updates.redPropType = newPrefs.redPropType;

      updatePreferences(updates);
      const current = getPreferences();

      // Build summary of changes
      const changes: string[] = [];
      for (const key of Object.keys(updates) as (keyof UserPreferences)[]) {
        if (before[key] !== current[key]) {
          changes.push(`${key}: ${before[key]} → ${current[key]}`);
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

  // Tool: get_preferences
  server.tool(
    "get_preferences",
    "Get current visibility preferences for pictograph generation.",
    {
      compact: z.boolean().optional().default(false).describe("Compact output (key:value pairs only - saves ~300 tokens)"),
    },
    async ({ compact = false }) => {
      const prefs = getPreferences();

      if (compact) {
        const pairs = [
          `dark:${prefs.darkMode}`,
          `size:${prefs.size}`,
          `tka:${prefs.showTKA}`,
          `tnd:${prefs.showTND}`,
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

      const summary = `Current Pictograph Preferences:

Display:
  • darkMode: ${prefs.darkMode}
  • size: ${prefs.size}px

Glyphs:
  • showTKA: ${prefs.showTKA} (letter + turn numbers)
  • showTND: ${prefs.showTND} (timing glyph)
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

  // Tool: reset_preferences
  server.tool(
    "reset_preferences",
    "Reset all preferences to defaults.",
    {},
    async () => {
      resetPreferences();

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
}
