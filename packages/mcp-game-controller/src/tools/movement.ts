/**
 * Movement Tools
 *
 * Tools for player movement, teleportation, and jumping.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";
import type { Vector3 } from "../types/game-state.js";

export function registerMovementTools(server: McpServer, bridge: WebSocketBridge): void {
  // game_move - Move player in direction
  server.tool(
    "game_move",
    "Move player in a direction for specified distance or duration",
    {
      direction: z
        .enum(["forward", "backward", "left", "right"])
        .describe("Movement direction relative to camera"),
      distance: z
        .number()
        .optional()
        .describe("Distance in meters (mutually exclusive with duration)"),
      duration: z
        .number()
        .optional()
        .describe("Duration in milliseconds (mutually exclusive with distance)"),
      sprint: z
        .boolean()
        .optional()
        .default(false)
        .describe("Use sprint speed"),
    },
    async ({ direction, distance, duration, sprint }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const result = await bridge.call<Vector3>("move", {
          direction,
          distance,
          duration,
          sprint,
        });
        return {
          content: [
            {
              type: "text",
              text: `Moved to (${result.x.toFixed(2)}, ${result.y.toFixed(2)}, ${result.z.toFixed(2)})`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_teleport - Instant position change
  server.tool(
    "game_teleport",
    "Teleport player to exact coordinates",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      snapToGround: z
        .boolean()
        .optional()
        .default(true)
        .describe("Raycast down to find ground after teleport"),
    },
    async ({ x, y, z, snapToGround }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("teleport", { x, y, z, snapToGround });
        return {
          content: [
            { type: "text", text: `Teleported to (${x}, ${y}, ${z})` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_jump - Jump action
  server.tool(
    "game_jump",
    "Make player jump (must be grounded)",
    {},
    async () => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("jump");
        return {
          content: [{ type: "text", text: "Jumped" }],
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
