/**
 * Playback Tools
 *
 * Tools for sequence loading and playback control.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";

export function registerPlaybackTools(server: McpServer, bridge: WebSocketBridge): void {
  // game_load_sequence - Load a sequence
  server.tool(
    "game_load_sequence",
    "Load a sequence by name or ID",
    {
      query: z.string().describe("Sequence name or ID to load"),
    },
    async ({ query }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const result = await bridge.call<{ loaded: boolean; name?: string; error?: string }>(
          "loadSequence",
          { query }
        );
        if (result.loaded) {
          return {
            content: [
              { type: "text", text: `Loaded sequence: ${result.name ?? query}` },
            ],
          };
        } else {
          return {
            content: [
              { type: "text", text: `Failed to load: ${result.error ?? "Not found"}` },
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

  // game_playback - Control playback
  server.tool(
    "game_playback",
    "Control sequence playback (play, pause, stop, reset, step)",
    {
      action: z
        .enum(["play", "pause", "stop", "reset", "step_forward", "step_back"])
        .describe("Playback action"),
      speed: z
        .number()
        .optional()
        .describe("Playback speed multiplier (e.g., 0.5, 1, 2)"),
    },
    async ({ action, speed }) => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        await bridge.call("playback", { action, speed });
        let msg = `Playback: ${action}`;
        if (speed !== undefined) {
          msg += ` (speed: ${speed}x)`;
        }
        return {
          content: [{ type: "text", text: msg }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // game_get_playback_state - Get current playback state
  server.tool(
    "game_get_playback_state",
    "Get current playback state (playing, step, speed, etc.)",
    {},
    async () => {
      if (!bridge.isConnected()) {
        return {
          content: [{ type: "text", text: "Error: No game client connected" }],
          isError: true,
        };
      }

      try {
        const state = await bridge.call<{
          isPlaying: boolean;
          currentStep: number;
          totalSteps: number;
          speed: number;
          loop: boolean;
          sequenceName: string | null;
        }>("getPlaybackState");
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
}
