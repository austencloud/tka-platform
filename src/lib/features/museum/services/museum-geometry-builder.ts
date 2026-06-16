import {
  Object3D,
  BoxGeometry,
  MeshStandardMaterial,
  BatchedMesh,
  TextureLoader,
  RepeatWrapping,
} from "three";
import type { Texture ,
  CylinderGeometry} from "three";
import type { MuseumGrid, MuseumTile, FloorMaterial, TileType } from "../domain/museum-grid-types";
import type { WingTheme } from "../domain/museum-grid-types";
import { parseTileKey, tileKey } from "../domain/museum-grid-types";
import type { PlaqueContent, PlaqueSize } from "./types";
import { MANUAL_PLACEMENTS } from '../data/museum-manual-placements';
import { getPlaceableObject } from '../domain/placeable-object-registry';
import { resolveWallRuns } from "./wall-run-resolver";
import { proceduralKitProvider, glbKitProvider } from "./kit-piece-provider";
import type { BatchTransfer } from "../workers/geometry-worker-protocol";

// ── Constants ──

const TILE_SIZE = 0.5;
const WALL_HEIGHT = 4.5;
const WALL_Y_CENTER = WALL_HEIGHT / 2;

const FLOOR_COLORS: Record<FloorMaterial, string> = {
  stone: "#3a3530",
  marble: "#e0d8c8",
  wood: "#4a3820",
  dirt: "#352a1e",
  sandstone: "#4a3e2a",
};

const TILE_TYPE_COLORS: Partial<Record<TileType, string>> = {
  wall: "#2a2420",
  door: "#4a3e28",
  "exhibit-panel": "#1a1a18",
  "performer-station": "#1a3a1a",
  pedestal: "#4a3e30",
  sign: "#2a3040",
};

const WING_WALL_COLORS: Record<WingTheme, string> = {
  cave: "#2a1e14",
  classical: "#3a3020",
  renaissance: "#2e2818",
  industrial: "#282828",
  digital: "#141428",
  institutional: "#e8e4e0",
  gallery: "#201820",
  modern: "#1a1a1a",
  futuristic: "#141420",
  outdoor: "#2a3020",
  construction: "#2e2a1e",
  retail: "#2a2220",
};

// Per-wing ambient color/intensity - used by room light computation
const WING_AMBIENT: Record<WingTheme, { color: string; intensity: number }> = {
  cave:          { color: "#8a6030", intensity: 0.8 },
  classical:     { color: "#a08050", intensity: 1.0 },
  renaissance:   { color: "#907050", intensity: 1.0 },
  industrial:    { color: "#808080", intensity: 0.9 },
  digital:       { color: "#4060a0", intensity: 0.9 },
  institutional: { color: "#d0d8e0", intensity: 2.0 },
  gallery:       { color: "#a09080", intensity: 0.9 },
  modern:        { color: "#606060", intensity: 0.8 },
  futuristic:    { color: "#506080", intensity: 0.8 },
  outdoor:       { color: "#c8b880", intensity: 1.6 },
  construction:  { color: "#908060", intensity: 0.85 },
  retail:        { color: "#a09080", intensity: 1.0 },
};

// Scale factor for room PointLight intensity relative to the old global AmbientLight values
const ROOM_LIGHT_SCALE = 1.5;

const FLOOR_TEXTURE_MAP: Partial<Record<FloorMaterial, string>> = {
  stone: "Rock035",
  marble: "Marble006",
  wood: "WoodFloor007",
  sandstone: "Rock003",
};

const WALL_TEXTURE_MAP: Partial<Record<WingTheme, string>> = {
  cave: "Rock035",
  classical: "Rock003",
  renaissance: "Rock003",
  gallery: "Plaster001",
  modern: "Plaster001",
};

// ── Plaque placement data ──

const PLAQUE_YAW: Record<string, number> = {
  south: 0,
  north: Math.PI,
  east: Math.PI / 2,
  west: -Math.PI / 2,
};

const PLAQUE_WALL_SHIFT: Record<string, { x: number; z: number }> = {
  south: { x: 0, z: TILE_SIZE * 0.4 },
  north: { x: 0, z: -TILE_SIZE * 0.4 },
  east: { x: TILE_SIZE * 0.4, z: 0 },
  west: { x: -TILE_SIZE * 0.4, z: 0 },
};

// ── Types ──

interface TileBucket {
  positions: { x: number; z: number }[];
  color: string;
  floorMaterial?: FloorMaterial;
  wingTheme?: WingTheme;
}

export interface PlaquePlacement {
  id: number;
  tileX: number;
  tileY: number;
  worldX: number;
  worldZ: number;
  yaw: number;
  wallOffsetX: number;
  wallOffsetZ: number;
  content: PlaqueContent;
  size: PlaqueSize;
  refId: string;
}

export interface TorchPosition {
  id: number;
  tileX: number;
  tileY: number;
  x: number;
  z: number;
  wallOffsetX: number;
  wallOffsetZ: number;
  wingTheme: WingTheme;
  /** Persistence ID from PlacementPersister - only set on manually placed torches */
  placementId?: string;
}

export interface LightPosition {
  id: number;
  tileX: number;
  tileY: number;
  x: number;
  z: number;
}

/** Per-room ambient fill light - replaces the single global AmbientLight */
export interface RoomLight {
  wingId: string;
  theme: WingTheme;
  positions: { x: number; z: number }[];
  color: string;
  intensity: number;
  distance: number;
}

export interface BatchedMeshData {
  mesh: BatchedMesh;
  /** Instance IDs for visibility control (e.g., ceiling toggle) */
  instanceIds?: number[];
}

// ── Yield helper ──

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── PBR material cache (shared across calls) ──

const textureLoader = new TextureLoader();
const pbrMaterialCache = new Map<string, MeshStandardMaterial>();

function loadPBR(packName: string, tileRepeat: number = 8, tintColor?: string): MeshStandardMaterial {
  const cacheKey = `${packName}_${tileRepeat}_${tintColor ?? "none"}`;
  const cached = pbrMaterialCache.get(cacheKey);
  if (cached) return cached;

  const basePath = `/assets/museum/textures/${packName.toLowerCase()}`;
  const prefix = `${packName}_1K-JPG`;

  const colorTex = textureLoader.load(`${basePath}/${prefix}_Color.jpg`);
  const normalTex = textureLoader.load(`${basePath}/${prefix}_NormalGL.jpg`);
  const roughnessTex = textureLoader.load(`${basePath}/${prefix}_Roughness.jpg`);

  const textures: Texture[] = [colorTex, normalTex, roughnessTex];
  for (const t of textures) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(tileRepeat, tileRepeat);
  }

  const mat = new MeshStandardMaterial({
    map: colorTex,
    normalMap: normalTex,
    roughnessMap: roughnessTex,
    color: tintColor ?? "#ffffff",
  });

  pbrMaterialCache.set(cacheKey, mat);
  return mat;
}

// ── Dry-run result (pure data, no Three.js objects) ──

export interface MuseumGeometryDryRun {
  floorBuckets: Map<string, TileBucket>;
  wallBuckets: Map<string, TileBucket>;
  plaquePlacements: PlaquePlacement[];
  performerPositions: { x: number; z: number }[];
  pedestalPositions: { x: number; z: number }[];
  signPositions: { x: number; z: number }[];
  torchPositions: TorchPosition[];
  totalFloorInstances: number;
  totalWallInstances: number;
  totalTiles: number;
}

/**
 * Phase 1 of geometry building: bucket all tiles by material/theme.
 * Pure data structures - no Three.js, no WebGL. Safe to run in vitest/jsdom.
 * Used by buildMuseumGeometry internally and by performance tests directly.
 */
export function bucketMuseumTiles(grid: MuseumGrid): MuseumGeometryDryRun {
  const floorBuckets = new Map<string, TileBucket>();
  const wallBuckets = new Map<string, TileBucket>();
  const plaquePlacements: PlaquePlacement[] = [];
  const performerPositions: { x: number; z: number }[] = [];
  const pedestalPositions: { x: number; z: number }[] = [];
  const signPositions: { x: number; z: number }[] = [];
  const torchPositions: TorchPosition[] = [];
  let nextPlaqueId = 0;
  let nextTorchId = 0;

  // Wing theme lookup map (avoids O(tiles * wings) per wall tile)
  const wingThemeByTile = new Map<string, WingTheme>();
  for (const wing of grid.wings) {
    const b = wing.bounds;
    for (let tx = b.x; tx < b.x + b.width; tx++) {
      for (let ty = b.y; ty < b.y + b.height; ty++) {
        wingThemeByTile.set(tileKey(tx, ty), wing.theme);
      }
    }
  }

  function getWingThemeAt(tileX: number, tileY: number): WingTheme | null {
    return wingThemeByTile.get(tileKey(tileX, tileY)) ?? null;
  }

  const exhibitByTile = new Map<string, typeof grid.exhibits[0]>();
  for (const exhibit of grid.exhibits) {
    exhibitByTile.set(tileKey(exhibit.tileX, exhibit.tileY), exhibit);
  }

  function addToFloorBucket(color: string, x: number, z: number, material?: FloorMaterial): void {
    let bucket = floorBuckets.get(color);
    if (!bucket) {
      bucket = { positions: [], color, floorMaterial: material };
      floorBuckets.set(color, bucket);
    }
    bucket.positions.push({ x, z });
  }

  function addToWallBucket(color: string, x: number, z: number, theme?: WingTheme): void {
    let bucket = wallBuckets.get(color);
    if (!bucket) {
      bucket = { positions: [], color, wingTheme: theme };
      wallBuckets.set(color, bucket);
    }
    bucket.positions.push({ x, z });
  }

  for (const [key, tile] of grid.tiles) {
    const { x: tileX, y: tileY } = parseTileKey(key);
    const worldX = tileX * TILE_SIZE;
    const worldZ = tileY * TILE_SIZE;

    switch (tile.type) {
      case "floor":
      case "corridor": {
        const material = tile.material ?? "stone";
        const color = FLOOR_COLORS[material];
        addToFloorBucket(color, worldX, worldZ, material);
        break;
      }
      case "door":
        addToFloorBucket(TILE_TYPE_COLORS.door!, worldX, worldZ);
        break;
      case "wall": {
        const wingTheme = getWingThemeAt(tileX, tileY);
        const wallColor = wingTheme ? WING_WALL_COLORS[wingTheme] : TILE_TYPE_COLORS.wall!;
        addToWallBucket(wallColor, worldX, worldZ, wingTheme ?? undefined);
        break;
      }
      case "exhibit-panel": {
        const exhibitDef = exhibitByTile.get(tileKey(tileX, tileY));
        if (exhibitDef) {
          // Wall behind the plaque so the exhibit isn't an open hole to the
          // exterior. The plaque is offset off the wall face by PLAQUE_WALL_SHIFT,
          // so it still reads in front. This tile is now wall, not walkable floor.
          const exhibitWingTheme = getWingThemeAt(tileX, tileY);
          const exhibitWallColor = exhibitWingTheme
            ? WING_WALL_COLORS[exhibitWingTheme]
            : TILE_TYPE_COLORS.wall!;
          addToWallBucket(exhibitWallColor, worldX, worldZ, exhibitWingTheme ?? undefined);
          const facing = tile.facing ?? "south";
          const plaqueContent: PlaqueContent = exhibitDef.plaque ?? {
            title: exhibitDef.id ?? "Exhibit",
            body: "This exhibit is under construction.",
          };
          const plaqueSize: PlaqueSize = exhibitDef.size ?? "standard";
          const yaw = PLAQUE_YAW[facing] ?? 0;
          const wallShift = PLAQUE_WALL_SHIFT[facing] ?? { x: 0, z: 0 };
          plaquePlacements.push({
            id: nextPlaqueId++, tileX, tileY, worldX, worldZ, yaw,
            wallOffsetX: wallShift.x, wallOffsetZ: wallShift.z,
            content: plaqueContent, size: plaqueSize, refId: exhibitDef.id,
          });
        } else {
          const wingTheme = getWingThemeAt(tileX, tileY);
          const wallColor = wingTheme ? WING_WALL_COLORS[wingTheme] : TILE_TYPE_COLORS.wall!;
          addToWallBucket(wallColor, worldX, worldZ, wingTheme ?? undefined);
        }
        break;
      }
      case "performer-station": {
        const mat = tile.material ?? "stone";
        addToFloorBucket(FLOOR_COLORS[mat], worldX, worldZ, mat);
        performerPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "pedestal": {
        const mat = tile.material ?? "stone";
        addToFloorBucket(FLOOR_COLORS[mat], worldX, worldZ, mat);
        pedestalPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "sign": {
        const mat = tile.material ?? "stone";
        addToFloorBucket(FLOOR_COLORS[mat], worldX, worldZ, mat);
        signPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "torch": {
        const mat = tile.material ?? "stone";
        addToFloorBucket(FLOOR_COLORS[mat], worldX, worldZ, mat);
        let wallOffsetX = 0;
        let wallOffsetZ = 0;
        const neighbors = [
          { dx: 0, dy: -1, ox: 0, oz: -1 },
          { dx: 0, dy: 1, ox: 0, oz: 1 },
          { dx: -1, dy: 0, ox: -1, oz: 0 },
          { dx: 1, dy: 0, ox: 1, oz: 0 },
        ];
        for (const n of neighbors) {
          const neighborTile = grid.tiles.get(`${tileX + n.dx},${tileY + n.dy}`);
          if (neighborTile?.type === "wall") {
            wallOffsetX = -n.ox * TILE_SIZE * 0.35;
            wallOffsetZ = -n.oz * TILE_SIZE * 0.35;
            break;
          }
        }
        const torchWingTheme = getWingThemeAt(tileX, tileY) ?? "cave";
        torchPositions.push({
          id: nextTorchId++, tileX, tileY,
          x: worldX, z: worldZ,
          wallOffsetX, wallOffsetZ,
          wingTheme: torchWingTheme,
        });
        break;
      }
      case "rope":
      case "scaffolding":
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        break;
      case "trigger":
        break;
    }
  }

  let totalFloorInstances = 0;
  for (const [, b] of floorBuckets) totalFloorInstances += b.positions.length;
  let totalWallInstances = 0;
  for (const [, b] of wallBuckets) totalWallInstances += b.positions.length;

  return {
    floorBuckets, wallBuckets,
    plaquePlacements, performerPositions, pedestalPositions, signPositions, torchPositions,
    totalFloorInstances, totalWallInstances,
    totalTiles: grid.tiles.size,
  };
}

// ── Per-room bucketing (for streaming) ──

export interface PerRoomBuckets {
  /** Per-wing bucketed tile data. Key = wingId. */
  roomBuckets: Map<string, MuseumGeometryDryRun>;
  /** Tiles outside all wing bounds (corridors + corridor walls). Always loaded. */
  corridorBucket: MuseumGeometryDryRun;
}

/**
 * Partition tiles by wing for per-room streaming. Each tile is assigned to
 * exactly one room (by wing bounds) or to the corridor bucket (if outside
 * all wing bounds). Pure data - no Three.js.
 */
export function bucketMuseumTilesByRoom(grid: MuseumGrid): PerRoomBuckets {
  // Build wing lookup: tile → wingId
  const tileToWing = new Map<string, string>();
  for (const wing of grid.wings) {
    const b = wing.bounds;
    for (let tx = b.x; tx < b.x + b.width; tx++) {
      for (let ty = b.y; ty < b.y + b.height; ty++) {
        tileToWing.set(tileKey(tx, ty), wing.id);
      }
    }
  }

  // Split tiles into per-wing maps and a corridor map
  const wingTiles = new Map<string, Map<string, MuseumTile>>();
  const corridorTiles = new Map<string, MuseumTile>();

  for (const [key, tile] of grid.tiles) {
    const wingId = tileToWing.get(key);
    if (wingId) {
      let wt = wingTiles.get(wingId);
      if (!wt) { wt = new Map(); wingTiles.set(wingId, wt); }
      wt.set(key, tile);
    } else {
      corridorTiles.set(key, tile);
    }
  }

  // Bucket each wing's tiles independently
  const roomBuckets = new Map<string, MuseumGeometryDryRun>();
  for (const wing of grid.wings) {
    const tiles = wingTiles.get(wing.id);
    if (!tiles || tiles.size === 0) continue;

    // Create a mini-grid with only this wing's tiles + exhibits/performers
    const miniGrid: MuseumGrid = {
      ...grid,
      tiles,
      exhibits: grid.exhibits.filter(e => {
        const b = wing.bounds;
        return e.tileX >= b.x && e.tileX < b.x + b.width &&
               e.tileY >= b.y && e.tileY < b.y + b.height;
      }),
      performers: grid.performers.filter(p => {
        const b = wing.bounds;
        return p.tileX >= b.x && p.tileX < b.x + b.width &&
               p.tileY >= b.y && p.tileY < b.y + b.height;
      }),
      wings: [wing],
    };
    roomBuckets.set(wing.id, bucketMuseumTiles(miniGrid));
  }

  // Bucket corridor tiles
  const corridorGrid: MuseumGrid = {
    ...grid,
    tiles: corridorTiles,
    exhibits: [],
    performers: [],
    wings: [],
  };
  const corridorBucket = bucketMuseumTiles(corridorGrid);

  return { roomBuckets, corridorBucket };
}

// ── Per-room chunk builder ──

/** One room's worth of Three.js geometry, ready to add/remove from the scene */
export interface RoomChunk {
  wingId: string;
  floorMeshes: BatchedMeshData[];
  wallMeshes: BatchedMeshData[];
  /** When set (institutional wing), kit-built wall group replaces wallMeshes. */
  kitWalls: import("three").Object3D | null;
  ceilingMesh: BatchedMeshData | null;
  pedestalMesh: BatchedMesh | null;
  signMesh: BatchedMesh | null;
  /** @deprecated No longer rendered - MuseumPerformerStation3D owns the visual platform */
  performerMesh: null;
  torchPositions: TorchPosition[];
  plaquePlacements: PlaquePlacement[];
  performerPositions: { x: number; z: number }[];
  exhibitLightPositions: LightPosition[];
  ceilingLightPositions: LightPosition[];
  sunlightPositions: LightPosition[];
  roomLight: RoomLight | null;
}

// Shared geometry instances (created once, reused across all room chunks)
let sharedFloorGeo: BoxGeometry | null = null;
let sharedWallGeo: BoxGeometry | null = null;
let sharedPedestalGeo: BoxGeometry | null = null;
let sharedSignGeo: BoxGeometry | null = null;
// Performer geo removed - MuseumPerformerStation3D renders its own platform

function getSharedGeometries() {
  // Full tile width so adjacent tiles abut (no seam grid), real depth so you
  // can't see through to the void below. Placed at y=-0.1 so the top stays at 0.
  if (!sharedFloorGeo) sharedFloorGeo = new BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE);
  if (!sharedWallGeo) sharedWallGeo = new BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
  if (!sharedPedestalGeo) sharedPedestalGeo = new BoxGeometry(TILE_SIZE * 0.7, 0.5, TILE_SIZE * 0.7);
  if (!sharedSignGeo) sharedSignGeo = new BoxGeometry(TILE_SIZE * 0.6, 0.4, 0.06);
  return {
    floorGeo: sharedFloorGeo,
    wallGeo: sharedWallGeo,
    pedestalGeo: sharedPedestalGeo,
    signGeo: sharedSignGeo,
  };
}

/**
 * Build BatchedMeshes for a single room chunk from pre-bucketed data.
 * BatchedMesh provides per-instance GPU frustum culling (enabled by default),
 * per-instance visibility via setVisibleAt(), and built-in raycasting with batchId.
 * Materials use the global PBR cache so textures load once across all rooms.
 */
export async function buildRoomChunk(
  buckets: MuseumGeometryDryRun,
  wingId: string,
  wing: { bounds: { x: number; y: number; width: number; height: number }; theme: WingTheme } | null,
): Promise<RoomChunk> {
  const { floorGeo, wallGeo, pedestalGeo, signGeo } = getSharedGeometries();
  const dummy = new Object3D();

  /** Create a BatchedMesh from a geometry + positions array */
  function buildBatch(
    geo: BoxGeometry | CylinderGeometry,
    material: MeshStandardMaterial,
    positions: { x: number; z: number }[],
    yPos: number,
  ): { mesh: BatchedMesh; instanceIds: number[] } {
    const vertCount = geo.getAttribute("position").count;
    const idxCount = geo.getIndex()?.count ?? vertCount;
    const batch = new BatchedMesh(positions.length, vertCount, idxCount, material);
    batch.perObjectFrustumCulled = true;
    const geoId = batch.addGeometry(geo);
    const instanceIds: number[] = [];
    for (const pos of positions) {
      dummy.position.set(pos.x, yPos, pos.z);
      dummy.updateMatrix();
      const id = batch.addInstance(geoId);
      batch.setMatrixAt(id, dummy.matrix);
      instanceIds.push(id);
    }
    return { mesh: batch, instanceIds };
  }

  // Floor batches - one per material bucket
  const floorMeshes: BatchedMeshData[] = [];
  for (const [, bucket] of buckets.floorBuckets) {
    if (bucket.positions.length === 0) continue;
    const texturePack = bucket.floorMaterial ? FLOOR_TEXTURE_MAP[bucket.floorMaterial] : undefined;
    const material = texturePack
      ? loadPBR(texturePack, 8)
      : new MeshStandardMaterial({ color: bucket.color });
    const { mesh, instanceIds } = buildBatch(floorGeo, material, bucket.positions, -0.1);
    floorMeshes.push({ mesh, instanceIds });
  }

  await yieldToMain();

  // Wall geometry. The institutional wing is built as merged kit runs (sealed,
  // continuous, no per-tile seams) via the resolver + provider; every other
  // wing keeps the per-tile BatchedMesh path until its kit lands.
  const wallMeshes: BatchedMeshData[] = [];
  let kitWalls: import("three").Object3D | null = null;

  if (wing && wing.theme === "institutional") {
    // Reconstruct wall tile coords from the bucketed world positions, tracking
    // their extent. The room rect is derived from the actual wall tiles, not
    // wing.bounds — a room's walls can be inset from the wing rectangle, and
    // scanning the wing border would then miss them entirely.
    const wallTiles = new Set<string>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, bucket] of buckets.wallBuckets) {
      for (const p of bucket.positions) {
        const tx = Math.round(p.x / TILE_SIZE);
        const ty = Math.round(p.z / TILE_SIZE);
        wallTiles.add(`${tx},${ty}`);
        if (tx < minX) minX = tx;
        if (tx > maxX) maxX = tx;
        if (ty < minY) minY = ty;
        if (ty > maxY) maxY = ty;
      }
    }
    if (wallTiles.size > 0) {
      const room = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const resolved = resolveWallRuns(room, (x, y) => wallTiles.has(`${x},${y}`));
      const color = WING_WALL_COLORS.institutional;
      const provider = glbKitProvider ?? proceduralKitProvider;
      kitWalls = provider.buildWalls(resolved, "institutional", TILE_SIZE, WALL_HEIGHT, color);
    }
  } else {
    for (const [, bucket] of buckets.wallBuckets) {
      if (bucket.positions.length === 0) continue;
      const texturePack = bucket.wingTheme ? WALL_TEXTURE_MAP[bucket.wingTheme] : undefined;
      const wallMat = texturePack
        ? loadPBR(texturePack, 4, bucket.color)
        : new MeshStandardMaterial({ color: bucket.color });
      const { mesh, instanceIds } = buildBatch(wallGeo, wallMat, bucket.positions, WALL_Y_CENTER);
      mesh.userData.cameraCollider = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      wallMeshes.push({ mesh, instanceIds });
    }
  }

  await yieldToMain();

  // Ceiling batch - all floor positions at WALL_HEIGHT.
  // All rooms share identical ceiling appearance, so we cache the material
  // (same pattern as floor/wall PBR cache) instead of creating one per room.
  const allFloorPositions: { x: number; z: number }[] = [];
  for (const [, bucket] of buckets.floorBuckets) {
    for (const pos of bucket.positions) allFloorPositions.push(pos);
  }
  let ceilingMesh: BatchedMeshData | null = null;
  if (allFloorPositions.length > 0) {
    const ceilingCacheKey = "__ceiling__";
    let ceilingMat = pbrMaterialCache.get(ceilingCacheKey);
    if (!ceilingMat) {
      ceilingMat = new MeshStandardMaterial({
        color: "#3a3530", emissive: "#0a0a08", emissiveIntensity: 0.3, roughness: 0.85,
      });
      pbrMaterialCache.set(ceilingCacheKey, ceilingMat);
    }
    const { mesh, instanceIds } = buildBatch(floorGeo, ceilingMat, allFloorPositions, WALL_HEIGHT);
    ceilingMesh = { mesh, instanceIds };
  }

  // Props - small batches
  let pedestalMesh: BatchedMesh | null = null;
  if (buckets.pedestalPositions.length > 0) {
    const mat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS.pedestal! });
    pedestalMesh = buildBatch(pedestalGeo, mat, buckets.pedestalPositions, 0.25).mesh;
  }

  let signMesh: BatchedMesh | null = null;
  if (buckets.signPositions.length > 0) {
    const mat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS.sign! });
    signMesh = buildBatch(signGeo, mat, buckets.signPositions, 0.5).mesh;
  }

  // Performer mesh intentionally skipped - MuseumPerformerStation3D renders its own platform

  // Exhibit light positions (from plaques in this chunk)
  const exhibitLightPositions: LightPosition[] = buckets.plaquePlacements.map((p, i) => ({
    id: i, tileX: p.tileX, tileY: p.tileY, x: p.worldX, z: p.worldZ,
  }));

  // Ceiling lights (for institutional/retail wings)
  const ceilingLightPositions: LightPosition[] = [];
  if (wing && (wing.theme === "institutional" || wing.theme === "retail")) {
    const b = wing.bounds;
    let nextId = 0;
    for (let dx = 3; dx < b.width - 2; dx += 6) {
      for (let dy = 3; dy < b.height - 2; dy += 8) {
        ceilingLightPositions.push({
          id: nextId++,
          tileX: b.x + dx, tileY: b.y + dy,
          x: (b.x + dx) * TILE_SIZE, z: (b.y + dy) * TILE_SIZE,
        });
      }
    }
  }

  // Sunlight shafts (for outdoor wings) - warm directional pools of light
  // simulating sunlight streaming down through open sky
  const sunlightPositions: LightPosition[] = [];
  if (wing?.theme === "outdoor") {
    const b = wing.bounds;
    let nextId = 0;
    // Place sunlight pools in a scattered pattern across the room
    const stepX = Math.max(4, Math.floor(b.width / 3));
    const stepY = Math.max(4, Math.floor(b.height / 3));
    for (let dx = 3; dx < b.width - 2; dx += stepX) {
      for (let dy = 3; dy < b.height - 2; dy += stepY) {
        // Offset slightly for organic feel (not a perfect grid)
        const jitterX = (nextId % 3 - 1) * 0.8;
        const jitterZ = (nextId % 2 === 0 ? 0.5 : -0.5);
        sunlightPositions.push({
          id: nextId++,
          tileX: b.x + dx, tileY: b.y + dy,
          x: (b.x + dx) * TILE_SIZE + jitterX,
          z: (b.y + dy) * TILE_SIZE + jitterZ,
        });
      }
    }
  }

  // Room ambient fill light
  let roomLight: RoomLight | null = null;
  if (wing) {
    const ambient = WING_AMBIENT[wing.theme];
    const b = wing.bounds;
    const roomWidthWorld = b.width * TILE_SIZE;
    const roomHeightWorld = b.height * TILE_SIZE;
    const distance = Math.max(roomWidthWorld, roomHeightWorld) * 1.2;
    const lightsPerAxis = Math.ceil(Math.max(b.width, b.height) / 15);
    const totalLights = lightsPerAxis * lightsPerAxis;
    const perLightIntensity = (ambient.intensity * ROOM_LIGHT_SCALE) / totalLights;
    const positions: { x: number; z: number }[] = [];
    for (let gx = 0; gx < lightsPerAxis; gx++) {
      for (let gz = 0; gz < lightsPerAxis; gz++) {
        const fracX = (gx + 0.5) / lightsPerAxis;
        const fracZ = (gz + 0.5) / lightsPerAxis;
        positions.push({
          x: (b.x + fracX * b.width) * TILE_SIZE,
          z: (b.y + fracZ * b.height) * TILE_SIZE,
        });
      }
    }
    roomLight = {
      wingId: wing.theme, theme: wing.theme,
      positions, color: ambient.color, intensity: perLightIntensity, distance,
    };
  }

  // Append manual placements for this room
  const torchPositions = [...buckets.torchPositions];
  if (wingId) {
    const manualPlacements = MANUAL_PLACEMENTS[wingId] ?? [];
    let nextManualId = torchPositions.length;
    for (const mp of manualPlacements) {
      const objDef = getPlaceableObject(mp.objectDefId);
      if (objDef?.category !== 'fixture') continue;

      const worldX = mp.tileX * TILE_SIZE;
      const worldZ = mp.tileY * TILE_SIZE;

      let wallOffsetX = 0;
      let wallOffsetZ = 0;
      if (mp.wallFacing === 'north') wallOffsetZ = -TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'south') wallOffsetZ = TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'west') wallOffsetX = -TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'east') wallOffsetX = TILE_SIZE * 0.35;

      torchPositions.push({
        id: nextManualId++,
        tileX: mp.tileX,
        tileY: mp.tileY,
        x: worldX,
        z: worldZ,
        wallOffsetX,
        wallOffsetZ,
        wingTheme: objDef.wingTheme ?? 'cave',
      });
    }
  }

  return {
    wingId,
    floorMeshes, wallMeshes, kitWalls, ceilingMesh,
    pedestalMesh, signMesh, performerMesh: null,
    torchPositions,
    plaquePlacements: buckets.plaquePlacements,
    performerPositions: buckets.performerPositions,
    exhibitLightPositions, ceilingLightPositions, sunlightPositions,
    roomLight,
  };
}

/** Dispose a room chunk's GPU resources */
export function disposeRoomChunk(chunk: RoomChunk): void {
  for (const { mesh } of chunk.floorMeshes) mesh.dispose();
  for (const { mesh } of chunk.wallMeshes) mesh.dispose();
  if (chunk.kitWalls) {
    chunk.kitWalls.traverse((obj) => {
      const m = obj as import("three").Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
  if (chunk.ceilingMesh) chunk.ceilingMesh.mesh.dispose();
  if (chunk.pedestalMesh) chunk.pedestalMesh.dispose();
  if (chunk.signMesh) chunk.signMesh.dispose();
  // performerMesh is always null - platform rendered by MuseumPerformerStation3D
}

/**
 * Reconstruct a MuseumGeometryDryRun from worker-transferred Float32Array batches.
 * This lets the main thread feed worker results into the existing buildRoomChunk().
 */
export function dryRunFromWorkerTransfer(
  floorBatches: BatchTransfer[],
  wallBatches: BatchTransfer[],
  pedestalPositions: Float32Array,
  signPositions: Float32Array,
  totalFloorInstances: number,
  totalWallInstances: number,
): MuseumGeometryDryRun {
  const floorBuckets = new Map<string, TileBucket>();
  for (const batch of floorBatches) {
    const positions: { x: number; z: number }[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) {
      positions.push({ x: batch.positions[i]!, z: batch.positions[i + 1]! });
    }
    floorBuckets.set(batch.color, {
      positions,
      color: batch.color,
      floorMaterial: batch.floorMaterial as FloorMaterial | undefined,
    });
  }

  const wallBuckets = new Map<string, TileBucket>();
  for (const batch of wallBatches) {
    const positions: { x: number; z: number }[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) {
      positions.push({ x: batch.positions[i]!, z: batch.positions[i + 1]! });
    }
    wallBuckets.set(batch.color, {
      positions,
      color: batch.color,
      wingTheme: batch.wingTheme as WingTheme | undefined,
    });
  }

  const pedPositions: { x: number; z: number }[] = [];
  for (let i = 0; i < pedestalPositions.length; i += 2) {
    pedPositions.push({ x: pedestalPositions[i]!, z: pedestalPositions[i + 1]! });
  }

  const sgnPositions: { x: number; z: number }[] = [];
  for (let i = 0; i < signPositions.length; i += 2) {
    sgnPositions.push({ x: signPositions[i]!, z: signPositions[i + 1]! });
  }

  return {
    floorBuckets,
    wallBuckets,
    plaquePlacements: [], // Plaques come from the descriptor, not the worker
    performerPositions: [],
    pedestalPositions: pedPositions,
    signPositions: sgnPositions,
    torchPositions: [], // Torches come from the descriptor, not the worker
    totalFloorInstances,
    totalWallInstances,
    totalTiles: totalFloorInstances + totalWallInstances,
  };
}

// Re-export constants for Museum3DScene
export { TILE_SIZE, WALL_HEIGHT, TILE_TYPE_COLORS, WING_WALL_COLORS, FLOOR_COLORS };
export { FLOOR_TEXTURE_MAP, WALL_TEXTURE_MAP, WING_AMBIENT };
