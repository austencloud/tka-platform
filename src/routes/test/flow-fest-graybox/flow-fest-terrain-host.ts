import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
} from "three";
import type { ImportedTerrainDataV2 } from "$lib/shared/3d/procedural-engine/generation/real-terrain-zone";

export type FlowFestTerrainHostMode = "bounded-static" | "chunked";

export interface FlowFestColliderMesh {
  name: string;
  vertices: Float32Array;
  indices: Uint32Array;
  centerX: number;
  centerZ: number;
  halfExtentX: number;
  halfExtentZ: number;
}

export interface FlowFestTerrainHostMetrics {
  mode: FlowFestTerrainHostMode;
  buildMilliseconds: number;
  renderMeshes: number;
  colliderMeshes: number;
  vertices: number;
  triangles: number;
  geometryBytes: number;
  sourceHeightSamples: number;
}

export interface FlowFestTerrainHost {
  root: Group;
  colliders: FlowFestColliderMesh[];
  metrics: FlowFestTerrainHostMetrics;
  dispose(): void;
}

export interface FlowFestChunkSeamTraversal {
  seamCrossings: number;
  seamAdjacentProbes: number;
  endpointProbes: number;
  probes: Array<{ x: number; z: number }>;
}

const CHUNK_SEGMENTS = 32;

export function flowFestColliderWindowKey(
  x: number,
  z: number,
  worldBounds: { minX: number; minZ: number },
  chunkSizeMeters = CHUNK_SEGMENTS
): string {
  const column = Math.floor((x - worldBounds.minX) / chunkSizeMeters);
  const row = Math.floor((z - worldBounds.minZ) / chunkSizeMeters);
  return `${column}:${row}`;
}

/**
 * Register each chunk-grid crossing and probe five centimetres before, on,
 * and after it. This is the deterministic traversal set used by the live
 * Rapier audit, not a screenshot-only approximation of seam continuity.
 */
export function buildFlowFestChunkSeamTraversal(
  start: { x: number; z: number },
  end: { x: number; z: number },
  worldBounds: { minX: number; minZ: number },
  chunkSizeMeters = CHUNK_SEGMENTS,
  epsilonMeters = 0.05
): FlowFestChunkSeamTraversal {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const seamParameters: number[] = [];
  for (
    let x =
      Math.ceil(
        (Math.min(start.x, end.x) - worldBounds.minX) / chunkSizeMeters
      ) *
        chunkSizeMeters +
      worldBounds.minX;
    x < Math.max(start.x, end.x);
    x += chunkSizeMeters
  ) {
    if (Math.abs(dx) < 1e-9) break;
    const t = (x - start.x) / dx;
    if (t > 1e-9 && t < 1 - 1e-9) seamParameters.push(t);
  }
  for (
    let z =
      Math.ceil(
        (Math.min(start.z, end.z) - worldBounds.minZ) / chunkSizeMeters
      ) *
        chunkSizeMeters +
      worldBounds.minZ;
    z < Math.max(start.z, end.z);
    z += chunkSizeMeters
  ) {
    if (Math.abs(dz) < 1e-9) break;
    const t = (z - start.z) / dz;
    if (t > 1e-9 && t < 1 - 1e-9) seamParameters.push(t);
  }
  const epsilon = length > 0 ? epsilonMeters / length : 0;
  const parameters = new Set<string>(["0.000000000000", "1.000000000000"]);
  for (const seam of seamParameters) {
    parameters.add(Math.max(0, seam - epsilon).toFixed(12));
    parameters.add(seam.toFixed(12));
    parameters.add(Math.min(1, seam + epsilon).toFixed(12));
  }
  const probes = [...parameters]
    .sort()
    .map(Number)
    .map((t) => ({
      x: start.x + dx * t,
      z: start.z + dz * t,
    }));
  return {
    seamCrossings: seamParameters.length,
    seamAdjacentProbes: seamParameters.length * 3,
    endpointProbes: 2,
    probes,
  };
}

/** Bilinear sampling in the exact north-to-south/east-to-west runtime grid. */
export function sampleFlowFestTerrainWorldY(
  terrain: ImportedTerrainDataV2,
  x: number,
  z: number
): number {
  const { width, height, heights, verticalOriginMeters } = terrain.heightmap;
  const column =
    ((x - terrain.worldBounds.minX) /
      (terrain.worldBounds.maxX - terrain.worldBounds.minX)) *
    (width - 1);
  const row =
    ((z - terrain.worldBounds.minZ) /
      (terrain.worldBounds.maxZ - terrain.worldBounds.minZ)) *
    (height - 1);
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(column)));
  const z0 = Math.max(0, Math.min(height - 1, Math.floor(row)));
  const x1 = Math.min(width - 1, x0 + 1);
  const z1 = Math.min(height - 1, z0 + 1);
  const tx = Math.max(0, Math.min(1, column - x0));
  const tz = Math.max(0, Math.min(1, row - z0));
  const northWest = heights[z0 * width + x0] ?? verticalOriginMeters;
  const northEast = heights[z0 * width + x1] ?? verticalOriginMeters;
  const southWest = heights[z1 * width + x0] ?? verticalOriginMeters;
  const southEast = heights[z1 * width + x1] ?? verticalOriginMeters;
  const north = northWest + (northEast - northWest) * tx;
  const south = southWest + (southEast - southWest) * tx;
  return north + (south - north) * tz - verticalOriginMeters;
}

interface GridWindow {
  startColumn: number;
  startRow: number;
  segmentColumns: number;
  segmentRows: number;
}

/**
 * The bounded and chunked Gate 2 candidates share this exact vertex builder.
 * The host choice changes ownership granularity only; it cannot change a
 * height, triangle winding, UV, or collider vertex.
 */
export function buildFlowFestTerrainHost(
  terrain: ImportedTerrainDataV2,
  mode: FlowFestTerrainHostMode,
  orthophoto: Texture | null
): FlowFestTerrainHost {
  const startedAt = performance.now();
  const material = new MeshStandardMaterial({
    color: orthophoto ? "#ffffff" : "#8a907c",
    map: orthophoto,
    roughness: 1,
    metalness: 0,
  });
  if (orthophoto) {
    orthophoto.colorSpace = SRGBColorSpace;
    orthophoto.needsUpdate = true;
  }

  const root = new Group();
  root.name = `FFS_TerrainHost_${mode}`;
  const colliders: FlowFestColliderMesh[] = [];
  let vertices = 0;
  let triangles = 0;
  let geometryBytes = 0;
  const spacingX =
    (terrain.worldBounds.maxX - terrain.worldBounds.minX) /
    (terrain.heightmap.width - 1);
  const spacingZ =
    (terrain.worldBounds.maxZ - terrain.worldBounds.minZ) /
    (terrain.heightmap.height - 1);

  const boundedWindow = {
    startColumn: 0,
    startRow: 0,
    segmentColumns: terrain.heightmap.width - 1,
    segmentRows: terrain.heightmap.height - 1,
  };
  const renderWindows = [boundedWindow];
  const colliderWindows =
    mode === "bounded-static"
      ? renderWindows
      : buildChunkWindows(terrain.heightmap.width, terrain.heightmap.height);

  for (const window of renderWindows) {
    const built = buildWindowGeometry(terrain, window);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(built.positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(built.uvs!, 2));
    geometry.setIndex(new BufferAttribute(built.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new Mesh(geometry, material);
    mesh.name =
      mode === "bounded-static"
        ? "FFS_Terrain_Bounded"
        : "FFS_Terrain_ChunkedRenderBatch";
    mesh.receiveShadow = true;
    root.add(mesh);

    vertices += built.positions.length / 3;
    triangles += built.indices.length / 3;
    geometryBytes +=
      built.positions.byteLength +
      built.uvs!.byteLength +
      built.indices.byteLength;

    if (mode === "bounded-static") {
      colliders.push({
        name: mesh.name,
        // The bounded host shares the exact visible typed arrays.
        vertices: built.positions,
        indices: built.indices,
        centerX:
          terrain.worldBounds.minX +
          window.startColumn * spacingX +
          (window.segmentColumns * spacingX) / 2,
        centerZ:
          terrain.worldBounds.minZ +
          window.startRow * spacingZ +
          (window.segmentRows * spacingZ) / 2,
        halfExtentX: (window.segmentColumns * spacingX) / 2,
        halfExtentZ: (window.segmentRows * spacingZ) / 2,
      });
    }
  }

  if (mode === "chunked") {
    for (const window of colliderWindows) {
      const built = buildWindowGeometry(terrain, window, false);
      colliders.push({
        name: `FFS_Terrain_Chunk_${window.startColumn / CHUNK_SEGMENTS}_${window.startRow / CHUNK_SEGMENTS}`,
        // Render batching changes draw ownership only. Every collider vertex
        // is rebuilt from the same source sample and exact triangle winding.
        vertices: built.positions,
        indices: built.indices,
        centerX:
          terrain.worldBounds.minX +
          window.startColumn * spacingX +
          (window.segmentColumns * spacingX) / 2,
        centerZ:
          terrain.worldBounds.minZ +
          window.startRow * spacingZ +
          (window.segmentRows * spacingZ) / 2,
        halfExtentX: (window.segmentColumns * spacingX) / 2,
        halfExtentZ: (window.segmentRows * spacingZ) / 2,
      });
      geometryBytes += built.positions.byteLength + built.indices.byteLength;
    }
  }

  const metrics: FlowFestTerrainHostMetrics = {
    mode,
    buildMilliseconds: performance.now() - startedAt,
    renderMeshes: renderWindows.length,
    colliderMeshes: colliders.length,
    vertices,
    triangles,
    geometryBytes,
    sourceHeightSamples: terrain.heightmap.heights.length,
  };

  return {
    root,
    colliders,
    metrics,
    dispose() {
      root.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      material.dispose();
      orthophoto?.dispose();
    },
  };
}

function buildChunkWindows(width: number, height: number): GridWindow[] {
  const segmentWidth = width - 1;
  const segmentHeight = height - 1;
  if (
    segmentWidth % CHUNK_SEGMENTS !== 0 ||
    segmentHeight % CHUNK_SEGMENTS !== 0
  ) {
    throw new Error(
      `Flow Fest chunk host requires ${CHUNK_SEGMENTS}m-aligned terrain; received ${width}x${height}`
    );
  }

  const windows: GridWindow[] = [];
  for (let row = 0; row < segmentHeight; row += CHUNK_SEGMENTS) {
    for (let column = 0; column < segmentWidth; column += CHUNK_SEGMENTS) {
      windows.push({
        startColumn: column,
        startRow: row,
        segmentColumns: CHUNK_SEGMENTS,
        segmentRows: CHUNK_SEGMENTS,
      });
    }
  }
  return windows;
}

function buildWindowGeometry(
  terrain: ImportedTerrainDataV2,
  window: GridWindow,
  includeUvs = true
): {
  positions: Float32Array;
  uvs: Float32Array | null;
  indices: Uint32Array;
} {
  const width = terrain.heightmap.width;
  const height = terrain.heightmap.height;
  const columns = window.segmentColumns + 1;
  const rows = window.segmentRows + 1;
  const positions = new Float32Array(columns * rows * 3);
  const uvs = includeUvs ? new Float32Array(columns * rows * 2) : null;
  const indices = new Uint32Array(
    window.segmentColumns * window.segmentRows * 6
  );
  const spacing =
    (terrain.worldBounds.maxX - terrain.worldBounds.minX) / (width - 1);
  const verticalOrigin = terrain.heightmap.verticalOriginMeters;

  let positionOffset = 0;
  let uvOffset = 0;
  for (let localRow = 0; localRow < rows; localRow += 1) {
    const sourceRow = window.startRow + localRow;
    for (let localColumn = 0; localColumn < columns; localColumn += 1) {
      const sourceColumn = window.startColumn + localColumn;
      const sourceIndex = sourceRow * width + sourceColumn;
      positions[positionOffset++] =
        terrain.worldBounds.minX + sourceColumn * spacing;
      positions[positionOffset++] =
        (terrain.heightmap.heights[sourceIndex] ?? verticalOrigin) -
        verticalOrigin;
      positions[positionOffset++] =
        terrain.worldBounds.minZ + sourceRow * spacing;
      if (uvs) {
        uvs[uvOffset++] = sourceColumn / (width - 1);
        // The source image is north-up: its top row is the terrain's min Z.
        uvs[uvOffset++] = 1 - sourceRow / (height - 1);
      }
    }
  }

  let indexOffset = 0;
  for (let row = 0; row < window.segmentRows; row += 1) {
    for (let column = 0; column < window.segmentColumns; column += 1) {
      const northWest = row * columns + column;
      const northEast = northWest + 1;
      const southWest = (row + 1) * columns + column;
      const southEast = southWest + 1;
      indices[indexOffset++] = northWest;
      indices[indexOffset++] = southWest;
      indices[indexOffset++] = northEast;
      indices[indexOffset++] = northEast;
      indices[indexOffset++] = southWest;
      indices[indexOffset++] = southEast;
    }
  }

  return { positions, uvs, indices };
}
