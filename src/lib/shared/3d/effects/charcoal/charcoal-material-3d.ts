/**
 * Screen-stable incandescent material for the 3D Coal effect.
 *
 * One point pool carries three silhouettes: short directional sparks, ember
 * halos around dimensional fragments, and persistent irregular coal heads.
 * The shader keeps each layer readable in wide multi-performer cameras while
 * clamping its close-up footprint.
 */

import { AdditiveBlending, Color, ShaderMaterial, SRGBColorSpace } from "three";

const vertexShader = /* glsl */ `
  attribute float particleSize;
  attribute float particleAlpha;
  attribute float particleTemp;
  attribute float particleKind;
  attribute float particleSeed;
  attribute vec3 particleVelocity;

  varying float vAlpha;
  varying float vTemp;
  varying float vKind;
  varying float vSeed;
  varying vec2 vDirection;

  void main() {
    vAlpha = particleAlpha;
    vTemp = particleTemp;
    vKind = particleKind;
    vSeed = particleSeed;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewVelocity = mat3(modelViewMatrix) * particleVelocity;
    vec2 direction = viewVelocity.xy;
    float directionLength = length(direction);
    vDirection = directionLength > 0.0001
      ? direction / directionLength
      : vec2(0.0, 1.0);

    float projectedSize = particleSize * (300.0 / max(0.1, -mvPosition.z));
    if (particleKind < 0.5) {
      gl_PointSize = clamp(projectedSize, 2.2, 14.0);
    } else if (particleKind < 1.5) {
      gl_PointSize = clamp(projectedSize, 5.0, 29.0);
    } else {
      gl_PointSize = clamp(projectedSize, 14.0, 48.0);
    }
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uCoreColor;
  uniform vec3 uMidColor;
  uniform vec3 uCoolColor;
  uniform float uEmissiveStrength;

  varying float vAlpha;
  varying float vTemp;
  varying float vKind;
  varying float vSeed;
  varying vec2 vDirection;

  vec3 heatColor(float temperature) {
    if (temperature > 0.5) {
      return mix(uMidColor, uCoreColor, (temperature - 0.5) * 2.0);
    }
    return mix(uCoolColor, uMidColor, temperature * 2.0);
  }

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    vec3 color = heatColor(vTemp);
    vec3 whiteHot = mix(uCoreColor, vec3(1.0), 0.86);
    float coverage = 0.0;
    float brightness = 1.0;

    if (vKind < 0.5) {
      float angle = atan(coord.y, coord.x);
      float radius = length(coord) * 2.0;
      float irregularity =
        sin(angle * 5.0 + vSeed * 17.0) * 0.055 +
        sin(angle * 8.0 - vSeed * 9.0) * 0.03;
      float boundary = 0.62 + irregularity;
      float body = 1.0 - smoothstep(boundary - 0.12, boundary, radius);
      float halo = exp(-radius * radius * 3.2) *
        (1.0 - smoothstep(0.78, 1.0, radius));
      float hotCore = 1.0 - smoothstep(0.02, 0.34, radius);
      coverage = max(body * 0.8, halo * 0.76);
      float whiteHeat = smoothstep(0.58, 0.98, vTemp);
      color = mix(color, whiteHot, hotCore * whiteHeat * 0.96);
      brightness = 1.14;
    } else if (vKind < 1.5) {
      float angle = atan(coord.y, coord.x);
      float radius = length(coord) * 2.0;
      float irregularity =
        sin(angle * 5.0 + vSeed * 11.7) * 0.09 +
        sin(angle * 9.0 - vSeed * 7.3) * 0.055;
      float boundary = 0.68 + irregularity;
      float body = 1.0 - smoothstep(boundary - 0.1, boundary, radius);
      float halo = exp(-radius * radius * 3.4) *
        (1.0 - smoothstep(0.76, 1.0, radius));
      float hotCenter = 1.0 - smoothstep(0.0, 0.28, radius);
      coverage = max(body * 0.76, halo * 0.96);
      float whiteHeat = smoothstep(0.46, 0.96, vTemp);
      color = mix(color, whiteHot, hotCenter * (0.18 + whiteHeat * 0.68));
      brightness = 1.12;
    } else {
      float angle = atan(coord.y, coord.x);
      float radius = length(coord) * 2.0;
      if (radius > 1.0) discard;
      float irregularity =
        sin(angle * 5.0 + vSeed * 11.7) * 0.065 +
        sin(angle * 8.0 - vSeed * 5.9) * 0.035;
      float boundary = 0.56 + irregularity;
      float coalBody = 1.0 - smoothstep(boundary - 0.1, boundary, radius);
      float halo = exp(-radius * radius * 2.7) *
        (1.0 - smoothstep(0.78, 1.0, radius));
      float hotCore = 1.0 - smoothstep(0.06, 0.34, radius);
      float fissure = smoothstep(
        0.91,
        0.997,
        sin(angle * 3.0 + radius * 19.0 + vSeed * 23.0) * 0.5 + 0.5
      );
      fissure *= coalBody * smoothstep(0.15, 0.62, radius);
      coverage = max(coalBody * 0.78, halo * 1.08) + fissure * 0.48;
      color = mix(
        uMidColor,
        whiteHot,
        clamp(hotCore * 0.96 + fissure * 0.34 + vTemp * 0.12, 0.0, 1.0)
      );
      brightness = 1.5;
    }

    float alpha = clamp(coverage, 0.0, 1.0) * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * uEmissiveStrength * brightness, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface CharcoalMaterialOptions {
  coreColor?: [number, number, number];
  midColor?: [number, number, number];
  coolColor?: [number, number, number];
  emissiveStrength?: number;
}

const DEFAULT_CORE: [number, number, number] = [255, 242, 210];
const DEFAULT_MID: [number, number, number] = [255, 150, 35];
const DEFAULT_COOL: [number, number, number] = [170, 45, 2];

function setRgb255(color: Color, rgb: [number, number, number]): void {
  color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
}

export function updateCharcoalMaterial(
  material: ShaderMaterial,
  options: CharcoalMaterialOptions
): void {
  if (options.coreColor) {
    setRgb255(material.uniforms.uCoreColor!.value as Color, options.coreColor);
  }
  if (options.midColor) {
    setRgb255(material.uniforms.uMidColor!.value as Color, options.midColor);
  }
  if (options.coolColor) {
    setRgb255(material.uniforms.uCoolColor!.value as Color, options.coolColor);
  }
  if (options.emissiveStrength !== undefined) {
    material.uniforms.uEmissiveStrength!.value = options.emissiveStrength;
  }
}

export function createCharcoalMaterial(
  options: CharcoalMaterialOptions = {}
): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      uCoreColor: { value: new Color() },
      uMidColor: { value: new Color() },
      uCoolColor: { value: new Color() },
      uEmissiveStrength: { value: options.emissiveStrength ?? 1.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  updateCharcoalMaterial(material, {
    coreColor: options.coreColor ?? DEFAULT_CORE,
    midColor: options.midColor ?? DEFAULT_MID,
    coolColor: options.coolColor ?? DEFAULT_COOL,
    emissiveStrength: options.emissiveStrength ?? 1.5,
  });
  return material;
}
