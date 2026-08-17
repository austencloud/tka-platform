/**
 * LedMaterial3D - Custom shader for LED billboard sprites.
 *
 * Each LED is a camera-facing quad rendered via InstancedMesh. The fragment
 * shader computes two concentric layers from the UV center:
 *   1. Inner core - bright, near-white, sharp circle (the "bulb")
 *   2. Outer halo - soft colored glow, larger radius, additive blend
 *
 * Per-instance attributes:
 *   - instanceColor: RGB from the pattern engine
 *   - instanceAlpha: opacity (used for trail fade)
 *   - instanceStretch: velocity-based elongation factor + direction
 *
 * The material uses additive blending so overlapping LEDs naturally
 * brighten, matching real LED light-painting behavior.
 */

import {
  ShaderMaterial,
  DoubleSide,
  AdditiveBlending,
} from "three";

const vertexShader = /* glsl */ `
  attribute vec3 instanceColor;
  attribute float instanceAlpha;
  attribute vec2 instanceStretch;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    vAlpha = instanceAlpha;

    // Apply velocity-based stretch to the quad in local space.
    // instanceStretch.x = stretch factor along motion direction (1.0 = no stretch)
    // instanceStretch.y = angle of motion direction in radians
    vec3 pos = position;
    float stretchFactor = instanceStretch.x;
    float angle = instanceStretch.y;

    // Rotate UV-space position into motion direction, stretch, rotate back
    float cosA = cos(angle);
    float sinA = sin(angle);
    // Rotate to align with motion
    float rx = pos.x * cosA + pos.y * sinA;
    float ry = -pos.x * sinA + pos.y * cosA;
    // Stretch along motion axis
    rx *= stretchFactor;
    // Rotate back
    pos.x = rx * cosA - ry * sinA;
    pos.y = rx * sinA + ry * cosA;

    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGlowRadius;
  uniform float uBrightness;
  uniform float uEmissiveStrength;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Distance from quad center (UV 0.5, 0.5)
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0; // normalize: 0 at center, 1 at edge

    // Discard pixels outside the glow radius for clean edges
    if (dist > 1.0) discard;

    // Inner core: sharp bright circle - the "bulb"
    float coreRadius = 0.15;
    float core = smoothstep(coreRadius, 0.0, dist);

    // Outer halo: soft exponential falloff
    float halo = exp(-dist * dist * 3.0 / (uGlowRadius * uGlowRadius));

    // Blend: core is near-white (desaturated), halo is full color
    vec3 coreColor = mix(vColor, vec3(1.0), 0.85); // near-white core
    vec3 haloColor = vColor * uEmissiveStrength;

    vec3 finalColor = coreColor * core + haloColor * halo;
    float finalAlpha = (core + halo * 0.6) * vAlpha * uBrightness;

    if (finalAlpha < 0.001) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface LedMaterialOptions {
  /**
   * Halo falloff width in the billboard's own UV space (default 1.0).
   *
   * Shader-local geometry, not a photometric quantity: it shapes the sprite the
   * caller already sized, and nothing divides by it. It is deliberately not fed
   * from the look — the 3D LED path still owes the same photometric rewrite the
   * 2D path just got, where an emitter's footprint comes from LED pitch and its
   * amplitude is renormalized by that footprint.
   */
  glowRadius?: number;
  /** Global brightness multiplier 0-1 (default 1.0) */
  brightness?: number;
  /** Emissive strength for the halo (default 2.0) */
  emissiveStrength?: number;
}

export function createLedMaterial(options: LedMaterialOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uGlowRadius: { value: options.glowRadius ?? 1.0 },
      uBrightness: { value: options.brightness ?? 1.0 },
      uEmissiveStrength: { value: options.emissiveStrength ?? 2.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
