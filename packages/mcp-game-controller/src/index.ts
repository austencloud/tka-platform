#!/usr/bin/env node
/**
 * MCP Game Controller Server
 *
 * Provides AI agents with low-latency control over 3D game environments.
 * Connects to game clients via WebSocket and exposes tools via MCP protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketBridge } from "./bridge/websocket-server.js";
import { registerAllTools } from "./tools/index.js";
import { SubscriptionManager } from "./subscriptions/manager.js";

const WS_PORT = parseInt(process.env.GAME_WS_PORT ?? "9876", 10);

async function main() {
  console.error("[MCP Game Controller] Starting...");

  const server = new McpServer({
    name: "mcp-game-controller",
    version: "1.0.0",
  });

  // Create WebSocket bridge for game communication
  const bridge = new WebSocketBridge({ port: WS_PORT });

  // Create subscription manager for event forwarding
  const subscriptions = new SubscriptionManager(server, bridge);

  registerAllTools(server, bridge);

  // Register event resources for subscriptions
  server.resource(
    "game-events",
    "game://events/{eventType}",
    async (uri) => {
      const eventType = uri.pathname.split("/").pop();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              eventType,
              description: `Subscribe to ${eventType} events`,
              available: bridge.isConnected(),
            }),
          },
        ],
      };
    }
  );

  // Add connection status tool
  server.tool(
    "game_status",
    "Check if a game client is connected",
    {},
    async () => {
      const connected = bridge.isConnected();
      const clientCount = bridge.getClientCount();
      return {
        content: [
          {
            type: "text",
            text: connected
              ? `Connected (${clientCount} client${clientCount > 1 ? "s" : ""})`
              : "No game client connected. Navigate to /realm in the browser.",
          },
        ],
      };
    }
  );

  // Start WebSocket bridge
  await bridge.start();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP Game Controller] Ready");
  console.error(`[MCP Game Controller] WebSocket bridge on port ${WS_PORT}`);

  // Handle shutdown
  process.on("SIGINT", () => {
    console.error("[MCP Game Controller] Shutting down...");
    subscriptions.dispose();
    bridge.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.error("[MCP Game Controller] Shutting down...");
    subscriptions.dispose();
    bridge.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[MCP Game Controller] Fatal error:", err);
  process.exit(1);
});
