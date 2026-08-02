/**
 * Wall Segment Stamper
 *
 * Stamps wall segments (exhibits, doors, torches, rope barriers, signs, gaps)
 * onto a tile grid at deterministic positions. Each wall of a room is processed
 * left-to-right (or top-to-bottom for vertical walls), placing segment tiles
 * directly on the room boundary. Derived walls then naturally wrap around
 * segment tiles, guaranteeing wall-backed exhibits.
 */

import type { MuseumTile, ExhibitDefinition, Direction } from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";
import type { PlacedRoom, RoomEdge } from "../domain/layout-types";
import type { WallDefinition, WallSegment } from "../domain/wall-segment-types";
import { computeSegmentWidth } from "../domain/wall-segment-types";
import { ROOM_CONTENT } from "../data/museum-room-content";
import type { StampResult, DoorPosition } from "./types";

type WallName = "north" | "south" | "east" | "west";

interface WallGeometry {
  /** The coordinate that stays constant along this wall */
  fixedAxis: "x" | "y";
  /** The fixed coordinate value */
  fixedValue: number;
  /** The coordinate that advances along the wall */
  advanceAxis: "x" | "y";
  /** Starting value of the advancing axis (first tile of the room on this wall) */
  wallStart: number;
  /** Room dimension along the advancing axis (total tiles including corners) */
  roomDim: number;
  /** The direction exhibits on this wall face (inward) */
  facing: Direction;
}

function getWallGeometry(room: PlacedRoom, wall: WallName): WallGeometry {
  switch (wall) {
    case "north":
      return {
        fixedAxis: "y",
        fixedValue: room.y,
        advanceAxis: "x",
        wallStart: room.x,
        roomDim: room.w,
        facing: "south",
      };
    case "south":
      return {
        fixedAxis: "y",
        fixedValue: room.y + room.h - 1,
        advanceAxis: "x",
        wallStart: room.x,
        roomDim: room.w,
        facing: "north",
      };
    case "east":
      return {
        fixedAxis: "x",
        fixedValue: room.x + room.w - 1,
        advanceAxis: "y",
        wallStart: room.y,
        roomDim: room.h,
        facing: "west",
      };
    case "west":
      return {
        fixedAxis: "x",
        fixedValue: room.x,
        advanceAxis: "y",
        wallStart: room.y,
        roomDim: room.h,
        facing: "east",
      };
  }
}

export function stampRoom(
  tiles: Map<string, MuseumTile>,
  room: PlacedRoom,
  _edges: RoomEdge[],
): StampResult {
  const exhibits: ExhibitDefinition[] = [];
  const doorPositions: DoorPosition[] = [];

  const wallNames: WallName[] = ["north", "south", "east", "west"];

  for (const wallName of wallNames) {
    const wallDef: WallDefinition = room.walls[wallName];
    if (wallDef.segments.length === 0) continue;

    const geo = getWallGeometry(room, wallName);
    const { wallResult, wallDoors } = stampWall(
      tiles,
      room,
      wallName,
      wallDef,
      geo,
    );

    exhibits.push(...wallResult);
    doorPositions.push(...wallDoors);
  }

  return { exhibits, doorPositions };
}

function stampWall(
  tiles: Map<string, MuseumTile>,
  room: PlacedRoom,
  wallName: WallName,
  wallDef: WallDefinition,
  geo: WallGeometry,
): { wallResult: ExhibitDefinition[]; wallDoors: DoorPosition[] } {
  const wallResult: ExhibitDefinition[] = [];
  const wallDoors: DoorPosition[] = [];

  const { minMargin } = wallDef;
  const wallEnd = geo.wallStart + geo.roomDim - 1; // last tile (opposite corner)
  const contentWidth = wallDef.segments.reduce(
    (total, segment) => total + computeSegmentWidth(segment),
    0,
  );
  // Both corners and both declared margins stay clear. wallContentEnd is
  // exclusive so a segment can end immediately before the trailing margin.
  const wallContentStart = geo.wallStart + 1 + minMargin;
  const wallContentEnd = wallEnd - minMargin;
  const availableWidth = wallContentEnd - wallContentStart;

  if (contentWidth > availableWidth) {
    throw new Error(
      `Segments on ${wallName} wall of room "${room.id}" exceed available wall length. ` +
      `Need ${contentWidth} tiles, but only ${availableWidth} are available after margins.`,
    );
  }

  const slack = availableWidth - contentWidth;
  const alignmentOffset =
    wallDef.alignment === "end"
      ? slack
      : wallDef.alignment === "center"
        ? Math.floor(slack / 2)
        : 0;
  let cursor = wallContentStart + alignmentOffset;

  for (const segment of wallDef.segments) {
    const width = computeSegmentWidth(segment);

    stampSegmentTiles(tiles, segment, geo, cursor, width);

    // Collect exhibit definitions
    if (segment.type === "exhibit") {
      const centerOffset = Math.floor(width / 2);
      const exhibit = buildExhibitDefinition(
        room,
        segment.refId,
        segment.size,
        geo,
        cursor,
        centerOffset,
      );
      wallResult.push(exhibit);
    }

    // Collect door positions
    if (segment.type === "door") {
      const centerOffset = Math.floor(width / 2);
      const doorPos = buildDoorPosition(
        segment.edgeId,
        wallName,
        geo,
        cursor,
        centerOffset,
      );
      wallDoors.push(doorPos);
    }

    cursor += width;
  }

  return { wallResult, wallDoors };
}

function stampSegmentTiles(
  tiles: Map<string, MuseumTile>,
  segment: WallSegment,
  geo: WallGeometry,
  cursor: number,
  width: number,
): void {
  for (let i = 0; i < width; i++) {
    const advanceCoord = cursor + i;
    const key =
      geo.advanceAxis === "x"
        ? tileKey(advanceCoord, geo.fixedValue)
        : tileKey(geo.fixedValue, advanceCoord);

    const tile = segmentToTile(segment);
    if (tile) {
      tiles.set(key, tile);
    }
  }
}

function segmentToTile(segment: WallSegment): MuseumTile | null {
  switch (segment.type) {
    case "door":
      return { type: "door" };
    case "exhibit":
      return { type: "exhibit-panel", refId: segment.refId, facing: segment.facing };
    case "torch":
      return { type: "torch" };
    case "rope":
      return { type: "rope" };
    case "sign":
      return { type: "sign", refId: segment.refId };
    case "screen":
      return { type: "sequence-screen", refId: segment.refId, facing: segment.facing };
    case "gap":
      return null; // Floor already carved, nothing to stamp
  }
}

function buildExhibitDefinition(
  room: PlacedRoom,
  refId: string,
  size: "standard" | "large" | "dev-whiteboard",
  geo: WallGeometry,
  cursor: number,
  centerOffset: number,
): ExhibitDefinition {
  const centerAdvance = cursor + centerOffset;

  const tileX =
    geo.advanceAxis === "x" ? centerAdvance : geo.fixedValue;
  const tileY =
    geo.advanceAxis === "y" ? centerAdvance : geo.fixedValue;

  const exhibit: ExhibitDefinition = {
    id: refId,
    tileX,
    tileY,
    size,
  };

  // Look up plaque content from ROOM_CONTENT
  const roomContent = ROOM_CONTENT[room.id];
  const exhibitContent = roomContent?.exhibits?.[refId];
  if (exhibitContent) {
    exhibit.plaque = exhibitContent.plaque;
    if (exhibitContent.sequenceId) {
      exhibit.sequenceId = exhibitContent.sequenceId;
    }
  }

  return exhibit;
}

function buildDoorPosition(
  edgeId: string,
  wallName: WallName,
  geo: WallGeometry,
  cursor: number,
  centerOffset: number,
): DoorPosition {
  const centerAdvance = cursor + centerOffset;

  return {
    x: geo.advanceAxis === "x" ? centerAdvance : geo.fixedValue,
    y: geo.advanceAxis === "y" ? centerAdvance : geo.fixedValue,
    wall: wallName,
    edgeId,
  };
}
