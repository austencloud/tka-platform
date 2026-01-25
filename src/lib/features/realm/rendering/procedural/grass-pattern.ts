/**
 * Procedural Grass Material Pattern
 *
 * Creates lush grass texturing using layered noise:
 * - Base green color with temperature variation
 * - FBM for large-scale color variation (patches)
 * - Worley noise for blade clump patterns
 * - High-frequency detail for individual blade hints
 *
 * Returns color, roughness, and height offset for normal calculation.
 */

import {
  Fn,
  vec2,
  vec3,
  float,
  mix,
  clamp,
  mul,
  add,
  sub,
  pow,
} from "three/tsl";
// TSL types - using any due to incomplete type exports
type ShaderNodeObject<T> = any;
type Node = any;

import {
  simpleFBM,
  valueNoise2D,
  voronoiNoise,
  ridgedNoise,
} from "./terrain-noise";

// ============================================================================
// GRASS COLOR PALETTE
// ============================================================================

// Base grass colors (RGB)
const GRASS_DARK = vec3(0.15, 0.35, 0.08);    // Dark forest grass
const GRASS_MID = vec3(0.25, 0.50, 0.12);     // Mid-tone grass
const GRASS_LIGHT = vec3(0.40, 0.60, 0.18);   // Sun-lit grass
const GRASS_DRY = vec3(0.45, 0.50, 0.20);     // Dry/yellow grass
const GRASS_LUSH = vec3(0.20, 0.55, 0.15);    // Lush meadow grass

// ============================================================================
// GRASS PATTERN FUNCTION
// ============================================================================

/**
 * Generate procedural grass pattern
 *
 * @param worldPos - World position (XZ plane, Y used for variation)
 * @param tileScale - Texture tiling scale (higher = smaller details)
 * @returns { color: vec3, roughness: float, height: float }
 */
export const grassPattern = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    // UV coordinates for texturing
    const uv = mul(worldPos.xz, tileScale);

    // ========================================================================
    // LAYER 1: Large-scale variation (patches of different grass types)
    // ========================================================================
    const patchNoise = simpleFBM(mul(uv, 0.05));
    const moistureNoise = simpleFBM(mul(add(uv, vec2(100.0, 50.0)), 0.03));

    // ========================================================================
    // LAYER 2: Medium-scale clumping (grass tufts)
    // ========================================================================
    const clumpNoise = voronoiNoise(mul(uv, 0.8));
    const clumpPattern = sub(1.0, mul(clumpNoise, 1.2));

    // ========================================================================
    // LAYER 3: Fine detail (individual blade direction hints)
    // ========================================================================
    const detailNoise = valueNoise2D(mul(uv, 8.0));
    const microDetail = valueNoise2D(mul(uv, 32.0));

    // ========================================================================
    // COLOR CALCULATION
    // ========================================================================

    // Base color from patch type
    const patchBlend = clamp(patchNoise, 0.0, 1.0);
    const baseColor1 = mix(GRASS_MID, GRASS_DARK, patchBlend);

    // Add moisture variation (lush vs dry)
    const moistureBlend = clamp(moistureNoise, 0.0, 1.0);
    const baseColor2 = mix(baseColor1, GRASS_LUSH, mul(moistureBlend, 0.5));

    // Modulate by clump pattern (darker in gaps between tufts)
    const clumpColor = mix(
      mul(baseColor2, 0.7), // Darker in gaps
      baseColor2,
      clamp(clumpPattern, 0.0, 1.0)
    );

    // Add sunlight variation from detail noise
    const sunlitBlend = mul(detailNoise, 0.3);
    const colorWithSun = mix(clumpColor, GRASS_LIGHT, sunlitBlend);

    // Final micro-detail modulation
    const microMod = add(0.9, mul(microDetail, 0.2));
    const finalColor = mul(colorWithSun, microMod);

    // ========================================================================
    // ROUGHNESS
    // ========================================================================
    // Grass is generally matte, but varies slightly
    // Dry grass is rougher, fresh grass slightly less rough
    const baseRoughness = float(0.85);
    const roughnessVariation = mul(sub(moistureNoise, 0.5), 0.1);
    const roughness = clamp(add(baseRoughness, roughnessVariation), 0.75, 0.95);

    // ========================================================================
    // HEIGHT (for normal calculation)
    // ========================================================================
    // Height is derived from noise to create subtle bumps
    const clumpHeight = mul(clumpPattern, 0.02);
    const detailHeight = mul(detailNoise, 0.005);
    const height = add(clumpHeight, detailHeight);

    return {
      color: finalColor,
      roughness: roughness,
      height: height,
    };
  }
);

/**
 * Simplified grass for distant terrain (fewer layers)
 */
export const grassPatternSimple = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // Just two layers of noise
    const patchNoise = simpleFBM(mul(uv, 0.05));
    const detailNoise = valueNoise2D(mul(uv, 4.0));

    // Simple color blend
    const color = mix(GRASS_MID, GRASS_DARK, patchNoise);
    const finalColor = mul(color, add(0.9, mul(detailNoise, 0.2)));

    return {
      color: finalColor,
      roughness: float(0.85),
      height: mul(detailNoise, 0.01),
    };
  }
);
