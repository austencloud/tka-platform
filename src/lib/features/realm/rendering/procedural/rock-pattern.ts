/**
 * Procedural Rock Material Pattern
 *
 * Creates realistic rock texturing using layered noise:
 * - Base gray tones with warm/cool variation
 * - Cellular noise for crack patterns
 * - Ridged noise for sharp edges and strata
 * - FBM for weathering and large-scale color variation
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
  abs,
  max,
  min,
} from "three/tsl";
// TSL types - using any due to incomplete type exports
type ShaderNodeObject<T> = any;
type Node = any;

import {
  simpleFBM,
  valueNoise2D,
  voronoiNoise,
  worleyNoise,
  ridgedNoise,
} from "./terrain-noise";

// ============================================================================
// ROCK COLOR PALETTE
// ============================================================================

// Base rock colors
const ROCK_DARK = vec3(0.25, 0.23, 0.22);     // Dark stone
const ROCK_MID = vec3(0.45, 0.42, 0.40);      // Mid-tone granite
const ROCK_LIGHT = vec3(0.60, 0.58, 0.55);    // Light stone
const ROCK_WARM = vec3(0.50, 0.42, 0.35);     // Warm sandstone tint
const ROCK_COOL = vec3(0.40, 0.45, 0.50);     // Cool slate tint
const ROCK_MOSS = vec3(0.30, 0.40, 0.25);     // Mossy areas

// ============================================================================
// ROCK PATTERN FUNCTION
// ============================================================================

/**
 * Generate procedural rock pattern
 *
 * @param worldPos - World position (XZ plane, Y for strata)
 * @param tileScale - Texture tiling scale
 * @returns { color: vec3, roughness: float, height: float }
 */
export const rockPattern = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // ========================================================================
    // LAYER 1: Large-scale geological variation
    // ========================================================================
    const geoNoise = simpleFBM(mul(uv, 0.02));

    // ========================================================================
    // LAYER 2: Crack patterns (Voronoi/Worley)
    // ========================================================================
    const crackBase = voronoiNoise(mul(uv, 0.5));
    const crackDetail = worleyNoise(mul(uv, 1.5));
    const crackPattern = add(mul(crackBase, 0.7), mul(crackDetail, 0.3));

    // ========================================================================
    // LAYER 3: Strata/layering (horizontal bands in rock)
    // ========================================================================
    // Use world Y position for horizontal strata
    const strataFreq = mul(worldPos.y, 0.3);
    const strata = mul(add(valueNoise2D(vec2(strataFreq, mul(uv.x, 0.1))), 1.0), 0.5);

    // ========================================================================
    // LAYER 4: Surface detail (weathering, pitting)
    // ========================================================================
    const weathering = ridgedNoise(mul(uv, 2.0));
    const pitting = mul(valueNoise2D(mul(uv, 8.0)), 0.3);
    const microDetail = valueNoise2D(mul(uv, 24.0));

    // ========================================================================
    // COLOR CALCULATION
    // ========================================================================

    // Base color from geological type
    const geoBlend = clamp(geoNoise, 0.0, 1.0);
    const baseColor1 = mix(ROCK_MID, ROCK_DARK, geoBlend);

    // Add warm/cool temperature variation
    const tempNoise = simpleFBM(mul(add(uv, vec2(200.0, 100.0)), 0.03));
    const tempBlend = clamp(tempNoise, 0.0, 1.0);
    const baseColor2 = mix(baseColor1, mix(ROCK_COOL, ROCK_WARM, tempBlend), 0.3);

    // Strata creates subtle banding
    const strataColor = mix(baseColor2, mul(baseColor2, 1.1), mul(strata, 0.15));

    // Cracks are darker
    const crackDarkening = clamp(sub(1.0, mul(crackPattern, 0.4)), 0.6, 1.0);
    const colorWithCracks = mul(strataColor, crackDarkening);

    // Weathering adds light/dark variation
    const weatherColor = mix(
      mul(colorWithCracks, 0.85),
      colorWithCracks,
      clamp(weathering, 0.0, 1.0)
    );

    // Micro-detail modulation
    const microMod = add(0.95, mul(microDetail, 0.1));
    const finalColor = mul(weatherColor, microMod);

    // ========================================================================
    // ROUGHNESS
    // ========================================================================
    // Rock varies from smooth (polished by water) to very rough
    const baseRoughness = float(0.70);
    const crackRoughness = mul(crackPattern, 0.15); // Cracks are rougher
    const weatherRoughness = mul(sub(weathering, 0.5), 0.1);
    const roughness = clamp(
      add(add(baseRoughness, crackRoughness), weatherRoughness),
      0.55,
      0.90
    );

    // ========================================================================
    // HEIGHT (for normal calculation)
    // ========================================================================
    // Rock has pronounced height variation from cracks and weathering
    const crackDepth = mul(crackPattern, -0.03); // Cracks are indented
    const weatherHeight = mul(weathering, 0.02);
    const pittingHeight = mul(pitting, -0.01);
    const microHeight = mul(microDetail, 0.005);
    const height = add(add(add(crackDepth, weatherHeight), pittingHeight), microHeight);

    return {
      color: finalColor,
      roughness: roughness,
      height: height,
    };
  }
);

/**
 * Simplified rock for distant terrain
 */
export const rockPatternSimple = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // Two layers of noise
    const geoNoise = simpleFBM(mul(uv, 0.02));
    const crackNoise = voronoiNoise(mul(uv, 0.5));

    // Simple color
    const baseColor = mix(ROCK_MID, ROCK_DARK, geoNoise);
    const crackDarkening = clamp(sub(1.0, mul(crackNoise, 0.3)), 0.7, 1.0);
    const finalColor = mul(baseColor, crackDarkening);

    return {
      color: finalColor,
      roughness: float(0.75),
      height: mul(crackNoise, -0.02),
    };
  }
);
