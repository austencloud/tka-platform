/**
 * Camera Tools
 *
 * Tools for camera control and mode switching.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";

export function registerCameraTools(server: McpServer, bridge: WebSocketBridge): void {
  // game_look - Set camera direction
  server.tool(
    "game_look",
    "Set camera yaw and pitch angles",
    {
      yaw: z
        .number()
        .optional()
        .describe("Horizontal angle in degrees (0 = north, 90 = east)"),
      pitch: z
        .number()
        .optional()
        .describe("Vertical angle in degrees (-90 = down, 90 = up)"),
    },
    async ({ yaw, pitch }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("look", { yaw, pitch });
        const parts = [];
        if (yaw !== undefined) parts.push(`yaw=${yaw}°`);
        if (pitch !== undefined) parts.push(`pitch=${pitch}°`);
        return {
          content: [{ type: "text", text: `Set camera: ${parts.join(", ")}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_look_at - Look at world position
  server.tool(
    "game_look_at",
    "Orient camera to face a world position",
    {
      x: z.number().describe("X coordinate to look at"),
      y: z.number().describe("Y coordinate to look at"),
      z: z.number().describe("Z coordinate to look at"),
    },
    async ({ x, y, z }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("lookAt", { x, y, z });
        return {
          content: [{ type: "text", text: `Looking at (${x}, ${y}, ${z})` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_set_camera_mode - Change camera mode
  server.tool(
    "game_set_camera_mode",
    "Switch between orbit, third-person, and first-person camera modes",
    {
      mode: z
        .enum(["orbit", "third_person", "first_person"])
        .describe("Camera mode to set"),
    },
    async ({ mode }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("setCameraMode", { mode });
        return {
          content: [{ type: "text", text: `Camera mode set to ${mode}` }],
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
