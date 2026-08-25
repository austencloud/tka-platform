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

const CHUNK_SEGMENTS = 32;

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

  const windows =
    mode === "bounded-static"
      ? [
          {
            startColumn: 0,
            startRow: 0,
            segmentColumns: terrain.heightmap.width - 1,
            segmentRows: terrain.heightmap.height - 1,
          },
        ]
      : buildChunkWindows(terrain.heightmap.width, terrain.heightmap.height);

  for (const [index, window] of windows.entries()) {
    const built = buildWindowGeometry(terrain, window);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(built.positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(built.uvs, 2));
    geometry.setIndex(new BufferAttribute(built.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new Mesh(geometry, material);
    mesh.name =
      mode === "bounded-static"
        ? "FFS_Terrain_Bounded"
        : `FFS_Terrain_Chunk_${window.startColumn / CHUNK_SEGMENTS}_${window.startRow / CHUNK_SEGMENTS}`;
    mesh.receiveShadow = true;
    root.add(mesh);

    colliders.push({
      name: mesh.name,
      // These are the same typed arrays mounted on the visible geometry.
      vertices: built.positions,
      indices: built.indices,
    });
    vertices += built.positions.length / 3;
    triangles += built.indices.length / 3;
    geometryBytes +=
      built.positions.byteLength +
      built.uvs.byteLength +
      built.indices.byteLength;
  }

  const metrics: FlowFestTerrainHostMetrics = {
    mode,
    buildMilliseconds: performance.now() - startedAt,
    renderMeshes: windows.length,
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
  window: GridWindow
): {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
} {
  const width = terrain.heightmap.width;
  const height = terrain.heightmap.height;
  const columns = window.segmentColumns + 1;
  const rows = window.segmentRows + 1;
  const positions = new Float32Array(columns * rows * 3);
  const uvs = new Float32Array(columns * rows * 2);
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
      uvs[uvOffset++] = sourceColumn / (width - 1);
      // The source image is north-up: its top row is the terrain's min Z.
      uvs[uvOffset++] = 1 - sourceRow / (height - 1);
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
