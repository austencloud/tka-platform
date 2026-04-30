/**
 * LedRibbonMaterial3D - shader for the continuous LED trail ribbon.
 *
 * The ribbon is a camera-facing extruded quad strip built from the LED's
 * position history. Unlike discrete billboard sampling, the ribbon is
 * mathematically continuous - there are no overlap artifacts, no sampling
 * ripple, no chain-of-dots look. This is the same technique used by AAA
 * trail/ribbon renderers (Unity Trail Renderer, Unreal Ribbon Emitter).
 *
 * Per-vertex attributes:
 *   - color: RGB (can vary along the ribbon if the LED changes color)
 *   - alpha: per-vertex opacity (drives the age-based fade from head to tail)
 *   - uv.y ∈ {0, 1}: top vs bottom edge of the ribbon, used for the
 *     cross-section falloff so the ribbon has a soft tube look rather
 *     than a hard-edged flat strip.
 */

import {
  ShaderMaterial,
  DoubleSide,
  AdditiveBlending,
} from "three";

const vertexShader = /* glsl */ `
  attribute float alpha;

  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uBrightness;
  uniform float uEmissiveStrength;
  uniform float uCoreStrength;

  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    // uv.y ranges 0..1; remap to v in [-1..+1] where 0 is the ribbon
    // centerline and ±1 is the edge.
    float v = vUv.y * 2.0 - 1.0;
    float absV = abs(v);

    // Soft cross-section: bright at the centerline, smoothly falling
    // off to zero at the edges. Using a quadratic here gives a tube-like
    // look without a hard edge.
    float cross = 1.0 - absV * absV;
    if (cross <= 0.0) discard;

    // Bright hot centerline (like the inner filament of a real glowing wire)
    // plus a wider soft glow body.
    float coreBand = smoothstep(0.35, 0.0, absV) * uCoreStrength;
    float body = cross;

    vec3 coreColor = mix(vColor, vec3(1.0), 0.7); // near-white hot centerline
    vec3 bodyColor = vColor * uEmissiveStrength;

    vec3 finalColor = coreColor * coreBand + bodyColor * body;
    float finalAlpha = (coreBand + body) * vAlpha * uBrightness;

    if (finalAlpha < 0.001) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface LedRibbonMaterialOptions {
  /** Global brightness multiplier (default 1.0) */
  brightness?: number;
  /** Emissive tint on the main ribbon body (default 1.8) */
  emissiveStrength?: number;
  /** Centerline hot-band strength; 0 = no bright centerline, 1 = strong (default 0.6) */
  coreStrength?: number;
}

export function createLedRibbonMaterial(
  options: LedRibbonMaterialOptions = {},
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uBrightness: { value: options.brightness ?? 1.0 },
      uEmissiveStrength: { value: options.emissiveStrength ?? 1.8 },
      uCoreStrength: { value: options.coreStrength ?? 0.6 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexColors: true,
  });
}
