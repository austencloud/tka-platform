/**
 * Real Terrain Zone
 *
 * Handles imported real-world terrain data (e.g., Hannon's Camp).
 * Provides height sampling and boundary checking for chunk generation.
 *
 * Key concepts:
 * - Zone boundary: A polygon in world coordinates defining the real terrain area
 * - Heightmap: Real elevation data to sample from within the zone
 * - Blending: Smooth transition between real and procedural terrain at edges
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RealTerrainZone {
  /** Zone name (e.g., "Hannon's Camp America") */
  name: string;
  /** Boundary polygon vertices in world coordinates */
  boundary: Array<{ x: number; z: number }>;
  /** Heightmap data */
  heightmap: {
    width: number;
    height: number;
    minElevation: number;
    maxElevation: number;
    heights: Float32Array;
  };
  /** World-space bounds of the zone */
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  };
  /** Origin point for UV mapping */
  origin: { x: number; z: number };
}

export interface ImportedTerrainData {
  version: number;
  name: string;
  timestamp: string;
  geoBounds: {
    nw: { lat: number; lng: number };
    se: { lat: number; lng: number };
  };
  center: { lat: number; lng: number };
  worldDimensions: {
    width: number;
    depth: number;
    originX: number;
    originZ: number;
  };
  heightmap: {
    width: number;
    height: number;
    minElevation: number;
    maxElevation: number;
    heights: number[];
  };
  boundary: Array<{
    u: number;
    v: number;
    worldX: number;
    worldZ: number;
  }>;
}

// ============================================================================
// ZONE CREATION
// ============================================================================

/**
 * Create a RealTerrainZone from imported terrain data
 */
export function createRealTerrainZone(data: ImportedTerrainData): RealTerrainZone {
  const { worldDimensions: _worldDimensions, heightmap, boundary, name } = data;

  // Convert heights array to Float32Array
  const heights = new Float32Array(heightmap.heights);

  // Calculate bounds from boundary points
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const point of boundary) {
    minX = Math.min(minX, point.worldX);
    maxX = Math.max(maxX, point.worldX);
    minZ = Math.min(minZ, point.worldZ);
    maxZ = Math.max(maxZ, point.worldZ);
  }

  // Convert boundary to world coordinates
  const boundaryWorld = boundary.map(p => ({
    x: p.worldX,
    z: p.worldZ,
  }));

  // Calculate actual bounds dimensions from the boundary
  const actualWidth = maxX - minX;
  const actualDepth = maxZ - minZ;

  // Calculate center of bounds - this is where the heightmap is centered
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return {
    name,
    boundary: boundaryWorld,
    heightmap: {
      width: heightmap.width,
      height: heightmap.height,
      minElevation: heightmap.minElevation,
      maxElevation: heightmap.maxElevation,
      heights,
    },
    bounds: {
      minX,
      maxX,
      minZ,
      maxZ,
      width: actualWidth,
      depth: actualDepth,
    },
    // Origin should be the CENTER of the bounds, not worldDimensions.origin
    // This ensures UV mapping works correctly
    origin: {
      x: centerX,
      z: centerZ,
    },
  };
}

// ============================================================================
// POINT-IN-POLYGON TEST
// ============================================================================

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(
  x: number,
  z: number,
  polygon: Array<{ x: number; z: number }>
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;

    if (
      ((pi.z > z) !== (pj.z > z)) &&
      (x < ((pj.x - pi.x) * (z - pi.z)) / (pj.z - pi.z) + pi.x)
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Get distance from a point to the nearest polygon edge
 * Returns positive if inside, negative if outside
 */
export function getSignedDistanceToPolygon(
  x: number,
  z: number,
  polygon: Array<{ x: number; z: number }>
): number {
  if (polygon.length < 3) return -Infinity;

  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]!;
    const p2 = polygon[(i + 1) % polygon.length]!;

    // Distance to line segment
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lengthSq = dx * dx + dz * dz;

    let t = 0;
    if (lengthSq > 0) {
      t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (z - p1.z) * dz) / lengthSq));
    }

    const nearestX = p1.x + t * dx;
    const nearestZ = p1.z + t * dz;
    const dist = Math.sqrt((x - nearestX) ** 2 + (z - nearestZ) ** 2);

    minDist = Math.min(minDist, dist);
  }

  const inside = isPointInPolygon(x, z, polygon);
  return inside ? minDist : -minDist;
}

// ============================================================================
// HEIGHT SAMPLING
// ============================================================================

/**
 * Sample height from the real terrain heightmap using bilinear interpolation
 */
export function sampleRealHeight(
  zone: RealTerrainZone,
  worldX: number,
  worldZ: number
): number {
  const { heightmap, bounds, origin } = zone;

  // Convert world coordinates to UV (0-1)
  const u = (worldX - origin.x) / bounds.width + 0.5;
  const v = (worldZ - origin.z) / bounds.depth + 0.5;

  // Convert UV to heightmap pixel coordinates
  const pixelX = u * (heightmap.width - 1);
  const pixelY = v * (heightmap.height - 1);

  // Clamp to valid range
  const clampedX = Math.max(0, Math.min(heightmap.width - 1, pixelX));
  const clampedY = Math.max(0, Math.min(heightmap.height - 1, pixelY));

  // Get integer and fractional parts for bilinear interpolation
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(x0 + 1, heightmap.width - 1);
  const y1 = Math.min(y0 + 1, heightmap.height - 1);
  const fx = clampedX - x0;
  const fy = clampedY - y0;

  // Sample four corners
  const h00 = heightmap.heights[y0 * heightmap.width + x0] ?? 0;
  const h10 = heightmap.heights[y0 * heightmap.width + x1] ?? 0;
  const h01 = heightmap.heights[y1 * heightmap.width + x0] ?? 0;
  const h11 = heightmap.heights[y1 * heightmap.width + x1] ?? 0;

  // Bilinear interpolation
  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  const height = h0 * (1 - fy) + h1 * fy;

  // Normalize to world units (0-50 range for compatibility with procedural terrain)
  const normalizedHeight =
    ((height - heightmap.minElevation) / (heightmap.maxElevation - heightmap.minElevation)) * 40;

  return normalizedHeight;
}

// ============================================================================
// BLENDED HEIGHT QUERY
// ============================================================================

/**
 * Get terrain height at a world position, blending real and procedural terrain
 *
 * @param zone Real terrain zone (or null if no zone loaded)
 * @param worldX World X coordinate
 * @param worldZ World Z coordinate
 * @param proceduralHeight Height from procedural generation
 * @param blendDistance Distance over which to blend (in world units)
 * @returns Final blended height
 */
export function getBlendedHeight(
  zone: RealTerrainZone | null,
  worldX: number,
  worldZ: number,
  proceduralHeight: number,
  blendDistance: number = 20
): number {
  if (!zone) {
    return proceduralHeight;
  }

  // Quick bounds check
  const margin = blendDistance;
  if (
    worldX < zone.bounds.minX - margin ||
    worldX > zone.bounds.maxX + margin ||
    worldZ < zone.bounds.minZ - margin ||
    worldZ > zone.bounds.maxZ + margin
  ) {
    return proceduralHeight;
  }

  // Get signed distance to boundary
  const signedDist = getSignedDistanceToPolygon(worldX, worldZ, zone.boundary);

  // Fully inside the zone (beyond blend distance)
  if (signedDist >= blendDistance) {
    return sampleRealHeight(zone, worldX, worldZ);
  }

  // Fully outside the zone (beyond blend distance)
  if (signedDist <= -blendDistance) {
    return proceduralHeight;
  }

  // In the blend zone - smooth interpolation
  const realHeight = sampleRealHeight(zone, worldX, worldZ);
  const t = (signedDist + blendDistance) / (2 * blendDistance);

  // Smoothstep for smoother transition
  const smoothT = t * t * (3 - 2 * t);

  return proceduralHeight * (1 - smoothT) + realHeight * smoothT;
}

// ============================================================================
// ZONE UTILITIES
// ============================================================================

/**
 * Check if a chunk potentially intersects with a real terrain zone
 */
export function chunkIntersectsZone(
  zone: RealTerrainZone,
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  margin: number = 20
): boolean {
  const chunkMinX = chunkX * chunkSize - margin;
  const chunkMaxX = (chunkX + 1) * chunkSize + margin;
  const chunkMinZ = chunkZ * chunkSize - margin;
  const chunkMaxZ = (chunkZ + 1) * chunkSize + margin;

  // AABB intersection test
  return !(
    chunkMaxX < zone.bounds.minX - margin ||
    chunkMinX > zone.bounds.maxX + margin ||
    chunkMaxZ < zone.bounds.minZ - margin ||
    chunkMinZ > zone.bounds.maxZ + margin
  );
}

/**
 * Serialize zone data for transfer to worker
 * (Workers can't share typed arrays directly without transfer)
 */
export function serializeZoneForWorker(zone: RealTerrainZone): {
  name: string;
  boundary: Array<{ x: number; z: number }>;
  heightmapWidth: number;
  heightmapHeight: number;
  minElevation: number;
  maxElevation: number;
  heights: Float32Array;
  bounds: RealTerrainZone["bounds"];
  origin: RealTerrainZone["origin"];
} {
  return {
    name: zone.name,
    boundary: zone.boundary,
    heightmapWidth: zone.heightmap.width,
    heightmapHeight: zone.heightmap.height,
    minElevation: zone.heightmap.minElevation,
    maxElevation: zone.heightmap.maxElevation,
    heights: zone.heightmap.heights,
    bounds: zone.bounds,
    origin: zone.origin,
  };
}

/**
 * Deserialize zone data received in worker
 */
export function deserializeZoneInWorker(data: ReturnType<typeof serializeZoneForWorker>): RealTerrainZone {
  return {
    name: data.name,
    boundary: data.boundary,
    heightmap: {
      width: data.heightmapWidth,
      height: data.heightmapHeight,
      minElevation: data.minElevation,
      maxElevation: data.maxElevation,
      heights: data.heights,
    },
    bounds: data.bounds,
    origin: data.origin,
  };
}
