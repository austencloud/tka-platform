/**
 * tika_ask — Full LLM round-trip
 *
 * Sends a message through TIKA's full pipeline (system prompt + tools + model)
 * and returns a diagnostic report: response text, tools called, inline content
 * count, JSON leak detection, and validation results.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TikaBridge } from "../tika-bridge.js";

export function registerTikaAsk(server: McpServer, bridge: TikaBridge) {
  server.tool(
    "tika_ask",
    "Send a message to TIKA (full LLM round-trip). Returns response text, tools called, JSON leak detection, and validation report.",
    {
      message: z.string().describe("The user message to send to TIKA"),
      level: z.number().min(1).max(3).default(1).describe("User knowledge level (1-3)"),
      model: z
        .enum(["haiku", "sonnet-4", "sonnet-4-legacy", "deepseek"])
        .default("haiku")
        .describe("Model to use (default: haiku for cheap testing)"),
      steps: z.number().min(1).max(10).default(6).describe("Max tool-use steps"),
    },
    async ({ message, level, model, steps }) => {
      try {
        const result = await bridge.ask(message, { level, model, steps });

        const lines: string[] = [];
        lines.push("=== TIKA Response Report ===");
        lines.push("");
        lines.push(`Model: ${model}`);
        lines.push(`Level: ${level}`);
        lines.push(`Response length: ${result.responseLength} chars`);
        lines.push(`Tools called: ${result.toolsCalled.length}`);
        for (const tc of result.toolsCalled) {
          lines.push(`  - ${tc.name}(${JSON.stringify(tc.args)})`);
        }
        lines.push(`Inline content count: ${result.inlineContentCount}`);
        lines.push(`Has JSON leak: ${result.hasJsonLeak ? "YES — REGRESSION" : "no"}`);
        lines.push("");
        lines.push("--- Validation ---");
        lines.push(`Passed: ${result.validation.passed}`);
        lines.push(`Errors: ${result.validation.errorCount}, Warnings: ${result.validation.warningCount}`);
        if (result.validation.violations.length > 0) {
          for (const v of result.validation.violations) {
            lines.push(`  ${v}`);
          }
        }
        lines.push("");
        lines.push("--- Response Text ---");
        lines.push(result.text || "(empty)");

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        const message_ = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error during TIKA ask: ${message_}` }],
          isError: true,
        };
      }
    }
  );
}
