/**
 * Player Physics Controller
 *
 * Uses Rapier's KinematicCharacterController for smooth, physics-based movement.
 * Handles ground detection, slope climbing, stepping, and collision response.
 */

import type RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorldState } from "./rapier-world";

// ============================================================================
// TYPES
// ============================================================================

export interface PlayerControllerConfig {
  /** Capsule radius */
  radius: number;
  /** Capsule half-height (total height = 2 * halfHeight + 2 * radius) */
  halfHeight: number;
  /** Starting position */
  position: { x: number; y: number; z: number };
  /** Character controller offset (skin width) */
  offset: number;
  /** Maximum slope angle player can climb (radians) */
  maxSlopeClimbAngle: number;
  /** Minimum slope angle that causes sliding (radians) */
  minSlopeSlideAngle: number;
  /** Auto-step max height */
  autoStepMaxHeight: number;
  /** Auto-step min width */
  autoStepMinWidth: number;
  /** Snap to ground distance */
  snapToGroundDistance: number;
}

export interface PlayerControllerState {
  rigidBody: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;
  controller: RAPIER.KinematicCharacterController | null;
  isGrounded: boolean;
  groundNormal: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_PLAYER_CONFIG: PlayerControllerConfig = {
  radius: 0.3,
  halfHeight: 0.55, // Total height ~1.7m (0.55*2 + 0.3*2)
  position: { x: 0, y: 50, z: 0 }, // Start high, will fall to ground
  offset: 0.02, // Small skin width
  maxSlopeClimbAngle: Math.PI / 4, // 45 degrees
  minSlopeSlideAngle: Math.PI / 4, // 45 degrees
  autoStepMaxHeight: 0.4, // Can step up 40cm (stairs)
  autoStepMinWidth: 0.2, // Minimum width to auto-step
  snapToGroundDistance: 0.3, // Snap when within 30cm of ground
};

// ============================================================================
// PLAYER CONTROLLER
// ============================================================================

/**
 * Create the player physics controller
 */
export function createPlayerController(
  physicsState: PhysicsWorldState,
  config: Partial<PlayerControllerConfig> = {}
): PlayerControllerState {
  const cfg = { ...DEFAULT_PLAYER_CONFIG, ...config };

  const state: PlayerControllerState = {
    rigidBody: null,
    collider: null,
    controller: null,
    isGrounded: false,
    groundNormal: { x: 0, y: 1, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  };

  if (!physicsState.rapier || !physicsState.world) {
    console.warn("[PlayerController] Physics not initialized");
    return state;
  }

  const RAPIER = physicsState.rapier;
  const world = physicsState.world;

  // Create kinematic rigid body for the player
  const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(cfg.position.x, cfg.position.y, cfg.position.z);

  state.rigidBody = world.createRigidBody(rigidBodyDesc);

  // Create capsule collider
  const colliderDesc = RAPIER.ColliderDesc.capsule(cfg.halfHeight, cfg.radius)
    .setFriction(0.0) // Character controller handles friction
    .setRestitution(0.0);

  state.collider = world.createCollider(colliderDesc, state.rigidBody);

  // Create the character controller
  state.controller = world.createCharacterController(cfg.offset);

  // Configure the controller
  state.controller.setSlideEnabled(true);
  state.controller.setMaxSlopeClimbAngle(cfg.maxSlopeClimbAngle);
  state.controller.setMinSlopeSlideAngle(cfg.minSlopeSlideAngle);
  state.controller.enableAutostep(
    cfg.autoStepMaxHeight,
    cfg.autoStepMinWidth,
    true // Include dynamic bodies
  );
  state.controller.enableSnapToGround(cfg.snapToGroundDistance);
  state.controller.setApplyImpulsesToDynamicBodies(true);

  return state;
}

/**
 * Move the player using the character controller
 */
export function movePlayer(
  physicsState: PhysicsWorldState,
  playerState: PlayerControllerState,
  desiredMovement: { x: number; y: number; z: number },
  deltaTime: number
): void {
  if (!physicsState.world || !playerState.controller || !playerState.collider || !playerState.rigidBody) {
    return;
  }

  // Compute the movement with collision detection
  playerState.controller.computeColliderMovement(
    playerState.collider,
    { x: desiredMovement.x, y: desiredMovement.y, z: desiredMovement.z },
    undefined, // Filter flags
    undefined  // Filter groups
  );

  // Get the corrected movement (after collision response)
  const correctedMovement = playerState.controller.computedMovement();

  // Get current position
  const currentPos = playerState.rigidBody.translation();

  // Apply the movement
  playerState.rigidBody.setNextKinematicTranslation({
    x: currentPos.x + correctedMovement.x,
    y: currentPos.y + correctedMovement.y,
    z: currentPos.z + correctedMovement.z,
  });

  // Check if grounded
  playerState.isGrounded = playerState.controller.computedGrounded();

  // Get ground normal if grounded
  // Note: Rapier doesn't directly expose ground normal, so we estimate
  if (playerState.isGrounded) {
    // Simple approximation - assume flat ground
    // For slopes, we'd need to raycast down
    playerState.groundNormal = { x: 0, y: 1, z: 0 };
  }

  // Store velocity for next frame calculations
  if (deltaTime > 0) {
    playerState.velocity = {
      x: correctedMovement.x / deltaTime,
      y: correctedMovement.y / deltaTime,
      z: correctedMovement.z / deltaTime,
    };
  }
}

/**
 * Get the player's current position
 */
export function getPlayerPosition(
  playerState: PlayerControllerState
): { x: number; y: number; z: number } | null {
  if (!playerState.rigidBody) return null;

  const pos = playerState.rigidBody.translation();
  return { x: pos.x, y: pos.y, z: pos.z };
}

/**
 * Teleport the player to a new position
 */
export function teleportPlayer(
  playerState: PlayerControllerState,
  position: { x: number; y: number; z: number }
): void {
  if (!playerState.rigidBody) return;

  playerState.rigidBody.setTranslation(position, true);
  playerState.velocity = { x: 0, y: 0, z: 0 };
}

/**
 * Dispose the player controller
 */
export function disposePlayerController(
  physicsState: PhysicsWorldState,
  playerState: PlayerControllerState
): void {
  if (physicsState.world) {
    if (playerState.controller) {
      physicsState.world.removeCharacterController(playerState.controller);
    }
    if (playerState.rigidBody) {
      physicsState.world.removeRigidBody(playerState.rigidBody);
    }
  }

  playerState.rigidBody = null;
  playerState.collider = null;
  playerState.controller = null;
}
