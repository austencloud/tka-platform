/**
 * Interaction Tools
 *
 * Tools for interacting with game objects and performers.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";
import type { InteractionResult } from "../types/game-state.js";

export function registerInteractionTools(server: McpServer, bridge: WebSocketBridge): void {
  // game_interact - Interact with object
  server.tool(
    "game_interact",
    "Interact with a named object or nearest interactable",
    {
      target: z
        .string()
        .describe("Object ID or 'nearest' for closest interactable"),
      action: z
        .string()
        .optional()
        .describe("Specific action to perform (optional, uses default)"),
    },
    async ({ target, action }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const result = await bridge.call<InteractionResult>("interact", {
          target,
          action,
        });
        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Interaction '${result.action}' on '${result.target}' succeeded`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Interaction failed: ${result.error ?? "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_select_performer - Select active performer
  server.tool(
    "game_select_performer",
    "Select a performer by index for prop control",
    {
      index: z.number().describe("Performer index (0-based)"),
    },
    async ({ index }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("selectPerformer", { index });
        return {
          content: [{ type: "text", text: `Selected performer ${index}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
