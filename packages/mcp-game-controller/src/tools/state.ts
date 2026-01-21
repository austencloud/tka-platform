/**
 * State Query Tools
 *
 * Tools for querying game state, scene, and raycasting.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";
import type { GameState, CompactGameState, SceneInfo, RaycastResult } from "../types/game-state.js";

export function registerStateTools(server: McpServer, bridge: WebSocketBridge): void {
  // game_get_state - Get current player state
  server.tool(
    "game_get_state",
    "Get current player position, rotation, physics state, and camera mode",
    {
      compact: z
        .boolean()
        .optional()
        .describe("Return minimal data (x, y, z, grounded) to save tokens"),
    },
    async ({ compact }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const state = await bridge.call<GameState>("getState");

        if (compact) {
          const compactState: CompactGameState = {
            x: +state.position.x.toFixed(2),
            y: +state.position.y.toFixed(2),
            z: +state.position.z.toFixed(2),
            g: state.grounded,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(compactState) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_get_scene - Get scene overview
  server.tool(
    "game_get_scene",
    "Get list of nearby objects, interactables, and terrain info",
    {
      radius: z
        .number()
        .optional()
        .default(20)
        .describe("Search radius in meters"),
      types: z
        .array(z.string())
        .optional()
        .describe("Filter by object types (e.g., interactable, performer, prop)"),
    },
    async ({ radius, types }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const scene = await bridge.call<SceneInfo>("getScene", { radius, types });
        return {
          content: [{ type: "text", text: JSON.stringify(scene, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_raycast - Cast ray into scene
  server.tool(
    "game_raycast",
    "Cast ray from camera or player position to find objects",
    {
      from: z
        .enum(["camera", "player"])
        .optional()
        .default("camera")
        .describe("Ray origin"),
      direction: z
        .object({
          x: z.number(),
          y: z.number(),
          z: z.number(),
        })
        .optional()
        .describe("Ray direction (defaults to camera forward)"),
      maxDistance: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum ray distance"),
    },
    async ({ from, direction, maxDistance }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const result = await bridge.call<RaycastResult>("raycast", {
          from,
          direction,
          maxDistance,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
