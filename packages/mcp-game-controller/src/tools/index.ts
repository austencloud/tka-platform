/**
 * Tool Registry
 *
 * Registers all game controller tools with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";
import { registerStateTools } from "./state.js";
import { registerMovementTools } from "./movement.js";
import { registerCameraTools } from "./camera.js";
import { registerInteractionTools } from "./interaction.js";
import { registerPlaybackTools } from "./playback.js";

export function registerAllTools(server: McpServer, bridge: WebSocketBridge): void {
  registerStateTools(server, bridge);
  registerMovementTools(server, bridge);
  registerCameraTools(server, bridge);
  registerInteractionTools(server, bridge);
  registerPlaybackTools(server, bridge);

  console.error("[MCP] Registered game controller tools");
}
