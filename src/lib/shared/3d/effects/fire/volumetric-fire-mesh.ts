/**
 * VolumetricFireMesh - Object-space raymarched fire volume.
 *
 * A THREE.Mesh with a BoxGeometry bounding volume and a custom ShaderMaterial
 * whose fragment shader raymarches through 3D simplex noise to produce
 * volumetric fire.
 *
 * Momentum response uses two shader-level techniques:
 *   1. uWindOffset (vec3) - accumulated velocity integrated over time.
 *      Displaces the noise sampling position so the flame texture itself
 *      drifts opposite to motion. This is the primary visual cue and is
 *      what mattatz, Fuller, and every successful real-time fire uses.
 *   2. uLeanOffset (vec2) - shifts the teardrop density profile center
 *      in XZ so the flame body physically leans, not just the texture.
 *
 * The renderer also tilts the mesh as a tertiary reinforcement.
 *
 * References:
 *   - mattatz/unity-procedural-volumetric-fire - noise displacement
 *   - Fuller & Krishnan (I3D 2007) - real-time procedural volumetric fire
 *   - andrewkchan.dev/posts/fire - fluid sim velocity injection
 */

import type {
  Color} from "three";
import {
  Mesh,
  BoxGeometry,
  ShaderMaterial,
  BackSide,
  AdditiveBlending,
  Vector3
} from "three";
import { simplex3dNoise } from "./fire-noise.glsl.ts";
import { getFireColors, type FireColorPreset, type FireColorSet } from "./fire-color-curve-3d";
import { QualityTier } from "../types";

const STEP_COUNTS: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 64,
  [QualityTier.MEDIUM]: 32,
  [QualityTier.LOW]: 16,
};

const OCTAVE_COUNTS: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 3,
  [QualityTier.MEDIUM]: 2,
  [QualityTier.LOW]: 1,
};

export interface VolumetricFireOptions {
  preset?: FireColorPreset;
  customColors?: Partial<FireColorSet>;
  qualityTier?: QualityTier;
  boxScale?: Vector3;
}

const vertexShader = /* glsl */ `
varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
  vec4 camLocal = inverse(modelMatrix) * vec4(cameraPosition, 1.0);
  vOrigin = camLocal.xyz;
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function buildFragmentShader(steps: number, octaves: number): string {
  return /* glsl */ `
${simplex3dNoise}

uniform float uTime;
uniform float uIntensity;
uniform float uTurbulence;
uniform float uScrollSpeed;
uniform float uFlameHeight;
uniform float uFlameRadius;
uniform vec3  uHotColor;
uniform vec3  uWarmColor;
uniform vec3  uCoolColor;
uniform vec3  uSmokeColor;
uniform float uSmokeThreshold;
uniform vec3  uWindOffset;
uniform vec2  uLeanOffset;

varying vec3 vOrigin;
varying vec3 vDirection;

const int STEPS = ${steps};
const float STEP_SIZE = 1.732 / float(STEPS);

vec2 boxIntersect(vec3 ro, vec3 rd) {
  vec3 invRd = 1.0 / rd;
  vec3 t0 = (-0.5 - ro) * invRd;
  vec3 t1 = ( 0.5 - ro) * invRd;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  float tNear = max(max(tMin.x, tMin.y), tMin.z);
  float tFar  = min(min(tMax.x, tMax.y), tMax.z);
  return vec2(tNear, tFar);
}

float fireDensity(vec3 p) {
  // Shift the density profile center by lean offset.
  // This makes the flame body physically lean in the direction
  // opposite to motion - the teardrop shape itself is displaced,
  // not just the noise texture. The lean increases with height
  // so the base stays anchored to the tip.
  float vertNorm = (p.y + 0.5) / uFlameHeight;
  if (vertNorm < 0.0 || vertNorm > 1.0) return 0.0;

  // Apply lean: shift XZ center progressively with height
  vec3 leanedP = p;
  float leanFactor = vertNorm * vertNorm; // quadratic: base anchored
  leanedP.x += uLeanOffset.x * leanFactor;
  leanedP.z += uLeanOffset.y * leanFactor;

  // Inverted teardrop radius profile
  float profileRadius;
  if (vertNorm < 0.15) {
    profileRadius = mix(0.15, 0.8, vertNorm / 0.15);
  } else if (vertNorm < 0.4) {
    profileRadius = mix(0.8, 1.0, (vertNorm - 0.15) / 0.25);
  } else {
    profileRadius = mix(1.0, 0.0, (vertNorm - 0.4) / 0.6);
  }

  float radial = length(leanedP.xz) / (uFlameRadius * max(profileRadius, 0.01));
  if (radial > 1.0) return 0.0;

  float radialFalloff = 1.0 - smoothstep(0.0, 1.0, radial);
  radialFalloff *= radialFalloff;

  float vertDensity = 1.0 - smoothstep(0.1, 0.9, vertNorm);

  // Noise sampling: scroll upward + accumulated wind displacement.
  // uWindOffset is velocity integrated over time - the noise field
  // physically drifts with motion, creating the organic trailing effect.
  vec3 noisePos = p;
  noisePos.y -= uTime * uScrollSpeed;
  noisePos += uWindOffset;

  float n = snoise(noisePos * 3.5) * 0.55;

${octaves >= 2 ? `
  n += snoise(noisePos * 7.0 + uTime * uScrollSpeed * 0.7) * 0.25;
` : ''}

${octaves >= 3 ? `
  n += snoise(noisePos * 14.0 + uTime * uScrollSpeed * 1.3) * 0.12;
` : ''}

  float density = (n * 0.5 + 0.5) * vertDensity * radialFalloff * uIntensity;

  float turbMod = 1.0 + uTurbulence * vertNorm *
    (snoise(noisePos * 5.0 + vec3(0.0, uTime * 2.0, 0.0)) * 0.5);
  density *= turbMod;

  return max(density, 0.0);
}

void main() {
  vec3 rayDir = normalize(vDirection);
  vec2 tBox = boxIntersect(vOrigin, rayDir);

  if (tBox.x > tBox.y || tBox.y < 0.0) discard;

  float tStart = max(tBox.x, 0.0);
  float tEnd = tBox.y;

  vec4 acc = vec4(0.0);

  for (int i = 0; i < STEPS; i++) {
    float t = tStart + float(i) * STEP_SIZE;
    if (t > tEnd) break;

    vec3 samplePos = vOrigin + rayDir * t;
    float density = fireDensity(samplePos);

    if (density > 0.001) {
      float temp = clamp(density, 0.0, 1.0);

      vec3 color;
      if (temp > 0.7) {
        color = mix(uWarmColor, uHotColor, (temp - 0.7) / 0.3);
      } else if (temp > 0.35) {
        color = mix(uCoolColor, uWarmColor, (temp - 0.35) / 0.35);
      } else if (temp > uSmokeThreshold) {
        color = mix(uSmokeColor, uCoolColor, (temp - uSmokeThreshold) / (0.35 - uSmokeThreshold));
      } else {
        color = uSmokeColor;
      }

      float emissive = 1.0 + temp * 2.5;
      color *= emissive;

      float alpha = density * STEP_SIZE * 8.0;
      alpha = clamp(alpha, 0.0, 1.0);

      acc.rgb += (1.0 - acc.a) * alpha * color;
      acc.a   += (1.0 - acc.a) * alpha;

      if (acc.a > 0.95) break;
    }
  }

  if (acc.a < 0.001) discard;

  gl_FragColor = vec4(acc.rgb, acc.a);
}
`;
}

export class VolumetricFireMesh extends Mesh {
  private fireUniforms: Record<string, { value: unknown }>;

  constructor(options: VolumetricFireOptions = {}) {
    const tier = options.qualityTier ?? QualityTier.HIGH;
    const steps = STEP_COUNTS[tier];
    const octaves = OCTAVE_COUNTS[tier];
    const colors = getFireColors(options.preset ?? "classic", options.customColors);
    const boxScale = options.boxScale ?? new Vector3(0.22, 0.4, 0.22);

    const uniforms: Record<string, { value: unknown }> = {
      uTime:           { value: 0.0 },
      uIntensity:      { value: 1.4 },
      uTurbulence:     { value: 1.0 },
      uScrollSpeed:    { value: 1.5 },
      uFlameHeight:    { value: 1.0 },
      uFlameRadius:    { value: 0.7 },
      uHotColor:       { value: colors.hot },
      uWarmColor:      { value: colors.warm },
      uCoolColor:      { value: colors.cool },
      uSmokeColor:     { value: colors.smoke },
      uSmokeThreshold: { value: 0.1 },
      uWindOffset:     { value: new Vector3(0, 0, 0) },
      uLeanOffset:     { value: [0.0, 0.0] },
    };

    const material = new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader: buildFragmentShader(steps, octaves),
      transparent: true,
      depthWrite: false,
      side: BackSide,
      blending: AdditiveBlending,
    });

    const geometry = new BoxGeometry(1, 1, 1);

    super(geometry, material);

    this.fireUniforms = uniforms;
    this.scale.copy(boxScale);
    this.frustumCulled = false;
    this.renderOrder = 98;
  }

  setTime(time: number): void {
    this.fireUniforms.uTime!.value = time;
  }

  /** Set accumulated wind offset (velocity integrated over time) */
  setWindOffset(x: number, y: number, z: number): void {
    (this.fireUniforms.uWindOffset!.value as Vector3).set(x, y, z);
  }

  /** Set lean offset - shifts teardrop center in XZ for physical leaning */
  setLeanOffset(x: number, z: number): void {
    (this.fireUniforms.uLeanOffset!.value as number[])[0] = x;
    (this.fireUniforms.uLeanOffset!.value as number[])[1] = z;
  }

  setPreset(preset: FireColorPreset, customColors?: Partial<FireColorSet>): void {
    const colors = getFireColors(preset, customColors);
    (this.fireUniforms.uHotColor!.value as Color).copy(colors.hot);
    (this.fireUniforms.uWarmColor!.value as Color).copy(colors.warm);
    (this.fireUniforms.uCoolColor!.value as Color).copy(colors.cool);
    (this.fireUniforms.uSmokeColor!.value as Color).copy(colors.smoke);
  }

  setIntensity(intensity: number): void {
    this.fireUniforms.uIntensity!.value = intensity;
  }

  setTurbulence(turbulence: number): void {
    this.fireUniforms.uTurbulence!.value = turbulence;
  }

  setScrollSpeed(speed: number): void {
    this.fireUniforms.uScrollSpeed!.value = speed;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as ShaderMaterial).dispose();
  }
}
