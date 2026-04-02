/**
 * Museum Design Validator
 *
 * A "linter for museum design" that checks exhibit placements against
 * professional gallery layout rules. Reports violations but never auto-fixes.
 * Run after grid build in dev mode to surface placement issues early.
 */

import type { PlacedRoom, RoomEdge, ExhibitPlacement } from "../../domain/layout-types";
import type { MuseumGrid, Direction } from "../../domain/museum-grid-types";
import { tileKey } from "../../domain/museum-grid-types";
import type { DesignViolation, IMuseumDesignValidator } from "../contracts/IMuseumDesignValidator";
import {
  CORNER_AVOIDANCE,
  ENTRANCE_CLEARANCE,
  EXHIBIT_SPACING,
  MAX_WALL_COVERAGE,
  DEV_WHITEBOARDS_ENABLED,
  OPPOSITE_WALL,
} from "../../domain/museum-design-rules";

interface TilePos {
  x: number;
  y: number;
}

/**
 * Converts a wall-relative position (wall + fraction 0.0-1.0) to absolute
 * tile coordinates, flush against the wall. Mirrors the logic in MuseumGridBuilder.
 */
function computeWallPosition(
  room: PlacedRoom,
  wall: string,
  position: number,
): TilePos {
  const interiorW = room.w - 2;
  const interiorH = room.h - 2;

  switch (wall) {
    case "north":
      return { x: room.x + 1 + Math.floor(position * interiorW), y: room.y };
    case "south":
      return {
        x: room.x + 1 + Math.floor(position * interiorW),
        y: room.y + room.h - 1,
      };
    case "east":
      return {
        x: room.x + room.w - 1,
        y: room.y + 1 + Math.floor(position * interiorH),
      };
    case "west":
      return { x: room.x, y: room.y + 1 + Math.floor(position * interiorH) };
    default:
      return { x: room.x + 1, y: room.y + 1 };
  }
}

/** Returns the four corner tile positions for a room. */
function getRoomCorners(room: PlacedRoom): TilePos[] {
  return [
    { x: room.x, y: room.y },
    { x: room.x + room.w - 1, y: room.y },
    { x: room.x, y: room.y + room.h - 1 },
    { x: room.x + room.w - 1, y: room.y + room.h - 1 },
  ];
}

/** Manhattan distance between two tile positions. */
function tileDist(a: TilePos, b: TilePos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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

/** Returns the outward direction vector for a wall (pointing outside the room). */
function wallOutwardDelta(wall: string): TilePos {
  switch (wall) {
    case "north":
      return { x: 0, y: -1 };
    case "south":
      return { x: 0, y: 1 };
    case "east":
      return { x: 1, y: 0 };
    case "west":
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/** Returns the usable length of a wall (interior tiles, excluding corners). */
function wallLength(room: PlacedRoom, wall: string): number {
  if (wall === "north" || wall === "south") return room.w - 2;
  return room.h - 2;
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

export class MuseumDesignValidator implements IMuseumDesignValidator {
  /**
   * Validates a single room's exhibits against design rules that don't
   * require the full tile grid. Returns violations found.
   */
  validateRoom(room: PlacedRoom, entranceWall: string): DesignViolation[] {
    const violations: DesignViolation[] = [];
    const exhibits = room.exhibits ?? [];
    if (exhibits.length === 0) return violations;

    // Pre-compute tile positions for all exhibits
    const positioned = exhibits.map((ex) => ({
      exhibit: ex,
      pos: computeWallPosition(room, ex.wall, ex.position),
    }));

    this.checkCornerAvoidance(room, positioned, violations);
    this.checkEntranceClearance(room, entranceWall, positioned, violations);
    this.checkAnchorPresence(room, exhibits, violations);
    this.checkAnchorPlacement(room, entranceWall, exhibits, violations);
    this.checkSpacing(room, positioned, violations);
    this.checkWallCoverage(room, exhibits, violations);

    return violations;
  }

  /**
   * Validates all rooms plus cross-room and grid-dependent rules.
   * Logs a grouped summary to the console.
   */
  validateAll(
    rooms: PlacedRoom[],
    edges: RoomEdge[],
    grid: MuseumGrid,
  ): DesignViolation[] {
    const entranceMap = this.buildEntranceMap(rooms, edges);
    const allViolations: DesignViolation[] = [];

    for (const room of rooms) {
      const entrance = entranceMap.get(room.id) ?? "south";
      const roomViolations = this.validateRoom(room, entrance);
      allViolations.push(...roomViolations);

      // Grid-dependent checks
      const exhibits = room.exhibits ?? [];
      const positioned = exhibits.map((ex) => ({
        exhibit: ex,
        pos: computeWallPosition(room, ex.wall, ex.position),
      }));

      this.checkWallBacked(room, positioned, grid, allViolations);
      this.checkSightline(room, entrance, positioned, grid, allViolations);
    }

    this.logViolations(rooms, allViolations);
    return allViolations;
  }

  // ── Rule 1: Corner Avoidance ──

  private checkCornerAvoidance(
    room: PlacedRoom,
    positioned: { exhibit: ExhibitPlacement; pos: TilePos }[],
    violations: DesignViolation[],
  ): void {
    const corners = getRoomCorners(room);
    for (const { exhibit, pos } of positioned) {
      for (const corner of corners) {
        if (tileDist(pos, corner) <= CORNER_AVOIDANCE) {
          violations.push({
            roomId: room.id,
            rule: "corner-avoidance",
            severity: "warning",
            message: `Exhibit "${exhibit.refId}" at (${pos.x},${pos.y}) is within ${CORNER_AVOIDANCE} tile(s) of a room corner`,
            exhibitRefId: exhibit.refId,
          });
          break; // One violation per exhibit is enough
        }
      }
    }
  }

  // ── Rule 2: Entrance Clearance ──

  private checkEntranceClearance(
    room: PlacedRoom,
    entranceWall: string,
    positioned: { exhibit: ExhibitPlacement; pos: TilePos }[],
    violations: DesignViolation[],
  ): void {
    const doorCenter = getWallMidpoint(room, entranceWall);
    for (const { exhibit, pos } of positioned) {
      if (
        exhibit.wall === entranceWall &&
        tileDist(pos, doorCenter) <= ENTRANCE_CLEARANCE
      ) {
        violations.push({
          roomId: room.id,
          rule: "entrance-clearance",
          severity: "warning",
          message: `Exhibit "${exhibit.refId}" is within ${ENTRANCE_CLEARANCE} tiles of the entrance doorway on the ${entranceWall} wall`,
          exhibitRefId: exhibit.refId,
        });
      }
    }
  }

  // ── Rule 3: Wall-Backed (grid-dependent) ──

  private checkWallBacked(
    room: PlacedRoom,
    positioned: { exhibit: ExhibitPlacement; pos: TilePos }[],
    grid: MuseumGrid,
    violations: DesignViolation[],
  ): void {
    for (const { exhibit, pos } of positioned) {
      const delta = wallOutwardDelta(exhibit.wall);
      const behindKey = tileKey(pos.x + delta.x, pos.y + delta.y);
      const behindTile = grid.tiles.get(behindKey);
      if (!behindTile || behindTile.type !== "wall") {
        violations.push({
          roomId: room.id,
          rule: "wall-backed",
          severity: "error",
          message: `Exhibit "${exhibit.refId}" at (${pos.x},${pos.y}) has no wall tile behind it (${exhibit.wall} wall, expected wall at ${pos.x + delta.x},${pos.y + delta.y})`,
          exhibitRefId: exhibit.refId,
        });
      }
    }
  }

  // ── Rule 4: Anchor Presence ──

  private checkAnchorPresence(
    room: PlacedRoom,
    exhibits: ExhibitPlacement[],
    violations: DesignViolation[],
  ): void {
    const hasAnchorField = exhibits.some((ex) => ex.isAnchor !== undefined);

    if (!hasAnchorField) {
      // No exhibits have the field at all — info note
      if (DEV_WHITEBOARDS_ENABLED) return; // Suppress during dev whiteboard mode
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
      if (DEV_WHITEBOARDS_ENABLED) return; // Suppress during dev whiteboard mode
      violations.push({
        roomId: room.id,
        rule: "anchor-presence",
        severity: "warning",
        message: `Room "${room.name}" has anchor-annotated exhibits but none is marked isAnchor: true`,
      });
    }
  }

  // ── Rule 5: Anchor Placement ──

  private checkAnchorPlacement(
    room: PlacedRoom,
    entranceWall: string,
    exhibits: ExhibitPlacement[],
    violations: DesignViolation[],
  ): void {
    const anchor = exhibits.find((ex) => ex.isAnchor === true);
    if (!anchor) return;
    if (DEV_WHITEBOARDS_ENABLED && !exhibits.some((ex) => ex.isAnchor === true))
      return;

    const expectedWall = OPPOSITE_WALL[entranceWall as Direction];
    if (anchor.wall !== expectedWall) {
      violations.push({
        roomId: room.id,
        rule: "anchor-placement",
        severity: "warning",
        message: `Anchor exhibit "${anchor.refId}" is on the ${anchor.wall} wall but should be on the ${expectedWall} wall (opposite the ${entranceWall} entrance)`,
        exhibitRefId: anchor.refId,
      });
    }
  }

  // ── Rule 6: Spacing ──

  private checkSpacing(
    room: PlacedRoom,
    positioned: { exhibit: ExhibitPlacement; pos: TilePos }[],
    violations: DesignViolation[],
  ): void {
    for (let i = 0; i < positioned.length; i++) {
      const a = positioned[i];
      if (!a) continue;
      for (let j = i + 1; j < positioned.length; j++) {
        const b = positioned[j];
        if (!b) continue;

        // Same group — spacing rule is relaxed
        if (a.exhibit.group && b.exhibit.group && a.exhibit.group === b.exhibit.group) {
          continue;
        }

        const dist = tileDist(a.pos, b.pos);
        if (dist < EXHIBIT_SPACING) {
          violations.push({
            roomId: room.id,
            rule: "spacing",
            severity: "warning",
            message: `Exhibits "${a.exhibit.refId}" and "${b.exhibit.refId}" are ${dist} tile(s) apart (minimum ${EXHIBIT_SPACING})`,
          });
        }
      }
    }
  }

  // ── Rule 7: Wall Coverage ──

  private checkWallCoverage(
    room: PlacedRoom,
    exhibits: ExhibitPlacement[],
    violations: DesignViolation[],
  ): void {
    const wallCounts = new Map<string, number>();
    for (const ex of exhibits) {
      const size = ex.size === "large" ? 2 : ex.size === "dev-whiteboard" ? 3 : 1;
      wallCounts.set(ex.wall, (wallCounts.get(ex.wall) ?? 0) + size);
    }

    for (const [wall, count] of wallCounts) {
      const length = wallLength(room, wall);
      if (length <= 0) continue;
      const coverage = count / length;
      if (coverage > MAX_WALL_COVERAGE) {
        violations.push({
          roomId: room.id,
          rule: "wall-coverage",
          severity: "warning",
          message: `${wall} wall is ${Math.round(coverage * 100)}% covered by exhibits (max ${Math.round(MAX_WALL_COVERAGE * 100)}%)`,
        });
      }
    }
  }

  // ── Rule 8: Sightline (grid-dependent) ──

  private checkSightline(
    room: PlacedRoom,
    entranceWall: string,
    positioned: { exhibit: ExhibitPlacement; pos: TilePos }[],
    grid: MuseumGrid,
    violations: DesignViolation[],
  ): void {
    const anchorEntry = positioned.find((p) => p.exhibit.isAnchor === true);
    if (!anchorEntry) return;

    const doorCenter = getWallMidpoint(room, entranceWall);
    const anchorPos = anchorEntry.pos;
    const line = bresenhamLine(doorCenter, anchorPos);

    // Build a set of exhibit-panel tile keys in this room for fast lookup
    const exhibitTileKeys = new Set<string>();
    for (const { pos } of positioned) {
      exhibitTileKeys.add(tileKey(pos.x, pos.y));
    }
    // Remove the anchor tile itself — it's the destination, not a blocker
    exhibitTileKeys.delete(tileKey(anchorPos.x, anchorPos.y));
    // Remove the doorway tile — it's the origin
    exhibitTileKeys.delete(tileKey(doorCenter.x, doorCenter.y));

    for (const point of line) {
      const key = tileKey(point.x, point.y);
      // Check both our positioned exhibits and the actual grid tiles
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
          message: `Exhibit at (${point.x},${point.y}) blocks the sightline from the ${entranceWall} entrance to anchor "${anchorEntry.exhibit.refId}"`,
        });
        break; // One sightline violation per room is sufficient
      }
    }
  }

  // ── Helpers ──

  /**
   * Builds a map of room ID to entrance wall direction by inspecting edges.
   * The first room (not a `to` in any main-path edge) defaults to "south".
   */
  private buildEntranceMap(
    rooms: PlacedRoom[],
    edges: RoomEdge[],
  ): Map<string, string> {
    const entranceMap = new Map<string, string>();

    // Find rooms that are destinations of main-path edges
    for (const edge of edges) {
      if (edge.type === "main-path" || edge.type === "side-branch") {
        entranceMap.set(edge.to, edge.toWall);
      }
    }

    // First room (not a destination of any edge) defaults to south
    for (const room of rooms) {
      if (!entranceMap.has(room.id)) {
        entranceMap.set(room.id, "south");
      }
    }

    return entranceMap;
  }

  /** Logs violations grouped by room to the console. */
  private logViolations(
    rooms: PlacedRoom[],
    violations: DesignViolation[],
  ): void {
    if (violations.length === 0) {
      console.log("[MuseumDesignValidator] All rooms pass design checks.");
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
        console.log(`[${icon}] ${v.rule}: ${v.message}`);
      }
      console.groupEnd();
    }
    console.groupEnd();
  }
}
