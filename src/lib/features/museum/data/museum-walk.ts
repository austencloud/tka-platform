/**
 * The museum as ONE walk.
 *
 * Until this file existed the museum was three unconnected things:
 *
 * 1. `MUSEUM_ROOMS` — the 16-room graph the module renders, in which the whole
 *    Vulcan Cave is a SINGLE placeholder room called `vulcan-cave`.
 * 2. `VULCAN_CAVE_ROOMS` — the eleven authored cave rooms (the six element
 *    chambers among them), which only ever appeared on the
 *    `/test/museum-cave-3d` review route, in a grid of their own.
 * 3. `LOBBY_PLAN_ROOMS` — a lobby and a cave threshold on a third route.
 *
 * Three grids, three `buildMuseumGrid` calls, no way to walk from one to the
 * next. Austen (2026-08-05): *"now make all the rooms connect so they all can
 * be experienced in one walk."*
 *
 * So this module splices the authored cave INTO the museum graph, in place of
 * the placeholder, and hands back one room list and one edge list. The result
 * is a single continuous route:
 *
 *   entrance → cave-threshold → squeeze → water approach → water gallery →
 *   water → fire → earth → air → sun → moon → egypt-threshold → egyptian →
 *   renaissance → victorian → digital → suppression → crumble → gallery →
 *   fear → isolation → collaboration → gift-shop
 *
 * with the vtg-wing, construction-zone and janitor side-branches hanging off it
 * exactly as before.
 *
 * ── Why a composition module and not an edit to the graph ────────────────────
 *
 * `museum-room-graph.ts` stays the museum's own authored topology and
 * `vulcan-cave-floor-plan.ts` stays the cave's. Copying either one into the
 * other is how the two representations drift; this file only ever rewires the
 * three door ids where they meet, and every other room passes through
 * untouched.
 */
import type { RoomEdge, RoomNode } from "../domain/layout-types";
import type { MuseumGrid } from "../domain/museum-grid-types";
import type { WallDefinition, WallName } from "../domain/wall-segment-types";
import { MUSEUM_ROOMS, MUSEUM_EDGES } from "./museum-room-graph";
import {
  VULCAN_CAVE_ROOMS,
  VULCAN_CAVE_EDGES,
  composeCaveTerrainForGrid,
} from "./vulcan-cave-floor-plan";

/**
 * The room the cave replaces. Its two edges are the seams this module has to
 * re-tie, and its id must not survive into the walk — a room in the list with
 * no edges is a room the visitor can see on the plan and never reach.
 */
const PLACEHOLDER_CAVE_ID = "vulcan-cave";

/**
 * Door ids are derived, not declared: the corridor router looks up
 * `${from}->${to}` (corridor-router.ts:25). So a door segment whose `edgeId`
 * does not equal its edge's derived id is stamped into the wall and never gets
 * a corridor routed to it — a door to nowhere, which is exactly what the cave
 * threshold's south door has been since the cave plan was written.
 */
const ENTRANCE_TO_CAVE = "entrance->cave-threshold";
const EGYPT_THRESHOLD_TO_EGYPTIAN = "egypt-threshold->egyptian";
/** The two ids the placeholder owned, both now dead. */
const OLD_ENTRANCE_TO_CAVE = "entrance->vulcan-cave";
const OLD_CAVE_TO_EGYPTIAN = "vulcan-cave->egyptian";

/** Rewrites one door's edgeId on one wall, leaving every other segment alone. */
function retargetDoor(
  room: RoomNode,
  wall: WallName,
  fromId: string,
  toId: string
): RoomNode {
  const source = room.walls?.[wall];
  if (!source) return room;
  const rewritten: WallDefinition = {
    ...source,
    segments: source.segments.map((segment) =>
      segment.type === "door" && segment.edgeId === fromId
        ? { ...segment, edgeId: toId }
        : segment
    ),
  };
  return { ...room, walls: { ...room.walls!, [wall]: rewritten } };
}

/** Adds a door segment to a wall that had none. */
function addDoor(
  room: RoomNode,
  wall: WallName,
  edgeId: string,
  width: number
): RoomNode {
  const source = room.walls?.[wall];
  const rewritten: WallDefinition = {
    segments: [...(source?.segments ?? []), { type: "door", edgeId, width }],
    minMargin: source?.minMargin ?? 2,
    alignment: source?.alignment ?? "center",
  };
  return { ...room, walls: { ...room.walls!, [wall]: rewritten } };
}

function mapRoom(room: RoomNode): RoomNode {
  switch (room.id) {
    // The lobby's north door pointed at the placeholder.
    case "entrance":
      return retargetDoor(room, "north", OLD_ENTRANCE_TO_CAVE, ENTRANCE_TO_CAVE);
    // The Egyptian wing's west door pointed at the placeholder. The cave now
    // arrives through its own threshold instead.
    case "egyptian":
      return retargetDoor(
        room,
        "west",
        OLD_CAVE_TO_EGYPTIAN,
        EGYPT_THRESHOLD_TO_EGYPTIAN
      );
    // The cave threshold's south door has always carried the LOBBY plan's id.
    // In this walk the room south of it is `entrance`, so the id becomes the
    // one the router will actually look for.
    case "cave-threshold":
      return retargetDoor(
        room,
        "south",
        "lobby->cave-threshold",
        ENTRANCE_TO_CAVE
      );
    // The cave's far end was a sealed terminus: a west door back to the Moon
    // and torches everywhere else. It becomes the wing's hinge.
    case "egypt-threshold":
      return addDoor(room, "east", EGYPT_THRESHOLD_TO_EGYPTIAN, 4);
    default:
      return room;
  }
}

/**
 * Every room in the museum, cave chambers included, in one list.
 *
 * Order matters in one place only: `buildMuseumGrid` spawns the visitor in
 * `rooms[0]` (museum-grid-builder.ts:105), and that stays `entrance`.
 */
export const MUSEUM_WALK_ROOMS: RoomNode[] = [
  ...MUSEUM_ROOMS.filter((room) => room.id !== PLACEHOLDER_CAVE_ID).map(mapRoom),
  ...VULCAN_CAVE_ROOMS.map(mapRoom),
];

export const MUSEUM_WALK_EDGES: RoomEdge[] = [
  ...MUSEUM_EDGES.filter(
    (edge) =>
      edge.from !== PLACEHOLDER_CAVE_ID && edge.to !== PLACEHOLDER_CAVE_ID
  ),
  // Lobby into the cave. The threshold's own south door was authored at width
  // 6 and the lobby's north door at 4; the corridor takes the edge's width.
  {
    from: "entrance",
    to: "cave-threshold",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 4,
  },
  ...VULCAN_CAVE_EDGES,
  // Out the far side, where the wing's own fiction already points: the Egypt
  // threshold exists to preview the next wing's sandstone light.
  {
    from: "egypt-threshold",
    to: "egyptian",
    type: "main-path",
    fromWall: "east",
    toWall: "west",
    corridorWidth: 4,
  },
];

/**
 * Attach the cave's terrain to a grid built from the lists above.
 *
 * The six element chambers are not tile geometry — their floors, walls and
 * blocking come from authored layout programs (the drowned gallery's water
 * shelf, the Sundial's collapse ring, the Moon's crater and its low gravity).
 * A grid without this is a grid where the visitor walks on a flat plane through
 * six rooms that look right and behave like nothing.
 *
 * Safe to call on a cached grid: it reads the compiled bay bounds and writes
 * only `grid.terrain`.
 */
export function attachMuseumWalkTerrain(grid: MuseumGrid): void {
  const terrain = composeCaveTerrainForGrid(grid);
  if (terrain) grid.terrain = terrain;
}
