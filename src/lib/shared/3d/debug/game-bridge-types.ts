/**
 * Game Bridge Types
 *
 * Type definitions for the MCP Game Controller bridge.
 * Shared between client and server.
 */

// ============================================================================
// PRIMITIVES
// ============================================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  yaw: number;   // Y-axis rotation (radians)
  pitch: number; // X-axis rotation (radians)
}

// ============================================================================
// GAME STATE
// ============================================================================

export interface GameState {
  position: Vector3;
  rotation: Rotation;
  velocity: Vector3;
  grounded: boolean;
  cameraMode: string;
  isPlaying: boolean;
  hasSequence: boolean;
  timestamp: number;
}

export interface SceneObject {
  id: string;
  type: "performer" | "prop" | "trigger" | "landmark";
  position: Vector3;
  distance: number;
  metadata?: Record<string, unknown>;
}

export interface SceneInfo {
  terrain: {
    type: string;
    height: number;
  };
  objects: SceneObject[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface RaycastResult {
  hit: boolean;
  point?: Vector3;
  normal?: Vector3;
  distance?: number;
  objectId?: string;
  objectType?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  speed: number;
  loop: boolean;
  sequenceName: string | null;
}

// ============================================================================
// PERFORMER
// ============================================================================

/**
 * Minimal performer interface for what game-bridge needs.
 * The actual AvatarInstanceState has more properties, but we only access these.
 */
export interface PerformerLike {
  position: { x: number; y: number; z: number };
  isPlaying: boolean;
  hasSequence: boolean;
  currentStepIndex: number;
  totalSteps: number;
  loop: boolean;
  loadedSequence?: { word?: string; name?: string } | null;
  // Playback controls
  play: () => void;
  pause: () => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

/**
 * Minimal performer manager interface.
 * The actual PerformerManager from performer-manager.svelte.ts has more,
 * but game-bridge only needs these fields.
 */
export interface PerformerManager {
  performers: PerformerLike[];
  activeIndex: number;
  selectPerformer: (index: number) => void;
  setSpeed: (speed: number) => void;
}

// ============================================================================
// BRIDGE PROTOCOL
// ============================================================================

export interface BridgeRequest {
  type: "request";
  id: string;
  method: string;
  params?: Record<string, unknown>;
  auth?: string; // Auth token
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

export interface BridgeAuth {
  type: "auth";
  token: string;
}

export type BridgeMessage = BridgeRequest | BridgeResponse | BridgeEvent | BridgeAuth;

// ============================================================================
// EVENTS
// ============================================================================

export type GameEventType =
  | "collision"
  | "grounded_changed"
  | "zone_enter"
  | "zone_exit"
  | "position_update"
  | "playback_state_changed"
  | "performer_changed";

export interface CollisionEvent {
  type: "collision";
  objectId: string;
  objectType: string;
  point: Vector3;
  normal: Vector3;
  impulse: number;
}

export interface GroundedEvent {
  type: "grounded_changed";
  grounded: boolean;
  groundNormal?: Vector3;
}

export interface ZoneEvent {
  type: "zone_enter" | "zone_exit";
  zoneId: string;
  zoneName: string;
  position: Vector3;
}

export interface PositionUpdateEvent {
  type: "position_update";
  position: Vector3;
  velocity: Vector3;
}

export interface PlaybackStateChangedEvent {
  type: "playback_state_changed";
  state: PlaybackState;
}

export interface PerformerChangedEvent {
  type: "performer_changed";
  performerIndex: number;
  performer: PerformerLike;
}

export type GameEvent =
  | CollisionEvent
  | GroundedEvent
  | ZoneEvent
  | PositionUpdateEvent
  | PlaybackStateChangedEvent
  | PerformerChangedEvent;

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface GameBridgeConfig {
  /** WebSocket URL (default: from env or ws://localhost:9876) */
  wsUrl?: string;
  /** Auth token for secure connections */
  authToken?: string;
  /** Enable auto-reconnect (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Reconnect backoff multiplier (default: 1.5) */
  reconnectBackoff?: number;
  /** Maximum reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
  /** Connection timeout in ms (default: 5000) */
  connectionTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export const DEFAULT_BRIDGE_CONFIG: Required<GameBridgeConfig> = {
  wsUrl: "ws://localhost:9876",
  authToken: "",
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectBackoff: 1.5,
  // Capped so an absent dev MCP server (the common case) stops retrying after
  // ~5 backed-off attempts instead of spamming "Scheduling reconnect" forever.
  maxReconnectAttempts: 5,
  connectionTimeout: 5000,
  debug: false,
};

// ============================================================================
// BINDINGS INTERFACE
// ============================================================================

export interface PhysicsBindings {
  getPlayerPosition: () => Vector3 | null;
  getPlayerVelocity: () => Vector3;
  isGrounded: () => boolean;
  movePlayer: (movement: Vector3, deltaTime: number) => void;
  teleportPlayer: (position: Vector3) => void;
  raycast: (
    origin: Vector3,
    direction: Vector3,
    maxDistance: number
  ) => RaycastResult;
}

export interface CameraBindings {
  getMode: () => string;
  setMode: (mode: string) => void;
  getYaw: () => number;
  getPitch: () => number;
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
}

export interface PlaybackBindings {
  getPerformerManager: () => PerformerManager | null;
  getSpeed: () => number;
  setSpeed: (speed: number) => void;
}

export interface GameBridgeBindings {
  physics: PhysicsBindings;
  camera: CameraBindings;
  playback: PlaybackBindings;
}
