/**
 * CDLOD Terrain Shader using TSL (Three.js Shading Language)
 *
 * Implements Continuous Distance-Dependent Level of Detail with vertex morphing.
 * Uses TSL for compatibility with both WebGL and WebGPU renderers.
 *
 * Key concepts:
 * - Vertices morph smoothly between LOD levels based on camera distance
 * - No seams because vertices transition continuously, not discretely
 * - All morphing happens in the vertex shader (GPU-side)
 *
 * References:
 * - Filip Strugar's CDLOD paper
 * - https://svnte.se/cdlod-terrain
 * - https://threejs.org/docs/pages/TSL.html
 */

import {
  MeshStandardNodeMaterial,
  // MeshBasicNodeMaterial,
} from "three/webgpu";

import {
  Fn,
  uniform,
  positionLocal,
  cameraPosition,
  modelWorldMatrix,
  normalLocal,
  vec3,
  float,
  int,
  If,
  Loop,
  clamp,
  floor,
  fract,
  mix,
  length,
  sub,
  mul,
  div,
  add,
  attribute,
} from "three/tsl";

import { Color, Vector3 } from "three";

/**
 * LOD configuration for CDLOD terrain
 */
export interface CDLODConfig {
  /** Distance thresholds for each LOD level (in world units) */
  lodDistances: number[];
  /** Size of each chunk in world units */
  chunkSize: number;
  /** Base resolution (vertices per side at LOD 0) */
  baseResolution: number;
}

/**
 * Create a CDLOD terrain material with vertex morphing using TSL
 * Compatible with both WebGL and WebGPU renderers
 */
export function createCDLODMaterial(config: CDLODConfig): MeshStandardNodeMaterial {
  // Create uniforms
  const uLodDistances = [
    uniform(config.lodDistances[0] ?? 32, "float"),
    uniform(config.lodDistances[1] ?? 64, "float"),
    uniform(config.lodDistances[2] ?? 128, "float"),
    uniform(config.lodDistances[3] ?? 256, "float"),
    uniform(config.lodDistances[4] ?? 512, "float"),
  ];
  const uLodCount = uniform(config.lodDistances.length, "int");
  const uChunkSize = uniform(config.chunkSize, "float");
  const uResolution = uniform(config.baseResolution, "int");
  const uChunkWorldPos = uniform(new Vector3(0, 0, 0), "vec3");
  const uMorphStart = uniform(0.5, "float"); // Start morphing at 50% through LOD range

  /**
   * Calculate morph factor based on camera distance
   * Returns 0.0 when vertex should stay at current LOD position
   * Returns 1.0 when vertex should fully morph to coarser LOD position
   */
  const getMorphFactor = Fn(([distanceToCamera]: [ReturnType<typeof float>]) => {
    // Simple approach: morph based on distance ranges
    // For each LOD level, calculate where we are in the range
    const morphFactor = float(0.0).toVar();
    const prevThreshold = float(0.0).toVar();

    // Check LOD 0
    If(distanceToCamera.lessThan(uLodDistances[0]), () => {
      const range = uLodDistances[0];
      const positionInRange = div(distanceToCamera, range);
      const morphRange = sub(float(1.0), uMorphStart);
      const factor = div(sub(positionInRange, uMorphStart), morphRange);
      morphFactor.assign(clamp(factor, 0.0, 1.0));
    }).ElseIf(distanceToCamera.lessThan(uLodDistances[1]), () => {
      const range = sub(uLodDistances[1], uLodDistances[0]);
      const positionInRange = div(sub(distanceToCamera, uLodDistances[0]), range);
      const morphRange = sub(float(1.0), uMorphStart);
      const factor = div(sub(positionInRange, uMorphStart), morphRange);
      morphFactor.assign(clamp(factor, 0.0, 1.0));
    }).ElseIf(distanceToCamera.lessThan(uLodDistances[2]), () => {
      const range = sub(uLodDistances[2], uLodDistances[1]);
      const positionInRange = div(sub(distanceToCamera, uLodDistances[1]), range);
      const morphRange = sub(float(1.0), uMorphStart);
      const factor = div(sub(positionInRange, uMorphStart), morphRange);
      morphFactor.assign(clamp(factor, 0.0, 1.0));
    }).ElseIf(distanceToCamera.lessThan(uLodDistances[3]), () => {
      const range = sub(uLodDistances[3], uLodDistances[2]);
      const positionInRange = div(sub(distanceToCamera, uLodDistances[2]), range);
      const morphRange = sub(float(1.0), uMorphStart);
      const factor = div(sub(positionInRange, uMorphStart), morphRange);
      morphFactor.assign(clamp(factor, 0.0, 1.0));
    }).Else(() => {
      // Beyond all LOD levels
      morphFactor.assign(1.0);
    });

    return morphFactor;
  });

  /**
   * Morph vertex position toward coarser grid
   * The coarser grid has half the resolution, so we snap to positions
   * that are multiples of 2 in grid space, then interpolate based on morph factor.
   */
  const morphVertex = Fn(([localPos, morphFactor]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    // If no morphing needed, return original position
    const result = vec3(localPos).toVar();

    If(morphFactor.greaterThan(0.0), () => {
      // Grid spacing at current resolution
      const resFloat = float(uResolution);
      const gridStep = div(uChunkSize, sub(resFloat, float(1.0)));

      // Convert to grid coordinates
      const gridX = div(localPos.x, gridStep);
      const gridZ = div(localPos.z, gridStep);

      // Find the fractional part that indicates which vertices need morphing
      // Vertices at even grid positions don't morph (they exist at coarser LOD)
      // Vertices at odd grid positions morph toward their even neighbors
      const fracX = mul(fract(mul(gridX, 0.5)), 2.0);
      const fracZ = mul(fract(mul(gridZ, 0.5)), 2.0);

      // Calculate offset to snap to coarser grid
      const morphOffsetX = mul(fracX, gridStep);
      const morphOffsetZ = mul(fracZ, gridStep);

      // Interpolate between current position and coarser position
      result.x.assign(sub(localPos.x, mul(morphOffsetX, morphFactor)));
      result.z.assign(sub(localPos.z, mul(morphOffsetZ, morphFactor)));
    });

    return result;
  });

  /**
   * Main vertex displacement function
   */
  const vertexDisplacement = Fn(() => {
    const localPos = positionLocal;

    // Calculate world position of this vertex
    const worldPos = modelWorldMatrix.mul(vec3(localPos.x, localPos.y, localPos.z).toVar().add(vec3(0, 0, 0)));

    // Distance from camera to vertex (approximate - use chunk center for efficiency)
    const chunkCenter = add(uChunkWorldPos, vec3(mul(uChunkSize, 0.5), 0, mul(uChunkSize, 0.5)));
    const toCamera = sub(cameraPosition, chunkCenter);
    const distanceToCamera = length(toCamera);

    // Calculate morph factor
    const morphFactor = getMorphFactor(distanceToCamera);

    // Morph the vertex position
    const morphedPos = morphVertex(localPos, morphFactor);

    return morphedPos;
  });

  // Create the material
  const material = new MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Apply vertex displacement
  material.positionNode = vertexDisplacement();

  // Store uniforms on material for external access
  (material as unknown as Record<string, unknown>).cdlodUniforms = {
    uChunkWorldPos,
    uResolution,
    uLodDistances,
    uLodCount,
    uChunkSize,
    uMorphStart,
  };

  return material;
}

/**
 * Update CDLOD material uniforms for a specific chunk
 */
export function updateChunkUniforms(
  material: MeshStandardNodeMaterial,
  chunkWorldX: number,
  chunkWorldZ: number,
  resolution: number
): void {
  const uniforms = (material as unknown as Record<string, unknown>).cdlodUniforms as {
    uChunkWorldPos: ReturnType<typeof uniform>;
    uResolution: ReturnType<typeof uniform>;
  } | undefined;

  if (uniforms) {
    uniforms.uChunkWorldPos.value.set(chunkWorldX, 0, chunkWorldZ);
    uniforms.uResolution.value = resolution;
  }
}

/**
 * Enable/disable morph debug visualization
 */
export function setDebugMorphing(material: MeshStandardNodeMaterial, enabled: boolean): void {
  // TODO: Implement debug visualization with TSL colorNode
  console.log(`[CDLOD] Debug morphing: ${enabled}`);
}

/**
 * Update sun direction for terrain material
 */
export function setSunDirection(material: MeshStandardNodeMaterial, direction: Vector3): void {
  // MeshStandardNodeMaterial uses scene lights, no need for custom sun uniform
}
