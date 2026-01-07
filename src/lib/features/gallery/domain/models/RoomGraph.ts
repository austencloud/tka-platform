/**
 * Room Graph
 *
 * A graph structure representing rooms and their connections.
 * Used for:
 * - Spatial queries (which room is the player in?)
 * - Navigation (pathfinding between rooms)
 * - Collision optimization (only check walls in nearby rooms)
 */

import type { Point2D } from "./geometry";
import { pointInPolygon, pointInCircle } from "./geometry";
import type { Room, RoomNode } from "./Room";
import { getShapeCenter, getShapeBoundingRadius, shapeToPolygon } from "./room-shapes";
import type { Doorway } from "./doorway";
import { getOtherRoomId } from "./doorway";

// =============================================================================
// Room Graph Definition
// =============================================================================

/**
 * The complete room graph for a gallery layout
 */
export interface RoomGraph {
  /** Map of room ID to room node */
  readonly rooms: ReadonlyMap<string, RoomNode>;

  /** Map of doorway ID to doorway */
  readonly doorways: ReadonlyMap<string, Doorway>;

  /** Adjacency list: room ID -> list of adjacent room IDs */
  readonly adjacency: ReadonlyMap<string, readonly string[]>;

  /** ID of the room where players spawn */
  readonly entryRoomId: string;
}

// =============================================================================
// Room Graph Builder
// =============================================================================

/**
 * Build a room graph from rooms and doorways
 */
export function buildRoomGraph(
  rooms: readonly Room[],
  doorways: readonly Doorway[],
  entryRoomId: string
): RoomGraph {
  // Build adjacency from doorways
  const adjacencyMap = new Map<string, string[]>();

  // Initialize empty adjacency lists
  for (const room of rooms) {
    adjacencyMap.set(room.id, []);
  }

  // Add connections from doorways
  for (const doorway of doorways) {
    const listA = adjacencyMap.get(doorway.roomAId);
    const listB = adjacencyMap.get(doorway.roomBId);

    if (listA && !listA.includes(doorway.roomBId)) {
      listA.push(doorway.roomBId);
    }
    if (listB && !listB.includes(doorway.roomAId)) {
      listB.push(doorway.roomAId);
    }
  }

  // Convert to readonly
  const adjacency = new Map<string, readonly string[]>();
  for (const [id, list] of adjacencyMap) {
    adjacency.set(id, list);
  }

  // Build room nodes
  const roomNodes = new Map<string, RoomNode>();
  for (const room of rooms) {
    const center = getShapeCenter(room.shape);
    const boundingRadius = getShapeBoundingRadius(room.shape);
    const adjacentRoomIds = adjacency.get(room.id) ?? [];

    roomNodes.set(room.id, {
      room,
      center,
      boundingRadius,
      adjacentRoomIds,
    });
  }

  // Build doorway map
  const doorwayMap = new Map<string, Doorway>();
  for (const doorway of doorways) {
    doorwayMap.set(doorway.id, doorway);
  }

  return {
    rooms: roomNodes,
    doorways: doorwayMap,
    adjacency,
    entryRoomId,
  };
}

// =============================================================================
// Spatial Queries
// =============================================================================

/**
 * Find which room a point is inside
 * Returns null if the point is outside all rooms
 */
export function findRoomAtPoint(
  graph: RoomGraph,
  point: Point2D
): RoomNode | null {
  for (const node of graph.rooms.values()) {
    if (isPointInRoom(point, node.room)) {
      return node;
    }
  }
  return null;
}

/**
 * Find which room a point is in, with a hint for optimization
 * Checks the hinted room first, then adjacent rooms, then all rooms
 */
export function findRoomAtPointWithHint(
  graph: RoomGraph,
  point: Point2D,
  hintRoomId: string | null
): RoomNode | null {
  // First, check the hinted room
  if (hintRoomId) {
    const hintNode = graph.rooms.get(hintRoomId);
    if (hintNode && isPointInRoom(point, hintNode.room)) {
      return hintNode;
    }

    // Check adjacent rooms next
    const adjacent = graph.adjacency.get(hintRoomId);
    if (adjacent) {
      for (const adjacentId of adjacent) {
        const adjacentNode = graph.rooms.get(adjacentId);
        if (adjacentNode && isPointInRoom(point, adjacentNode.room)) {
          return adjacentNode;
        }
      }
    }
  }

  // Fallback: check all rooms
  return findRoomAtPoint(graph, point);
}

/**
 * Check if a point is inside a room's shape
 */
export function isPointInRoom(point: Point2D, room: Room): boolean {
  const { shape } = room;

  switch (shape.type) {
    case "circular":
      return pointInCircle(point, { center: shape.center, radius: shape.radius });
    case "rectangular":
    case "polygonal":
      return pointInPolygon(point, shapeToPolygon(shape));
  }
}

/**
 * Get all rooms within a certain distance of a point
 * Uses bounding radius for fast rejection
 */
export function getRoomsNearPoint(
  graph: RoomGraph,
  point: Point2D,
  maxDistance: number
): readonly RoomNode[] {
  const results: RoomNode[] = [];

  for (const node of graph.rooms.values()) {
    const dx = point.x - node.center.x;
    const dz = point.z - node.center.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Include if point is within maxDistance of the room's bounding circle
    if (dist <= maxDistance + node.boundingRadius) {
      results.push(node);
    }
  }

  return results;
}

/**
 * Get a room and its adjacent rooms (for localized collision checks)
 */
export function getRoomWithNeighbors(
  graph: RoomGraph,
  roomId: string
): readonly RoomNode[] {
  const results: RoomNode[] = [];

  const centerNode = graph.rooms.get(roomId);
  if (!centerNode) return results;

  results.push(centerNode);

  for (const adjacentId of centerNode.adjacentRoomIds) {
    const adjacentNode = graph.rooms.get(adjacentId);
    if (adjacentNode) {
      results.push(adjacentNode);
    }
  }

  return results;
}

// =============================================================================
// Doorway Queries
// =============================================================================

/**
 * Get all doorways connected to a room
 */
export function getRoomDoorways(
  graph: RoomGraph,
  roomId: string
): readonly Doorway[] {
  const results: Doorway[] = [];

  for (const doorway of graph.doorways.values()) {
    if (doorway.roomAId === roomId || doorway.roomBId === roomId) {
      results.push(doorway);
    }
  }

  return results;
}

/**
 * Get the doorway connecting two specific rooms
 */
export function getDoorwayBetweenRooms(
  graph: RoomGraph,
  roomId1: string,
  roomId2: string
): Doorway | null {
  for (const doorway of graph.doorways.values()) {
    if (
      (doorway.roomAId === roomId1 && doorway.roomBId === roomId2) ||
      (doorway.roomAId === roomId2 && doorway.roomBId === roomId1)
    ) {
      return doorway;
    }
  }
  return null;
}

// =============================================================================
// Pathfinding
// =============================================================================

/**
 * Find the shortest path between two rooms using BFS
 * Returns array of room IDs from start to end, or empty array if no path
 */
export function findPath(
  graph: RoomGraph,
  startRoomId: string,
  endRoomId: string
): readonly string[] {
  if (startRoomId === endRoomId) {
    return [startRoomId];
  }

  const visited = new Set<string>();
  const queue: { roomId: string; path: string[] }[] = [
    { roomId: startRoomId, path: [startRoomId] },
  ];

  visited.add(startRoomId);

  while (queue.length > 0) {
    const { roomId, path } = queue.shift()!;
    const adjacent = graph.adjacency.get(roomId);

    if (!adjacent) continue;

    for (const nextId of adjacent) {
      if (nextId === endRoomId) {
        return [...path, nextId];
      }

      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ roomId: nextId, path: [...path, nextId] });
      }
    }
  }

  return []; // No path found
}

// =============================================================================
// Debug Helpers
// =============================================================================

/**
 * Get statistics about the room graph
 */
export function getRoomGraphStats(graph: RoomGraph): {
  roomCount: number;
  doorwayCount: number;
  totalExhibitableRooms: number;
  maxAdjacent: number;
} {
  let maxAdjacent = 0;
  let totalExhibitableRooms = 0;

  for (const node of graph.rooms.values()) {
    if (node.adjacentRoomIds.length > maxAdjacent) {
      maxAdjacent = node.adjacentRoomIds.length;
    }
    if (node.room.hasExhibits) {
      totalExhibitableRooms++;
    }
  }

  return {
    roomCount: graph.rooms.size,
    doorwayCount: graph.doorways.size,
    totalExhibitableRooms,
    maxAdjacent,
  };
}
