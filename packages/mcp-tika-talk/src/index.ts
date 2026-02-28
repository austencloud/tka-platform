#!/usr/bin/env node
/**
 * MCP TIKA Talk Server
 *
 * Test TIKA without clicking through the browser.
 * Two tools:
 *   - tika_tool_call: Direct tool execution (no LLM)
 *   - tika_ask: Full LLM round-trip with diagnostics
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeBridge } from "./tika-bridge.js";
import { registerTikaToolCall } from "./tools/tika-tool-call.js";
import { registerTikaAsk } from "./tools/tika-ask.js";

async function main() {
  console.error("[tika-talk] Starting...");

  const bridge = initializeBridge();

  const server = new McpServer({
    name: "mcp-tika-talk",
    version: "1.0.0",
  });

  registerTikaToolCall(server, bridge);
  registerTikaAsk(server, bridge);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[tika-talk] Ready — 2 tools registered");

  process.on("SIGINT", () => {
    console.error("[tika-talk] Shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.error("[tika-talk] Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[tika-talk] Fatal error:", err);
  process.exit(1);
});
