/**
 * Game Bridge Context
 *
 * Svelte context for sharing the game bridge across 3D components.
 * Provides a unified way to initialize and access the bridge from
 * any 3D destination (Stage, Gallery, Infinite Worlds, etc.)
 */

import { getContext, setContext, onDestroy } from "svelte";
import type {
  GameBridgeBindings,
  GameBridgeConfig,
  PhysicsBindings,
  CameraBindings,
  PlaybackBindings,
  Vector3,
  RaycastResult,
  PerformerManager,
} from "./game-bridge-types";
import { GameBridge, initGameBridge, destroyGameBridge, getGameBridge } from "./game-bridge";
import type { PhysicsProvider } from "../camera/types";
import type { PhysicsWorldState, PlayerControllerState } from "../physics/types";
import { castRay } from "../physics/rapier-world";
import {
  movePlayer,
  getPlayerPosition,
  getPlayerVelocity,
  isPlayerGrounded,
  teleportPlayer,
} from "../physics/player-controller";

const GAME_BRIDGE_KEY = Symbol("game-bridge");

// ============================================================================
// TYPES
// ============================================================================

export interface GameBridgeContext {
  bridge: GameBridge | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export interface GameBridgeInitOptions {
  /** Configuration overrides */
  config?: Partial<GameBridgeConfig>;

  // Physics bindings
  physicsState: PhysicsWorldState | null;
  playerController: PlayerControllerState | null;
  /** Optional: Use existing PhysicsProvider instead of raw state */
  physicsProvider?: PhysicsProvider | null;

  // Camera bindings
  getCameraMode: () => string;
  setCameraMode: (mode: string) => void;
  getYaw: () => number;
  getPitch: () => number;
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;

  // Playback bindings
  getPerformerManager: () => PerformerManager | null;
  getSpeed: () => number;
  setSpeed: (speed: number) => void;
}

// ============================================================================
// CONTEXT SETUP
// ============================================================================

/**
 * Create game bridge bindings from the initialization options.
 * Handles both raw physics state and PhysicsProvider patterns.
 */
function createBindings(options: GameBridgeInitOptions): GameBridgeBindings {
  const {
    physicsState,
    playerController,
    physicsProvider,
    getCameraMode,
    setCameraMode,
    getYaw,
    getPitch,
    setYaw,
    setPitch,
    getPerformerManager,
    getSpeed,
    setSpeed,
  } = options;

  // Physics bindings - prefer PhysicsProvider if available
  const physics: PhysicsBindings = physicsProvider
    ? {
        getPlayerPosition: () => physicsProvider.getPlayerPosition(),
        getPlayerVelocity: () => physicsProvider.getVelocity(),
        isGrounded: () => physicsProvider.isGrounded(),
        movePlayer: (movement: Vector3, deltaTime: number) => {
          physicsProvider.movePlayer(movement, deltaTime);
        },
        teleportPlayer: (position: Vector3) => {
          physicsProvider.teleport?.(position);
        },
        raycast: (origin: Vector3, direction: Vector3, maxDistance: number): RaycastResult => {
          if (!physicsState) return { hit: false };
          const result = castRay(physicsState, origin, direction, maxDistance);
          if (result) {
            return {
              hit: true,
              point: result.point,
              normal: result.normal,
              distance: result.distance,
            };
          }
          return { hit: false };
        },
      }
    : {
        getPlayerPosition: () => {
          if (!playerController) return null;
          return getPlayerPosition(playerController);
        },
        getPlayerVelocity: () => {
          if (!playerController) return { x: 0, y: 0, z: 0 };
          return getPlayerVelocity(playerController);
        },
        isGrounded: () => {
          if (!playerController) return false;
          return isPlayerGrounded(playerController);
        },
        movePlayer: (movement: Vector3, deltaTime: number) => {
          if (!physicsState || !playerController) return;
          movePlayer(physicsState, playerController, movement, deltaTime);
        },
        teleportPlayer: (position: Vector3) => {
          if (!playerController) return;
          teleportPlayer(playerController, position);
        },
        raycast: (origin: Vector3, direction: Vector3, maxDistance: number): RaycastResult => {
          if (!physicsState) return { hit: false };
          const result = castRay(physicsState, origin, direction, maxDistance);
          if (result) {
            return {
              hit: true,
              point: result.point,
              normal: result.normal,
              distance: result.distance,
            };
          }
          return { hit: false };
        },
      };

  // Camera bindings
  const camera: CameraBindings = {
    getMode: getCameraMode,
    setMode: setCameraMode,
    getYaw,
    getPitch,
    setYaw,
    setPitch,
  };

  // Playback bindings
  const playback: PlaybackBindings = {
    getPerformerManager,
    getSpeed,
    setSpeed,
  };

  return { physics, camera, playback };
}

/**
 * Initialize the game bridge context in a component.
 * Call this in your 3D scene's root component.
 *
 * @example
 * ```svelte
 * <script>
 *   import { initGameBridgeContext } from "$lib/shared/3d-core/debug/game-bridge-context.svelte";
 *
 *   const bridgeCtx = initGameBridgeContext({
 *     physicsState,
 *     playerController,
 *     getCameraMode: () => cameraMode,
 *     setCameraMode: (m) => cameraMode = m,
 *     getYaw: () => yaw,
 *     getPitch: () => pitch,
 *     setYaw: (y) => yaw = y,
 *     setPitch: (p) => pitch = p,
 *     getPerformerManager: () => performerManager,
 *     getSpeed: () => speed,
 *     setSpeed: (s) => speed = s,
 *   });
 *
 *   // Auto-connect in dev mode
 *   $effect(() => {
 *     if (import.meta.env.DEV) {
 *       bridgeCtx.connect();
 *     }
 *   });
 * </script>
 * ```
 */
export function initGameBridgeContext(
  options: GameBridgeInitOptions
): GameBridgeContext {
  let bridge: GameBridge | null = null;
  let isConnected = $state(false);

  const bindings = createBindings(options);

  async function connect(): Promise<void> {
    if (!import.meta.env.DEV) {
      console.log("[GameBridge] Skipping connection in production");
      return;
    }

    try {
      bridge = initGameBridge(bindings, options.config);
      await bridge.connect();
      isConnected = true;
      console.log("[GameBridge] Connected successfully");
    } catch (err) {
      console.log("[GameBridge] Connection failed (MCP server may not be running):", err);
      isConnected = false;
    }
  }

  function disconnect(): void {
    if (bridge) {
      destroyGameBridge();
      bridge = null;
      isConnected = false;
    }
  }

  // Create context value
  const ctx: GameBridgeContext = {
    get bridge() {
      return bridge;
    },
    get isConnected() {
      return isConnected;
    },
    connect,
    disconnect,
  };

  // Store in Svelte context
  setContext(GAME_BRIDGE_KEY, ctx);

  // Cleanup on destroy
  onDestroy(() => {
    disconnect();
  });

  return ctx;
}

/**
 * Get the game bridge context from a child component.
 * Returns null if no context is available.
 */
export function getGameBridgeContext(): GameBridgeContext | null {
  return getContext<GameBridgeContext>(GAME_BRIDGE_KEY) ?? null;
}

/**
 * Update the bindings for an existing game bridge.
 * Use this when physics state changes after initial setup.
 */
export function updateGameBridgeBindings(
  options: Partial<GameBridgeInitOptions>
): void {
  const bridge = getGameBridge();
  if (!bridge) return;

  // Build partial bindings from options
  const partialBindings: Partial<GameBridgeBindings> = {};

  if (options.physicsState || options.playerController || options.physicsProvider) {
    // Rebuild physics bindings
    const fullOptions = {
      physicsState: options.physicsState ?? null,
      playerController: options.playerController ?? null,
      physicsProvider: options.physicsProvider ?? null,
      getCameraMode: options.getCameraMode ?? (() => "orbit"),
      setCameraMode: options.setCameraMode ?? (() => {}),
      getYaw: options.getYaw ?? (() => 0),
      getPitch: options.getPitch ?? (() => 0),
      setYaw: options.setYaw ?? (() => {}),
      setPitch: options.setPitch ?? (() => {}),
      getPerformerManager: options.getPerformerManager ?? (() => null),
      getSpeed: options.getSpeed ?? (() => 1),
      setSpeed: options.setSpeed ?? (() => {}),
    };
    const bindings = createBindings(fullOptions);
    partialBindings.physics = bindings.physics;
  }

  if (options.getCameraMode || options.setCameraMode || options.getYaw || options.getPitch || options.setYaw || options.setPitch) {
    partialBindings.camera = {
      getMode: options.getCameraMode ?? (() => "orbit"),
      setMode: options.setCameraMode ?? (() => {}),
      getYaw: options.getYaw ?? (() => 0),
      getPitch: options.getPitch ?? (() => 0),
      setYaw: options.setYaw ?? (() => {}),
      setPitch: options.setPitch ?? (() => {}),
    };
  }

  if (options.getPerformerManager || options.getSpeed || options.setSpeed) {
    partialBindings.playback = {
      getPerformerManager: options.getPerformerManager ?? (() => null),
      getSpeed: options.getSpeed ?? (() => 1),
      setSpeed: options.setSpeed ?? (() => {}),
    };
  }

  bridge.updateBindings(partialBindings);
}
