/**
 * Procedural Snow Material Pattern
 *
 * Creates realistic snow texturing:
 * - Bright white base with subtle blue shadows
 * - Smooth, slightly glossy surface (ice crystals)
 * - Sparkle effect from ice crystal reflections
 * - Drift patterns from wind
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
  max,
  type ShaderNodeObject,
  type Node,
} from "three/tsl";

import {
  simpleFBM,
  valueNoise2D,
  voronoiNoise,
} from "./terrain-noise";

// ============================================================================
// SNOW COLOR PALETTE
// ============================================================================

// Base snow colors
const SNOW_WHITE = vec3(0.95, 0.97, 1.0);     // Bright white snow
const SNOW_BLUE = vec3(0.85, 0.90, 0.98);     // Blue shadow snow
const SNOW_WARM = vec3(0.98, 0.95, 0.92);     // Warm sunlit snow
const SNOW_ICY = vec3(0.88, 0.93, 1.0);       // Icy blue-white

// ============================================================================
// SNOW PATTERN FUNCTION
// ============================================================================

/**
 * Generate procedural snow pattern
 *
 * @param worldPos - World position
 * @param tileScale - Texture tiling scale
 * @returns { color: vec3, roughness: float, height: float }
 */
export const snowPattern = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // ========================================================================
    // LAYER 1: Large-scale drift patterns
    // ========================================================================
    const driftNoise = simpleFBM(mul(uv, 0.03));

    // ========================================================================
    // LAYER 2: Wind-sculpted patterns
    // ========================================================================
    // Directional wind patterns
    const windUV = vec2(mul(uv.x, 0.5), uv.y);
    const windNoise = simpleFBM(mul(windUV, 0.1));

    // ========================================================================
    // LAYER 3: Surface texture (compressed vs fluffy)
    // ========================================================================
    const surfaceNoise = valueNoise2D(mul(uv, 8.0));
    const microTexture = valueNoise2D(mul(uv, 32.0));

    // ========================================================================
    // LAYER 4: Sparkle effect (ice crystal reflections)
    // ========================================================================
    // High-frequency noise for sparkle positions
    const sparkleNoise = valueNoise2D(mul(uv, 100.0));
    // Sharp threshold for sparkle effect
    const sparkle = clamp(mul(sub(sparkleNoise, 0.90), 10.0), 0.0, 1.0);

    // Second sparkle layer at different frequency
    const sparkle2Noise = valueNoise2D(mul(add(uv, vec2(17.3, 8.7)), 75.0));
    const sparkle2 = clamp(mul(sub(sparkle2Noise, 0.92), 12.5), 0.0, 1.0);

    const totalSparkle = max(sparkle, sparkle2);

    // ========================================================================
    // COLOR CALCULATION
    // ========================================================================

    // Base color from drift position
    const driftBlend = clamp(driftNoise, 0.0, 1.0);
    const baseColor1 = mix(SNOW_WHITE, SNOW_BLUE, mul(driftBlend, 0.2));

    // Wind patterns create subtle shadows
    const windShadow = mul(sub(windNoise, 0.5), 0.1);
    const colorWithWind = add(baseColor1, mul(vec3(0.0, 0.02, 0.05), windShadow));

    // Surface texture creates very subtle variation
    const surfaceMod = add(0.98, mul(sub(surfaceNoise, 0.5), 0.04));
    const colorWithSurface = mul(colorWithWind, surfaceMod);

    // Micro-texture (very subtle)
    const microMod = add(0.995, mul(sub(microTexture, 0.5), 0.01));
    const colorWithMicro = mul(colorWithSurface, microMod);

    // Add sparkles (bright blue-white glints)
    const sparkleColor = vec3(1.0, 1.0, 1.05); // Slightly blue-white
    const finalColor = mix(colorWithMicro, sparkleColor, mul(totalSparkle, 0.5));

    // ========================================================================
    // ROUGHNESS
    // ========================================================================
    // Snow is slightly glossy due to ice crystals
    // Fresh powder is more matte, compacted snow more glossy
    const baseRoughness = float(0.45);
    // Compacted areas (drifts) are smoother
    const compactionFactor = mul(driftNoise, -0.15);
    // Surface texture adds slight variation
    const textureRoughness = mul(sub(surfaceNoise, 0.5), 0.1);
    const roughness = clamp(
      add(add(baseRoughness, compactionFactor), textureRoughness),
      0.25,
      0.60
    );

    // ========================================================================
    // HEIGHT (for normal calculation)
    // ========================================================================
    // Snow has smooth drifts and subtle surface ripples
    const driftHeight = mul(driftNoise, 0.03);
    const windHeight = mul(sub(windNoise, 0.5), 0.01);
    const surfaceHeight = mul(sub(surfaceNoise, 0.5), 0.005);
    const height = add(add(driftHeight, windHeight), surfaceHeight);

    return {
      color: finalColor,
      roughness: roughness,
      height: height,
    };
  }
);

/**
 * Simplified snow for distant terrain
 */
export const snowPatternSimple = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // Simple drift variation
    const driftNoise = simpleFBM(mul(uv, 0.03));

    // Basic color with subtle blue shadows
    const baseColor = mix(SNOW_WHITE, SNOW_BLUE, mul(driftNoise, 0.15));

    return {
      color: baseColor,
      roughness: float(0.40),
      height: mul(driftNoise, 0.02),
    };
  }
);
