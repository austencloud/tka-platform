/**
 * MuseumModelLoader
 *
 * Extracts exhibit slot positions from a loaded glTF museum model.
 * Slots are defined in Blender as Empty objects with naming convention: Slot_RoomName_Index
 *
 * Example: Slot_NorthWing_01, Slot_Rotunda_03
 */

import type { Object3D } from "three";

/**
 * A slot extracted from the museum model.
 * Represents where an exhibit (frame + animation screen) should be placed.
 */
export interface ModelSlot {
  /** Unique identifier from Blender object name */
  readonly id: string;
  /** World position from the Empty object */
  readonly position: { x: number; y: number; z: number };
  /** Y-axis rotation (radians) - direction the frame should face */
  readonly rotation: number;
  /** Slot type for different exhibit sizes */
  readonly slotType: "standard" | "large" | "video";
  /** Room identifier extracted from name (e.g., "northwing", "rotunda") */
  readonly roomId: string;
}

/**
 * Result of loading a museum model.
 */
export interface LoadedMuseum {
  /** The Three.js scene graph from the glTF */
  readonly scene: Object3D;
  /** Exhibit slots extracted from Empty objects */
  readonly slots: readonly ModelSlot[];
}

export class MuseumModelLoader {
  /**
   * Extract exhibit slots from a loaded museum scene.
   * Looks for Empty objects named with pattern: Slot_RoomName_Index
   *
   * @param scene - The loaded glTF scene
   * @returns Array of ModelSlot with positions and rotations
   */
  extractSlots(scene: Object3D): ModelSlot[] {
    const slots: ModelSlot[] = [];

    scene.traverse((object) => {
      if (this.isSlotMarker(object.name)) {
        const slot = this.parseSlot(object);
        if (slot) {
          slots.push(slot);
        }
      }
    });

    // Sort by room and index for consistent ordering
    slots.sort((a, b) => {
      if (a.roomId !== b.roomId) {
        return a.roomId.localeCompare(b.roomId);
      }
      return a.id.localeCompare(b.id);
    });

    console.debug(
      `[MuseumModelLoader] Extracted ${slots.length} slots from model`,
      slots.map((s) => s.id)
    );

    return slots;
  }

  /**
   * Check if an object name matches the slot naming convention.
   */
  private isSlotMarker(name: string): boolean {
    return name.startsWith("Slot_");
  }

  /**
   * Parse a slot from a Blender Empty object.
   */
  private parseSlot(object: Object3D): ModelSlot | null {
    const parts = object.name.split("_");

    if (parts.length < 2) {
      console.warn(
        `[MuseumModelLoader] Invalid slot name format: ${object.name}. Expected Slot_RoomName_Index`
      );
      return null;
    }

    // Extract room name (part between Slot_ and last _Index)
    // Examples: Slot_NorthWing_01 -> "northwing", Slot_Rotunda_Center_01 -> "rotunda_center"
    const roomParts = parts.slice(1, parts.length - 1);
    const roomId = roomParts.join("_").toLowerCase();

    // Get slot type from custom properties (userData in Three.js)
    const slotType = this.parseSlotType(object.userData);

    return {
      id: object.name,
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      },
      rotation: object.rotation.y,
      slotType,
      roomId: roomId || "unknown",
    };
  }

  /**
   * Parse slot type from Blender custom properties.
   */
  private parseSlotType(
    userData: Record<string, unknown>
  ): ModelSlot["slotType"] {
    const rawType = userData?.slot_type;

    if (rawType === "large") return "large";
    if (rawType === "video") return "video";

    return "standard";
  }

  /**
   * Get slots for a specific room.
   */
  getSlotsForRoom(slots: readonly ModelSlot[], roomId: string): ModelSlot[] {
    return slots.filter((s) => s.roomId === roomId.toLowerCase());
  }

  /**
   * Find the nearest slot to a position.
   */
  findNearestSlot(
    slots: readonly ModelSlot[],
    position: { x: number; z: number }
  ): ModelSlot | null {
    const firstSlot = slots[0];
    if (!firstSlot) return null;

    let nearest: ModelSlot = firstSlot;
    let nearestDist = this.distanceSquared(nearest.position, position);

    for (let i = 1; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;

      const dist = this.distanceSquared(slot.position, position);
      if (dist < nearestDist) {
        nearest = slot;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private distanceSquared(
    a: { x: number; z: number },
    b: { x: number; z: number }
  ): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return dx * dx + dz * dz;
  }
}
