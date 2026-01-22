/**
 * Procedural Dirt Material Pattern
 *
 * Creates earthy dirt/soil texturing:
 * - Rich brown base with moisture variation
 * - FBM for large-scale color patches
 * - Small pebble/particle pattern via cellular noise
 * - Subtle cracks in dry areas
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
  type ShaderNodeObject,
  type Node,
} from "three/tsl";

import {
  simpleFBM,
  valueNoise2D,
  voronoiNoise,
  worleyNoise,
} from "./terrain-noise";

// ============================================================================
// DIRT COLOR PALETTE
// ============================================================================

// Base dirt colors
const DIRT_DARK = vec3(0.25, 0.18, 0.12);     // Dark moist earth
const DIRT_MID = vec3(0.40, 0.30, 0.20);      // Mid-tone soil
const DIRT_LIGHT = vec3(0.55, 0.45, 0.35);    // Light dry dirt
const DIRT_RED = vec3(0.50, 0.30, 0.20);      // Reddish clay
const DIRT_RICH = vec3(0.30, 0.22, 0.15);     // Rich humus

// ============================================================================
// DIRT PATTERN FUNCTION
// ============================================================================

/**
 * Generate procedural dirt pattern
 *
 * @param worldPos - World position
 * @param tileScale - Texture tiling scale
 * @returns { color: vec3, roughness: float, height: float }
 */
export const dirtPattern = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // ========================================================================
    // LAYER 1: Large-scale soil type variation
    // ========================================================================
    const soilTypeNoise = simpleFBM(mul(uv, 0.04));
    const moistureNoise = simpleFBM(mul(add(uv, vec2(50.0, 80.0)), 0.06));

    // ========================================================================
    // LAYER 2: Pebble/particle patterns
    // ========================================================================
    const pebbleNoise = voronoiNoise(mul(uv, 3.0));
    const smallParticles = voronoiNoise(mul(uv, 8.0));

    // ========================================================================
    // LAYER 3: Cracking in dry areas
    // ========================================================================
    const crackNoise = worleyNoise(mul(uv, 1.2));
    // Cracks only appear in dry areas (low moisture)
    const dryness = clamp(sub(0.6, moistureNoise), 0.0, 1.0);
    const crackStrength = mul(crackNoise, dryness);

    // ========================================================================
    // LAYER 4: Fine surface texture
    // ========================================================================
    const surfaceNoise = valueNoise2D(mul(uv, 16.0));
    const microDetail = valueNoise2D(mul(uv, 40.0));

    // ========================================================================
    // COLOR CALCULATION
    // ========================================================================

    // Base color from soil type
    const soilBlend = clamp(soilTypeNoise, 0.0, 1.0);
    const baseColor1 = mix(DIRT_MID, DIRT_RICH, soilBlend);

    // Moisture makes dirt darker
    const moistColor = mix(DIRT_LIGHT, DIRT_DARK, clamp(moistureNoise, 0.0, 1.0));
    const baseColor2 = mix(baseColor1, moistColor, 0.5);

    // Pebbles create small light spots
    const pebbleHighlight = clamp(sub(0.3, pebbleNoise), 0.0, 0.3);
    const colorWithPebbles = add(baseColor2, mul(vec3(1.0), pebbleHighlight));

    // Small particles add texture
    const particleVariation = mul(sub(smallParticles, 0.5), 0.1);
    const colorWithParticles = add(colorWithPebbles, mul(vec3(1.0), particleVariation));

    // Cracks are darker
    const crackDarkening = clamp(sub(1.0, mul(crackStrength, 0.3)), 0.7, 1.0);
    const colorWithCracks = mul(colorWithParticles, crackDarkening);

    // Surface texture modulation
    const surfaceMod = add(0.95, mul(surfaceNoise, 0.1));
    const microMod = add(0.98, mul(microDetail, 0.04));
    const finalColor = mul(mul(colorWithCracks, surfaceMod), microMod);

    // ========================================================================
    // ROUGHNESS
    // ========================================================================
    // Dirt is very matte, wet dirt slightly less so
    const baseRoughness = float(0.90);
    const moistRoughness = mul(moistureNoise, -0.1); // Wet = slightly smoother
    const roughness = clamp(add(baseRoughness, moistRoughness), 0.80, 0.95);

    // ========================================================================
    // HEIGHT (for normal calculation)
    // ========================================================================
    // Pebbles create small bumps, cracks create indentations
    const pebbleHeight = mul(clamp(sub(0.3, pebbleNoise), 0.0, 0.3), 0.05);
    const particleHeight = mul(smallParticles, 0.01);
    const crackDepth = mul(crackStrength, -0.015);
    const surfaceHeight = mul(surfaceNoise, 0.003);
    const height = add(add(add(pebbleHeight, particleHeight), crackDepth), surfaceHeight);

    return {
      color: finalColor,
      roughness: roughness,
      height: height,
    };
  }
);

/**
 * Simplified dirt for distant terrain
 */
export const dirtPatternSimple = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // Two noise layers
    const soilNoise = simpleFBM(mul(uv, 0.04));
    const moistNoise = simpleFBM(mul(uv, 0.06));

    // Simple color blend
    const baseColor = mix(DIRT_MID, DIRT_RICH, soilNoise);
    const moistColor = mix(DIRT_LIGHT, DIRT_DARK, moistNoise);
    const finalColor = mix(baseColor, moistColor, 0.5);

    return {
      color: finalColor,
      roughness: float(0.90),
      height: mul(soilNoise, 0.01),
    };
  }
);
