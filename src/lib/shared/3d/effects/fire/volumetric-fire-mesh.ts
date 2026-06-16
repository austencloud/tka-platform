/**
 * VolumetricFireMesh - Object-space raymarched fire volume.
 *
 * A THREE.Mesh with a BoxGeometry bounding volume and a custom ShaderMaterial
 * whose fragment shader raymarches through domain-warped fractal noise to
 * produce volumetric fire.
 *
 * Shape & structure (the "licks, not blobs" upgrade):
 *   - Domain-warped fBm. A warp vector built from offset fBm taps distorts the
 *     sampling domain before the final fBm read, turning round noise cells into
 *     the tongue/filament structure real flames have. (Quílez domain warping.)
 *   - Height-growing erosion. The base stays solid; the flame top tears into
 *     separate tongues, so it reads as fire rather than a glowing cylinder.
 *   - Jittered ray start. A per-fragment hash offsets the first sample so the
 *     fixed step count never produces visible slice banding on close orbit.
 *
 * Color & emission:
 *   - Planck blackbody fit drives the "classic" preset: white-hot core ->
 *     yellow -> deep orange -> red edge, the physically-correct flame spectrum.
 *     Overexposure-to-white in the core comes from emission scaling + additive
 *     accumulation, exactly what a camera does to a real flame.
 *   - Stylized presets (blue / spirit / custom) keep their authored 4-stop ramp
 *     but now ride on the improved heat field, warp, and erosion. uBlackbody
 *     blends between the two so classic is physical and the rest stay on-brand.
 *
 * Momentum response (driven by FireRenderer3D's wick model):
 *   1. uWindOffset (vec3) - accumulated velocity, transformed into flame-local
 *      space by the renderer, displaces the noise domain so the internal texture
 *      streams correctly even when the flame lies sideways.
 *   2. uLeanOffset (vec2) - shifts the teardrop density center in XZ. The wick
 *      model leaves this near zero (orientation now carries the directional cue)
 *      but it stays wired for fine control.
 *
 * References:
 *   - Inigo Quilez - domain warping (iquilezles.org/articles/warp)
 *   - Tanner Helland - blackbody color temperature fit
 *   - mattatz/unity-procedural-volumetric-fire - noise displacement
 *   - Fuller & Krishnan (I3D 2007) - real-time procedural volumetric fire
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
import { simplex3dNoise } from "./fire-noise.glsl";
import { getFireColors, type FireColorPreset, type FireColorSet } from "./fire-color-curve-3d";
import { QualityTier } from "../types";

const STEP_COUNTS: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 96,
  [QualityTier.MEDIUM]: 48,
  [QualityTier.LOW]: 24,
};

/** fBm octave count per tier. Domain warp needs >=2 to read as filaments. */
const OCTAVE_COUNTS: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 3,
  [QualityTier.MEDIUM]: 2,
  [QualityTier.LOW]: 1,
};

/** Domain-warp tap count per tier. 0 = no warp (cheapest), 3 = full xyz warp. */
const WARP_TAPS: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 3,
  [QualityTier.MEDIUM]: 2,
  [QualityTier.LOW]: 0,
};

/** Presets whose authored colors should override the physical blackbody curve. */
function blackbodyAmount(preset: FireColorPreset): number {
  return preset === "classic" ? 1.0 : 0.0;
}

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

function buildFbm(octaves: number): string {
  // Unrolled fBm so older GLSL ES 1.0 compilers don't choke on dynamic loops.
  let body = `  float f = 0.5 * snoise(p);\n`;
  if (octaves >= 2) body += `  p *= 2.02; f += 0.25 * snoise(p);\n`;
  if (octaves >= 3) body += `  p *= 2.07; f += 0.125 * snoise(p);\n`;
  return /* glsl */ `
float fbm(vec3 p) {
${body}  return f;
}
`;
}

function buildFragmentShader(steps: number, octaves: number, warpTaps: number): string {
  const warp =
    warpTaps === 0
      ? /* glsl */ `  float n = fbm(noisePos + vec3(0.0, -uTime * uScrollSpeed * 0.8, 0.0));`
      : /* glsl */ `
  vec3 q = vec3(
    fbm(noisePos),
    fbm(noisePos + vec3(5.2, 1.3, 2.8)),
    ${warpTaps >= 3 ? `fbm(noisePos + vec3(1.7, 9.2, 4.6))` : `0.0`}
  );
  float n = fbm(noisePos + uWarp * q + vec3(0.0, -uTime * uScrollSpeed * 0.8, 0.0));`;

  return /* glsl */ `
${simplex3dNoise}

uniform float uTime;
uniform float uIntensity;
uniform float uTurbulence;
uniform float uScrollSpeed;
uniform float uFlameHeight;
uniform float uFlameRadius;
uniform float uWarp;
uniform float uErosion;
uniform float uEmission;
uniform float uBlackbody;
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

${buildFbm(octaves)}

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

// Tanner Helland blackbody fit, clamped to the flame band (800-2400K).
vec3 blackbody(float tK) {
  float t = tK / 100.0;
  float g = 99.4708025861 * log(t) - 161.1195681661;
  float b = (t <= 19.0) ? 0.0 : 138.5177312231 * log(t - 10.0) - 305.0447927307;
  return clamp(vec3(255.0, g, b) / 255.0, 0.0, 1.0);
}

// Returns density in x, heat (0-1 temperature proxy) in y.
vec2 fireField(vec3 p) {
  float vertNorm = (p.y + 0.5) / uFlameHeight;
  if (vertNorm < 0.0 || vertNorm > 1.0) return vec2(0.0);

  // Lean: shift the teardrop center progressively with height (base anchored).
  vec3 leanedP = p;
  float leanFactor = vertNorm * vertNorm;
  leanedP.x += uLeanOffset.x * leanFactor;
  leanedP.z += uLeanOffset.y * leanFactor;

  // Inverted-teardrop silhouette.
  float profileRadius;
  if (vertNorm < 0.15) {
    profileRadius = mix(0.15, 0.8, vertNorm / 0.15);
  } else if (vertNorm < 0.4) {
    profileRadius = mix(0.8, 1.0, (vertNorm - 0.15) / 0.25);
  } else {
    profileRadius = mix(1.0, 0.0, (vertNorm - 0.4) / 0.6);
  }

  float radial = length(leanedP.xz) / (uFlameRadius * max(profileRadius, 0.01));
  if (radial > 1.0) return vec2(0.0);

  float radialFalloff = 1.0 - smoothstep(0.0, 1.0, radial);
  radialFalloff *= radialFalloff;
  float vertDensity = 1.0 - smoothstep(0.1, 0.9, vertNorm);
  float profile = radialFalloff * vertDensity;

  // Rising, wind-displaced sample position.
  vec3 noisePos = p * 3.0;
  noisePos.y -= uTime * uScrollSpeed * 2.4;
  noisePos += uWindOffset;

${warp}

  float flame = n * 0.5 + 0.5;
  flame *= 1.0 + uTurbulence * 0.5 * snoise(noisePos * 1.8 + vec3(0.0, uTime * 2.0, 0.0));

  // Height-growing erosion: solid base, tongues at the top.
  float erosion = mix(uErosion * 0.3, uErosion, smoothstep(0.15, 1.0, vertNorm));
  float density = smoothstep(erosion, erosion + 0.35, flame * (profile * 1.6)) * uIntensity;

  // Heat: hottest in the low core, cooling outward and upward.
  float coreness = (1.0 - radial) * (1.0 - smoothstep(0.0, 0.85, vertNorm));
  float heat = clamp(density * 0.9 + coreness * 0.6, 0.0, 1.0);

  return vec2(density, heat);
}

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 rayDir = normalize(vDirection);
  vec2 tBox = boxIntersect(vOrigin, rayDir);

  if (tBox.x > tBox.y || tBox.y < 0.0) discard;

  float jitter = hash12(gl_FragCoord.xy);
  float tStart = max(tBox.x, 0.0) + jitter * STEP_SIZE;
  float tEnd = tBox.y;

  vec4 acc = vec4(0.0);

  for (int i = 0; i < STEPS; i++) {
    float t = tStart + float(i) * STEP_SIZE;
    if (t > tEnd) break;

    vec3 samplePos = vOrigin + rayDir * t;
    vec2 field = fireField(samplePos);
    float density = field.x;

    if (density > 0.001) {
      float heat = field.y;
      float emissive = 0.3 + uEmission * heat * heat;

      // Physical blackbody path (classic preset).
      vec3 bb = blackbody(mix(800.0, 2400.0, heat * heat)) * emissive;

      // Authored 4-stop ramp path (blue / spirit / custom).
      vec3 ramp;
      if (heat > 0.7) {
        ramp = mix(uWarmColor, uHotColor, (heat - 0.7) / 0.3);
      } else if (heat > 0.35) {
        ramp = mix(uCoolColor, uWarmColor, (heat - 0.35) / 0.35);
      } else if (heat > uSmokeThreshold) {
        ramp = mix(uSmokeColor, uCoolColor, (heat - uSmokeThreshold) / (0.35 - uSmokeThreshold));
      } else {
        ramp = uSmokeColor;
      }
      ramp *= emissive;

      vec3 color = mix(ramp, bb, uBlackbody);

      float alpha = clamp(density * STEP_SIZE * 8.0, 0.0, 1.0);
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
    const warpTaps = WARP_TAPS[tier];
    const preset = options.preset ?? "classic";
    const colors = getFireColors(preset, options.customColors);
    const boxScale = options.boxScale ?? new Vector3(0.22, 0.4, 0.22);

    const uniforms: Record<string, { value: unknown }> = {
      uTime:           { value: 0.0 },
      uIntensity:      { value: 1.4 },
      uTurbulence:     { value: 1.0 },
      uScrollSpeed:    { value: 1.5 },
      uFlameHeight:    { value: 1.0 },
      uFlameRadius:    { value: 0.7 },
      uWarp:           { value: warpTaps > 0 ? 0.9 : 0.0 },
      uErosion:        { value: 0.45 },
      uEmission:       { value: 2.6 },
      uBlackbody:      { value: blackbodyAmount(preset) },
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
      fragmentShader: buildFragmentShader(steps, octaves, warpTaps),
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

  /** Set wind offset (velocity integrated over time), already in flame-local space. */
  setWindOffset(x: number, y: number, z: number): void {
    (this.fireUniforms.uWindOffset!.value as Vector3).set(x, y, z);
  }

  /** Set lean offset - shifts teardrop center in XZ for fine physical leaning. */
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
    this.fireUniforms.uBlackbody!.value = blackbodyAmount(preset);
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

  /** Domain-warp strength. No-op on LOW tier (warp compiled out). */
  setWarp(warp: number): void {
    this.fireUniforms.uWarp!.value = warp;
  }

  /** Erosion threshold - lower = fuller body, higher = more torn tongues. */
  setErosion(erosion: number): void {
    this.fireUniforms.uErosion!.value = erosion;
  }

  /** Emission gain on the hot core. The wick model boosts this during a poof. */
  setEmission(emission: number): void {
    this.fireUniforms.uEmission!.value = emission;
  }

  /** Radial extent of the flame body. The wick model widens this during a poof. */
  setFlameRadius(radius: number): void {
    this.fireUniforms.uFlameRadius!.value = radius;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as ShaderMaterial).dispose();
  }
}
