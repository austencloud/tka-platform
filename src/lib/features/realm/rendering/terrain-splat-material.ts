// @ts-nocheck - TSL type system has UniformNode compatibility issues
/**
 * Terrain Splat Material using TSL
 *
 * Production-quality PBR terrain texturing with:
 * - Triplanar mapping (no UV seams on cliffs)
 * - 5-layer texture splatting (grass, rock, dirt, sand, snow)
 * - Procedural noise patterns (no texture files needed)
 * - Height-based and slope-based blending
 * - LOD vertex morphing for seamless terrain transitions (clipmap-style)
 *
 * Blend weights come from vertex attributes computed in the chunk worker.
 * All texturing is procedural - generated on the GPU via TSL noise functions.
 *
 * LOD morphing is based on Geometry Clipmaps (Losasso & Hoppe, SIGGRAPH 2004):
 * - Vertices at "odd" grid positions morph toward "even" positions
 * - Formula: z' = (1-α)zf + αzc where α increases near LOD boundaries
 * - This eliminates popping/seams between LOD levels
 *
 * Based on Three.js official webgpu_tsl_procedural_terrain example.
 *
 * References:
 * - https://threejs.org/examples/webgpu_tsl_procedural_terrain.html
 * - https://github.com/boytchev/tsl-textures
 * - https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
 */

import { MeshStandardNodeMaterial } from "three/webgpu";

import {
  Fn,
  uniform,
  attribute,
  positionLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  modelWorldMatrix,
  vec2,
  vec3,
  float,
  abs,
  pow,
  normalize,
  mix,
  clamp,
  add,
  sub,
  mul,
  div,
  max,
  min,
  floor,
  fract,
  dot,
  sin,
  cos,
  hash,
  length,
  If,
} from "three/tsl";

import { Vector3 } from "three";

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TerrainSplatConfig {
  /** Texture scale for procedural patterns (default: 0.1 = 10m repeat) */
  tileScale?: number;
  /** Triplanar blending sharpness (default: 4.0, higher = sharper) */
  triplanarSharpness?: number;
  /** Use simplified patterns for better performance (default: false) */
  useSimplePatterns?: boolean;

  // LOD morphing configuration
  /** Enable LOD vertex morphing for seamless transitions (default: true) */
  enableLODMorphing?: boolean;
  /** LOD distance thresholds (default: [32, 64, 128, 256, 512]) */
  lodDistances?: number[];
  /** Chunk size in world units (default: 32) */
  chunkSize?: number;
  /** Base resolution (vertices per side at LOD 0) (default: 33) */
  baseResolution?: number;
  /** Where morphing starts within each LOD range (0.5 = 50%) (default: 0.6) */
  morphStart?: number;
}

const DEFAULT_CONFIG: Required<TerrainSplatConfig> = {
  tileScale: 0.1,
  triplanarSharpness: 4.0,
  useSimplePatterns: false,

  // LOD morphing defaults
  enableLODMorphing: true,
  lodDistances: [32, 64, 128, 256, 512],
  chunkSize: 32,
  baseResolution: 33,
  morphStart: 0.6, // Start morphing at 60% of LOD range
};

// ============================================================================
// COLOR PALETTES
// ============================================================================

const GRASS_DARK = vec3(0.15, 0.35, 0.08);
const GRASS_MID = vec3(0.25, 0.50, 0.12);
const GRASS_LIGHT = vec3(0.40, 0.60, 0.18);

const ROCK_DARK = vec3(0.25, 0.23, 0.22);
const ROCK_MID = vec3(0.45, 0.43, 0.40);
const ROCK_LIGHT = vec3(0.60, 0.58, 0.55);

const DIRT_DARK = vec3(0.25, 0.18, 0.12);
const DIRT_MID = vec3(0.40, 0.30, 0.20);
const DIRT_LIGHT = vec3(0.55, 0.45, 0.35);

const SAND_DARK = vec3(0.70, 0.60, 0.45);
const SAND_MID = vec3(0.85, 0.75, 0.60);
const SAND_LIGHT = vec3(0.95, 0.90, 0.80);

const SNOW_DARK = vec3(0.85, 0.88, 0.95);
const SNOW_MID = vec3(0.95, 0.97, 1.0);
const SNOW_LIGHT = vec3(1.0, 1.0, 1.0);

// ============================================================================
// NOISE FUNCTIONS (inline for TSL compatibility)
// ============================================================================

/**
 * Simple 2D value noise using hash
 */
const valueNoise2D = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const i = floor(p);
  const f = fract(p);

  // Smooth interpolation curve
  const u = mul(f, mul(f, sub(float(3.0), mul(float(2.0), f))));

  // Four corner values
  const a = hash(i);
  const b = hash(add(i, vec2(1.0, 0.0)));
  const c = hash(add(i, vec2(0.0, 1.0)));
  const d = hash(add(i, vec2(1.0, 1.0)));

  // Bilinear interpolation
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

/**
 * Simple FBM (4 octaves, inline)
 */
const simpleFBM = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const value = float(0.0).toVar();
  const amplitude = float(1.0).toVar();
  const pos = vec2(p).toVar();
  const totalAmp = float(0.0).toVar();

  // Octave 1
  value.addAssign(mul(amplitude, valueNoise2D(pos)));
  totalAmp.addAssign(amplitude);
  amplitude.mulAssign(float(0.5));
  pos.mulAssign(float(2.0));

  // Octave 2
  value.addAssign(mul(amplitude, valueNoise2D(pos)));
  totalAmp.addAssign(amplitude);
  amplitude.mulAssign(float(0.5));
  pos.mulAssign(float(2.0));

  // Octave 3
  value.addAssign(mul(amplitude, valueNoise2D(pos)));
  totalAmp.addAssign(amplitude);
  amplitude.mulAssign(float(0.5));
  pos.mulAssign(float(2.0));

  // Octave 4
  value.addAssign(mul(amplitude, valueNoise2D(pos)));
  totalAmp.addAssign(amplitude);

  return div(value, totalAmp);
});

/**
 * Voronoi/cellular noise for patterns
 */
const voronoiNoise = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const n = floor(p);
  const f = fract(p);
  const minDist = float(8.0).toVar();

  // Unrolled 3x3 neighborhood check
  // Row -1
  const neighbor_m1_m1 = vec2(float(-1), float(-1));
  const cell_m1_m1 = add(neighbor_m1_m1, hash(add(n, neighbor_m1_m1)));
  minDist.assign(min(minDist, length(sub(cell_m1_m1, f))));

  const neighbor_0_m1 = vec2(float(0), float(-1));
  const cell_0_m1 = add(neighbor_0_m1, hash(add(n, neighbor_0_m1)));
  minDist.assign(min(minDist, length(sub(cell_0_m1, f))));

  const neighbor_1_m1 = vec2(float(1), float(-1));
  const cell_1_m1 = add(neighbor_1_m1, hash(add(n, neighbor_1_m1)));
  minDist.assign(min(minDist, length(sub(cell_1_m1, f))));

  // Row 0
  const neighbor_m1_0 = vec2(float(-1), float(0));
  const cell_m1_0 = add(neighbor_m1_0, hash(add(n, neighbor_m1_0)));
  minDist.assign(min(minDist, length(sub(cell_m1_0, f))));

  const neighbor_0_0 = vec2(float(0), float(0));
  const cell_0_0 = add(neighbor_0_0, hash(add(n, neighbor_0_0)));
  minDist.assign(min(minDist, length(sub(cell_0_0, f))));

  const neighbor_1_0 = vec2(float(1), float(0));
  const cell_1_0 = add(neighbor_1_0, hash(add(n, neighbor_1_0)));
  minDist.assign(min(minDist, length(sub(cell_1_0, f))));

  // Row 1
  const neighbor_m1_1 = vec2(float(-1), float(1));
  const cell_m1_1 = add(neighbor_m1_1, hash(add(n, neighbor_m1_1)));
  minDist.assign(min(minDist, length(sub(cell_m1_1, f))));

  const neighbor_0_1 = vec2(float(0), float(1));
  const cell_0_1 = add(neighbor_0_1, hash(add(n, neighbor_0_1)));
  minDist.assign(min(minDist, length(sub(cell_0_1, f))));

  const neighbor_1_1 = vec2(float(1), float(1));
  const cell_1_1 = add(neighbor_1_1, hash(add(n, neighbor_1_1)));
  minDist.assign(min(minDist, length(sub(cell_1_1, f))));

  return minDist;
});

// ============================================================================
// TRIPLANAR SAMPLING
// ============================================================================

/**
 * Calculate triplanar blend weights from world normal
 */
const getTriplanarWeights = Fn(
  ([worldNormal, sharpness]: [
    ReturnType<typeof vec3>,
    ReturnType<typeof float>,
  ]) => {
    const absNormal = abs(worldNormal);
    const weights = pow(absNormal, vec3(sharpness, sharpness, sharpness));
    const sum = add(add(weights.x, weights.y), weights.z);
    return div(weights, max(sum, float(0.001)));
  }
);

// ============================================================================
// MATERIAL PATTERN FUNCTIONS
// ============================================================================

/**
 * Grass color from position
 */
const getGrassColor = Fn(([uv]: [ReturnType<typeof vec2>]) => {
  const patchNoise = simpleFBM(mul(uv, float(0.05)));
  const detailNoise = valueNoise2D(mul(uv, float(4.0)));

  const baseColor = mix(GRASS_MID, GRASS_DARK, patchNoise);
  const finalColor = mul(baseColor, add(float(0.9), mul(detailNoise, float(0.2))));
  return finalColor;
});

/**
 * Rock color from position
 */
const getRockColor = Fn(([uv]: [ReturnType<typeof vec2>]) => {
  const crackNoise = voronoiNoise(mul(uv, float(2.0)));
  const fbmNoise = simpleFBM(mul(uv, float(0.1)));

  const baseColor = mix(ROCK_MID, ROCK_DARK, fbmNoise);
  const crackDark = mul(baseColor, float(0.7));
  const finalColor = mix(crackDark, baseColor, clamp(mul(crackNoise, float(2.0)), float(0.0), float(1.0)));
  return finalColor;
});

/**
 * Dirt color from position
 */
const getDirtColor = Fn(([uv]: [ReturnType<typeof vec2>]) => {
  const fbmNoise = simpleFBM(mul(uv, float(0.08)));
  const detailNoise = valueNoise2D(mul(uv, float(6.0)));

  const baseColor = mix(DIRT_MID, DIRT_DARK, fbmNoise);
  const finalColor = mul(baseColor, add(float(0.85), mul(detailNoise, float(0.3))));
  return finalColor;
});

/**
 * Sand color from position
 */
const getSandColor = Fn(([uv]: [ReturnType<typeof vec2>]) => {
  const rippleNoise = simpleFBM(mul(uv, float(0.3)));
  const fineNoise = valueNoise2D(mul(uv, float(20.0)));

  const baseColor = mix(SAND_MID, SAND_LIGHT, rippleNoise);
  const finalColor = mul(baseColor, add(float(0.95), mul(fineNoise, float(0.1))));
  return finalColor;
});

/**
 * Snow color from position
 */
const getSnowColor = Fn(([uv]: [ReturnType<typeof vec2>]) => {
  const driftNoise = simpleFBM(mul(uv, float(0.1)));
  const sparkleNoise = valueNoise2D(mul(uv, float(50.0)));

  const baseColor = mix(SNOW_MID, SNOW_LIGHT, driftNoise);
  // Add subtle sparkle
  const sparkle = mul(pow(sparkleNoise, float(8.0)), float(0.1));
  const finalColor = add(baseColor, vec3(sparkle, sparkle, sparkle));
  return finalColor;
});

// ============================================================================
// MAIN MATERIAL CREATION
// ============================================================================

/**
 * Create a terrain splat material with procedural texturing
 *
 * The material uses vertex attributes for blend weights:
 * - blendWeights1: vec3(grass, rock, dirt)
 * - blendWeights2: vec3(sand, snow, unused)
 *
 * These are computed per-vertex in the chunk worker based on biome, height, and slope.
 */
export function createTerrainSplatMaterial(
  config: TerrainSplatConfig = {}
): MeshStandardNodeMaterial {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Uniforms for texturing
  const uTileScale = uniform(cfg.tileScale, "float");
  const uTriplanarSharpness = uniform(cfg.triplanarSharpness, "float");

  // Uniforms for LOD morphing (shared across all chunks)
  // Note: uChunkWorldPos is NOT needed - we derive chunk position from modelWorldMatrix
  // This allows all chunks to share a single material instance
  const uChunkSize = uniform(cfg.chunkSize, "float");
  const uMorphStart = uniform(cfg.morphStart, "float");
  const uLodDistances = cfg.lodDistances.map((d) => uniform(d, "float"));

  // Create the material
  const material = new MeshStandardNodeMaterial({
    roughness: 0.8,
    metalness: 0.0,
  });

  // ===========================================================================
  // LOD VERTEX MORPHING (Geometry Clipmaps technique)
  // ===========================================================================
  // This eliminates popping/seams between LOD levels by smoothly morphing
  // vertices at "odd" grid positions toward "even" positions as the camera
  // moves away from the chunk.

  if (cfg.enableLODMorphing) {
    /**
     * Calculate the blend factor α based on camera distance
     * α = 0 at inner LOD boundary, ramps to 1 at outer boundary
     */
    const calculateMorphAlpha = Fn(([distToCamera]: [ReturnType<typeof float>]) => {
      const alpha = float(0.0).toVar();

      // Check each LOD level (unrolled for TSL compatibility)
      If(distToCamera.lessThan(uLodDistances[0]), () => {
        // Within LOD 0 range
        const lodEnd = uLodDistances[0];
        const transitionStart = mul(lodEnd, uMorphStart);
        const transitionRange = sub(lodEnd, transitionStart);

        If(distToCamera.greaterThan(transitionStart), () => {
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
     * Grid position parity: fract(gridPos * 0.5) * 2
     * - Even positions: result = 0
     * - Odd positions: result = 1
     */
    const morphVertexPosition = Fn(
      ([localPos, alpha]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
        const result = vec3(localPos).toVar();

        If(alpha.greaterThan(0.001), () => {
          // Grid step at current resolution
          const gridStep = div(uChunkSize, float(cfg.baseResolution - 1));

          // Convert local position to grid coordinates
          const gridX = div(localPos.x, gridStep);
          const gridZ = div(localPos.z, gridStep);

          // Determine if this is an "odd" vertex (needs morphing)
          // fract(x * 0.5) * 2 gives 0 for even, ~1 for odd grid positions
          const oddX = mul(fract(mul(gridX, 0.5)), 2.0);
          const oddZ = mul(fract(mul(gridZ, 0.5)), 2.0);

          // Calculate the offset to the coarser grid position
          const offsetX = mul(mul(oddX, gridStep), alpha);
          const offsetZ = mul(mul(oddZ, gridStep), alpha);

          // Apply morphing - move toward coarser grid position
          result.x.assign(sub(localPos.x, offsetX));
          result.z.assign(sub(localPos.z, offsetZ));
        });

        return result;
      }
    );

    /**
     * Main vertex displacement function
     *
     * Uses the model's world transform to determine chunk position,
     * allowing all chunks to share a single material instance.
     */
    const vertexDisplacement = Fn(() => {
      const localPos = positionLocal;

      // Get chunk's world origin from the model matrix (translation component)
      // This allows all chunks to share one material - each mesh's transform provides its position
      const chunkOrigin = vec3(
        modelWorldMatrix.element(3).element(0), // Translation X
        modelWorldMatrix.element(3).element(1), // Translation Y
        modelWorldMatrix.element(3).element(2)  // Translation Z
      );

      // World position of chunk center
      const chunkCenterWorld = add(
        chunkOrigin,
        vec3(mul(uChunkSize, 0.5), float(0), mul(uChunkSize, 0.5))
      );

      // Distance from camera to chunk center (XZ plane only)
      const toCamera = sub(cameraPosition, chunkCenterWorld);
      const distToCamera = length(vec3(toCamera.x, float(0), toCamera.z));

      // Calculate morph alpha
      const alpha = calculateMorphAlpha(distToCamera);

      // Morph vertex position (XZ only - height stays the same)
      const morphedPos = morphVertexPosition(localPos, alpha);

      return vec3(morphedPos.x, localPos.y, morphedPos.z);
    });

    // Apply vertex displacement
    material.positionNode = vertexDisplacement();
  }

  // ===========================================================================
  // TERRAIN TEXTURING (Triplanar procedural splatting)
  // ===========================================================================

  // Assign color node - this is the main terrain color calculation
  material.colorNode = Fn(() => {
    // Get world position and normal
    const worldPos = positionWorld;
    const worldNorm = normalWorld;

    // Vertex attributes for blend weights
    const blendWeights1 = attribute("blendWeights1", "vec3"); // grass, rock, dirt
    const blendWeights2 = attribute("blendWeights2", "vec3"); // sand, snow, _

    // Extract individual weights
    const wGrass = blendWeights1.x;
    const wRock = blendWeights1.y;
    const wDirt = blendWeights1.z;
    const wSand = blendWeights2.x;
    const wSnow = blendWeights2.y;

    // Get triplanar weights
    const triWeights = getTriplanarWeights(worldNorm, uTriplanarSharpness);

    // UV coordinates for each projection plane
    const uvXZ = mul(worldPos.xz, uTileScale); // Top-down (Y projection)
    const uvYZ = mul(vec2(worldPos.y, worldPos.z), uTileScale); // X projection
    const uvXY = mul(vec2(worldPos.x, worldPos.y), uTileScale); // Z projection

    // ========================================================================
    // SAMPLE EACH MATERIAL WITH TRIPLANAR BLENDING
    // ========================================================================

    // Grass triplanar
    const grassXZ = getGrassColor(uvXZ);
    const grassYZ = getGrassColor(uvYZ);
    const grassXY = getGrassColor(uvXY);
    const grassColor = add(
      add(mul(grassYZ, triWeights.x), mul(grassXZ, triWeights.y)),
      mul(grassXY, triWeights.z)
    );

    // Rock triplanar
    const rockXZ = getRockColor(uvXZ);
    const rockYZ = getRockColor(uvYZ);
    const rockXY = getRockColor(uvXY);
    const rockColor = add(
      add(mul(rockYZ, triWeights.x), mul(rockXZ, triWeights.y)),
      mul(rockXY, triWeights.z)
    );

    // Dirt triplanar
    const dirtXZ = getDirtColor(uvXZ);
    const dirtYZ = getDirtColor(uvYZ);
    const dirtXY = getDirtColor(uvXY);
    const dirtColor = add(
      add(mul(dirtYZ, triWeights.x), mul(dirtXZ, triWeights.y)),
      mul(dirtXY, triWeights.z)
    );

    // Sand triplanar
    const sandXZ = getSandColor(uvXZ);
    const sandYZ = getSandColor(uvYZ);
    const sandXY = getSandColor(uvXY);
    const sandColor = add(
      add(mul(sandYZ, triWeights.x), mul(sandXZ, triWeights.y)),
      mul(sandXY, triWeights.z)
    );

    // Snow triplanar
    const snowXZ = getSnowColor(uvXZ);
    const snowYZ = getSnowColor(uvYZ);
    const snowXY = getSnowColor(uvXY);
    const snowColor = add(
      add(mul(snowYZ, triWeights.x), mul(snowXZ, triWeights.y)),
      mul(snowXY, triWeights.z)
    );

    // ========================================================================
    // BLEND ALL MATERIALS BY VERTEX WEIGHTS
    // ========================================================================

    const finalColor = add(
      add(
        add(add(mul(grassColor, wGrass), mul(rockColor, wRock)), mul(dirtColor, wDirt)),
        mul(sandColor, wSand)
      ),
      mul(snowColor, wSnow)
    );

    return finalColor;
  })();

  // Roughness varies by material - grass is matte, rock is rougher
  material.roughnessNode = Fn(() => {
    const blendWeights1 = attribute("blendWeights1", "vec3");
    const blendWeights2 = attribute("blendWeights2", "vec3");

    // Different roughness per material type
    const grassRough = float(0.85);
    const rockRough = float(0.75);
    const dirtRough = float(0.90);
    const sandRough = float(0.95);
    const snowRough = float(0.40); // Snow is slightly shiny (ice)

    const roughness = add(
      add(
        add(
          add(mul(grassRough, blendWeights1.x), mul(rockRough, blendWeights1.y)),
          mul(dirtRough, blendWeights1.z)
        ),
        mul(sandRough, blendWeights2.x)
      ),
      mul(snowRough, blendWeights2.y)
    );

    return clamp(roughness, float(0.2), float(1.0));
  })();

  // Store config and uniforms for runtime updates
  (material as Record<string, unknown>).terrainConfig = cfg;
  (material as Record<string, unknown>).terrainUniforms = {
    uTileScale,
    uTriplanarSharpness,
    // LOD morphing uniforms (shared - chunk position derived from model matrix)
    uChunkSize,
    uMorphStart,
    uLodDistances,
  };

  return material;
}

/**
 * Create a simplified terrain material for fallback (WebGL compatibility)
 * Uses vertex colors instead of procedural texturing
 */
export function createTerrainFallbackMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
  });

  return material;
}

/**
 * Update terrain material uniforms at runtime
 */
export function updateTerrainMaterialUniforms(
  material: MeshStandardNodeMaterial,
  config: Partial<TerrainSplatConfig>
): void {
  const uniforms = (material as Record<string, unknown>).terrainUniforms as
    | {
        uTileScale?: { value: number };
        uTriplanarSharpness?: { value: number };
      }
    | undefined;

  if (uniforms) {
    if (config.tileScale !== undefined && uniforms.uTileScale) {
      uniforms.uTileScale.value = config.tileScale;
    }
    if (config.triplanarSharpness !== undefined && uniforms.uTriplanarSharpness) {
      uniforms.uTriplanarSharpness.value = config.triplanarSharpness;
    }
  }
}
