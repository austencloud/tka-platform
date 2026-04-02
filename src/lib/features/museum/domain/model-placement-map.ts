/**
 * Model Placement Map
 *
 * Defines which tile types get 3D furniture models placed on them.
 * This is the bridge between the 2D tile grid and the 3D scene.
 *
 * Only a subset of tiles get models — most tiles are rendered as
 * instanced box geometry (walls, floors). Models add visual richness
 * to interactive or decorative tiles.
 */

import type { MuseumModelRole } from "../services/contracts/IMuseumModelLoader";
import type { TileType } from "./museum-grid-types";

export interface ModelPlacement {
  /** Which model to load. */
  role: MuseumModelRole;
  /** Y-axis rotation in radians. 0 = facing +Z (south). */
  rotationY: number;
  /** Additional vertical offset on top of the role's default yOffset. */
  extraY: number;
}

/**
 * Maps tile types to model placements. Tiles not in this map
 * don't get a GLTF model — they use the existing instanced geometry.
 */
// Disabled until we implement proper room-relative placement logic.
// Tile-type matching puts furniture in nonsensical locations.
export const TILE_MODEL_MAP: Partial<Record<TileType, ModelPlacement>> = {};

/**
 * Models placed at fixed positions in specific wing themes.
 * These don't correspond to tile types — they're decorative
 * furniture scattered through corridors and rooms.
 */
export interface FixedModelPlacement {
  role: MuseumModelRole;
  /** World-space X (not tile X — already multiplied by TILE_SIZE). */
  worldX: number;
  /** World-space Z. */
  worldZ: number;
  rotationY: number;
}

/**
 * Hand-placed decorative models. Start with a few corridor benches
 * and gift shop bookshelves. Expand as the museum layout stabilizes.
 *
 * Coordinates are in tile space — the renderer multiplies by TILE_SIZE.
 */
// Disabled until we implement room-relative placement (wall positions, corners, etc.)
// Hardcoded coordinates produce nonsensical layouts.
export const FIXED_PLACEMENTS: FixedModelPlacement[] = [];
