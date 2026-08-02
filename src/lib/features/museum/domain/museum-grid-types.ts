/**
 * Museum Grid Types
 *
 * Shared data format for the 2D museum game, floor plan editor,
 * and 2D-to-3D pipeline. 1 tile = 0.5m in real-world scale.
 */

export type TileType =
  | "floor"
  | "wall"
  | "door"
  | "exhibit-panel"
  | "performer-station"
  | "torch"
  | "pedestal"
  | "trigger"
  | "corridor"
  | "rope" // Barrier - visible, solid, not interactable (VTG Wing rope-off)
  | "scaffolding" // Construction Zone - visible clutter, solid
  | "sign" // Readable sign - interactable, not solid
  | "sequence-screen"; // TV screen showing sequence bartage - solid, interactable

export type FloorMaterial = "stone" | "marble" | "wood" | "dirt" | "sandstone";
export type Direction = "north" | "south" | "east" | "west";
export type MuseumFurnitureRole =
  | "bench"
  | "pedestal"
  | "bookshelf"
  | "lamp"
  | "plant"
  | "desk"
  | "desk-chair"
  | "trashcan"
  | "coat-rack"
  | "rug"
  | "scaffolding"
  | "sign";

export type MuseumFormationPresentation = "ritual" | "sculpture";
export type WingTheme =
  | "cave" // Wing 1: Ancient Origins - torchlight, stone
  | "classical" // Wing 2: Egypt/Greece - oil lamps, warm
  | "renaissance" // Wing 3: Da Vinci - natural light, studio
  | "industrial" // Wing 4: Victorian - gas lamps, brass
  | "digital" // Wing 5: CRT glow, fluorescent
  | "institutional" // Wing 6: Suppression - sterile, bureaucratic
  | "gallery" // Wing 7: Vessel Hall - spotlights
  | "modern" // Wing 8: Modern Vessel - dramatic
  | "futuristic" // Futures Chamber
  | "outdoor" // Ending rooms
  | "construction" // Construction Zone / Janitor's Closet
  | "retail"; // Gift Shop

/** Optional authored visual layer mounted over a room's tile-built structure. */
export interface MuseumRoomPresentation {
  modelPath?: string;
  ceilingModelPath?: string;
  emissiveBoost?: number;
  atmosphere?: {
    type: "dust";
    count: number;
    speed: number;
    colors: string[];
    sizeRange: [number, number];
  };
  /**
   * Skip rendering this wing's tile floors/walls/ceiling. Collision and
   * validation still come from the tile grid; a presentation layer (authored
   * GLB or graybox component) supplies the visible room instead.
   */
  suppressTileGeometry?: boolean;
}

export interface MuseumTile {
  type: TileType;
  material?: FloorMaterial;
  refId?: string;
  facing?: Direction;
}

export interface MuseumGrid {
  width: number;
  height: number;
  tileScale: 0.5;
  tiles: Map<string, MuseumTile>;
  wings: WingRegion[];
  spawn: { x: number; y: number; facing: Direction };
  exhibits: ExhibitDefinition[];
  performers: PerformerDefinition[];
  triggers: TriggerDefinition[];
  furniture: FurnitureDefinition[];
}

export interface MuseumGridSerialized {
  width: number;
  height: number;
  tileScale: 0.5;
  tiles: Record<string, MuseumTile>;
  wings: WingRegion[];
  spawn: { x: number; y: number; facing: Direction };
  exhibits: ExhibitDefinition[];
  performers: PerformerDefinition[];
  triggers: TriggerDefinition[];
  furniture: FurnitureDefinition[];
}

export interface WingRegion {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  theme: WingTheme;
  description?: string;
  roomPresentation?: MuseumRoomPresentation;
}

export interface ExhibitDefinition {
  id: string;
  tileX: number;
  tileY: number;
  /** Plaque size: standard (1 tile), large (2 tiles), or dev-whiteboard (3 tiles) */
  size?: "standard" | "large" | "dev-whiteboard";
  sequenceId?: string;
  plaque?: {
    title: string;
    subtitle?: string;
    body: string;
    barter?: string;
  };
}

export interface PerformerDefinition {
  id: string;
  tileX: number;
  tileY: number;
  facing: Direction;
  sequenceId?: string;
  autoPlay: boolean;
  /** Presentation variant used by telekinetic formations. */
  presentation?: MuseumFormationPresentation;
  /** Uniform visual scale for formation-style performers. */
  scale?: number;
  /** Circular collision footprint around the performer, expressed in tiles. */
  collisionRadiusTiles?: number;
}

export interface FurnitureDefinition {
  id: string;
  role: MuseumFurnitureRole;
  tileX: number;
  tileY: number;
  rotationY: number;
}

export interface TriggerDefinition {
  id: string;
  tileX: number;
  tileY: number;
  action: "show-lore" | "play-audio" | "show-image" | "custom";
  content?: {
    title?: string;
    body: string;
  };
}

// ── Serialization (Map doesn't survive JSON.stringify) ──

export function serializeGrid(grid: MuseumGrid): MuseumGridSerialized {
  const tiles: Record<string, MuseumTile> = {};
  for (const [key, tile] of grid.tiles) {
    tiles[key] = tile;
  }
  return {
    width: grid.width,
    height: grid.height,
    tileScale: grid.tileScale,
    tiles,
    wings: grid.wings,
    spawn: grid.spawn,
    exhibits: grid.exhibits,
    performers: grid.performers,
    triggers: grid.triggers,
    furniture: grid.furniture,
  };
}

export function deserializeGrid(data: MuseumGridSerialized): MuseumGrid {
  const tiles = new Map<string, MuseumTile>();
  for (const [key, tile] of Object.entries(data.tiles)) {
    tiles.set(key, tile);
  }
  return {
    width: data.width,
    height: data.height,
    tileScale: data.tileScale,
    tiles,
    wings: data.wings,
    spawn: data.spawn,
    exhibits: data.exhibits,
    performers: data.performers,
    triggers: data.triggers,
    furniture: data.furniture ?? [],
  };
}

// ── Helpers ──

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileKey(key: string): { x: number; y: number } {
  const parts = key.split(",");
  return { x: Number(parts[0]), y: Number(parts[1]) };
}

export function createEmptyGrid(width: number, height: number): MuseumGrid {
  return {
    width,
    height,
    tileScale: 0.5,
    tiles: new Map(),
    wings: [],
    spawn: {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      facing: "north",
    },
    exhibits: [],
    performers: [],
    triggers: [],
    furniture: [],
  };
}
