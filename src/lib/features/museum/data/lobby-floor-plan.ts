import type { RoomEdge, RoomNode, GridConfig } from "../domain/layout-types";
import type { WallDefinition } from "../domain/wall-segment-types";
import type {
  MuseumFloorPlanPoint,
  MuseumFloorPlanZone,
} from "../domain/museum-floor-plan-types";
import type { MuseumGridBuildResult } from "../services/types";
import { buildMuseumGrid } from "../services/museum-grid-builder";

const EMPTY_WALL: WallDefinition = { segments: [], minMargin: 1 };
const LOBBY_TO_CAVE_EDGE_ID = "lobby->cave-threshold";

export const CAVE_THRESHOLD_ROOM: RoomNode = {
  id: "cave-threshold",
  name: "Cave Threshold",
  material: "stone",
  theme: "cave",
  minInteriorWidth: 10,
  minInteriorHeight: 8,
  description:
    "A compressed stone vestibule that turns the visitor away from the bright lobby before the Vulcan Cave opens up.",
  walls: {
    north: EMPTY_WALL,
    south: {
      segments: [{ type: "door", edgeId: LOBBY_TO_CAVE_EDGE_ID, width: 6 }],
      minMargin: 1,
      alignment: "end",
    },
    east: {
      segments: [{ type: "torch" }],
      minMargin: 1,
      alignment: "center",
    },
    west: {
      segments: [{ type: "torch" }],
      minMargin: 1,
      alignment: "center",
    },
  },
};

const LOBBY_PLAN_ROOMS: RoomNode[] = [
  {
    id: "lobby",
    name: "Entrance Lobby",
    material: "marble",
    theme: "institutional",
    minInteriorWidth: 16,
    minInteriorHeight: 24,
    spawn: { offsetX: 0, offsetY: 0.42, facing: "north" },
    roomPresentation: {
      modelPath: "/models/museum/lobby/order-lobby-dressing.glb",
      ceilingModelPath: "/models/museum/lobby/order-lobby-ceiling.glb",
      atmosphere: {
        type: "dust",
        count: 72,
        speed: 0.035,
        colors: ["#d9ccb0", "#9d927c"],
        sizeRange: [0.007, 0.018],
      },
    },
    description:
      "A formal Order-built entrance hall with a central kinetic sculpture, a staffed east wall, and a cave threshold held out of the entry sightline.",
    walls: {
      north: {
        segments: [
          {
            type: "exhibit",
            refId: "lobby-first-pictograph",
            size: "large",
            facing: "south",
          },
          { type: "gap", minTiles: 3 },
          { type: "door", edgeId: LOBBY_TO_CAVE_EDGE_ID, width: 6 },
          { type: "gap", minTiles: 1 },
        ],
        minMargin: 1,
        alignment: "end",
      },
      south: {
        segments: [{ type: "door", edgeId: "outside->lobby", width: 6 }],
        minMargin: 1,
        alignment: "center",
      },
      east: {
        segments: [
          {
            type: "exhibit",
            refId: "lobby-reception",
            size: "standard",
            facing: "west",
          },
          { type: "gap", minTiles: 8 },
          {
            type: "exhibit",
            refId: "lobby-gift-shop-frontage",
            size: "large",
            facing: "west",
          },
        ],
        minMargin: 1,
        alignment: "end",
      },
      west: {
        segments: [
          {
            type: "exhibit",
            refId: "lobby-bulletin",
            size: "standard",
            facing: "east",
          },
          { type: "gap", minTiles: 5 },
          {
            type: "exhibit",
            refId: "lobby-guest-book",
            size: "standard",
            facing: "east",
          },
        ],
        minMargin: 1,
        alignment: "center",
      },
    },
    performers: [
      {
        offsetX: -0.12,
        offsetY: -0.05,
        facing: "south",
        refId: "lobby-telekinetic-formation",
        presentation: "sculpture",
        scale: 1.45,
        collisionRadiusTiles: 3,
      },
    ],
    furniture: [
      { role: "bench", offsetX: -0.34, offsetY: -0.08, rotationY: Math.PI / 2 },
      { role: "bench", offsetX: -0.34, offsetY: 0.16, rotationY: Math.PI / 2 },
      { role: "pedestal", offsetX: -0.3, offsetY: 0.29 },
      { role: "lamp", offsetX: -0.42, offsetY: 0.29 },
      { role: "coat-rack", offsetX: -0.42, offsetY: 0.42 },
      { role: "rug", offsetX: -0.12, offsetY: -0.05 },
      { role: "desk", offsetX: 0.38, offsetY: 0.12, rotationY: Math.PI / 2 },
      {
        role: "desk-chair",
        offsetX: 0.45,
        offsetY: 0.12,
        rotationY: -Math.PI / 2,
      },
      { role: "trashcan", offsetX: 0.43, offsetY: 0.23 },
      {
        role: "bookshelf",
        offsetX: 0.42,
        offsetY: 0.34,
        rotationY: Math.PI / 2,
      },
      {
        role: "bookshelf",
        offsetX: 0.42,
        offsetY: 0.43,
        rotationY: Math.PI / 2,
      },
      { role: "plant", offsetX: -0.38, offsetY: -0.38 },
      { role: "plant", offsetX: 0.38, offsetY: -0.38 },
    ],
  },
  CAVE_THRESHOLD_ROOM,
];

const LOBBY_PLAN_EDGES: RoomEdge[] = [
  {
    from: "lobby",
    to: "cave-threshold",
    type: "main-path",
    fromWall: "north",
    toWall: "south",
    corridorWidth: 5,
  },
];

const LOBBY_PLAN_GRID_CONFIG: GridConfig = {
  cellWidth: 40,
  cellHeight: 40,
  padding: 2,
};

export interface LobbyFloorPlan extends MuseumGridBuildResult {
  edges: RoomEdge[];
  zones: MuseumFloorPlanZone[];
  circulation: MuseumFloorPlanPoint[];
  lobbyInterior: {
    widthTiles: number;
    heightTiles: number;
    widthMetres: number;
    heightMetres: number;
  };
}

interface RelativeZone {
  id: string;
  number: number;
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone: MuseumFloorPlanZone["tone"];
}

const LOBBY_RELATIVE_ZONES: RelativeZone[] = [
  {
    id: "arrival",
    number: 1,
    title: "Arrival apron",
    description:
      "Six-tile entry, clear first view, and enough empty floor to arrive before reading anything.",
    x: 6,
    y: 29,
    width: 10,
    height: 6,
    tone: "arrival",
  },
  {
    id: "sculpture",
    number: 2,
    title: "Kinetic anchor",
    description:
      "A three-metre sculpture sits just left of the entry axis, keeping the first pictograph visible and the northbound route clear.",
    x: 8,
    y: 13,
    width: 8,
    height: 9,
    tone: "anchor",
  },
  {
    id: "guest-book",
    number: 3,
    title: "Guest book and chairs",
    description:
      "The social side of the room: varied handwriting, notices, and normal museum seating.",
    x: 1,
    y: 17,
    width: 7,
    height: 11,
    tone: "social",
  },
  {
    id: "reception",
    number: 4,
    title: "Reception and staff",
    description:
      "A believable staffed edge with the trash-can alarm close enough to feel like old procedure, not a gag prop.",
    x: 17,
    y: 18,
    width: 6,
    height: 8,
    tone: "service",
  },
  {
    id: "first-pictograph",
    number: 5,
    title: "First pictograph",
    description:
      "The alphabet wall earns the north end of the lobby and faces the visitor before the cave turn.",
    x: 7,
    y: 1,
    width: 9,
    height: 6,
    tone: "exhibit",
  },
  {
    id: "gift-shop",
    number: 6,
    title: "Closed gift shop frontage",
    description:
      "Glass and merchandise remain visible from the doors, establishing the eventual return loop without opening it yet.",
    x: 17,
    y: 29,
    width: 6,
    height: 6,
    tone: "retail",
  },
];

function resolveLobbyZone(
  zone: RelativeZone,
  lobbyBounds: { x: number; y: number }
): MuseumFloorPlanZone {
  return {
    ...zone,
    x: lobbyBounds.x + 1 + zone.x,
    y: lobbyBounds.y + 1 + zone.y,
  };
}

function findDoorCenter(
  build: MuseumGridBuildResult,
  bounds: { x: number; y: number; width: number; height: number },
  wall: "north" | "south"
): MuseumFloorPlanPoint {
  const y = wall === "north" ? bounds.y : bounds.y + bounds.height - 1;
  const doorXs: number[] = [];
  for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
    if (build.grid.tiles.get(`${x},${y}`)?.type === "door") doorXs.push(x);
  }
  if (doorXs.length === 0) {
    throw new Error(`Expected a ${wall} door in authored floor-plan bounds`);
  }
  const averageX = doorXs.reduce((sum, x) => sum + x, 0) / doorXs.length;
  return { x: averageX + 0.5, y: y + 0.5 };
}

export function buildLobbyFloorPlan(): LobbyFloorPlan {
  const build = buildMuseumGrid(
    LOBBY_PLAN_ROOMS,
    LOBBY_PLAN_EDGES,
    LOBBY_PLAN_GRID_CONFIG
  );
  const lobby = build.grid.wings.find((wing) => wing.id === "lobby");
  const cave = build.grid.wings.find((wing) => wing.id === "cave-threshold");
  if (!lobby || !cave) {
    throw new Error("Lobby floor plan did not produce both authored rooms");
  }

  const lobbyExit = findDoorCenter(build, lobby.bounds, "north");
  const caveEntry = findDoorCenter(build, cave.bounds, "south");
  const zones = LOBBY_RELATIVE_ZONES.map((zone) =>
    resolveLobbyZone(zone, lobby.bounds)
  );
  zones.push({
    id: "cave-dogleg",
    number: 7,
    title: "Cave dogleg",
    description:
      "The route leaves the entry axis, turns once, and sheds the lobby light before the stone room begins.",
    x: Math.min(lobbyExit.x, caveEntry.x) - 2,
    y: cave.bounds.y,
    width: Math.abs(lobbyExit.x - caveEntry.x) + 5,
    height: lobby.bounds.y - cave.bounds.y + 1,
    tone: "threshold",
  });

  const lobbyCenterX = lobby.bounds.x + lobby.bounds.width / 2;
  const eastCirculationLaneX = lobbyCenterX + 4.5;
  const circulation: MuseumFloorPlanPoint[] = [
    { x: build.grid.spawn.x + 0.5, y: build.grid.spawn.y + 0.5 },
    { x: lobbyCenterX, y: lobby.bounds.y + 29 },
    { x: eastCirculationLaneX, y: lobby.bounds.y + 27 },
    { x: eastCirculationLaneX, y: lobby.bounds.y + 10 },
    lobbyExit,
    caveEntry,
    {
      x: cave.bounds.x + cave.bounds.width / 2,
      y: cave.bounds.y + cave.bounds.height / 2,
    },
  ];

  const widthTiles = lobby.bounds.width - 2;
  const heightTiles = lobby.bounds.height - 2;

  return {
    ...build,
    edges: LOBBY_PLAN_EDGES,
    zones,
    circulation,
    lobbyInterior: {
      widthTiles,
      heightTiles,
      widthMetres: widthTiles * build.grid.tileScale,
      heightMetres: heightTiles * build.grid.tileScale,
    },
  };
}
