// @ts-nocheck - TSL type system has UniformNode compatibility issues throughout
/**
 * Geometry Clipmaps Terrain System
 *
 * State-of-the-art terrain LOD technique based on:
 * - Losasso & Hoppe (SIGGRAPH 2004): "Geometry clipmaps: Terrain rendering using nested regular grids"
 * - NVIDIA GPU Gems 2, Chapter 2: "Terrain Rendering Using GPU-Based Geometry Clipmaps"
 *
 * Key concepts:
 * 1. Camera-centered nested grids - each LOD level is a ring around the viewer
 * 2. Transition zones - vertices morph smoothly between LOD levels using: z' = (1-α)zf + αzc
 * 3. Single mesh per LOD level - no chunk boundaries to cause seams
 * 4. GPU-driven - heights sampled from heightmap texture in vertex shader
 *
 * Why this is the "10-year solution":
 * - No seams by design (no chunk boundaries within an LOD level)
 * - Smooth LOD transitions (vertex morphing, not discrete swaps)
 * - Scales to massive worlds (nested structure is O(log n) memory)
 * - GPU-efficient (instanced rings, texture-based heights)
 * - Industry standard (used by AAA games, Google Earth, etc.)
 *
 * ARCHITECTURE NOTE:
 * This module provides TWO approaches:
 *
 * 1. GeometryClipmapManager - Pure clipmap approach (experimental)
 *    - Camera-centered nested rings
 *    - Best for: static heightmaps, flight simulators
 *
 * 2. createClipmapChunkMaterial - Hybrid chunk+clipmap approach (recommended)
 *    - Keeps existing chunk streaming system
 *    - Adds clipmap-style vertex morphing within chunks
 *    - Best for: dynamic terrain, procedural generation, this project
 *
 * The hybrid approach is recommended because:
 * - Preserves existing chunk loading/unloading (tested and working)
 * - Adds GPU-based vertex morphing for seamless LOD transitions
 * - Easier to integrate with vegetation, physics, special zones
 *
 * References:
 * - https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
 * - https://hhoppe.com/proj/gpugcm/
 */

import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Group,
  Vector3,
  DataTexture,
  FloatType,
  RedFormat,
  LinearFilter,
  ClampToEdgeWrapping,
  type Scene,
} from "three";

import {
  MeshStandardNodeMaterial,
} from "three/webgpu";

import {
  Fn,
  uniform,
  positionLocal,
  cameraPosition,
  modelWorldMatrix,
  vec3,
  vec2,
  float,
  If,
  clamp,
  mix,
  length,
  sub,
  mul,
  div,
  add,
  max,
  abs,
  fract,
  texture,
  uv,
} from "three/tsl";

// ============================================================================
// TYPES
// ============================================================================

export interface GeometryClipmapConfig {
  /** Number of LOD levels (rings) */
  levels: number;
  /** Grid size per level (n×n vertices, typically 255 for (2^8 - 1)) */
  gridSize: number;
  /** World-space size of finest level grid cell */
  baseCellSize: number;
  /** Transition width as fraction of level size (typically 0.1 = 10%) */
  transitionWidth: number;
  /** Heightmap resolution (power of 2) */
  heightmapResolution: number;
}

export interface ClipmapLevel {
  /** LOD level index (0 = finest) */
  level: number;
  /** Grid cell size at this level (baseCellSize * 2^level) */
  cellSize: number;
  /** Total size of this level in world units */
  levelSize: number;
  /** The mesh for this level (ring or full grid for level 0) */
  mesh: Mesh;
  /** Inner hole size (0 for level 0) */
  innerHoleSize: number;
}

// ============================================================================
// GEOMETRY CLIPMAP MANAGER
// ============================================================================

export class GeometryClipmapManager {
  private config: GeometryClipmapConfig;
  private levels: ClipmapLevel[] = [];
  private group: Group;
  private heightmapTexture: DataTexture | null = null;
  private material: MeshStandardNodeMaterial | null = null;

  // Uniforms for shader
  private uViewerPos = uniform(new Vector3(0, 0, 0), "vec3");
  private uHeightScale = uniform(50.0, "float");
  private uTransitionWidth = uniform(0.1, "float");

  constructor(config: Partial<GeometryClipmapConfig> = {}) {
    this.config = {
      levels: config.levels ?? 5,
      gridSize: config.gridSize ?? 127, // 2^7 - 1 for good morphing
      baseCellSize: config.baseCellSize ?? 1.0,
      transitionWidth: config.transitionWidth ?? 0.1,
      heightmapResolution: config.heightmapResolution ?? 2048,
    };

    this.group = new Group();
    this.group.name = "GeometryClipmap";
  }

  /**
   * Initialize the clipmap system
   * Creates all LOD level meshes and the shared material
   */
  initialize(scene: Scene, heightGenerator: (x: number, z: number) => number): void {
    // Create heightmap texture from generator
    this.createHeightmapTexture(heightGenerator);

    // Create the TSL material with vertex morphing
    this.createClipmapMaterial();

    // Create geometry for each LOD level
    for (let level = 0; level < this.config.levels; level++) {
      this.createLevel(level);
    }

    scene.add(this.group);

    console.log(`[GeometryClipmap] Initialized with ${this.config.levels} levels, grid size ${this.config.gridSize}`);
  }

  /**
   * Create a heightmap texture from the height generator function
   * This is sampled in the vertex shader to get terrain height
   */
  private createHeightmapTexture(heightGenerator: (x: number, z: number) => number): void {
    const res = this.config.heightmapResolution;
    const data = new Float32Array(res * res);

    // Calculate the world extent covered by the heightmap
    // The clipmap covers a much larger area at coarser LODs
    const maxLevelSize = this.getLevelSize(this.config.levels - 1);
    const worldExtent = maxLevelSize * 2; // Cover area centered on viewer

    for (let z = 0; z < res; z++) {
      for (let x = 0; x < res; x++) {
        // Map texture coords to world coords
        const worldX = (x / (res - 1) - 0.5) * worldExtent;
        const worldZ = (z / (res - 1) - 0.5) * worldExtent;
        const height = heightGenerator(worldX, worldZ);
        data[z * res + x] = height;
      }
    }

    this.heightmapTexture = new DataTexture(
      data,
      res,
      res,
      RedFormat,
      FloatType
    );
    this.heightmapTexture.minFilter = LinearFilter;
    this.heightmapTexture.magFilter = LinearFilter;
    this.heightmapTexture.wrapS = ClampToEdgeWrapping;
    this.heightmapTexture.wrapT = ClampToEdgeWrapping;
    this.heightmapTexture.needsUpdate = true;

    console.log(`[GeometryClipmap] Created heightmap texture: ${res}x${res}, covering ${worldExtent.toFixed(0)}m`);
  }

  /**
   * Create the TSL material with GPU-based vertex morphing
   * This implements the core clipmap formula: z' = (1-α)zf + αzc
   */
  private createClipmapMaterial(): void {
    const heightmapUniform = uniform(this.heightmapTexture!, "texture");
    const maxLevelSize = this.getLevelSize(this.config.levels - 1);
    const worldExtent = maxLevelSize * 2;
    const uWorldExtent = uniform(worldExtent, "float");

    /**
     * Sample height from heightmap at world position
     */
    const sampleHeight = Fn(([worldX, worldZ]: [ReturnType<typeof float>, ReturnType<typeof float>]) => {
      // Convert world position to texture UV (centered on viewer)
      const u = add(div(sub(worldX, this.uViewerPos.x), uWorldExtent), float(0.5));
      const v = add(div(sub(worldZ, this.uViewerPos.z), uWorldExtent), float(0.5));

      // Sample heightmap
      // @ts-expect-error - UniformNode type mismatch in TSL
      const heightSample = texture(heightmapUniform, vec2(u, v));
      return mul(heightSample.r, this.uHeightScale);
    });

    /**
     * Calculate blend factor α for transition zones
     * α = 0 in the inner region, ramps to 1 at outer edge
     */
    const calculateAlpha = Fn(([worldPos]: [ReturnType<typeof vec3>]) => {
      // Distance from viewer in XZ plane
      const dx = abs(sub(worldPos.x, this.uViewerPos.x));
      const dz = abs(sub(worldPos.z, this.uViewerPos.z));
      const distFromViewer = max(dx, dz); // Use Chebyshev distance for square grids

      // Determine which level this vertex belongs to based on distance
      // Each level covers 2x the area of the previous
      const level0Size = float(this.getLevelSize(0));
      const transitionStart = mul(level0Size, sub(float(1.0), this.uTransitionWidth));

      // Calculate alpha based on position in transition zone
      const posInTransition = div(sub(distFromViewer, transitionStart), mul(level0Size, this.uTransitionWidth));
      return clamp(posInTransition, 0.0, 1.0);
    });

    /**
     * Main vertex displacement function
     * Implements: z' = (1-α)zf + αzc
     */
    const vertexDisplacement = Fn(() => {
      const localPos = positionLocal;

      // World position (before height displacement)
      const worldPos = modelWorldMatrix.mul(vec3(localPos.x, 0, localPos.z));

      // Get fine-level height at this position
      const heightFine = sampleHeight(worldPos.x, worldPos.z);

      // Get coarse-level height (sampled at lower resolution)
      // For coarse sampling, we snap to a coarser grid
      const coarseGridSize = float(this.config.baseCellSize * 2);
      const coarseX = mul(float(Math.floor), div(worldPos.x, coarseGridSize)).mul(coarseGridSize);
      const coarseZ = mul(float(Math.floor), div(worldPos.z, coarseGridSize)).mul(coarseGridSize);
      const heightCoarse = sampleHeight(coarseX, coarseZ);

      // Calculate blend factor
      const alpha = calculateAlpha(worldPos);

      // Blend heights: z' = (1-α)zf + αzc
      const blendedHeight = mix(heightFine, heightCoarse, alpha);

      // Return displaced position
      return vec3(localPos.x, blendedHeight, localPos.z);
    });

    // Create the material
    this.material = new MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Apply vertex displacement
    this.material.positionNode = vertexDisplacement();

    console.log(`[GeometryClipmap] Created TSL material with vertex morphing`);
  }

  /**
   * Create geometry and mesh for a single LOD level
   * Level 0 is a full grid, higher levels are hollow rings
   */
  private createLevel(level: number): void {
    const cellSize = this.getCellSize(level);
    const levelSize = this.getLevelSize(level);
    const gridSize = this.config.gridSize;

    let geometry: BufferGeometry;

    if (level === 0) {
      // Level 0: Full grid (finest detail, centered on viewer)
      geometry = this.createFullGridGeometry(gridSize, cellSize);
    } else {
      // Higher levels: Hollow ring (excludes area covered by finer level)
      const innerHoleSize = this.getLevelSize(level - 1);
      geometry = this.createRingGeometry(gridSize, cellSize, innerHoleSize);
    }

    const mesh = new Mesh(geometry, this.material!);
    mesh.frustumCulled = false; // Clipmap is always centered on camera
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    const levelData: ClipmapLevel = {
      level,
      cellSize,
      levelSize,
      mesh,
      innerHoleSize: level === 0 ? 0 : this.getLevelSize(level - 1),
    };

    this.levels.push(levelData);
    this.group.add(mesh);

    console.log(`[GeometryClipmap] Created level ${level}: cellSize=${cellSize.toFixed(2)}m, levelSize=${levelSize.toFixed(0)}m`);
  }

  /**
   * Create a full grid geometry for level 0
   */
  private createFullGridGeometry(gridSize: number, cellSize: number): BufferGeometry {
    const halfSize = (gridSize - 1) * cellSize / 2;
    const vertexCount = gridSize * gridSize;
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    // Generate vertices in a grid centered on origin
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = (z * gridSize + x) * 3;
        vertices[idx] = x * cellSize - halfSize;
        vertices[idx + 1] = 0; // Height set by vertex shader
        vertices[idx + 2] = z * cellSize - halfSize;

        // Placeholder color (will be replaced by biome-based coloring)
        colors[idx] = 0.3;
        colors[idx + 1] = 0.5;
        colors[idx + 2] = 0.2;
      }
    }

    // Generate indices
    const indices = this.generateGridIndices(gridSize);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Create a hollow ring geometry for levels > 0
   * Excludes the inner area that's covered by the finer level
   */
  private createRingGeometry(gridSize: number, cellSize: number, innerHoleSize: number): BufferGeometry {
    const halfSize = (gridSize - 1) * cellSize / 2;
    const halfHoleSize = innerHoleSize / 2;

    // For a ring, we still generate the full grid of vertices,
    // but we exclude triangles that fall within the inner hole
    const vertexCount = gridSize * gridSize;
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = (z * gridSize + x) * 3;
        vertices[idx] = x * cellSize - halfSize;
        vertices[idx + 1] = 0;
        vertices[idx + 2] = z * cellSize - halfSize;

        colors[idx] = 0.3;
        colors[idx + 1] = 0.5;
        colors[idx + 2] = 0.2;
      }
    }

    // Generate indices, excluding triangles in the inner hole
    const indices = this.generateRingIndices(gridSize, cellSize, halfHoleSize);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Generate indices for a full grid
   */
  private generateGridIndices(gridSize: number): Uint32Array {
    const quadCount = (gridSize - 1) * (gridSize - 1);
    const indices = new Uint32Array(quadCount * 6);
    let idx = 0;

    for (let z = 0; z < gridSize - 1; z++) {
      for (let x = 0; x < gridSize - 1; x++) {
        const topLeft = z * gridSize + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * gridSize + x;
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad
        indices[idx++] = topLeft;
        indices[idx++] = bottomLeft;
        indices[idx++] = topRight;

        indices[idx++] = topRight;
        indices[idx++] = bottomLeft;
        indices[idx++] = bottomRight;
      }
    }

    return indices;
  }

  /**
   * Generate indices for a ring (excludes inner hole)
   */
  private generateRingIndices(gridSize: number, cellSize: number, halfHoleSize: number): Uint32Array {
    const halfSize = (gridSize - 1) * cellSize / 2;
    const indexList: number[] = [];

    for (let z = 0; z < gridSize - 1; z++) {
      for (let x = 0; x < gridSize - 1; x++) {
        // Calculate world position of this quad's center
        const quadCenterX = (x + 0.5) * cellSize - halfSize;
        const quadCenterZ = (z + 0.5) * cellSize - halfSize;

        // Skip quads that are inside the inner hole
        if (Math.abs(quadCenterX) < halfHoleSize && Math.abs(quadCenterZ) < halfHoleSize) {
          continue;
        }

        const topLeft = z * gridSize + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * gridSize + x;
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad
        indexList.push(topLeft, bottomLeft, topRight);
        indexList.push(topRight, bottomLeft, bottomRight);
      }
    }

    return new Uint32Array(indexList);
  }

  /**
   * Get cell size at a given LOD level
   */
  private getCellSize(level: number): number {
    return this.config.baseCellSize * Math.pow(2, level);
  }

  /**
   * Get total size of a level in world units
   */
  private getLevelSize(level: number): number {
    return (this.config.gridSize - 1) * this.getCellSize(level);
  }

  /**
   * Update the clipmap based on viewer position
   * The clipmap group is repositioned to stay centered on the viewer
   */
  update(viewerX: number, viewerY: number, viewerZ: number): void {
    // Snap viewer position to grid to prevent jitter
    const snapSize = this.config.baseCellSize;
    const snappedX = Math.floor(viewerX / snapSize) * snapSize;
    const snappedZ = Math.floor(viewerZ / snapSize) * snapSize;

    // Update group position
    this.group.position.set(snappedX, 0, snappedZ);

    // Update shader uniform
    this.uViewerPos.value.set(snappedX, viewerY, snappedZ);
  }

  /**
   * Update the heightmap from a new generator function
   * Call this when terrain changes (e.g., loading a new area)
   */
  updateHeightmap(heightGenerator: (x: number, z: number) => number): void {
    if (!this.heightmapTexture) return;

    const res = this.config.heightmapResolution;
    const data = this.heightmapTexture.image.data as Float32Array;
    const maxLevelSize = this.getLevelSize(this.config.levels - 1);
    const worldExtent = maxLevelSize * 2;

    for (let z = 0; z < res; z++) {
      for (let x = 0; x < res; x++) {
        const worldX = (x / (res - 1) - 0.5) * worldExtent;
        const worldZ = (z / (res - 1) - 0.5) * worldExtent;
        data[z * res + x] = heightGenerator(worldX, worldZ);
      }
    }

    this.heightmapTexture.needsUpdate = true;
  }

  /**
   * Set the height scale uniform
   */
  setHeightScale(scale: number): void {
    this.uHeightScale.value = scale;
  }

  /**
   * Get statistics for debugging
   */
  getStats(): { levels: number; totalVertices: number; totalTriangles: number } {
    let totalVertices = 0;
    let totalTriangles = 0;

    for (const level of this.levels) {
      const geo = level.mesh.geometry;
      totalVertices += geo.getAttribute("position").count;
      const index = geo.getIndex();
      if (index) {
        totalTriangles += index.count / 3;
      }
    }

    return {
      levels: this.levels.length,
      totalVertices,
      totalTriangles,
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    for (const level of this.levels) {
      level.mesh.geometry.dispose();
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.heightmapTexture) {
      this.heightmapTexture.dispose();
    }

    this.group.clear();
    this.levels = [];

    console.log("[GeometryClipmap] Disposed");
  }
}

// ============================================================================
// HYBRID CHUNK+CLIPMAP SYSTEM (RECOMMENDED)
// ============================================================================
// This approach keeps the existing chunk streaming system but adds
// clipmap-style vertex morphing to eliminate seams between chunks.

/**
 * Configuration for the hybrid chunk+clipmap material
 */
export interface HybridClipmapConfig {
  /** LOD distance thresholds (world units) */
  lodDistances: number[];
  /** Size of each chunk (world units) */
  chunkSize: number;
  /** Vertices per chunk side at LOD 0 */
  baseResolution: number;
  /** Where morphing starts within each LOD range (0.5 = 50%) */
  morphStart: number;
}

/**
 * Create a material for chunk-based terrain with clipmap-style vertex morphing
 *
 * This is the RECOMMENDED approach for this project because:
 * 1. Works with existing chunk loading/unloading system
 * 2. GPU-based vertex morphing eliminates seams between LOD levels
 * 3. Supports dynamic terrain generation and special zones
 *
 * The key insight from Geometry Clipmaps applied here:
 * - Adjacent chunks MUST share edge vertices with identical heights
 * - Within transition zones, vertices morph: z' = (1-α)zf + αzc
 * - Morphing happens on GPU, so it's smooth and per-frame
 */
export function createHybridClipmapMaterial(config: HybridClipmapConfig): MeshStandardNodeMaterial {
  // Uniforms that get updated per-chunk
  const uChunkWorldPos = uniform(new Vector3(0, 0, 0), "vec3");
  const uChunkSize = uniform(config.chunkSize, "float");
  const uLod = uniform(0, "int");

  // Global uniforms
  const uMorphStart = uniform(config.morphStart, "float");
  const lodCount = Math.min(config.lodDistances.length, 5);
  const uLodDistances = [
    uniform(config.lodDistances[0] ?? 32, "float"),
    uniform(config.lodDistances[1] ?? 64, "float"),
    uniform(config.lodDistances[2] ?? 128, "float"),
    uniform(config.lodDistances[3] ?? 256, "float"),
    uniform(config.lodDistances[4] ?? 512, "float"),
  ];

  /**
   * Calculate the blend factor α for a vertex based on camera distance
   *
   * The clipmap formula is: z' = (1-α)zf + αzc
   * where:
   *   zf = height at fine (current) LOD
   *   zc = height at coarse (next) LOD
   *   α = blend factor, 0 at LOD boundary start, 1 at LOD boundary end
   *
   * We compute α based on where the vertex is within its LOD's transition zone.
   */
  const calculateMorphAlpha = Fn(([distToCamera]: [ReturnType<typeof float>]) => {
    const alpha = float(0.0).toVar();

    // Check each LOD level
    // @ts-expect-error - UniformNode type mismatch in TSL
    If(distToCamera.lessThan(uLodDistances[0]), () => {
      // Within LOD 0 range
      const lodStart = float(0.0);
      // @ts-expect-error - UniformNode type mismatch in TSL
      const lodEnd = uLodDistances[0];
      const lodRange = sub(lodEnd, lodStart);
      // @ts-expect-error - UniformNode type mismatch in TSL
      const transitionStart = mul(lodEnd, uMorphStart);
      const transitionRange = sub(lodEnd, transitionStart);

      If(distToCamera.greaterThan(transitionStart), () => {
        // In transition zone - calculate alpha
        const posInTransition = div(sub(distToCamera, transitionStart), transitionRange);
        alpha.assign(clamp(posInTransition, 0.0, 1.0));
      });
    }).ElseIf(distToCamera.lessThan(uLodDistances[1]), () => {
      // Within LOD 1 range
      const lodStart = uLodDistances[0];
      const lodEnd = uLodDistances[1];
      const lodRange = sub(lodEnd, lodStart);
      const transitionStart = add(lodStart, mul(lodRange, uMorphStart));
      const transitionRange = sub(lodEnd, transitionStart);

      If(distToCamera.greaterThan(transitionStart), () => {
        const posInTransition = div(sub(distToCamera, transitionStart), transitionRange);
        alpha.assign(clamp(posInTransition, 0.0, 1.0));
      });
    }).ElseIf(distToCamera.lessThan(uLodDistances[2]), () => {
      // Within LOD 2 range
      const lodStart = uLodDistances[1];
      const lodEnd = uLodDistances[2];
      const lodRange = sub(lodEnd, lodStart);
      const transitionStart = add(lodStart, mul(lodRange, uMorphStart));
      const transitionRange = sub(lodEnd, transitionStart);

      If(distToCamera.greaterThan(transitionStart), () => {
        const posInTransition = div(sub(distToCamera, transitionStart), transitionRange);
        alpha.assign(clamp(posInTransition, 0.0, 1.0));
      });
    }).ElseIf(distToCamera.lessThan(uLodDistances[3]), () => {
      // Within LOD 3 range
      const lodStart = uLodDistances[2];
      const lodEnd = uLodDistances[3];
      const lodRange = sub(lodEnd, lodStart);
      const transitionStart = add(lodStart, mul(lodRange, uMorphStart));
      const transitionRange = sub(lodEnd, transitionStart);

      If(distToCamera.greaterThan(transitionStart), () => {
        const posInTransition = div(sub(distToCamera, transitionStart), transitionRange);
        alpha.assign(clamp(posInTransition, 0.0, 1.0));
      });
    }).Else(() => {
      // Beyond all LOD levels - fully morphed
      alpha.assign(1.0);
    });

    return alpha;
  });

  /**
   * Morph vertex position from fine grid to coarse grid
   *
   * Vertices at "odd" grid positions (those that exist only at finer LODs)
   * morph toward their even neighbors (which exist at coarser LODs).
   *
   * Grid position parity is determined by: fract(gridPos * 0.5) * 2
   * - Even positions: result = 0
   * - Odd positions: result = 1
   */
  const morphVertexPosition = Fn(([localPos, alpha]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    const result = vec3(localPos).toVar();

    If(alpha.greaterThan(0.001), () => {
      // Calculate grid step at current resolution
      const gridStep = div(uChunkSize, float(config.baseResolution - 1));

      // Convert local position to grid coordinates
      const gridX = div(localPos.x, gridStep);
      const gridZ = div(localPos.z, gridStep);

      // Determine if this is an "odd" vertex (needs morphing)
      // fract(x * 0.5) * 2 gives 0 for even, ~1 for odd grid positions
      const oddX = mul(fract(mul(gridX, 0.5)), 2.0);
      const oddZ = mul(fract(mul(gridZ, 0.5)), 2.0);

      // Calculate the offset to the coarser grid position
      // Odd vertices snap to the nearest even vertex when fully morphed
      const offsetX = mul(mul(oddX, gridStep), alpha);
      const offsetZ = mul(mul(oddZ, gridStep), alpha);

      // Apply morphing - move toward coarser grid position
      result.x.assign(sub(localPos.x, offsetX));
      result.z.assign(sub(localPos.z, offsetZ));
    });

    return result;
  });

  /**
   * Main vertex displacement function
   */
  const vertexDisplacement = Fn(() => {
    const localPos = positionLocal;

    // Calculate world position of chunk center
    const chunkCenterWorld = add(
      uChunkWorldPos,
      vec3(mul(uChunkSize, 0.5), 0, mul(uChunkSize, 0.5))
    );

    // Distance from camera to chunk center (for LOD determination)
    const toCamera = sub(cameraPosition, chunkCenterWorld);
    const distToCamera = length(vec3(toCamera.x, 0, toCamera.z)); // XZ distance only

    // Calculate morph alpha
    const alpha = calculateMorphAlpha(distToCamera);

    // Morph vertex position
    const morphedPos = morphVertexPosition(localPos, alpha);

    // Y (height) stays the same - it's baked into the vertex data
    // The key is that the XZ position morphs to match the coarser grid,
    // which means adjacent chunks will have matching edge vertices
    return vec3(morphedPos.x, localPos.y, morphedPos.z);
  });

  // Create material
  const material = new MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Apply vertex displacement
  material.positionNode = vertexDisplacement();

  // Store uniforms for external access
  (material as unknown as Record<string, unknown>).clipmapUniforms = {
    uChunkWorldPos,
    uChunkSize,
    uLod,
    uMorphStart,
    uLodDistances,
  };

  return material;
}

/**
 * Update material uniforms for a specific chunk
 */
export function updateHybridChunkUniforms(
  material: MeshStandardNodeMaterial,
  chunkWorldX: number,
  chunkWorldZ: number,
  lod: number
): void {
  const uniforms = (material as unknown as Record<string, unknown>).clipmapUniforms as {
    uChunkWorldPos: ReturnType<typeof uniform>;
    uLod: ReturnType<typeof uniform>;
  } | undefined;

  if (uniforms) {
    uniforms.uChunkWorldPos.value.set(chunkWorldX, 0, chunkWorldZ);
    uniforms.uLod.value = lod;
  }
}

// ============================================================================
// SHARED EDGE GENERATION (CRITICAL FOR SEAMLESS TERRAIN)
// ============================================================================
// The key to seamless terrain is that adjacent chunks MUST share identical
// edge vertices. This requires:
// 1. Edge vertex world coordinates are calculated EXACTLY (no floating point drift)
// 2. Heights at edges are sampled at those exact world coordinates
// 3. When LOD differs, the higher-LOD chunk generates "transition" vertices
//    that interpolate to match the lower-LOD chunk's edge

/**
 * Generate edge-matched vertex positions for a chunk
 *
 * This ensures that:
 * - Edge vertices are at EXACT world coordinates (no floating point drift)
 * - Adjacent chunks sample the same world positions for their shared edge
 * - LOD transitions are handled by vertex morphing in the shader
 *
 * @param chunkX - Chunk X coordinate (not world position)
 * @param chunkZ - Chunk Z coordinate
 * @param chunkSize - Size of chunk in world units
 * @param resolution - Vertices per side
 * @param heightFn - Function to get height at world coordinates
 */
export function generateEdgeMatchedVertices(
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  resolution: number,
  heightFn: (worldX: number, worldZ: number) => number
): { vertices: Float32Array; normals: Float32Array } {
  const vertexCount = resolution * resolution;
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  // CRITICAL: Calculate exact world origin (integer math, no drift)
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;

  const step = chunkSize / (resolution - 1);

  // First pass: generate vertices with exact edge coordinates
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = (z * resolution + x) * 3;

      // CRITICAL: Edge vertices use EXACT boundary coordinates
      // This ensures adjacent chunks have identical edge positions
      let worldX: number;
      let worldZ: number;

      if (x === 0) {
        worldX = originX; // Exact left edge
      } else if (x === resolution - 1) {
        worldX = originX + chunkSize; // Exact right edge
      } else {
        worldX = originX + x * step;
      }

      if (z === 0) {
        worldZ = originZ; // Exact bottom edge
      } else if (z === resolution - 1) {
        worldZ = originZ + chunkSize; // Exact top edge
      } else {
        worldZ = originZ + z * step;
      }

      // Sample height at exact world coordinates
      const height = heightFn(worldX, worldZ);

      // Store local position (relative to chunk origin)
      // The local coordinates also use exact values for edges
      const localX = x === 0 ? 0 : (x === resolution - 1 ? chunkSize : x * step);
      const localZ = z === 0 ? 0 : (z === resolution - 1 ? chunkSize : z * step);

      vertices[idx] = localX;
      vertices[idx + 1] = height;
      vertices[idx + 2] = localZ;
    }
  }

  // Second pass: calculate normals
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = (z * resolution + x) * 3;

      const currentHeight = vertices[idx + 1] ?? 0;
      const left = x > 0 ? (vertices[(z * resolution + (x - 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const right = x < resolution - 1 ? (vertices[(z * resolution + (x + 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const down = z > 0 ? (vertices[((z - 1) * resolution + x) * 3 + 1] ?? currentHeight) : currentHeight;
      const up = z < resolution - 1 ? (vertices[((z + 1) * resolution + x) * 3 + 1] ?? currentHeight) : currentHeight;

      // Calculate normal from height differences
      const nx = left - right;
      const ny = 2 * step;
      const nz = down - up;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    }
  }

  return { vertices, normals };
}
