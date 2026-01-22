/**
 * Terrain Noise Functions using TSL
 *
 * Provides procedural noise primitives for terrain texturing.
 * All functions return TSL nodes that execute on the GPU.
 *
 * Uses Three.js TSL noise functions (MaterialX-based):
 * - mx_noise_float: Perlin noise
 * - mx_fractal_noise_float: FBM (multi-octave) noise
 * - mx_cell_noise_float: Cellular/Voronoi noise
 * - mx_worley_noise_float: Worley noise for cracks/patterns
 *
 * References:
 * - https://threejs.org/docs/pages/TSL.html
 * - https://github.com/boytchev/tsl-textures
 */

import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  cos,
  abs,
  floor,
  fract,
  mix,
  clamp,
  smoothstep,
  dot,
  normalize,
  length,
  max,
  min,
  add,
  sub,
  mul,
  div,
  mod,
  pow,
  sqrt,
  hash,
  dFdx,
  dFdy,
  cross,
  type ShaderNodeObject,
  type Node,
} from "three/tsl";

// ============================================================================
// BASIC NOISE PRIMITIVES
// ============================================================================

/**
 * Simple hash function for 2D input
 * Returns pseudo-random value in [0, 1]
 */
export const hash2D = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const p2 = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(mul(sin(p2), 43758.5453123));
});

/**
 * Simple hash function for 3D input
 */
export const hash3D = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const p3 = fract(mul(p, vec3(0.1031, 0.1030, 0.0973)));
  const p3dot = add(p3, dot(p3, add(p3.yzx, 33.33)));
  return fract(mul(add(p3.x, p3.y), p3.z));
});

/**
 * 2D Value Noise
 * Smooth interpolation between random values at integer coordinates
 */
export const valueNoise2D = Fn(([p]: [ShaderNodeObject<Node>]) => {
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
 * 2D Gradient Noise (Perlin-like)
 * Uses gradient vectors for smoother results
 */
export const gradientNoise2D = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const i = floor(p);
  const f = fract(p);

  // Smooth interpolation curve (quintic)
  const u = mul(f, mul(f, mul(f, add(mul(f, sub(mul(f, 6.0), 15.0)), 10.0))));

  // Gradient function
  const grad = Fn(([hash2]: [ShaderNodeObject<Node>]) => {
    const angle = mul(hash2, mul(float(2.0), float(Math.PI)));
    return vec2(cos(angle), sin(angle));
  });

  // Corner gradients
  const g00 = grad(hash(i));
  const g10 = grad(hash(add(i, vec2(1.0, 0.0))));
  const g01 = grad(hash(add(i, vec2(0.0, 1.0))));
  const g11 = grad(hash(add(i, vec2(1.0, 1.0))));

  // Corner contributions
  const n00 = dot(g00, f);
  const n10 = dot(g10, sub(f, vec2(1.0, 0.0)));
  const n01 = dot(g01, sub(f, vec2(0.0, 1.0)));
  const n11 = dot(g11, sub(f, vec2(1.0, 1.0)));

  // Bilinear interpolation
  const nx0 = mix(n00, n10, u.x);
  const nx1 = mix(n01, n11, u.x);
  return mul(add(mix(nx0, nx1, u.y), float(0.5)), float(1.0));
});

/**
 * 3D Value Noise
 */
export const valueNoise3D = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const i = floor(p);
  const f = fract(p);

  // Smooth interpolation
  const u = mul(f, mul(f, sub(float(3.0), mul(float(2.0), f))));

  // Eight corner values
  const c000 = hash(i);
  const c100 = hash(add(i, vec3(1.0, 0.0, 0.0)));
  const c010 = hash(add(i, vec3(0.0, 1.0, 0.0)));
  const c110 = hash(add(i, vec3(1.0, 1.0, 0.0)));
  const c001 = hash(add(i, vec3(0.0, 0.0, 1.0)));
  const c101 = hash(add(i, vec3(1.0, 0.0, 1.0)));
  const c011 = hash(add(i, vec3(0.0, 1.0, 1.0)));
  const c111 = hash(add(i, vec3(1.0, 1.0, 1.0)));

  // Trilinear interpolation
  const x00 = mix(c000, c100, u.x);
  const x10 = mix(c010, c110, u.x);
  const x01 = mix(c001, c101, u.x);
  const x11 = mix(c011, c111, u.x);
  const xy0 = mix(x00, x10, u.y);
  const xy1 = mix(x01, x11, u.y);
  return mix(xy0, xy1, u.z);
});

// ============================================================================
// FBM (FRACTAL BROWNIAN MOTION)
// ============================================================================

/**
 * FBM - Layered noise for natural textures
 * @param p - Position (2D or 3D)
 * @param octaves - Number of noise layers (1-8)
 * @param lacunarity - Frequency multiplier per octave (typically 2.0)
 * @param persistence - Amplitude multiplier per octave (typically 0.5)
 */
export const fbm2D = Fn(
  ([p, octaves, lacunarity, persistence]: [
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
  ]) => {
    const value = float(0.0).toVar();
    const amplitude = float(1.0).toVar();
    const frequency = float(1.0).toVar();
    const maxValue = float(0.0).toVar();
    const pos = vec2(p).toVar();

    // Unroll loop for better GPU performance (max 8 octaves)
    // Octave 1
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);
    amplitude.mulAssign(persistence);
    frequency.mulAssign(lacunarity);

    // Octave 2
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);
    amplitude.mulAssign(persistence);
    frequency.mulAssign(lacunarity);

    // Octave 3
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);
    amplitude.mulAssign(persistence);
    frequency.mulAssign(lacunarity);

    // Octave 4
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);
    amplitude.mulAssign(persistence);
    frequency.mulAssign(lacunarity);

    // Octave 5
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);
    amplitude.mulAssign(persistence);
    frequency.mulAssign(lacunarity);

    // Octave 6
    value.addAssign(mul(amplitude, valueNoise2D(mul(pos, frequency))));
    maxValue.addAssign(amplitude);

    return div(value, maxValue);
  }
);

/**
 * FBM with 3D input
 */
export const fbm3D = Fn(
  ([p, octaves, lacunarity, persistence]: [
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
  ]) => {
    const value = float(0.0).toVar();
    const amplitude = float(1.0).toVar();
    const frequency = float(1.0).toVar();
    const maxValue = float(0.0).toVar();
    const pos = vec3(p).toVar();

    // Unroll 6 octaves
    for (let i = 0; i < 6; i++) {
      value.addAssign(mul(amplitude, valueNoise3D(mul(pos, frequency))));
      maxValue.addAssign(amplitude);
      amplitude.mulAssign(persistence);
      frequency.mulAssign(lacunarity);
    }

    return div(value, maxValue);
  }
);

/**
 * Simplified FBM with preset parameters
 * Good for general terrain texturing
 */
export const simpleFBM = Fn(([p]: [ShaderNodeObject<Node>]) => {
  return fbm2D(p, float(6), float(2.0), float(0.5));
});

// ============================================================================
// SPECIALIZED NOISE PATTERNS
// ============================================================================

/**
 * Ridged noise - Creates sharp ridges like mountain ranges
 * Good for rock cracks and terrain details
 */
export const ridgedNoise = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const value = float(0.0).toVar();
  const amplitude = float(1.0).toVar();
  const frequency = float(1.0).toVar();
  const weight = float(1.0).toVar();
  const pos = vec2(p).toVar();

  // 5 octaves of ridged noise
  for (let i = 0; i < 5; i++) {
    const n = sub(float(1.0), abs(sub(mul(valueNoise2D(mul(pos, frequency)), 2.0), 1.0)));
    const nSquared = mul(n, n);
    const weighted = mul(mul(nSquared, weight), amplitude);
    value.addAssign(weighted);
    weight.assign(clamp(mul(nSquared, 2.0), 0.0, 1.0));
    amplitude.mulAssign(float(0.5));
    frequency.mulAssign(float(2.0));
  }

  return value;
});

/**
 * Voronoi/Cellular noise
 * Creates cell-like patterns, good for cracked earth, scales
 */
export const voronoiNoise = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const n = floor(p);
  const f = fract(p);

  const minDist = float(8.0).toVar();

  // Check 3x3 neighborhood
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const neighbor = vec2(float(i), float(j));
      const cellCenter = add(neighbor, hash2D(add(n, neighbor)));
      const diff = sub(cellCenter, f);
      const dist = length(diff);
      minDist.assign(min(minDist, dist));
    }
  }

  return minDist;
});

/**
 * Worley noise variant - Returns distance to second-closest point
 * Creates more varied cellular patterns
 */
export const worleyNoise = Fn(([p]: [ShaderNodeObject<Node>]) => {
  const n = floor(p);
  const f = fract(p);

  const dist1 = float(8.0).toVar();
  const dist2 = float(8.0).toVar();

  // Check 3x3 neighborhood
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const neighbor = vec2(float(i), float(j));
      const cellCenter = add(neighbor, hash2D(add(n, neighbor)));
      const diff = sub(cellCenter, f);
      const dist = length(diff);

      // Track two closest distances
      dist2.assign(min(dist2, max(dist1, dist)));
      dist1.assign(min(dist1, dist));
    }
  }

  return sub(dist2, dist1);
});

// ============================================================================
// DOMAIN WARPING
// ============================================================================

/**
 * Domain warping - Distorts coordinates for more organic shapes
 * Creates swirling, turbulent patterns
 */
export const warpedNoise = Fn(
  ([p, warpStrength]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    // First layer of warping
    const warp1 = vec2(
      simpleFBM(add(p, vec2(0.0, 0.0))),
      simpleFBM(add(p, vec2(5.2, 1.3)))
    );

    // Warped position
    const warped = add(p, mul(warp1, warpStrength));

    // Second layer (optional, more organic)
    const warp2 = vec2(
      simpleFBM(add(warped, vec2(1.7, 9.2))),
      simpleFBM(add(warped, vec2(8.3, 2.8)))
    );

    const finalPos = add(warped, mul(warp2, mul(warpStrength, 0.5)));

    return simpleFBM(finalPos);
  }
);

// ============================================================================
// NORMAL GENERATION
// ============================================================================

/**
 * Generate normal from height using screen-space derivatives
 * This creates bump mapping from procedural height values
 */
export const heightToNormal = Fn(
  ([height, strength]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    const dx = dFdx(height);
    const dy = dFdy(height);

    // Perturb the normal
    const normal = normalize(vec3(mul(dx, strength).negate(), mul(dy, strength).negate(), 1.0));

    return normal;
  }
);

/**
 * Combine multiple height sources into a single normal
 */
export const combineNormals = Fn(
  ([n1, n2, blend]: [
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
  ]) => {
    // Reoriented Normal Mapping (RNM) blending
    // Better than simple lerp for normal blending
    const t = add(mul(vec3(n1.xy, 0), blend), vec3(0, 0, n1.z));
    const u = mul(vec3(n2.xy.negate(), 0), sub(1.0, blend));
    const r = add(t, add(u, vec3(0, 0, n2.z)));
    return normalize(r);
  }
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Remap value from one range to another
 */
export const remap = Fn(
  ([value, inMin, inMax, outMin, outMax]: [
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
  ]) => {
    const t = div(sub(value, inMin), sub(inMax, inMin));
    return add(outMin, mul(t, sub(outMax, outMin)));
  }
);

/**
 * Contrast adjustment for noise values
 * @param value - Input value (0-1)
 * @param contrast - Contrast amount (1.0 = unchanged, >1 = more contrast)
 */
export const adjustContrast = Fn(
  ([value, contrast]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    return clamp(add(mul(sub(value, 0.5), contrast), 0.5), 0.0, 1.0);
  }
);

/**
 * Posterize - Reduce to discrete steps (for stylized looks)
 */
export const posterize = Fn(
  ([value, steps]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
    return div(floor(mul(value, steps)), steps);
  }
);
