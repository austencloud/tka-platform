/**
 * CharcoalMaterial3D - Temperature-based point sprite shader for charcoal sparks.
 *
 * Each spark has a per-particle temperature attribute that drives its color:
 *   Hot (1.0): bright yellow-white (core at birth)
 *   Warm (0.5): orange
 *   Cool (0.0): deep red / dark ash
 *
 * Point sprites are circular with a soft radial falloff. Additive blending
 * makes overlapping sparks naturally brighten.
 */

import { ShaderMaterial, AdditiveBlending, Color } from "three";

const vertexShader = /* glsl */ `
  attribute float particleSize;
  attribute float particleAlpha;
  attribute float particleTemp;

  varying float vAlpha;
  varying float vTemp;

  void main() {
    vAlpha = particleAlpha;
    vTemp = particleTemp;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Scale point size with distance for perspective
    gl_PointSize = particleSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uMidColor;
  uniform vec3 uCoolColor;
  uniform float uEmissiveStrength;

  varying float vAlpha;
  varying float vTemp;

  void main() {
    // Circular point sprite with soft falloff
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord) * 2.0;
    if (dist > 1.0) discard;

    float radialAlpha = pow(1.0 - smoothstep(0.0, 1.0, dist), 1.8);

    // Temperature-based color: hot → mid → cool
    vec3 color;
    if (vTemp > 0.5) {
      color = mix(uMidColor, uCoreColor, (vTemp - 0.5) * 2.0);
    } else {
      color = mix(uCoolColor, uMidColor, vTemp * 2.0);
    }

    float alpha = radialAlpha * vAlpha;
    if (alpha < 0.001) discard;

    gl_FragColor = vec4(color * uEmissiveStrength, alpha);
  }
`;

export interface CharcoalMaterialOptions {
  coreColor?: [number, number, number];
  midColor?: [number, number, number];
  coolColor?: [number, number, number];
  emissiveStrength?: number;
}

export function createCharcoalMaterial(
  options: CharcoalMaterialOptions = {},
): ShaderMaterial {
  const core = options.coreColor ?? [255, 242, 210];
  const mid = options.midColor ?? [255, 150, 35];
  const cool = options.coolColor ?? [170, 45, 2];

  return new ShaderMaterial({
    uniforms: {
      uCoreColor: { value: new Color(core[0] / 255, core[1] / 255, core[2] / 255) },
      uMidColor: { value: new Color(mid[0] / 255, mid[1] / 255, mid[2] / 255) },
      uCoolColor: { value: new Color(cool[0] / 255, cool[1] / 255, cool[2] / 255) },
      uEmissiveStrength: { value: options.emissiveStrength ?? 1.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
