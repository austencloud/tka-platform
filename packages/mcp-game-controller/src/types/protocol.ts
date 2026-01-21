/**
 * Bridge Protocol Types
 *
 * Message types for WebSocket communication between
 * MCP server and game client.
 */

export interface BridgeRequest {
  type: "request";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface BridgeResponse {
  type: "response";
  id: string;
  result?: unknown;
  error?: string;
}

export interface BridgeEvent {
  type: "event";
  event: string;
  data: unknown;
}

export interface BridgeSubscribe {
  type: "subscribe";
  event: string;
}

export interface BridgeUnsubscribe {
  type: "unsubscribe";
  event: string;
}

export interface BridgeAuth {
  type: "auth";
  token: string;
}

export type BridgeMessage =
  | BridgeRequest
  | BridgeResponse
  | BridgeEvent
  | BridgeSubscribe
  | BridgeUnsubscribe
  | BridgeAuth;
