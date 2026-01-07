/**
 * Doorway Definition Models
 *
 * Doorways connect rooms and define how the player transitions between spaces.
 * They also determine where walls are cut to create openings.
 */

import type { Point2D } from "./geometry";

// =============================================================================
// Doorway Style
// =============================================================================

/**
 * Visual style of the doorway
 */
export type DoorwayStyle =
  | "archway" // Rounded arch opening (default for most connections)
  | "grand_entrance" // Extra tall, ornate entrance
  | "simple" // Rectangular opening, no decoration
  | "pillared"; // Flanked by columns

// =============================================================================
// Doorway Definition
// =============================================================================

/**
 * A connection between two rooms
 */
export interface Doorway {
  /** Unique identifier */
  readonly id: string;

  /** ID of the first room */
  readonly roomAId: string;
  /** ID of the second room */
  readonly roomBId: string;

  /** Position of the doorway center (XZ plane) */
  readonly position: Point2D;

  /** Width of the opening */
  readonly width: number;
  /** Height of the opening */
  readonly height: number;

  /** Visual style */
  readonly style: DoorwayStyle;

  /** Rotation around Y axis (radians) - orientation of the doorway */
  readonly rotation: number;

  /** Whether the doorway has physical doors (affects rendering) */
  readonly hasDoors?: boolean;

  /** Whether the doorway is currently passable */
  readonly isOpen?: boolean;
}

// =============================================================================
// Doorway Creation Helpers
// =============================================================================

/**
 * Create a simple archway doorway between two rooms
 */
export function createArchway(
  id: string,
  roomAId: string,
  roomBId: string,
  position: Point2D,
  rotation: number,
  width: number = 400,
  height: number = 600
): Doorway {
  return {
    id,
    roomAId,
    roomBId,
    position,
    width,
    height,
    style: "archway",
    rotation,
    isOpen: true,
  };
}

/**
 * Create a grand entrance doorway (typically for rotunda connections)
 */
export function createGrandEntrance(
  id: string,
  roomAId: string,
  roomBId: string,
  position: Point2D,
  rotation: number,
  width: number = 500,
  height: number = 800
): Doorway {
  return {
    id,
    roomAId,
    roomBId,
    position,
    width,
    height,
    style: "grand_entrance",
    rotation,
    isOpen: true,
  };
}

// =============================================================================
// Doorway Position Calculation
// =============================================================================

/**
 * Calculate the doorway position between a circular room and a rectangular wing
 * The doorway is placed at the edge of the circle in the direction of the wing
 */
export function calculateCircleToRectDoorwayPosition(
  circleCenter: Point2D,
  circleRadius: number,
  wingCenter: Point2D
): { position: Point2D; rotation: number } {
  // Direction from circle center to wing center
  const dx = wingCenter.x - circleCenter.x;
  const dz = wingCenter.z - circleCenter.z;
  const angle = Math.atan2(dx, dz);

  // Position on the circle edge
  const position: Point2D = {
    x: circleCenter.x + Math.sin(angle) * circleRadius,
    z: circleCenter.z + Math.cos(angle) * circleRadius,
  };

  return { position, rotation: angle };
}

/**
 * Calculate doorway position along a rectangular room's wall
 */
export function calculateRectWallDoorwayPosition(
  roomCenter: Point2D,
  roomWidth: number,
  roomDepth: number,
  roomRotation: number,
  wall: "north" | "south" | "east" | "west",
  offsetFromCenter: number = 0
): { position: Point2D; rotation: number } {
  // Local position before room rotation
  let localX = 0;
  let localZ = 0;
  let localRotation = 0;

  switch (wall) {
    case "north":
      localX = offsetFromCenter;
      localZ = roomDepth / 2;
      localRotation = 0;
      break;
    case "south":
      localX = offsetFromCenter;
      localZ = -roomDepth / 2;
      localRotation = Math.PI;
      break;
    case "east":
      localX = roomWidth / 2;
      localZ = offsetFromCenter;
      localRotation = Math.PI / 2;
      break;
    case "west":
      localX = -roomWidth / 2;
      localZ = offsetFromCenter;
      localRotation = -Math.PI / 2;
      break;
  }

  // Apply room rotation
  const cos = Math.cos(roomRotation);
  const sin = Math.sin(roomRotation);
  const worldX = roomCenter.x + localX * cos - localZ * sin;
  const worldZ = roomCenter.z + localX * sin + localZ * cos;

  return {
    position: { x: worldX, z: worldZ },
    rotation: localRotation + roomRotation,
  };
}

// =============================================================================
// Doorway Query Helpers
// =============================================================================

/**
 * Check if a doorway connects two specific rooms (in either order)
 */
export function doorwayConnects(
  doorway: Doorway,
  roomId1: string,
  roomId2: string
): boolean {
  return (
    (doorway.roomAId === roomId1 && doorway.roomBId === roomId2) ||
    (doorway.roomAId === roomId2 && doorway.roomBId === roomId1)
  );
}

/**
 * Get the ID of the other room connected by a doorway
 */
export function getOtherRoomId(doorway: Doorway, roomId: string): string | null {
  if (doorway.roomAId === roomId) return doorway.roomBId;
  if (doorway.roomBId === roomId) return doorway.roomAId;
  return null;
}

/**
 * Get all doorways connected to a specific room
 */
export function getDoorwaysForRoom(
  doorways: readonly Doorway[],
  roomId: string
): readonly Doorway[] {
  return doorways.filter(
    (d) => d.roomAId === roomId || d.roomBId === roomId
  );
}
