/**
 * RoomDescriptor - lightweight cache entry that survives room teardown.
 *
 * When the progressive loading system tears down a room's geometry (because
 * the player moved away), it keeps a RoomDescriptor in memory instead of
 * discarding all that work. When the player returns to that room, the
 * descriptor lets us skip the tile-bucketing phase and jump straight to
 * mesh creation - shaving the rebuild from ~200ms down to ~20ms.
 *
 * A descriptor is ~2-5KB in memory, compared to the full Three.js geometry
 * which can be 10-50MB. All 16 descriptors together are smaller than a
 * single loaded room's geometry.
 */

import type { WingTheme } from "./museum-grid-types";
import type {
  MuseumGeometryDryRun,
  PlaquePlacement,
  TorchPosition,
} from "../services/museum-geometry-builder";

// ── Serialized tile bucket types ──

/**
 * A single entry from a floor or wall bucket, stored as a plain array
 * instead of a Map so it survives JSON serialization without custom logic.
 */
export interface SerializedBucketEntry {
  color: string;
  positions: { x: number; z: number }[];
  /** Only present on floor buckets */
  floorMaterial?: string;
  /** Only present on wall buckets */
  wingTheme?: WingTheme;
}

/**
 * The bucketed tile data from the geometry dry-run, serialized to plain
 * arrays so it can be passed through JSON without losing Map structure.
 */
export interface SerializedTileBuckets {
  floorEntries: SerializedBucketEntry[];
  wallEntries: SerializedBucketEntry[];
  pedestalPositions: { x: number; z: number }[];
  signPositions: { x: number; z: number }[];
  performerPositions: { x: number; z: number }[];
  totalFloorInstances: number;
  totalWallInstances: number;
}

// ── RoomDescriptor ──

/**
 * Everything needed to rebuild a room's geometry without re-bucketing tiles.
 * Produced once during the first build, kept in memory, re-used on re-entry.
 */
export interface RoomDescriptor {
  roomId: string;
  wingTheme: WingTheme;
  tileBuckets: SerializedTileBuckets;
  fixtures: {
    torches: TorchPosition[];
    plaques: PlaquePlacement[];
  };
  /**
   * Unique color keys from both floor and wall buckets.
   * Used to warm the material cache before the render thread needs them,
   * so the first frame after a room rebuild doesn't stall on material creation.
   */
  materialKeys: string[];
}

// ── Factory ──

/**
 * Converts the output of bucketMuseumTiles() into a RoomDescriptor.
 * This is the only place that reads the Map structures from the dry-run;
 * everything downstream works with the serialized plain-array form.
 */
export function createRoomDescriptor(
  roomId: string,
  buckets: MuseumGeometryDryRun,
  wingTheme: WingTheme
): RoomDescriptor {
  const floorEntries: SerializedBucketEntry[] = [];
  for (const [, bucket] of buckets.floorBuckets) {
    floorEntries.push({
      color: bucket.color,
      positions: [...bucket.positions],
      ...(bucket.floorMaterial !== undefined
        ? { floorMaterial: bucket.floorMaterial }
        : {}),
    });
  }

  const wallEntries: SerializedBucketEntry[] = [];
  for (const [, bucket] of buckets.wallBuckets) {
    wallEntries.push({
      color: bucket.color,
      positions: [...bucket.positions],
      ...(bucket.wingTheme !== undefined
        ? { wingTheme: bucket.wingTheme }
        : {}),
    });
  }

  // Collect every unique color key across floor + wall buckets.
  // These are used to pre-warm the material cache when the descriptor
  // is loaded before the room becomes visible, hiding the GPU stall.
  const keySet = new Set<string>();
  for (const entry of floorEntries) keySet.add(entry.color);
  for (const entry of wallEntries) keySet.add(entry.color);

  return {
    roomId,
    wingTheme,
    tileBuckets: {
      floorEntries,
      wallEntries,
      pedestalPositions: [...buckets.pedestalPositions],
      signPositions: [...buckets.signPositions],
      performerPositions: [...buckets.performerPositions],
      totalFloorInstances: buckets.totalFloorInstances,
      totalWallInstances: buckets.totalWallInstances,
    },
    fixtures: {
      torches: [...buckets.torchPositions],
      plaques: [...buckets.plaquePlacements],
    },
    materialKeys: [...keySet],
  };
}

// ── Serialization helpers ──

/**
 * Turns a descriptor into a JSON string for storage (IndexedDB, sessionStorage).
 * All types are plain JSON-safe values, so no custom replacer is needed.
 */
export function serializeDescriptor(desc: RoomDescriptor): string {
  return JSON.stringify(desc);
}

/**
 * Restores a descriptor from the JSON string produced by serializeDescriptor().
 * Types are cast directly - the descriptor contains only plain values (no Maps,
 * no class instances, no Three.js objects) so parse is a safe round-trip.
 */
export function deserializeDescriptor(json: string): RoomDescriptor {
  return JSON.parse(json) as RoomDescriptor;
}
