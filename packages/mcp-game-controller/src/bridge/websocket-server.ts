/**
 * WebSocket Bridge Server
 *
 * Manages WebSocket connections to game clients and provides
 * RPC-style communication for MCP tools.
 *
 * Features:
 * - Token-based authentication (optional)
 * - Request/response RPC pattern
 * - Event broadcasting
 * - Connection management
 */

import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import type {
  BridgeMessage,
  BridgeRequest,
  BridgeResponse,
  BridgeEvent,
  BridgeAuth,
} from "../types/protocol.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ClientState {
  ws: WebSocket;
  authenticated: boolean;
}

export interface WebSocketBridgeConfig {
  port: number;
  requestTimeout?: number;
  /** Optional auth token. If set, clients must authenticate before making requests. */
  authToken?: string;
}

export class WebSocketBridge {
  private wss: WebSocketServer | null = null;
  private clientStates = new Map<WebSocket, ClientState>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;
  private eventListeners = new Map<string, Set<(data: unknown) => void>>();
  private config: Required<Omit<WebSocketBridgeConfig, "authToken">> & { authToken: string | null };

  constructor(config: WebSocketBridgeConfig) {
    this.config = {
      port: config.port,
      requestTimeout: config.requestTimeout ?? 10000,
      authToken: config.authToken ?? process.env.GAME_BRIDGE_TOKEN ?? null,
    };
  }

  /** Check if authentication is required */
  private get requiresAuth(): boolean {
    return this.config.authToken !== null && this.config.authToken !== "";
  }

  async start(): Promise<void> {
    if (await this.isPortInUse(this.config.port)) {
      console.error(`[Bridge] Port ${this.config.port} in use — killing zombie process`);
      this.killProcessOnPort(this.config.port);
      // Give the OS a moment to release the port
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.config.port });
      this.attachListeners(this.wss, resolve, reject);
    });
  }

  private isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private killProcessOnPort(port: number): void {
    try {
      // Windows: find and kill the PID holding the port
      const result = execSync(
        `powershell.exe -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`,
        { encoding: "utf8", timeout: 5000 },
      );
      console.error(`[Bridge] Killed zombie on port ${port}`);
    } catch {
      console.error(`[Bridge] Could not kill process on port ${port}`);
    }
  }

  private attachListeners(
    wss: WebSocketServer,
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
      wss.on("connection", (ws) => {
        console.error("[Bridge] Game client connected");

        // Track client state
        const clientState: ClientState = {
          ws,
          authenticated: !this.requiresAuth, // Auto-auth if no token required
        };
        this.clientStates.set(ws, clientState);

        ws.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString()) as BridgeMessage;
            this.handleMessage(ws, msg, clientState);
          } catch (err) {
            console.error("[Bridge] Failed to parse message:", err);
          }
        });

        ws.on("close", () => {
          console.error("[Bridge] Game client disconnected");
          this.clientStates.delete(ws);
        });

        ws.on("error", (err) => {
          console.error("[Bridge] WebSocket error:", err);
        });
      });

      wss.on("listening", () => {
        const authStatus = this.requiresAuth ? " (auth required)" : " (no auth)";
        console.error(
          `[Bridge] WebSocket server listening on port ${this.config.port}${authStatus}`
        );
        resolve();
      });

      wss.on("error", (err: NodeJS.ErrnoException) => {
        reject(err);
      });
  }

  stop(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Bridge shutting down"));
      this.pendingRequests.delete(id);
    }

    // Close all client connections
    for (const [ws] of this.clientStates) {
      ws.close();
    }
    this.clientStates.clear();

    // Close server
    this.wss?.close();
    this.wss = null;
  }

  private handleMessage(ws: WebSocket, msg: BridgeMessage, clientState: ClientState): void {
    // Handle auth message
    if (msg.type === "auth") {
      this.handleAuth(ws, msg as BridgeAuth, clientState);
      return;
    }

    // If auth required but not authenticated, reject
    if (this.requiresAuth && !clientState.authenticated) {
      const response: BridgeResponse = {
        type: "response",
        id: (msg as BridgeRequest).id ?? "0",
        error: "Authentication required",
      };
      ws.send(JSON.stringify(response));
      return;
    }

    switch (msg.type) {
      case "response":
        this.handleResponse(msg as BridgeResponse);
        break;
      case "event":
        this.handleEvent(msg as BridgeEvent);
        break;
      default:
        console.error("[Bridge] Unknown message type:", msg);
    }
  }

  private handleAuth(ws: WebSocket, msg: BridgeAuth, clientState: ClientState): void {
    if (msg.token === this.config.authToken) {
      clientState.authenticated = true;
      console.error("[Bridge] Client authenticated");
      // Send success response
      const response: BridgeResponse = {
        type: "response",
        id: "auth",
        result: { authenticated: true },
      };
      ws.send(JSON.stringify(response));
    } else {
      console.error("[Bridge] Client authentication failed");
      // Send failure response
      const response: BridgeResponse = {
        type: "response",
        id: "auth",
        error: "Invalid token",
      };
      ws.send(JSON.stringify(response));
    }
  }

  private handleResponse(msg: BridgeResponse): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) {
      console.error("[Bridge] No pending request for id:", msg.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(msg.id);

    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }

  private handleEvent(msg: BridgeEvent): void {
    const listeners = this.eventListeners.get(msg.event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(msg.data);
        } catch (err) {
          console.error("[Bridge] Event listener error:", err);
        }
      }
    }
  }

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const client = this.getActiveClient();
    if (!client) {
      throw new Error("No game client connected");
    }

    const id = String(++this.requestId);

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const request: BridgeRequest = {
        type: "request",
        id,
        method,
        params,
      };

      client.send(JSON.stringify(request));
    });
  }

  /**
   * Subscribe to game events
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  broadcast(event: string, data: unknown): void {
    const msg: BridgeEvent = { type: "event", event, data };
    const payload = JSON.stringify(msg);

    for (const [ws, state] of this.clientStates) {
      if (ws.readyState === WebSocket.OPEN && state.authenticated) {
        ws.send(payload);
      }
    }
  }

  isConnected(): boolean {
    for (const [ws, state] of this.clientStates) {
      if (ws.readyState === WebSocket.OPEN && state.authenticated) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the number of authenticated connected clients
   */
  getClientCount(): number {
    let count = 0;
    for (const [ws, state] of this.clientStates) {
      if (ws.readyState === WebSocket.OPEN && state.authenticated) {
        count++;
      }
    }
    return count;
  }

  private getActiveClient(): WebSocket | null {
    for (const [ws, state] of this.clientStates) {
      if (ws.readyState === WebSocket.OPEN && state.authenticated) {
        return ws;
      }
    }
    return null;
  }
}
