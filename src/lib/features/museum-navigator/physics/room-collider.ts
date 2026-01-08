/**
 * Room Collider Manager
 *
 * Creates Rapier colliders for museum room boundaries.
 * Uses cuboid colliders for floor and walls (more efficient than trimesh for boxes).
 */

import type RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorldState } from "../../infinite-worlds/physics/rapier-world";
import type { RoomMesh } from "../rendering/room-renderer";

// ============================================================================
// TYPES
// ============================================================================

export interface RoomCollider {
  roomId: string;
  floor: RAPIER.Collider;
  ceiling: RAPIER.Collider;
  walls: RAPIER.Collider[];
}

// ============================================================================
// ROOM COLLIDER MANAGER
// ============================================================================

export class RoomColliderManager {
  private colliders: Map<string, RoomCollider> = new Map();
  private physicsState: PhysicsWorldState;

  constructor(physicsState: PhysicsWorldState) {
    this.physicsState = physicsState;
  }

  /**
   * Add colliders for a room
   */
  addRoomCollider(roomId: string, room: RoomMesh): RoomCollider | null {
    if (!this.physicsState.rapier || !this.physicsState.world) {
      console.warn("[RoomCollider] Physics not initialized");
      return null;
    }

    const RAPIER = this.physicsState.rapier;
    const { width, depth, height, exits = [] } = room.config;

    // Remove existing collider if any
    this.removeRoomCollider(roomId);

    const wallColliders: RAPIER.Collider[] = [];
    const wallThickness = 0.2;

    // Floor collider (thin box)
    const floorDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.1, depth / 2);
    floorDesc.setTranslation(0, -0.1, 0);
    floorDesc.setFriction(0.8);
    const floor = this.physicsState.world.createCollider(floorDesc);

    // Ceiling collider
    const ceilingDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.1, depth / 2);
    ceilingDesc.setTranslation(0, height + 0.1, 0);
    const ceiling = this.physicsState.world.createCollider(ceilingDesc);

    // Wall colliders - only create if no exit on that side
    // North wall (-Z)
    if (!exits.includes("north")) {
      const northDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, wallThickness / 2);
      northDesc.setTranslation(0, height / 2, -depth / 2 - wallThickness / 2);
      wallColliders.push(this.physicsState.world.createCollider(northDesc));
    }

    // South wall (+Z)
    if (!exits.includes("south")) {
      const southDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, wallThickness / 2);
      southDesc.setTranslation(0, height / 2, depth / 2 + wallThickness / 2);
      wallColliders.push(this.physicsState.world.createCollider(southDesc));
    }

    // East wall (+X)
    if (!exits.includes("east")) {
      const eastDesc = RAPIER.ColliderDesc.cuboid(wallThickness / 2, height / 2, depth / 2);
      eastDesc.setTranslation(width / 2 + wallThickness / 2, height / 2, 0);
      wallColliders.push(this.physicsState.world.createCollider(eastDesc));
    }

    // West wall (-X)
    if (!exits.includes("west")) {
      const westDesc = RAPIER.ColliderDesc.cuboid(wallThickness / 2, height / 2, depth / 2);
      westDesc.setTranslation(-width / 2 - wallThickness / 2, height / 2, 0);
      wallColliders.push(this.physicsState.world.createCollider(westDesc));
    }

    const roomCollider: RoomCollider = {
      roomId,
      floor,
      ceiling,
      walls: wallColliders,
    };

    this.colliders.set(roomId, roomCollider);

    console.log(`[RoomCollider] Added colliders for room "${roomId}" (${wallColliders.length} walls)`);

    return roomCollider;
  }

  /**
   * Remove a room's colliders
   */
  removeRoomCollider(roomId: string): void {
    const existing = this.colliders.get(roomId);

    if (existing && this.physicsState.world) {
      this.physicsState.world.removeCollider(existing.floor, true);
      this.physicsState.world.removeCollider(existing.ceiling, true);
      for (const wall of existing.walls) {
        this.physicsState.world.removeCollider(wall, true);
      }
      this.colliders.delete(roomId);
    }
  }

  /**
   * Check if a room has colliders
   */
  hasCollider(roomId: string): boolean {
    return this.colliders.has(roomId);
  }

  /**
   * Get total collider count
   */
  getColliderCount(): number {
    let count = 0;
    for (const room of this.colliders.values()) {
      count += 2 + room.walls.length; // floor + ceiling + walls
    }
    return count;
  }

  /**
   * Dispose all colliders
   */
  dispose(): void {
    if (this.physicsState.world) {
      for (const room of this.colliders.values()) {
        this.physicsState.world.removeCollider(room.floor, true);
        this.physicsState.world.removeCollider(room.ceiling, true);
        for (const wall of room.walls) {
          this.physicsState.world.removeCollider(wall, true);
        }
      }
    }
    this.colliders.clear();
  }
}
