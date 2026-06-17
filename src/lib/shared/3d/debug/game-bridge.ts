/**
 * Game Bridge - Client-side bridge for MCP Game Controller
 *
 * Production-quality implementation with:
 * - Token-based authentication
 * - Exponential backoff reconnection
 * - Direct physics commands (no keypress simulation)
 * - Full event subscription support
 * - Configurable via environment variables
 */

import type {
  Vector3,
  GameState,
  SceneInfo,
  SceneObject,
  RaycastResult,
  PlaybackState,
  BridgeRequest,
  BridgeResponse,
  BridgeEvent,
  BridgeMessage,
  GameBridgeConfig,
  GameBridgeBindings,
  GameEventType,
  GameEvent,
} from "./game-bridge-types";
import { DEFAULT_BRIDGE_CONFIG } from "./game-bridge-types";

// ============================================================================
// GAME BRIDGE CLASS
// ============================================================================

export class GameBridge {
  private ws: WebSocket | null = null;
  private bindings: GameBridgeBindings;
  private config: Required<GameBridgeConfig>;
  private eventListeners = new Map<string, Set<(data: unknown) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private currentReconnectDelay: number;
  private isAuthenticated = false;
  private pendingAuth: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private connectionPromise: Promise<void> | null = null;

  // Track last known state for events
  private lastGroundedState = false;
  private lastPosition: Vector3 = { x: 0, y: 0, z: 0 };

  constructor(bindings: GameBridgeBindings, config: Partial<GameBridgeConfig> = {}) {
    this.bindings = bindings;
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.currentReconnectDelay = this.config.reconnectDelay;
  }

  // --------------------------------------------------------------------------
  // CONNECTION
  // --------------------------------------------------------------------------

  async connect(wsUrl?: string): Promise<void> {
    const url = wsUrl ?? this.config.wsUrl;

    // If already connecting, return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Connection timeout"));
        this.ws?.close();
      }, this.config.connectionTimeout);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.log("Connected to MCP server");
          this.reconnectAttempts = 0;
          this.currentReconnectDelay = this.config.reconnectDelay;

          // If auth token is configured, authenticate first
          if (this.config.authToken) {
            this.pendingAuth = { resolve, reject };
            this.sendAuth(this.config.authToken);
          } else {
            this.isAuthenticated = true;
            resolve();
          }
        };

        this.ws.onerror = (err) => {
          clearTimeout(timeoutId);
          this.log("WebSocket error:", err);
          reject(err);
        };

        this.ws.onclose = (event) => {
          this.log(`Disconnected (code: ${event.code}, reason: ${event.reason})`);
          this.isAuthenticated = false;
          this.connectionPromise = null;

          if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect(url);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as BridgeMessage;
            this.handleMessage(msg);
          } catch (err) {
            this.log("Failed to parse message:", err);
          }
        };
      } catch (err) {
        clearTimeout(timeoutId);
        this.connectionPromise = null;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.config.autoReconnect = false; // Prevent reconnection
    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }
    this.connectionPromise = null;
    this.isAuthenticated = false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  private scheduleReconnect(url: string): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.currentReconnectDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected()) {
        this.connect(url).catch((err) => {
          this.log("Reconnect failed:", err);
        });
      }
    }, this.currentReconnectDelay);

    // Exponential backoff with cap
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * this.config.reconnectBackoff,
      this.config.maxReconnectDelay
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  private sendAuth(token: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "auth", token }));
  }

  private handleAuthResponse(success: boolean, error?: string): void {
    if (success) {
      this.isAuthenticated = true;
      this.pendingAuth?.resolve();
    } else {
      this.pendingAuth?.reject(new Error(error ?? "Authentication failed"));
    }
    this.pendingAuth = null;
  }

  // --------------------------------------------------------------------------
  // MESSAGE HANDLING
  // --------------------------------------------------------------------------

  private handleMessage(msg: BridgeMessage): void {
    if (msg.type === "request") {
      this.handleRequest(msg as BridgeRequest);
    } else if (msg.type === "event") {
      this.handleEvent(msg as BridgeEvent);
    } else if (msg.type === "response") {
      // Handle auth response
      const resp = msg as BridgeResponse;
      if (this.pendingAuth) {
        this.handleAuthResponse(!resp.error, resp.error);
      }
    }
  }

  private async handleRequest(msg: BridgeRequest): Promise<void> {
    const { id, method, params } = msg;

    // Check authentication if required
    if (this.config.authToken && !this.isAuthenticated) {
      this.sendResponse(id, undefined, "Not authenticated");
      return;
    }

    try {
      const result = await this.executeMethod(method, params ?? {});
      this.sendResponse(id, result);
    } catch (err) {
      this.sendResponse(id, undefined, String(err));
    }
  }

  private handleEvent(msg: BridgeEvent): void {
    const listeners = this.eventListeners.get(msg.event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(msg.data);
        } catch (err) {
          this.log("Event listener error:", err);
        }
      }
    }
  }

  private sendResponse(id: string, result?: unknown, error?: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const response: BridgeResponse = { type: "response", id };
    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }
    this.ws.send(JSON.stringify(response));
  }

  private sendEvent(event: string, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const msg: BridgeEvent = { type: "event", event, data };
    this.ws.send(JSON.stringify(msg));
  }

  // --------------------------------------------------------------------------
  // METHOD EXECUTION
  // --------------------------------------------------------------------------

  /**
   * Stable public entry point for driving the bridge directly (chrome-devtools
   * MCP / browser console) WITHOUT a WebSocket controller. Forwards to the same
   * dispatch the WS uses, so `window.__gameBridge.debug("teleport", {x,y,z})`,
   * `debug("raycast", {})`, `debug("getState")`, etc. all work and stay valid
   * even if the private method names change. Returns the method's result.
   */
  async debug(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.executeMethod(method, params);
  }

  private async executeMethod(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      // State methods
      case "getState":
        return this.getState();
      case "getScene":
        return this.getScene(params.radius as number, params.types as string[]);
      case "raycast":
        return this.raycast(params);

      // Movement methods (direct physics, no keypress simulation)
      case "move":
        return this.move(params);
      case "teleport":
        return this.teleport(params);
      case "jump":
        return this.jump();

      // Camera methods
      case "look":
        return this.look(params);
      case "lookAt":
        return this.lookAt(params);
      case "setCameraMode":
        return this.setCameraMode(params.mode as string);

      // Interaction methods
      case "interact":
        return this.interact(params);
      case "selectPerformer":
        return this.selectPerformer(params.index as number);

      // Playback methods
      case "loadSequence":
        return this.loadSequence(params.query as string);
      case "playback":
        return this.playback(params);
      case "getPlaybackState":
        return this.getPlaybackState();

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // --------------------------------------------------------------------------
  // STATE METHODS
  // --------------------------------------------------------------------------

  private getState(): GameState {
    const pos = this.bindings.physics.getPlayerPosition() ?? { x: 0, y: 0, z: 0 };
    const vel = this.bindings.physics.getPlayerVelocity();
    const pm = this.bindings.playback.getPerformerManager();
    const performer = pm?.performers[pm.activeIndex];

    return {
      position: pos,
      rotation: {
        yaw: this.bindings.camera.getYaw(),
        pitch: this.bindings.camera.getPitch(),
      },
      velocity: vel,
      grounded: this.bindings.physics.isGrounded(),
      cameraMode: this.bindings.camera.getMode(),
      isPlaying: performer?.isPlaying ?? false,
      hasSequence: performer?.hasSequence ?? false,
      timestamp: Date.now(),
    };
  }

  private getScene(radius: number = 20, types?: string[]): SceneInfo {
    const playerPos = this.bindings.physics.getPlayerPosition() ?? { x: 0, y: 0, z: 0 };
    const pm = this.bindings.playback.getPerformerManager();
    const objects: SceneObject[] = [];

    if (pm) {
      for (let i = 0; i < pm.performers.length; i++) {
        const p = pm.performers[i];
        if (!p) continue;

        const dx = p.position.x - playerPos.x;
        const dz = p.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance <= radius) {
          if (!types || types.includes("performer")) {
            objects.push({
              id: `performer-${i}`,
              type: "performer",
              position: p.position,
              distance,
              metadata: {
                isActive: i === pm.activeIndex,
                hasSequence: p.hasSequence,
                isPlaying: p.isPlaying,
              },
            });
          }
        }
      }
    }

    return {
      terrain: { type: "stage", height: 5 },
      objects,
      bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    };
  }

  private raycast(params: Record<string, unknown>): RaycastResult {
    const origin = params.origin as Vector3;
    const direction = params.direction as Vector3;
    const maxDistance = (params.maxDistance as number) ?? 100;

    return this.bindings.physics.raycast(origin, direction, maxDistance);
  }

  // --------------------------------------------------------------------------
  // MOVEMENT METHODS (Direct Physics)
  // --------------------------------------------------------------------------

  private async move(params: Record<string, unknown>): Promise<Vector3> {
    const direction = params.direction as string;
    const distance = (params.distance as number) ?? 1;
    const sprint = (params.sprint as boolean) ?? false;

    // Get current yaw for direction calculation
    const yaw = this.bindings.camera.getYaw();

    // Calculate movement vector based on direction and camera yaw
    let dx = 0, dz = 0;
    switch (direction) {
      case "forward":
        dx = Math.sin(yaw);
        dz = Math.cos(yaw);
        break;
      case "backward":
        dx = -Math.sin(yaw);
        dz = -Math.cos(yaw);
        break;
      case "left":
        dx = Math.sin(yaw - Math.PI / 2);
        dz = Math.cos(yaw - Math.PI / 2);
        break;
      case "right":
        dx = Math.sin(yaw + Math.PI / 2);
        dz = Math.cos(yaw + Math.PI / 2);
        break;
      default:
        throw new Error(`Invalid direction: ${direction}`);
    }

    // Normalize and scale by distance
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length > 0) {
      dx = (dx / length) * distance;
      dz = (dz / length) * distance;
    }

    // Apply sprint multiplier
    const speedMultiplier = sprint ? 2.0 : 1.0;
    dx *= speedMultiplier;
    dz *= speedMultiplier;

    // Execute movement in small steps for collision accuracy
    const steps = Math.max(1, Math.ceil(distance / 0.5)); // 0.5m per step max
    const stepDx = dx / steps;
    const stepDz = dz / steps;
    const stepTime = 0.016; // ~60fps

    for (let i = 0; i < steps; i++) {
      this.bindings.physics.movePlayer(
        { x: stepDx, y: 0, z: stepDz },
        stepTime
      );
      // Small delay between steps for physics to settle
      await new Promise(r => setTimeout(r, stepTime * 1000));
    }

    const pos = this.bindings.physics.getPlayerPosition() ?? { x: 0, y: 0, z: 0 };
    return pos;
  }

  private teleport(params: Record<string, unknown>): { success: boolean; position: Vector3 } {
    const x = params.x as number;
    const y = params.y as number;
    const z = params.z as number;

    this.bindings.physics.teleportPlayer({ x, y, z });

    const pos = this.bindings.physics.getPlayerPosition() ?? { x, y, z };
    return { success: true, position: pos };
  }

  private jump(): { success: boolean; grounded: boolean } {
    const grounded = this.bindings.physics.isGrounded();
    if (grounded) {
      // Apply jump impulse through physics
      // This requires the physics provider to support vertical velocity
      this.bindings.physics.movePlayer({ x: 0, y: 5.0, z: 0 }, 0.016);
      return { success: true, grounded: true };
    }
    return { success: false, grounded: false };
  }

  // --------------------------------------------------------------------------
  // CAMERA METHODS
  // --------------------------------------------------------------------------

  private look(params: Record<string, unknown>): { yaw: number; pitch: number } {
    const yawDeg = params.yaw as number | undefined;
    const pitchDeg = params.pitch as number | undefined;

    if (yawDeg !== undefined) {
      this.bindings.camera.setYaw((yawDeg * Math.PI) / 180);
    }
    if (pitchDeg !== undefined) {
      this.bindings.camera.setPitch((pitchDeg * Math.PI) / 180);
    }

    return {
      yaw: (this.bindings.camera.getYaw() * 180) / Math.PI,
      pitch: (this.bindings.camera.getPitch() * 180) / Math.PI,
    };
  }

  private lookAt(params: Record<string, unknown>): { yaw: number; pitch: number } {
    const x = params.x as number;
    const y = params.y as number;
    const z = params.z as number;

    const pos = this.bindings.physics.getPlayerPosition();
    if (!pos) {
      return {
        yaw: (this.bindings.camera.getYaw() * 180) / Math.PI,
        pitch: (this.bindings.camera.getPitch() * 180) / Math.PI,
      };
    }

    // Calculate yaw to face target
    const dx = x - pos.x;
    const dz = z - pos.z;
    const yaw = Math.atan2(dx, dz);
    this.bindings.camera.setYaw(yaw);

    // Calculate pitch to look at target height
    const dy = y - pos.y;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const pitch = -Math.atan2(dy, horizontalDist);
    this.bindings.camera.setPitch(Math.max(-1.4, Math.min(1.4, pitch)));

    return {
      yaw: (yaw * 180) / Math.PI,
      pitch: (pitch * 180) / Math.PI,
    };
  }

  private setCameraMode(mode: string): { mode: string; success: boolean } {
    const validModes = ["orbit", "third_person", "first_person"];
    if (!validModes.includes(mode)) {
      return { mode: this.bindings.camera.getMode(), success: false };
    }
    this.bindings.camera.setMode(mode);
    return { mode, success: true };
  }

  // --------------------------------------------------------------------------
  // INTERACTION METHODS
  // --------------------------------------------------------------------------

  private interact(_params: Record<string, unknown>): {
    success: boolean;
    action: string;
    target: string;
    error?: string;
  } {
    // TODO: Implement object interaction when interactables are added
    return {
      success: false,
      action: "none",
      target: "none",
      error: "Not implemented",
    };
  }

  private selectPerformer(index: number): { success: boolean; index: number } {
    const pm = this.bindings.playback.getPerformerManager();
    if (!pm || index < 0 || index >= pm.performers.length) {
      return { success: false, index: pm?.activeIndex ?? -1 };
    }
    pm.selectPerformer(index);
    return { success: true, index };
  }

  // --------------------------------------------------------------------------
  // PLAYBACK METHODS
  // --------------------------------------------------------------------------

  private loadSequence(_query: string): { loaded: boolean; error?: string } {
    // TODO: Search library and load sequence
    return { loaded: false, error: "Not implemented" };
  }

  private playback(params: Record<string, unknown>): { success: boolean; state: PlaybackState } {
    const action = params.action as string;
    const speed = params.speed as number | undefined;
    const stepIndex = params.step as number | undefined;

    const pm = this.bindings.playback.getPerformerManager();
    const performer = pm?.performers[pm.activeIndex];

    if (!performer) {
      return {
        success: false,
        state: {
          isPlaying: false,
          currentStep: 0,
          totalSteps: 0,
          speed: 1,
          loop: false,
          sequenceName: null,
        },
      };
    }

    switch (action) {
      case "play":
        performer.play();
        break;
      case "pause":
        performer.pause();
        break;
      case "stop":
        performer.pause();
        performer.reset();
        break;
      case "reset":
        performer.reset();
        break;
      case "step_forward":
        performer.nextStep();
        break;
      case "step_back":
        performer.prevStep();
        break;
      case "goto":
        if (stepIndex !== undefined) {
          performer.goToStep(stepIndex);
        }
        break;
    }

    if (speed !== undefined) {
      pm?.setSpeed(speed);
    }

    return {
      success: true,
      state: this.getPlaybackStateInternal(),
    };
  }

  private getPlaybackState(): PlaybackState {
    return this.getPlaybackStateInternal();
  }

  private getPlaybackStateInternal(): PlaybackState {
    const pm = this.bindings.playback.getPerformerManager();
    const performer = pm?.performers[pm?.activeIndex ?? 0];

    return {
      isPlaying: performer?.isPlaying ?? false,
      currentStep: performer?.currentStepIndex ?? 0,
      totalSteps: performer?.totalSteps ?? 0,
      speed: this.bindings.playback.getSpeed(),
      loop: performer?.loop ?? false,
      sequenceName:
        performer?.loadedSequence?.word ??
        performer?.loadedSequence?.name ??
        null,
    };
  }

  // --------------------------------------------------------------------------
  // EVENT SUBSCRIPTION & EMISSION
  // --------------------------------------------------------------------------

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  emit(event: GameEventType, data: GameEvent): void {
    this.sendEvent(event, data);
  }

  /**
   * Called by the game loop to emit state change events.
   * Track state changes and emit events when they occur.
   */
  tick(): void {
    if (!this.isConnected()) return;

    // Check grounded state change
    const grounded = this.bindings.physics.isGrounded();
    if (grounded !== this.lastGroundedState) {
      this.lastGroundedState = grounded;
      this.emit("grounded_changed", {
        type: "grounded_changed",
        grounded,
      });
    }

    // Emit position updates (throttled - only when moved significantly)
    const pos = this.bindings.physics.getPlayerPosition();
    if (pos) {
      const dx = pos.x - this.lastPosition.x;
      const dy = pos.y - this.lastPosition.y;
      const dz = pos.z - this.lastPosition.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > 0.01) {
        // Moved more than 10cm
        this.lastPosition = { ...pos };
        this.emit("position_update", {
          type: "position_update",
          position: pos,
          velocity: this.bindings.physics.getPlayerVelocity(),
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[GameBridge]", ...args);
    }
  }

  updateBindings(bindings: Partial<GameBridgeBindings>): void {
    if (bindings.physics) {
      this.bindings.physics = { ...this.bindings.physics, ...bindings.physics };
    }
    if (bindings.camera) {
      this.bindings.camera = { ...this.bindings.camera, ...bindings.camera };
    }
    if (bindings.playback) {
      this.bindings.playback = { ...this.bindings.playback, ...bindings.playback };
    }
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

let bridgeInstance: GameBridge | null = null;

/**
 * Whether the game bridge INSTANCE should be created.
 *
 * Two independent concerns, deliberately split:
 *
 *  1. ENABLED  (this fn)  — create the GameBridge and expose `window.__gameBridge`.
 *     This is all you need to drive the scene directly (chrome-devtools MCP /
 *     console calling `__gameBridge.teleport(...)`, `.raycast(...)`, etc.). It
 *     does NOT open any socket, so it makes zero console noise.
 *  2. CONNECT  (shouldConnectGameBridge) — additionally open the WebSocket to
 *     the MCP game controller server. ONLY opt into this when that controller
 *     is actually running, otherwise the absent server produces the
 *     connection-refused / reconnect spam this split exists to prevent.
 *
 * Off by default. Opt in via any of:
 *
 *   - localStorage: tka:game-bridge = "1"       → enabled, no socket (quiet)
 *   - localStorage: tka:game-bridge = "connect" → enabled AND connect to WS
 *   - Vite env:     VITE_GAME_BRIDGE=1 | connect
 *   - window flag:  window.__enableGameBridge / window.__connectGameBridge
 *
 * From the browser console:  localStorage["tka:game-bridge"] = "1"  then reload
 * for direct driving (no WS). Use "connect" only with the controller running.
 */
function readBridgeFlag(): string | null {
  const envFlag = import.meta.env?.VITE_GAME_BRIDGE;
  if (typeof envFlag === "string" && envFlag !== "") return envFlag;
  if (typeof window !== "undefined") {
    try {
      return window.localStorage?.getItem("tka:game-bridge") ?? null;
    } catch {
      // localStorage can throw in sandboxed/private contexts — treat as unset
    }
  }
  return null;
}

export function isGameBridgeEnabled(): boolean {
  const flag = readBridgeFlag();
  if (flag === "1" || flag === "true" || flag === "connect") return true;
  if (typeof window !== "undefined") {
    const w = window as unknown as { __enableGameBridge?: boolean; __connectGameBridge?: boolean };
    if (w.__enableGameBridge || w.__connectGameBridge) return true;
  }
  return false;
}

/**
 * Whether to additionally open the WebSocket to the MCP game controller.
 * Strictly narrower than isGameBridgeEnabled — connecting implies enabled.
 */
export function shouldConnectGameBridge(): boolean {
  if (readBridgeFlag() === "connect") return true;
  if (typeof window !== "undefined") {
    if ((window as unknown as { __connectGameBridge?: boolean }).__connectGameBridge) return true;
  }
  return false;
}

/**
 * Get WebSocket URL from environment or default
 */
function getWsUrl(): string {
  // Check for Vite env variable
  if (import.meta?.env?.VITE_GAME_BRIDGE_URL) {
    return import.meta.env.VITE_GAME_BRIDGE_URL;
  }
  // Default to localhost
  return "ws://localhost:9876";
}

/**
 * Get auth token from environment
 */
function getAuthToken(): string {
  if (import.meta?.env?.VITE_GAME_BRIDGE_TOKEN) {
    return import.meta.env.VITE_GAME_BRIDGE_TOKEN;
  }
  return "";
}

/**
 * Initialize the game bridge with bindings.
 * Call this when the 3D scene is ready.
 */
export function initGameBridge(
  bindings: GameBridgeBindings,
  config?: Partial<GameBridgeConfig>
): GameBridge {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
  }

  const fullConfig: Partial<GameBridgeConfig> = {
    wsUrl: getWsUrl(),
    authToken: getAuthToken(),
    debug: import.meta.env?.DEV ?? false,
    ...config,
  };

  bridgeInstance = new GameBridge(bindings, fullConfig);

  // Expose on window for debugging
  if (typeof window !== "undefined") {
    (window as unknown as { __gameBridge: GameBridge }).__gameBridge = bridgeInstance;
  }

  return bridgeInstance;
}

/**
 * Get the current game bridge instance
 */
export function getGameBridge(): GameBridge | null {
  return bridgeInstance;
}

/**
 * Destroy the game bridge and clean up
 */
export function destroyGameBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
    bridgeInstance = null;
    if (typeof window !== "undefined") {
      delete (window as unknown as { __gameBridge?: GameBridge }).__gameBridge;
    }
  }
}

// Re-export types for convenience
export type { GameBridgeBindings, GameBridgeConfig } from "./game-bridge-types";
