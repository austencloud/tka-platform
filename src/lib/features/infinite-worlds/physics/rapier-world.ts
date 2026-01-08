/**
 * Rapier Physics World
 *
 * WASM-compiled Rust physics engine integration.
 * Runs physics simulation and syncs with ECS.
 *
 * Features:
 * - 5-8x faster than JavaScript physics
 * - Proper collision detection (not raycast hacks)
 * - Rigid body dynamics
 * - Character controller
 * - Continuous collision detection
 */

import type RAPIER from "@dimforge/rapier3d-compat";
import { world, withPhysics, dynamicBodies, type Entity, type PhysicsBodyComponent } from "../core/ecs-world";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Physics world state
 */
export interface PhysicsWorldState {
  rapier: typeof RAPIER | null;
  world: RAPIER.World | null;
  isInitialized: boolean;
  gravity: { x: number; y: number; z: number };
}

/**
 * Collider configuration
 */
export interface ColliderConfig {
  type: "box" | "sphere" | "capsule" | "cylinder" | "trimesh";
  size?: { x: number; y: number; z: number }; // For box
  radius?: number; // For sphere, capsule, cylinder
  halfHeight?: number; // For capsule, cylinder
  friction?: number;
  restitution?: number;
  density?: number;
}

/**
 * Rigid body configuration
 */
export interface RigidBodyConfig {
  type: "dynamic" | "static" | "kinematic";
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  linearDamping?: number;
  angularDamping?: number;
  canSleep?: boolean;
  ccd?: boolean; // Continuous collision detection
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create the physics world state
 */
export function createPhysicsWorldState(): PhysicsWorldState {
  return {
    rapier: null,
    world: null,
    isInitialized: false,
    gravity: { x: 0, y: -9.81, z: 0 },
  };
}

/**
 * Initialize Rapier WASM and create the physics world
 */
export async function initPhysicsWorld(
  state: PhysicsWorldState,
  gravity = { x: 0, y: -20, z: 0 }
): Promise<void> {
  // Dynamic import for WASM module
  const RAPIER = await import("@dimforge/rapier3d-compat");
  await RAPIER.init();

  state.rapier = RAPIER;
  state.gravity = gravity;
  state.world = new RAPIER.World(new RAPIER.Vector3(gravity.x, gravity.y, gravity.z));
  state.isInitialized = true;

  console.log("[InfiniteWorlds] Rapier physics initialized");
}

// ============================================================================
// RIGID BODY CREATION
// ============================================================================

/**
 * Create a rigid body with collider
 */
export function createRigidBody(
  state: PhysicsWorldState,
  bodyConfig: RigidBodyConfig,
  colliderConfig: ColliderConfig
): PhysicsBodyComponent | null {
  if (!state.rapier || !state.world) return null;

  const RAPIER = state.rapier;

  // Create rigid body description
  let rigidBodyDesc: RAPIER.RigidBodyDesc;
  switch (bodyConfig.type) {
    case "dynamic":
      rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
      break;
    case "static":
      rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
      break;
    case "kinematic":
      rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
      break;
  }

  rigidBodyDesc.setTranslation(
    bodyConfig.position.x,
    bodyConfig.position.y,
    bodyConfig.position.z
  );

  if (bodyConfig.rotation) {
    rigidBodyDesc.setRotation(bodyConfig.rotation);
  }

  if (bodyConfig.linearDamping !== undefined) {
    rigidBodyDesc.setLinearDamping(bodyConfig.linearDamping);
  }

  if (bodyConfig.angularDamping !== undefined) {
    rigidBodyDesc.setAngularDamping(bodyConfig.angularDamping);
  }

  if (bodyConfig.canSleep !== undefined) {
    rigidBodyDesc.setCanSleep(bodyConfig.canSleep);
  }

  if (bodyConfig.ccd) {
    rigidBodyDesc.setCcdEnabled(true);
  }

  // Create the rigid body
  const rigidBody = state.world.createRigidBody(rigidBodyDesc);

  // Create collider description
  let colliderDesc: RAPIER.ColliderDesc;
  switch (colliderConfig.type) {
    case "box":
      colliderDesc = RAPIER.ColliderDesc.cuboid(
        (colliderConfig.size?.x ?? 1) / 2,
        (colliderConfig.size?.y ?? 1) / 2,
        (colliderConfig.size?.z ?? 1) / 2
      );
      break;
    case "sphere":
      colliderDesc = RAPIER.ColliderDesc.ball(colliderConfig.radius ?? 0.5);
      break;
    case "capsule":
      colliderDesc = RAPIER.ColliderDesc.capsule(
        colliderConfig.halfHeight ?? 0.5,
        colliderConfig.radius ?? 0.3
      );
      break;
    case "cylinder":
      colliderDesc = RAPIER.ColliderDesc.cylinder(
        colliderConfig.halfHeight ?? 0.5,
        colliderConfig.radius ?? 0.5
      );
      break;
    default:
      colliderDesc = RAPIER.ColliderDesc.ball(0.5);
  }

  if (colliderConfig.friction !== undefined) {
    colliderDesc.setFriction(colliderConfig.friction);
  }

  if (colliderConfig.restitution !== undefined) {
    colliderDesc.setRestitution(colliderConfig.restitution);
  }

  if (colliderConfig.density !== undefined) {
    colliderDesc.setDensity(colliderConfig.density);
  }

  // Create the collider attached to the rigid body
  const collider = state.world.createCollider(colliderDesc, rigidBody);

  return {
    rigidBody,
    collider,
    bodyType: bodyConfig.type,
  };
}

/**
 * Create a character controller (capsule collider with special physics)
 */
export function createCharacterController(
  state: PhysicsWorldState,
  position: { x: number; y: number; z: number },
  radius = 0.3,
  height = 1.7
): RAPIER.KinematicCharacterController | null {
  if (!state.rapier || !state.world) return null;

  const RAPIER = state.rapier;

  // Create the character controller
  const characterController = state.world.createCharacterController(0.01); // Offset for skin

  // Configure the controller
  characterController.setSlideEnabled(true);
  characterController.setMaxSlopeClimbAngle(Math.PI / 4); // 45 degrees
  characterController.setMinSlopeSlideAngle(Math.PI / 4);
  characterController.enableAutostep(0.5, 0.2, true); // Max height, min width, include dynamic
  characterController.enableSnapToGround(0.5); // Snap distance

  return characterController;
}

// ============================================================================
// SIMULATION
// ============================================================================

/**
 * Step the physics simulation
 */
export function stepPhysics(state: PhysicsWorldState, deltaTime: number): void {
  if (!state.world) return;

  // Step the simulation (fixed timestep internally)
  state.world.timestep = deltaTime;
  state.world.step();
}

/**
 * Sync physics bodies to ECS transforms
 */
export function syncPhysicsToECS(): void {
  for (const entity of withPhysics.entities) {
    if (!entity.physicsBody || !entity.transform) continue;

    const body = entity.physicsBody.rigidBody;
    const translation = body.translation();
    const rotation = body.rotation();

    // Update transform from physics
    entity.transform.position[0] = translation.x;
    entity.transform.position[1] = translation.y;
    entity.transform.position[2] = translation.z;

    entity.transform.rotation[0] = rotation.x;
    entity.transform.rotation[1] = rotation.y;
    entity.transform.rotation[2] = rotation.z;
    entity.transform.rotation[3] = rotation.w;
  }
}

/**
 * Sync ECS transforms to physics bodies (for kinematic bodies)
 */
export function syncECSToPhysics(): void {
  for (const entity of withPhysics.entities) {
    if (!entity.physicsBody || !entity.transform) continue;
    if (entity.physicsBody.bodyType !== "kinematic") continue;

    const body = entity.physicsBody.rigidBody;

    body.setNextKinematicTranslation({
      x: entity.transform.position[0]!,
      y: entity.transform.position[1]!,
      z: entity.transform.position[2]!,
    });

    body.setNextKinematicRotation({
      x: entity.transform.rotation[0]!,
      y: entity.transform.rotation[1]!,
      z: entity.transform.rotation[2]!,
      w: entity.transform.rotation[3]!,
    });
  }
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Ray cast into the physics world
 */
export function castRay(
  state: PhysicsWorldState,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance: number
): { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; distance: number } | null {
  if (!state.rapier || !state.world) return null;

  const RAPIER = state.rapier;

  const ray = new RAPIER.Ray(
    new RAPIER.Vector3(origin.x, origin.y, origin.z),
    new RAPIER.Vector3(direction.x, direction.y, direction.z)
  );

  const hit = state.world.castRay(ray, maxDistance, true);

  if (hit) {
    const point = ray.pointAt(hit.timeOfImpact);
    const hitCollider = hit.collider;
    const normal = hitCollider.castRayAndGetNormal(ray, maxDistance, true)?.normal;

    return {
      point: { x: point.x, y: point.y, z: point.z },
      normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : { x: 0, y: 1, z: 0 },
      distance: hit.timeOfImpact,
    };
  }

  return null;
}

/**
 * Check if a point is grounded
 */
export function checkGrounded(
  state: PhysicsWorldState,
  position: { x: number; y: number; z: number },
  groundCheckDistance = 0.1
): { isGrounded: boolean; groundNormal: { x: number; y: number; z: number }; groundDistance: number } {
  const result = castRay(
    state,
    position,
    { x: 0, y: -1, z: 0 },
    groundCheckDistance
  );

  if (result) {
    return {
      isGrounded: true,
      groundNormal: result.normal,
      groundDistance: result.distance,
    };
  }

  return {
    isGrounded: false,
    groundNormal: { x: 0, y: 1, z: 0 },
    groundDistance: groundCheckDistance,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove a rigid body from the physics world
 */
export function removeRigidBody(
  state: PhysicsWorldState,
  component: PhysicsBodyComponent
): void {
  if (!state.world) return;

  state.world.removeRigidBody(component.rigidBody);
}

/**
 * Dispose the physics world
 */
export function disposePhysicsWorld(state: PhysicsWorldState): void {
  if (state.world) {
    state.world.free();
    state.world = null;
  }
  state.rapier = null;
  state.isInitialized = false;
}
