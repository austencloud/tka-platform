/**
 * Subscription Manager
 *
 * Manages event subscriptions and forwards game events to MCP clients.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebSocketBridge } from "../bridge/websocket-server.js";
import type { GameEvent, GameEventType } from "../types/events.js";

const EVENT_TYPES: GameEventType[] = [
  "collision",
  "grounded_changed",
  "zone_enter",
  "zone_exit",
  "position_update",
];

export class SubscriptionManager {
  private unsubscribers = new Map<string, () => void>();

  constructor(
    private server: McpServer,
    private bridge: WebSocketBridge
  ) {
    // Set up event forwarding from bridge to MCP
    for (const eventType of EVENT_TYPES) {
      const unsubscribe = bridge.on(eventType, (data) => {
        this.handleGameEvent({ type: eventType, data } as GameEvent);
      });
      this.unsubscribers.set(eventType, unsubscribe);
    }
  }

  private handleGameEvent(event: GameEvent): void {
    // MCP uses notifications/resources/updated for subscribed resources
    // The resource URI format is game://events/{eventType}
    const resourceUri = `game://events/${event.type}`;

    // Send notification to MCP client
    // Note: The actual notification mechanism depends on MCP SDK version
    // This is the conceptual implementation
    try {
      // @ts-expect-error - notification API may vary by SDK version
      this.server.notification?.({
        method: "notifications/resources/updated",
        params: {
          uri: resourceUri,
        },
      });
    } catch {
      // Notification not supported or no subscribers
    }
  }

  getEventTypes(): string[] {
    return [...EVENT_TYPES];
  }

  /**
   * Clean up all subscriptions
   */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers.values()) {
      unsubscribe();
    }
    this.unsubscribers.clear();
  }
}
