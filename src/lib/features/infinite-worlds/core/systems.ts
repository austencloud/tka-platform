/**
 * ECS Systems
 *
 * Systems are functions that operate on entities with specific components.
 * They run every frame in a defined order.
 *
 * Order:
 * 1. Input System - Read player input
 * 2. Physics System - Step simulation
 * 3. Movement System - Apply player movement
 * 4. Sync System - Sync ECS ↔ Physics ↔ Three.js
 * 5. Render System - Update meshes and camera
 */

import {
  world,
  withTransform,
  withPhysics,
  withMesh,
  localPlayer,
  dynamicBodies,
  withLOD,
  type Entity,
  type InputComponent,
} from "./ecs-world";
import type { PhysicsWorldState } from "../physics/rapier-world";
import { syncPhysicsToECS, syncECSToPhysics, checkGrounded } from "../physics/rapier-world";
import {
  type PlayerControllerState,
  movePlayer,
  getPlayerPosition,
} from "../physics/player-controller";
import type { PerspectiveCamera, Scene, Object3D } from "three";
import { Vector3, Quaternion, Euler } from "three";
import { CameraMode } from "$lib/shared/3d-core/camera/types";
import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";
import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
import { AdaptiveInputProvider } from "$lib/shared/3d/input/InputProviderFactory";

// ============================================================================
// SYSTEM CONTEXT
// ============================================================================

/**
 * Shared context passed to all systems
 */
export interface SystemContext {
  deltaTime: number;
  time: number;
  physics: PhysicsWorldState;
  camera: PerspectiveCamera;
  scene: Scene;
  playerController: PlayerControllerState | null;
}

// ============================================================================
// INPUT SYSTEM
// ============================================================================

/**
 * Unified input provider (adapts to keyboard, touch, gamepad)
 */
let inputProvider: AdaptiveInputProvider | null = null;
let inputCapabilities = getInputCapabilities();

/**
 * Keyboard state for V key toggle (still needed for camera mode)
 */
const keyState: Record<string, boolean> = {};

/**
 * Whether touch UI should be shown
 */
let showTouchUI = false;

/**
 * External joystick input (from VirtualJoystick component)
 */
let joystickInput = { x: 0, z: 0 };

/**
 * Initialize input listeners using unified input provider
 * Works on desktop (pointer lock + keyboard) AND mobile/DevTools (touch/drag)
 */
export function initInputSystem(canvas: HTMLCanvasElement): () => void {
  // Initialize InputCapabilities for proper touch/mouse detection
  inputCapabilities.init();

  // Create unified input provider that adapts to input type
  inputProvider = new AdaptiveInputProvider(inputCapabilities, canvas, {
    lookSensitivity: 0.002,
    movementDeadzone: 0.15,
    inertiaDecay: 0.92,
  });
  inputProvider.enable();

  // V key still handled directly for camera mode toggle
  const handleKeyDown = (e: KeyboardEvent) => {
    keyState[e.code] = true;

    // V key toggles camera mode
    if (e.key.toLowerCase() === "v") {
      for (const entity of localPlayer.entities) {
        if (entity.camera) {
          // Toggle mode
          entity.camera.mode = entity.camera.mode === CameraMode.FIRST_PERSON
            ? CameraMode.THIRD_PERSON
            : CameraMode.FIRST_PERSON;

          // Save preference
          cameraPreferences.setModeForDestination("worlds", entity.camera.mode);
        }
      }
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keyState[e.code] = false;
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // Return cleanup function
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    inputProvider?.dispose();
    inputProvider = null;
    inputCapabilities.destroy();
  };
}

/**
 * Update input component from unified input provider
 */
export function inputSystem(ctx: SystemContext): void {
  if (!inputProvider) return;

  // Update input provider (handles inertia, etc.)
  inputProvider.update(ctx.deltaTime);

  // Update touch UI visibility
  showTouchUI = inputCapabilities.shouldShowTouchUI();

  // Get movement input - use joystick on touch, otherwise use keyboard/gamepad
  const providerMovement = inputProvider.getMovementInput();
  const movement = showTouchUI && (joystickInput.x !== 0 || joystickInput.z !== 0)
    ? { forward: joystickInput.z, strafe: joystickInput.x }
    : providerMovement;

  for (const entity of localPlayer.entities) {
    if (!entity.input) continue;

    // Map normalized input to discrete directions
    // Movement is already normalized (-1 to 1)
    entity.input.moveForward = movement.forward > 0.3;
    entity.input.moveBackward = movement.forward < -0.3;
    entity.input.moveRight = movement.strafe > 0.3;
    entity.input.moveLeft = movement.strafe < -0.3;
    entity.input.jump = inputProvider.isJumpPressed();
    entity.input.sprint = inputProvider.isSprintHeld();
    entity.input.crouch = keyState["ControlLeft"] || keyState["ControlRight"] || false;
    entity.input.interact = keyState["KeyE"] || false;
  }
}

/**
 * Get look delta from unified input provider
 */
export function consumeMouseDelta(): { x: number; y: number } {
  if (!inputProvider) return { x: 0, y: 0 };
  const lookDelta = inputProvider.getLookDelta();
  // Convert to expected format (yaw/pitch -> x/y in pixels-like units)
  return { x: lookDelta.yaw / 0.002, y: lookDelta.pitch / 0.002 };
}

export function getPointerLocked(): boolean {
  if (!inputProvider) return false;
  return inputProvider.getPointerLockProvider().isPointerLocked();
}

/**
 * Check if touch UI should be shown
 */
export function getShouldShowTouchUI(): boolean {
  return showTouchUI;
}

/**
 * Get the input provider for external use (e.g., touch joystick integration)
 */
export function getInputProvider(): AdaptiveInputProvider | null {
  return inputProvider;
}

/**
 * Set joystick input from VirtualJoystick component
 * @param x Horizontal input (-1 to 1, positive = right)
 * @param z Vertical input (-1 to 1, positive = forward)
 */
export function setJoystickInput(x: number, z: number): void {
  joystickInput = { x, z };
}

// ============================================================================
// CAMERA SYSTEM
// ============================================================================

const MOUSE_SENSITIVITY = 0.002;

/**
 * Update camera rotation from input (pointer lock, touch, or gamepad)
 */
export function cameraSystem(ctx: SystemContext): void {
  if (!inputProvider) return;

  // Get look delta from unified input provider
  const lookDelta = inputProvider.getLookDelta();

  for (const entity of localPlayer.entities) {
    if (!entity.camera) continue;

    // Update rotation (same for both modes)
    // Look delta is already in radians
    entity.camera.yaw -= lookDelta.yaw;
    entity.camera.pitch -= lookDelta.pitch;

    // Clamp pitch to prevent flipping
    entity.camera.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, entity.camera.pitch)
    );

    // Apply camera position/rotation based on mode
    if (entity.camera.mode === CameraMode.FIRST_PERSON) {
      // First-person: camera at player position
      const euler = new Euler(entity.camera.pitch, entity.camera.yaw, 0, "YXZ");
      ctx.camera.quaternion.setFromEuler(euler);
      // Position synced in renderSyncSystem
    } else {
      // Third-person: orbit behind player
      if (ctx.playerController) {
        const playerPos = getPlayerPosition(ctx.playerController);
        if (playerPos) {
          const distance = entity.camera.targetDistance;
          const height = entity.camera.targetHeight;

          const offsetX = -Math.sin(entity.camera.yaw) * distance;
          const offsetZ = -Math.cos(entity.camera.yaw) * distance;

          ctx.camera.position.set(
            playerPos.x + offsetX,
            playerPos.y + height,
            playerPos.z + offsetZ
          );

          // Look at player
          ctx.camera.lookAt(
            playerPos.x,
            playerPos.y + 1.7, // Eye height
            playerPos.z
          );
        }
      }
    }
  }
}

// ============================================================================
// MOVEMENT SYSTEM
// ============================================================================

const MOVE_SPEED = 5;
const SPRINT_MULTIPLIER = 2;
const CROUCH_MULTIPLIER = 0.5;
const JUMP_FORCE = 8;
const GRAVITY = 25;
const PLAYER_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.0;

// Temporary vectors (reuse to avoid GC)
const moveDir = new Vector3();
const forward = new Vector3();
const right = new Vector3();

// Persistent vertical velocity for gravity/jumping
let verticalVelocity = 0;

/**
 * Apply player movement using Rapier character controller
 */
export function movementSystem(ctx: SystemContext): void {
  const pc = ctx.playerController;

  // Use physics-based movement if player controller is available
  if (pc && pc.controller && pc.rigidBody) {
    movementSystemPhysics(ctx);
    return;
  }

  // Fallback to non-physics movement (shouldn't happen in normal use)
  movementSystemFallback(ctx);
}

/**
 * Physics-based movement using Rapier character controller
 */
function movementSystemPhysics(ctx: SystemContext): void {
  const pc = ctx.playerController!;

  for (const entity of localPlayer.entities) {
    if (!entity.input || !entity.camera) continue;

    const input = entity.input;

    // Calculate movement direction from camera yaw
    const yaw = entity.camera.yaw;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    // Build movement vector from input
    moveDir.set(0, 0, 0);
    if (input.moveForward) moveDir.add(forward);
    if (input.moveBackward) moveDir.sub(forward);
    if (input.moveRight) moveDir.add(right);
    if (input.moveLeft) moveDir.sub(right);

    // Apply speed modifiers
    let speed = MOVE_SPEED;
    if (input.sprint && !input.crouch) speed *= SPRINT_MULTIPLIER;
    if (input.crouch) speed *= CROUCH_MULTIPLIER;

    // Normalize and scale by deltaTime
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(speed * ctx.deltaTime);
    }

    // Handle jumping
    if (input.jump && pc.isGrounded && verticalVelocity <= 0) {
      verticalVelocity = JUMP_FORCE;
    }

    // Apply gravity
    if (!pc.isGrounded) {
      verticalVelocity -= GRAVITY * ctx.deltaTime;
      verticalVelocity = Math.max(verticalVelocity, -50); // Terminal velocity
    } else if (verticalVelocity < 0) {
      verticalVelocity = 0;
    }

    // Compute desired movement (horizontal + vertical)
    const desiredMovement = {
      x: moveDir.x,
      y: verticalVelocity * ctx.deltaTime,
      z: moveDir.z,
    };

    // Move the player using character controller
    movePlayer(ctx.physics, pc, desiredMovement, ctx.deltaTime);

    // Update grounded state from controller
    if (entity.grounded) {
      entity.grounded.isGrounded = pc.isGrounded;
      entity.grounded.groundNormal[0] = pc.groundNormal.x;
      entity.grounded.groundNormal[1] = pc.groundNormal.y;
      entity.grounded.groundNormal[2] = pc.groundNormal.z;
    }

    // Sync ECS transform from physics
    const playerPos = getPlayerPosition(pc);
    if (playerPos && entity.transform) {
      entity.transform.position[0] = playerPos.x;
      entity.transform.position[1] = playerPos.y;
      entity.transform.position[2] = playerPos.z;
    }
  }
}

/**
 * Fallback movement without physics (for when physics isn't ready)
 */
function movementSystemFallback(ctx: SystemContext): void {
  for (const entity of localPlayer.entities) {
    if (!entity.input || !entity.transform || !entity.velocity || !entity.camera) continue;

    const input = entity.input;
    const transform = entity.transform;
    const velocity = entity.velocity;

    // Calculate movement direction from camera yaw
    const yaw = entity.camera.yaw;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    // Build movement vector from input
    moveDir.set(0, 0, 0);
    if (input.moveForward) moveDir.add(forward);
    if (input.moveBackward) moveDir.sub(forward);
    if (input.moveRight) moveDir.add(right);
    if (input.moveLeft) moveDir.sub(right);

    // Apply speed modifiers
    let speed = MOVE_SPEED;
    if (input.sprint && !input.crouch) speed *= SPRINT_MULTIPLIER;
    if (input.crouch) speed *= CROUCH_MULTIPLIER;

    // Normalize and scale
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(speed);
    }

    // Set horizontal velocity
    velocity.linear[0] = moveDir.x;
    velocity.linear[2] = moveDir.z;

    // Simple gravity (no ground detection)
    velocity.linear[1] = (velocity.linear[1] ?? 0) - GRAVITY * ctx.deltaTime;

    // Apply velocity to position
    transform.position[0] = (transform.position[0] ?? 0) + (velocity.linear[0] ?? 0) * ctx.deltaTime;
    transform.position[1] = (transform.position[1] ?? 0) + (velocity.linear[1] ?? 0) * ctx.deltaTime;
    transform.position[2] = (transform.position[2] ?? 0) + (velocity.linear[2] ?? 0) * ctx.deltaTime;
  }
}

// ============================================================================
// PHYSICS SYSTEM
// ============================================================================

/**
 * Step physics simulation and sync with ECS
 */
export function physicsSystem(ctx: SystemContext): void {
  if (!ctx.physics.isInitialized || !ctx.physics.world) return;

  // Sync kinematic bodies from ECS to physics
  syncECSToPhysics();

  // Step simulation
  ctx.physics.world.timestep = ctx.deltaTime;
  ctx.physics.world.step();

  // Sync physics results back to ECS
  syncPhysicsToECS();
}

// ============================================================================
// RENDER SYNC SYSTEM
// ============================================================================

const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempScale = new Vector3();

/**
 * Sync ECS transforms to Three.js objects
 */
export function renderSyncSystem(ctx: SystemContext): void {
  // Sync meshes
  for (const entity of withMesh.entities) {
    if (!entity.mesh || !entity.transform) continue;

    const transform = entity.transform;
    const obj = entity.mesh.object3D;

    // Update position
    obj.position.set(
      transform.position[0] ?? 0,
      transform.position[1] ?? 0,
      transform.position[2] ?? 0
    );

    // Update rotation
    obj.quaternion.set(
      transform.rotation[0] ?? 0,
      transform.rotation[1] ?? 0,
      transform.rotation[2] ?? 0,
      transform.rotation[3] ?? 1
    );

    // Update scale
    obj.scale.set(
      transform.scale[0] ?? 1,
      transform.scale[1] ?? 1,
      transform.scale[2] ?? 1
    );

    // Update visibility
    obj.visible = entity.mesh.visible;
  }

  // Sync camera position from local player (ONLY in first-person mode)
  // In third-person, cameraSystem handles camera position
  for (const entity of localPlayer.entities) {
    if (!entity.transform || !entity.camera) continue;

    // Only sync camera position in first-person mode
    if (entity.camera.mode === CameraMode.FIRST_PERSON) {
      ctx.camera.position.set(
        entity.transform.position[0] ?? 0,
        entity.transform.position[1] ?? 0,
        entity.transform.position[2] ?? 0
      );
    }
  }
}

// ============================================================================
// LOD SYSTEM
// ============================================================================

/**
 * Update LOD levels based on camera distance
 */
export function lodSystem(ctx: SystemContext): void {
  const cameraPos = ctx.camera.position;

  for (const entity of withLOD.entities) {
    if (!entity.transform || !entity.lod || !entity.mesh) continue;

    // Calculate distance to camera
    const dx = (entity.transform.position[0] ?? 0) - cameraPos.x;
    const dy = (entity.transform.position[1] ?? 0) - cameraPos.y;
    const dz = (entity.transform.position[2] ?? 0) - cameraPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Determine LOD level
    let newLOD = entity.lod.maxLOD;
    for (let i = 0; i < entity.lod.lodDistances.length; i++) {
      const threshold = entity.lod.lodDistances[i];
      if (threshold !== undefined && distance < threshold) {
        newLOD = i;
        break;
      }
    }

    if (newLOD !== entity.lod.currentLOD) {
      entity.lod.currentLOD = newLOD;
      // TODO: Trigger mesh swap based on LOD
    }
  }
}

// ============================================================================
// SYSTEM PIPELINE
// ============================================================================

/**
 * Run all systems in order (core systems only)
 */
export function runSystems(ctx: SystemContext): void {
  inputSystem(ctx);
  cameraSystem(ctx);
  movementSystem(ctx);
  physicsSystem(ctx);
  renderSyncSystem(ctx);
  lodSystem(ctx);
}

// Extended system pipeline with placement systems is available via:
// - placementSystem() from ../placement/PlacementSystem
// - selectionSystem() from ../placement/SelectionSystem
// - transformGizmoSystem() from ../placement/TransformGizmoSystem
// - boundarySystem() from ../placement/BoundarySystem
// - persistenceSystem() from ../placement/PersistenceSystem
//
// These should be called after renderSyncSystem() and before lodSystem()
// when placement features are enabled in the realm config.
