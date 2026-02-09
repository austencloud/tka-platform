/**
 * Utility Tools
 *
 * General utility tools: generate_random_word
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateRandomWord } from "../shared/server-context.js";

export function registerUtilityTools(server: McpServer): void {
  // Tool: generate_random_word
  server.tool(
    "generate_random_word",
    "Generate a random valid TKA word of specified length.",
    {
      length: z.number().min(1).max(20).describe("Number of letters"),
      excludeLetters: z.array(z.string()).optional().describe("Letters to exclude"),
    },
    async ({ length, excludeLetters }) => {
      const word = generateRandomWord(length, excludeLetters);

      return {
        content: [
          {
            type: "text" as const,
            text: `Generated word: **${word}** (${word.length} letters)`,
          },
        ],
      };
    }
  );
}
