/**
 * Terrain program for The First Fire (the Cinder Court procession bay).
 *
 * The Fire room is one flat cinder floor at the museum datum: the walk from
 * the Water door to the Earth door never changes height. What the terrain
 * owns is WHERE that floor exists. The procession plan carves an S-route of
 * corridors and three shrine courts out of solid basalt, and everything the
 * plan did not carve is rock the visitor cannot enter. Blocking is derived
 * from the same plan the Blender shell was built from, so the collider and
 * the rock can never disagree about where a wall stands.
 *
 * Like the other suppressed-tile bays, this module also owns the corridor
 * between the grotto and the fire room (both wings suppress tile geometry, so
 * the corridor between them has no other owner).
 */
import type { MuseumGrid, MuseumTerrainProgram } from "../domain/museum-grid-types";
import {
  TILE_METRES,
  bandRects,
  inRectClosed,
  unionRect,
  type Point2,
  type WorldRect,
} from "./drowned-gallery-terrain";
import {
  buildFirstFireProcessionPlanForGrid,
  pointInProcessionPolygon,
  type FirstFireProcessionPlan,
} from "./first-fire-procession-plan";

export const FIRE_ROOM_ID = "cave-fire";
export const GROTTO_ROOM_ID = "cave-water";

/** The whole bay is one datum: the cinder floor never leaves the door height. */
export const CINDER_FLOOR_Y = 0;

/**
 * How far outboard of a route's walked width the collider lets the visitor
 * stand. The carved shell's wall foot stands 0.30 m outboard of the walked
 * edge (see build-first-fire-graybox.py FLOOR_SHOULDER) and the production
 * remesh erodes it further, so half of that keeps the camera out of the rock
 * without making a 4.5 m corridor feel narrower than it is.
 */
export const ROUTE_SHOULDER_M = 0.15;

export interface FirstFireProcessionBay {
  plan: FirstFireProcessionPlan;
  /** The fire wing in world metres, wall tiles included. */
  fireRect: WorldRect;
  /** Corridor + door tiles between the grotto and the fire room. */
  corridor: WorldRect[];
  /** Rects other bays' orphan checks count as authored floor. */
  floorRects: { rect: WorldRect }[];
  /** Rects the composed cave terrain routes queries by. */
  bayFootprint: WorldRect[];
  bayBounds: WorldRect;
}

function wingWorldRect(b: { x: number; y: number; width: number; height: number }): WorldRect {
  const half = TILE_METRES / 2;
  return {
    minX: b.x * TILE_METRES - half,
    minZ: b.y * TILE_METRES - half,
    maxX: (b.x + b.width - 1) * TILE_METRES + half,
    maxZ: (b.y + b.height - 1) * TILE_METRES + half,
  };
}

export function buildFirstFireProcessionBay(grid: MuseumGrid): FirstFireProcessionBay | null {
  const fireWing = grid.wings.find((w) => w.id === FIRE_ROOM_ID);
  if (!fireWing) return null;
  const plan = buildFirstFireProcessionPlanForGrid(grid);
  if (!plan) return null;

  const fireRect = wingWorldRect(fireWing.bounds);
  const grottoWing = grid.wings.find((w) => w.id === GROTTO_ROOM_ID);
  let corridor: WorldRect[] = [];
  if (grottoWing) {
    const gb = grottoWing.bounds;
    const fb = fireWing.bounds;
    corridor = bandRects(
      grid,
      gb.x + gb.width - 1,
      fb.x,
      Math.min(gb.y, fb.y) - 2,
      Math.max(gb.y + gb.height, fb.y + fb.height) + 2,
      (t) => t === "corridor" || t === "door"
    );
  }
  const bayFootprint = [fireRect, ...corridor];
  return {
    plan,
    fireRect,
    corridor,
    floorRects: bayFootprint.map((rect) => ({ rect })),
    bayFootprint,
    bayBounds: unionRect(bayFootprint),
  };
}

function distanceToSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

function nearPolyline(p: Point2, points: readonly Point2[], reach: number): boolean {
  if (points.length === 1) {
    return Math.hypot(p.x - points[0]!.x, p.z - points[0]!.z) <= reach;
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(p, points[i]!, points[i + 1]!) <= reach) return true;
  }
  return false;
}

/**
 * Is a world point on carved floor? Everything the plan walks — the route
 * sections at their width, the three court floors, and the ember-bridge
 * threshold — is open; the rest of the room is basalt.
 */
export function isFirstFireCarvedAt(plan: FirstFireProcessionPlan, x: number, z: number): boolean {
  const p = { x, z };
  if (inRectClosed(plan.threshold, x, z)) return true;
  for (const shrine of plan.shrines) {
    if (pointInProcessionPolygon(p, shrine.courtPolygon)) return true;
  }
  for (const section of plan.pathSections) {
    if (nearPolyline(p, section.points, section.width / 2 + ROUTE_SHOULDER_M)) return true;
  }
  for (const corridor of plan.carved.corridors) {
    if (nearPolyline(p, corridor.points, corridor.width / 2 + ROUTE_SHOULDER_M)) return true;
  }
  return false;
}

export function createFirstFireProcessionTerrain(grid: MuseumGrid): MuseumTerrainProgram | null {
  const bay = buildFirstFireProcessionBay(grid);
  if (!bay) return null;
  const { plan } = bay;
  return {
    waterlineY: -Infinity,
    elevationAt: () => CINDER_FLOOR_Y,
    blockedAt(x, z) {
      // Only the room's interior is carved; the corridor from the grotto and
      // the door tiles are museum circulation and always open.
      if (!inRectClosed(plan.room, x, z)) return false;
      return !isFirstFireCarvedAt(plan, x, z);
    },
  };
}
