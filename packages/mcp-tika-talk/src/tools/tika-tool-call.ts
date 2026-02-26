/**
 * tika_tool_call — Direct tool execution (no LLM)
 *
 * Calls a single TIKA tool and returns the filtered output the model would
 * receive. Useful for inspecting tool behavior without burning API tokens.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TikaBridge } from "../tika-bridge.js";

export function registerTikaToolCall(server: McpServer, bridge: TikaBridge) {
  server.tool(
    "tika_tool_call",
    "Call a TIKA tool directly (no LLM). Returns the filtered output the model would see.",
    {
      toolName: z.string().describe("TIKA tool name (e.g. get_letter_explanation, validate_sequence)"),
      args: z.record(z.unknown()).default({}).describe("Tool arguments as key-value pairs"),
    },
    async ({ toolName, args }) => {
      try {
        const result = await bridge.executeTool(toolName, args);
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        // Detect inline content in the result
        const inlineTypes = [
          "inline-pictograph",
          "inline-gallery",
          "inline-sequence-player",
          "inline-step-grid",
          "inline-quiz",
        ];
        const foundInline = inlineTypes.filter((t) => text.includes(t));

        let summary = `Tool: ${toolName}\n`;
        summary += `Args: ${JSON.stringify(args)}\n`;
        summary += `Result length: ${text.length} chars\n`;
        if (foundInline.length > 0) {
          summary += `Inline content: ${foundInline.join(", ")}\n`;
        }
        summary += `\n--- Filtered output ---\n${text}`;

        return {
          content: [{ type: "text", text: summary }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error executing ${toolName}: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
