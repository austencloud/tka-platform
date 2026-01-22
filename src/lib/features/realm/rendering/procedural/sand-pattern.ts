/**
 * Procedural Sand Material Pattern
 *
 * Creates realistic sand texturing:
 * - Tan/beige base with subtle warm/cool variation
 * - Very fine FBM ripples (wind patterns)
 * - Low contrast, smooth appearance
 * - Sparkle effect for silica glints
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
  sin,
  cos,
  type ShaderNodeObject,
  type Node,
} from "three/tsl";

import {
  simpleFBM,
  valueNoise2D,
  ridgedNoise,
} from "./terrain-noise";

// ============================================================================
// SAND COLOR PALETTE
// ============================================================================

// Base sand colors
const SAND_LIGHT = vec3(0.85, 0.78, 0.60);    // Light beach sand
const SAND_MID = vec3(0.75, 0.68, 0.50);      // Mid-tone sand
const SAND_DARK = vec3(0.65, 0.55, 0.40);     // Darker wet sand
const SAND_WARM = vec3(0.82, 0.72, 0.52);     // Warm golden sand
const SAND_COOL = vec3(0.78, 0.75, 0.62);     // Cool gray sand

// ============================================================================
// SAND PATTERN FUNCTION
// ============================================================================

/**
 * Generate procedural sand pattern
 *
 * @param worldPos - World position
 * @param tileScale - Texture tiling scale
 * @returns { color: vec3, roughness: float, height: float }
 */
export const sandPattern = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // ========================================================================
    // LAYER 1: Large-scale dune variation
    // ========================================================================
    const duneNoise = simpleFBM(mul(uv, 0.02));

    // ========================================================================
    // LAYER 2: Wind ripple patterns
    // ========================================================================
    // Directional ripples - elongated in wind direction
    const rippleUV = vec2(mul(uv.x, 0.3), uv.y); // Stretch in X
    const rippleNoise = valueNoise2D(mul(rippleUV, 4.0));

    // Secondary ripples at slight angle
    const ripple2UV = vec2(
      add(mul(uv.x, 0.95), mul(uv.y, 0.31)),
      add(mul(uv.x, -0.31), mul(uv.y, 0.95))
    );
    const ripple2Noise = valueNoise2D(mul(ripple2UV, 3.0));

    const combinedRipples = mul(add(rippleNoise, mul(ripple2Noise, 0.5)), 0.67);

    // ========================================================================
    // LAYER 3: Fine grain texture
    // ========================================================================
    const grainNoise = valueNoise2D(mul(uv, 50.0));
    const microGrain = valueNoise2D(mul(uv, 120.0));

    // ========================================================================
    // LAYER 4: Sparkle effect (silica glints)
    // ========================================================================
    // High-frequency noise that creates occasional bright spots
    const sparkleNoise = valueNoise2D(mul(uv, 80.0));
    // Only values very close to 1.0 become sparkles
    const sparkle = clamp(mul(sub(sparkleNoise, 0.92), 12.5), 0.0, 1.0);

    // ========================================================================
    // COLOR CALCULATION
    // ========================================================================

    // Base color from dune position
    const duneBlend = clamp(duneNoise, 0.0, 1.0);
    const baseColor1 = mix(SAND_MID, SAND_LIGHT, duneBlend);

    // Temperature variation (warm vs cool tones)
    const tempNoise = simpleFBM(mul(add(uv, vec2(100.0, 200.0)), 0.03));
    const tempBlend = clamp(tempNoise, 0.0, 1.0);
    const baseColor2 = mix(baseColor1, mix(SAND_COOL, SAND_WARM, tempBlend), 0.2);

    // Ripples create subtle light/shadow
    const rippleShading = add(0.95, mul(sub(combinedRipples, 0.5), 0.1));
    const colorWithRipples = mul(baseColor2, rippleShading);

    // Fine grain adds texture (very subtle)
    const grainMod = add(0.98, mul(sub(grainNoise, 0.5), 0.04));
    const colorWithGrain = mul(colorWithRipples, grainMod);

    // Micro-grain modulation
    const microMod = add(0.99, mul(sub(microGrain, 0.5), 0.02));
    const colorWithMicro = mul(colorWithGrain, microMod);

    // Add sparkles (bright white glints)
    const sparkleColor = vec3(1.0, 0.98, 0.95);
    const finalColor = mix(colorWithMicro, sparkleColor, mul(sparkle, 0.3));

    // ========================================================================
    // ROUGHNESS
    // ========================================================================
    // Dry sand is very matte
    const baseRoughness = float(0.95);
    // Slight variation
    const roughnessVariation = mul(sub(duneNoise, 0.5), 0.05);
    const roughness = clamp(add(baseRoughness, roughnessVariation), 0.90, 1.0);

    // ========================================================================
    // HEIGHT (for normal calculation)
    // ========================================================================
    // Sand has subtle dune shapes and ripple patterns
    const duneHeight = mul(duneNoise, 0.02);
    const rippleHeight = mul(sub(combinedRipples, 0.5), 0.01);
    const grainHeight = mul(sub(grainNoise, 0.5), 0.002);
    const height = add(add(duneHeight, rippleHeight), grainHeight);

    return {
      color: finalColor,
      roughness: roughness,
      height: height,
    };
  }
);

/**
 * Simplified sand for distant terrain
 */
export const sandPatternSimple = Fn(
  ([worldPos, tileScale]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const uv = mul(worldPos.xz, tileScale);

    // Simple dune variation
    const duneNoise = simpleFBM(mul(uv, 0.02));

    // Basic color
    const baseColor = mix(SAND_MID, SAND_LIGHT, duneNoise);

    return {
      color: baseColor,
      roughness: float(0.95),
      height: mul(duneNoise, 0.01),
    };
  }
);
