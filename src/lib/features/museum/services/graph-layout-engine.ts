/**
 * Graph Layout Engine
 *
 * Takes an abstract room graph (nodes + edges) and a grid configuration,
 * then computes absolute tile positions for every room. Uses a LINEAR CHAIN
 * layout: rooms placed sequentially along the main path, alternating
 * horizontal and vertical segments for a winding journey.
 *
 * Room sizes vary based on their min/max dimensions (compression/release).
 * Corridors are tight (width from edges). No fixed cell grid - each room
 * gets exactly the space it needs.
 */

import type {
  RoomNode,
  RoomEdge,
  GridConfig,
  PlacedRoom,
  LayoutResult,
} from "../domain/layout-types";
import { computeRoomDimensions } from "../domain/wall-segment-types";

// Direction vectors for placing the next room relative to the current one
const DIR_VECTORS: Record<string, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

export function computeLayout(
  rooms: RoomNode[],
  edges: RoomEdge[],
  config: GridConfig
): LayoutResult {
  const mainPath = extractMainPath(rooms, edges);
  const sideEdges = edges.filter((e) => e.type !== "main-path");
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const edgeMap = new Map(edges.map((e) => [`${e.from}->${e.to}`, e]));

  // Place rooms sequentially along the main path
  const placed = new Map<string, PlacedRoom>();
  const corridorGap = config.padding + 6; // Space for corridor between rooms

  for (let i = 0; i < mainPath.length; i++) {
    const roomId = mainPath[i]!;
    const room = roomMap.get(roomId);
    if (!room) continue;

    // Dimensions derived from wall segment budgets
    const { w, h } = computeRoomDimensions(room);

    if (i === 0) {
      // First room at origin
      placed.set(roomId, createPlacedRoom(room, 2, 2, w, h));
      continue;
    }

    // Find the edge connecting the previous room to this one
    const prevId = mainPath[i - 1]!;
    const edge = edgeMap.get(`${prevId}->${roomId}`);
    const prevRoom = placed.get(prevId);
    if (!edge || !prevRoom) continue;

    // Place this room based on which wall the corridor exits from
    const dir = DIR_VECTORS[edge.fromWall];
    if (!dir) continue;

    let x: number;
    let y: number;

    if (dir.dx > 0) {
      // Exit east: new room to the right of previous
      x = prevRoom.x + prevRoom.w + corridorGap;
      y = prevRoom.y + Math.floor((prevRoom.h - h) / 2); // Vertically centered
    } else if (dir.dx < 0) {
      // Exit west: new room to the left
      x = prevRoom.x - w - corridorGap;
      y = prevRoom.y + Math.floor((prevRoom.h - h) / 2);
    } else if (dir.dy > 0) {
      // Exit south: new room below
      x = prevRoom.x + Math.floor((prevRoom.w - w) / 2); // Horizontally centered
      y = prevRoom.y + prevRoom.h + corridorGap;
    } else {
      // Exit north: new room above
      x = prevRoom.x + Math.floor((prevRoom.w - w) / 2);
      y = prevRoom.y - h - corridorGap;
    }

    placed.set(roomId, createPlacedRoom(room, x, y, w, h));
  }

  // Place side-branch rooms
  for (const edge of sideEdges) {
    if (placed.has(edge.to)) continue;
    const parentRoom = placed.get(edge.from);
    const childNode = roomMap.get(edge.to);
    if (!parentRoom || !childNode) continue;

    const { w, h } = computeRoomDimensions(childNode);
    const dir = DIR_VECTORS[edge.fromWall];
    if (!dir) continue;

    let x: number;
    let y: number;

    if (dir.dx > 0) {
      x = parentRoom.x + parentRoom.w + corridorGap;
      y = parentRoom.y + Math.floor((parentRoom.h - h) / 2);
    } else if (dir.dx < 0) {
      x = parentRoom.x - w - corridorGap;
      y = parentRoom.y + Math.floor((parentRoom.h - h) / 2);
    } else if (dir.dy > 0) {
      x = parentRoom.x + Math.floor((parentRoom.w - w) / 2);
      y = parentRoom.y + parentRoom.h + corridorGap;
    } else {
      x = parentRoom.x + Math.floor((parentRoom.w - w) / 2);
      y = parentRoom.y - h - corridorGap;
    }

    placed.set(edge.to, createPlacedRoom(childNode, x, y, w, h));
  }

  // Resolve all overlaps globally. The naive placement above can produce
  // overlaps when the path folds back on itself (e.g. north->east->south->
  // west->north). We iteratively push overlapping rooms apart until no
  // bounding boxes intersect.
  resolveAllOverlaps(placed, corridorGap);

  // Shift all rooms so the minimum coordinate is at (2, 2).
  // This eliminates negative coordinates from rooms placed north/west
  // of the entrance without clamping (which caused overlaps).
  shiftAllRoomsToPositive(placed);

  const placedRooms = Array.from(placed.values());

  // Compute total grid dimensions from placed rooms
  let maxX = 0;
  let maxY = 0;
  for (const room of placedRooms) {
    maxX = Math.max(maxX, room.x + room.w);
    maxY = Math.max(maxY, room.y + room.h);
  }

  return {
    rooms: placedRooms,
    corridors: [],
    gridWidth: maxX + 4,
    gridHeight: maxY + 4,
  };
}

function createPlacedRoom(
  room: RoomNode,
  x: number,
  y: number,
  w: number,
  h: number
): PlacedRoom {
  return {
    id: room.id,
    name: room.name,
    x,
    y,
    w,
    h,
    material: room.material,
    theme: room.theme,
    description: room.description,
    devNotes: room.devNotes,
    walls: room.walls,
    performers: room.performers,
    furniture: room.furniture,
    spawn: room.spawn,
    roomPresentation: room.roomPresentation,
  };
}

/**
 * Shifts every placed room so the minimum X and Y across all rooms
 * lands at (2, 2). This replaces the old Math.max(0, ...) clamping
 * that collapsed negative-coordinate rooms onto each other.
 */
function shiftAllRoomsToPositive(placed: Map<string, PlacedRoom>): void {
  const allRooms = Array.from(placed.values());
  let minX = Infinity;
  let minY = Infinity;
  for (const room of allRooms) {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
  }

  const offsetX = 2 - minX;
  const offsetY = 2 - minY;

  if (offsetX === 0 && offsetY === 0) return;

  for (const room of allRooms) {
    room.x += offsetX;
    room.y += offsetY;
  }
}

/**
 * Iteratively resolves ALL room overlaps by pushing overlapping pairs
 * apart symmetrically (each room moves half the required distance).
 * This converges reliably even when the path folds back on itself,
 * because no single room absorbs the full displacement.
 */
function resolveAllOverlaps(
  placed: Map<string, PlacedRoom>,
  gap: number
): void {
  const roomList = Array.from(placed.values());
  const maxIterations = 500;

  for (let iter = 0; iter < maxIterations; iter++) {
    let resolved = true;

    for (let i = 0; i < roomList.length; i++) {
      for (let j = i + 1; j < roomList.length; j++) {
        const a = roomList[i]!;
        const b = roomList[j]!;

        if (!roomsOverlap(a, b)) continue;
        resolved = false;

        // Overlap amounts on each axis
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        // Push apart along the axis with less overlap (minimum displacement).
        // Each room moves half the required distance + half the gap.
        if (overlapX <= overlapY) {
          const push = Math.ceil((overlapX + gap) / 2);
          if (a.x + a.w / 2 <= b.x + b.w / 2) {
            a.x -= push;
            b.x += push;
          } else {
            a.x += push;
            b.x -= push;
          }
        } else {
          const push = Math.ceil((overlapY + gap) / 2);
          if (a.y + a.h / 2 <= b.y + b.h / 2) {
            a.y -= push;
            b.y += push;
          } else {
            a.y += push;
            b.y -= push;
          }
        }
      }
    }

    if (resolved) break;
  }
}

function roomsOverlap(a: PlacedRoom, b: PlacedRoom): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * Extracts the main-path room ordering via topological sort.
 */
function extractMainPath(rooms: RoomNode[], edges: RoomEdge[]): string[] {
  const mainEdges = edges.filter((e) => e.type === "main-path");
  const roomIds = new Set(rooms.map((r) => r.id));

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of roomIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of mainEdges) {
    adj.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const mainPathNodes = new Set<string>();
  for (const edge of mainEdges) {
    mainPathNodes.add(edge.from);
    mainPathNodes.add(edge.to);
  }

  const queue: string[] = [];
  for (const id of mainPathNodes) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!mainPathNodes.has(current)) continue;
    order.push(current);

    for (const next of adj.get(current) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        queue.push(next);
      }
    }
  }

  for (const room of rooms) {
    if (!order.includes(room.id)) {
      order.push(room.id);
    }
  }

  return order;
}
