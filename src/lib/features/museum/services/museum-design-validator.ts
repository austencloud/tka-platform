/**
 * Museum Design Validator
 *
 * A "linter for museum design" that checks exhibit placements against
 * professional gallery layout rules. Reports violations but never auto-fixes.
 *
 * Most spatial rules (corner avoidance, entrance clearance, spacing,
 * wall coverage, wall-backed) are now guaranteed by construction via
 * wall segment budgets. Only sightline tracing and anchor metadata
 * checks remain as runtime validations.
 */

import type { PlacedRoom, RoomEdge } from "../domain/layout-types";
import type { MuseumGrid, Direction } from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";
import type { DesignViolation } from "./types";
import type { ExhibitSegment } from "../domain/wall-segment-types";
import {
  DEV_WHITEBOARDS_ENABLED,
  OPPOSITE_WALL,
} from "../domain/museum-design-rules";

interface TilePos {
  x: number;
  y: number;
}

/** Returns the midpoint tile of a wall (the doorway center). */
function getWallMidpoint(room: PlacedRoom, wall: string): TilePos {
  switch (wall) {
    case "north":
      return { x: room.x + Math.floor(room.w / 2), y: room.y };
    case "south":
      return { x: room.x + Math.floor(room.w / 2), y: room.y + room.h - 1 };
    case "east":
      return { x: room.x + room.w - 1, y: room.y + Math.floor(room.h / 2) };
    case "west":
      return { x: room.x, y: room.y + Math.floor(room.h / 2) };
    default:
      return { x: room.x + Math.floor(room.w / 2), y: room.y };
  }
}

/**
 * Bresenham's line algorithm. Returns every tile on the line from a to b
 * (inclusive of both endpoints).
 */
function bresenhamLine(a: TilePos, b: TilePos): TilePos[] {
  const points: TilePos[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return points;
}

/**
 * Validates a single room's exhibits against design rules that don't
 * require the full tile grid. Only anchor metadata checks remain here;
 * spatial rules are guaranteed by wall segment construction.
 */
export function validateRoom(room: PlacedRoom, entranceWall: string): DesignViolation[] {
  const violations: DesignViolation[] = [];
  const allExhibits = getExhibitSegments(room);
  if (allExhibits.length === 0) return violations;

  checkAnchorPresence(room, allExhibits, violations);
  checkAnchorPlacement(room, entranceWall, violations);

  return violations;
}

/**
 * Validates all rooms plus grid-dependent rules (sightline).
 * Logs a grouped summary to the console.
 */
export function validateAll(
  rooms: PlacedRoom[],
  edges: RoomEdge[],
  grid: MuseumGrid,
): DesignViolation[] {
  const entranceMap = buildEntranceMap(rooms, edges);
  const allViolations: DesignViolation[] = [];

  for (const room of rooms) {
    const entrance = entranceMap.get(room.id) ?? "south";

    // Segment-aware checks (no grid needed)
    checkAnchorPresence(room, getExhibitSegments(room), allViolations);
    checkAnchorPlacement(room, entrance, allViolations);

    // Grid-dependent checks
    checkSightline(room, entrance, grid, allViolations);
  }

  logViolations(rooms, allViolations);
  return allViolations;
}

// ── Rule: Anchor Presence ──

function checkAnchorPresence(
  room: PlacedRoom,
  exhibits: ExhibitSegment[],
  violations: DesignViolation[],
): void {
  if (exhibits.length === 0) return;

  const hasAnchorField = exhibits.some((ex) => ex.isAnchor !== undefined);

  if (!hasAnchorField) {
    if (DEV_WHITEBOARDS_ENABLED) return;
    violations.push({
      roomId: room.id,
      rule: "anchor-presence",
      severity: "info",
      message: `Room "${room.name}" has no anchor annotations on any exhibit`,
    });
    return;
  }

  const hasAnchor = exhibits.some((ex) => ex.isAnchor === true);
  if (!hasAnchor) {
    if (DEV_WHITEBOARDS_ENABLED) return;
    violations.push({
      roomId: room.id,
      rule: "anchor-presence",
      severity: "warning",
      message: `Room "${room.name}" has anchor-annotated exhibits but none is marked isAnchor: true`,
    });
  }
}

// ── Rule: Anchor Placement ──

function checkAnchorPlacement(
  room: PlacedRoom,
  entranceWall: string,
  violations: DesignViolation[],
): void {
  for (const wallDir of ["north", "south", "east", "west"] as const) {
    const wall = room.walls[wallDir];
    for (const seg of wall.segments) {
      if (seg.type === "exhibit" && seg.isAnchor) {
        const expectedWall = OPPOSITE_WALL[entranceWall as Direction];
        if (wallDir !== expectedWall) {
          violations.push({
            roomId: room.id,
            rule: "anchor-placement",
            severity: "warning",
            message: `Anchor exhibit "${seg.refId}" is on the ${wallDir} wall but should be on the ${expectedWall} wall (opposite the ${entranceWall} entrance)`,
            exhibitRefId: seg.refId,
          });
        }
        return; // Only one anchor per room
      }
    }
  }
}

// ── Rule: Sightline (grid-dependent) ──

function checkSightline(
  room: PlacedRoom,
  entranceWall: string,
  grid: MuseumGrid,
  violations: DesignViolation[],
): void {
  // Find the anchor's refId from wall segments
  let anchorRefId: string | undefined;
  for (const wallDir of ["north", "south", "east", "west"] as const) {
    for (const seg of room.walls[wallDir].segments) {
      if (seg.type === "exhibit" && seg.isAnchor) {
        anchorRefId = seg.refId;
        break;
      }
    }
    if (anchorRefId) break;
  }
  if (!anchorRefId) return;

  // Find the anchor's tile position from grid exhibits
  const anchorGridExhibit = grid.exhibits.find(
    (ex) =>
      ex.id === anchorRefId &&
      ex.tileX >= room.x &&
      ex.tileX < room.x + room.w &&
      ex.tileY >= room.y &&
      ex.tileY < room.y + room.h,
  );
  if (!anchorGridExhibit) return;

  const anchorPos: TilePos = {
    x: anchorGridExhibit.tileX,
    y: anchorGridExhibit.tileY,
  };
  const doorCenter = getWallMidpoint(room, entranceWall);
  const line = bresenhamLine(doorCenter, anchorPos);

  // Build a set of exhibit-panel tile keys in this room for fast lookup
  const exhibitTileKeys = new Set<string>();
  for (const ex of grid.exhibits) {
    if (
      ex.tileX >= room.x &&
      ex.tileX < room.x + room.w &&
      ex.tileY >= room.y &&
      ex.tileY < room.y + room.h
    ) {
      exhibitTileKeys.add(tileKey(ex.tileX, ex.tileY));
    }
  }
  // Remove the anchor tile itself - it's the destination, not a blocker
  exhibitTileKeys.delete(tileKey(anchorPos.x, anchorPos.y));
  // Remove the doorway tile - it's the origin
  exhibitTileKeys.delete(tileKey(doorCenter.x, doorCenter.y));

  for (const point of line) {
    const key = tileKey(point.x, point.y);
    const gridTile = grid.tiles.get(key);
    const isExhibitPanel =
      exhibitTileKeys.has(key) ||
      (gridTile?.type === "exhibit-panel" &&
        key !== tileKey(anchorPos.x, anchorPos.y));

    if (isExhibitPanel) {
      violations.push({
        roomId: room.id,
        rule: "sightline",
        severity: "warning",
        message: `Exhibit at (${point.x},${point.y}) blocks the sightline from the ${entranceWall} entrance to anchor "${anchorRefId}"`,
      });
      break; // One sightline violation per room is sufficient
    }
  }
}

// ── Helpers ──

/** Extracts all exhibit segments from a room's four walls. */
function getExhibitSegments(room: PlacedRoom): ExhibitSegment[] {
  const results: ExhibitSegment[] = [];
  for (const wall of Object.values(room.walls)) {
    for (const seg of wall.segments) {
      if (seg.type === "exhibit") results.push(seg);
    }
  }
  return results;
}

/**
 * Builds a map of room ID to entrance wall direction by inspecting edges.
 * The first room (not a `to` in any main-path edge) defaults to "south".
 */
function buildEntranceMap(
  rooms: PlacedRoom[],
  edges: RoomEdge[],
): Map<string, string> {
  const entranceMap = new Map<string, string>();

  for (const edge of edges) {
    if (edge.type === "main-path" || edge.type === "side-branch") {
      entranceMap.set(edge.to, edge.toWall);
    }
  }

  for (const room of rooms) {
    if (!entranceMap.has(room.id)) {
      entranceMap.set(room.id, "south");
    }
  }

  return entranceMap;
}

/** Logs violations grouped by room to the console. */
function logViolations(
  rooms: PlacedRoom[],
  violations: DesignViolation[],
): void {
  if (violations.length === 0) {
    return;
  }

  const byRoom = new Map<string, DesignViolation[]>();
  for (const v of violations) {
    const list = byRoom.get(v.roomId) ?? [];
    list.push(v);
    byRoom.set(v.roomId, list);
  }

  const roomNameMap = new Map(rooms.map((r) => [r.id, r.name]));
  const severityIcon = { error: "X", warning: "!", info: "i" } as const;

  console.group(
    `[MuseumDesignValidator] ${violations.length} violation(s) across ${byRoom.size} room(s)`,
  );
  for (const [roomId, roomViolations] of byRoom) {
    const name = roomNameMap.get(roomId) ?? roomId;
    console.group(`${name} (${roomViolations.length})`);
    for (const v of roomViolations) {
      const icon = severityIcon[v.severity];
      console.warn(`[${icon}] ${v.rule}: ${v.message}`);
    }
    console.groupEnd();
  }
  console.groupEnd();
}
