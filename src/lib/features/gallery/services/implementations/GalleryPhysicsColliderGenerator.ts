/**
 * Gallery Physics Collider Generator
 *
 * Converts gallery layout collision world (2D wall segments) into Rapier 3D colliders.
 * Used when Rapier physics mode is enabled.
 */

import type { PhysicsWorldState } from "$lib/shared/3d-core/physics/types";
import type { CollisionWorld, WallCollider } from "../../domain/models/WallCollider";
import type RAPIER from "@dimforge/rapier3d-compat";

const WALL_HEIGHT = 4.0; // 4 meters tall walls
const WALL_THICKNESS = 0.2; // 20cm thick walls

/**
 * Create a quaternion from rotation around Y axis
 * Rapier uses { x, y, z, w } quaternion format
 */
function quaternionFromYRotation(angleRadians: number): { x: number; y: number; z: number; w: number } {
  const halfAngle = angleRadians / 2;
  return {
    x: 0,
    y: Math.sin(halfAngle),
    z: 0,
    w: Math.cos(halfAngle)
  };
}

/**
 * Convert a 2D wall segment to a 3D Rapier cuboid collider
 */
function createWallCollider(
  physicsState: PhysicsWorldState,
  wall: WallCollider
): RAPIER.Collider | null {
  if (!physicsState.rapier || !physicsState.world) return null;
  if (wall.isDoorway) return null; // Skip doorways

  const RAPIER = physicsState.rapier;

  // Calculate wall dimensions
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);

  // Calculate center position
  const centerX = (wall.start.x + wall.end.x) / 2;
  const centerZ = (wall.start.z + wall.end.z) / 2;
  const centerY = WALL_HEIGHT / 2; // Center at half height

  // Calculate rotation angle (wall direction)
  const angle = Math.atan2(dz, dx);

  // Create cuboid collider (half-extents)
  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    length / 2,
    WALL_HEIGHT / 2,
    WALL_THICKNESS / 2
  );

  // Set position
  colliderDesc.setTranslation(centerX, centerY, centerZ);

  // Set rotation (rotate around Y axis)
  const quaternion = quaternionFromYRotation(angle);
  colliderDesc.setRotation(quaternion);

  // Set friction
  colliderDesc.setFriction(0.5);

  // Create the collider
  const collider = physicsState.world.createCollider(colliderDesc);

  return collider;
}

/**
 * Create all wall colliders from the gallery layout
 * Returns array of collider references for cleanup
 */
export function createGalleryWallColliders(
  physicsState: PhysicsWorldState,
  collisionWorld: CollisionWorld
): RAPIER.Collider[] {
  const colliders: RAPIER.Collider[] = [];

  // Convert each wall in the collision world
  for (const wall of collisionWorld.walls.values()) {
    const collider = createWallCollider(physicsState, wall);
    if (collider) {
      colliders.push(collider);
    }
  }

  console.log(`[GalleryPhysics] Created ${colliders.length} wall colliders`);

  return colliders;
}

/**
 * Create floor collider for the gallery
 */
export function createGalleryFloorCollider(
  physicsState: PhysicsWorldState,
  floorWidth: number,
  floorDepth: number
): RAPIER.Collider | null {
  if (!physicsState.rapier || !physicsState.world) return null;

  const RAPIER = physicsState.rapier;

  // Large floor collider centered at origin
  const floorDesc = RAPIER.ColliderDesc.cuboid(
    floorWidth / 2,
    0.1, // Thin floor
    floorDepth / 2
  );

  floorDesc.setTranslation(0, -0.1, 0);
  floorDesc.setFriction(0.8); // High friction for floor

  const collider = physicsState.world.createCollider(floorDesc);

  console.log(`[GalleryPhysics] Created floor collider (${floorWidth}x${floorDepth})`);

  return collider;
}

/**
 * Remove all colliders from the physics world
 */
export function removeColliders(
  physicsState: PhysicsWorldState,
  colliders: RAPIER.Collider[]
): void {
  if (!physicsState.world) return;

  for (const collider of colliders) {
    physicsState.world.removeCollider(collider, true);
  }
}
