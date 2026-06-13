/**
 * FireParticleMaterial3D - velocity-stretched, noise-eroded flame-lick shader
 * for the Lagrangian fire renderer.
 *
 * Point sprites read as "particley" because they are screen-aligned squares
 * that can neither rotate nor elongate. This material instead renders each
 * particle as an instanced quad that is billboarded and *stretched along its
 * own velocity* entirely in the vertex shader (GPU view-space billboarding -
 * no per-instance CPU matrix). A particle streaking sideways with the tip
 * becomes a sideways streak; one rising on buoyancy becomes a vertical tongue.
 *
 * The fragment shader carves a flame-lick silhouette out of the quad - wide
 * rounded base tapering to a frayed tip - then erodes its edges with scrolling
 * value-noise fBm so the outline is torn, not elliptical. Dense overlap of
 * these licks under additive blending reads as continuous wispy flame rather
 * than a cloud of blobs.
 *
 * Per-instance attributes (set by FireRenderer3D):
 *   aCenter (vec3) - world-space (rig-local) particle position
 *   aVel    (vec3) - world-space velocity (stretch axis + magnitude)
 *   aLife   (float) - normalized age 0..1 (drives blackbody color + size curve)
 *   aSeed   (float) - per-particle random for noise decorrelation
 *   aSize   (float) - base size in world units
 *
 * Age drives the blackbody ramp: white-hot core (HDR for bloom) -> orange ->
 * deep red -> smoke faded to nothing.
 */

import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from "three";
import type { FireColorSet } from "./fire-color-curve-3d";

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aVel;
  attribute float aLife;
  attribute float aSeed;
  attribute float aSize;

  uniform float uLenBase;
  uniform float uLenPerSpeed;
  uniform float uLenMax;
  uniform float uWidth;

  varying vec2 vUv;
  varying float vLife;
  varying float vSeed;

  void main() {
    vUv = uv;
    vLife = aLife;
    vSeed = aSeed;

    // Size over life: born small at the wick, swells, frays + shrinks at death.
    float grow = smoothstep(0.0, 0.18, aLife);
    float taper = 1.0 - smoothstep(0.5, 1.0, aLife) * 0.6;
    float sizeMul = (0.5 + 0.85 * grow) * taper;

    // View-space billboard: stretch axis = velocity projected to the screen.
    vec3 centerView = (modelViewMatrix * vec4(aCenter, 1.0)).xyz;
    vec3 velView = (modelViewMatrix * vec4(aVel, 0.0)).xyz;
    vec2 dir = velView.xy;
    float speed = length(dir);
    vec2 along = speed > 1e-4 ? dir / speed : vec2(0.0, 1.0);
    vec2 perp = vec2(-along.y, along.x);

    float lenFactor = min(uLenBase + speed * uLenPerSpeed, uLenMax);
    float halfLen = aSize * sizeMul * lenFactor;
    float halfWid = aSize * sizeMul * uWidth;

    vec2 local = uv - 0.5; // [-0.5, 0.5]
    vec2 offset = along * (local.y * 2.0 * halfLen) + perp * (local.x * 2.0 * halfWid);
    vec3 posView = centerView + vec3(offset, 0.0);

    gl_Position = projectionMatrix * vec4(posView, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uHot;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform vec3 uSmoke;
  uniform float uEmissiveHot;
  uniform float uTime;

  varying vec2 vUv;
  varying float vLife;
  varying float vSeed;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      s += a * vnoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    // vUv.y: 0 = trailing base, 1 = leading tip (along velocity).
    float y = clamp(vUv.y, 0.0, 1.0);
    float xc = vUv.x - 0.5; // -0.5 .. 0.5 across the lick

    // Snake the centreline: low-freq noise sways the lick sideways, swaying
    // more toward the tip so it curls instead of reading as a straight wedge.
    float sway = fbm(vec2(y * 2.2 - uTime * 1.3 + vSeed * 6.0, vSeed * 17.0)) - 0.5;
    float xw = xc + sway * 0.5 * y;

    // Curved width profile: rounded base, smooth taper to the tip. The pow()
    // bows the sides outward so they are never straight triangle edges.
    float widthEnv = smoothstep(0.0, 0.1, y) * pow(1.0 - y, 0.62);
    float across = abs(xw) * 2.0;

    // High-freq fBm frays the boundary in and out and is allowed to reach zero,
    // so the silhouette is torn and notched (flame), not a filled wedge.
    float fray = fbm(vec2(xc * 5.0 + vSeed * 23.0,
                          y * 6.0 - uTime * 2.4 + vSeed * 11.0));
    float edge = widthEnv * (0.55 + 0.8 * fray);
    float body = smoothstep(edge, edge * 0.3, across);

    // Vertical envelope: fade in at the base, fade out into a frayed tip.
    float vert = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.5, 1.0, y));
    float shape = pow(clamp(body * vert, 0.0, 1.0), 1.2);
    if (shape < 0.004) discard;

    // Blackbody ramp across normalized age.
    vec3 color;
    if (vLife < 0.35) {
      color = mix(uHot, uWarm, vLife / 0.35);
    } else if (vLife < 0.7) {
      color = mix(uWarm, uCool, (vLife - 0.35) / 0.35);
    } else {
      color = mix(uCool, uSmoke, (vLife - 0.7) / 0.3);
    }

    // Emission: blinding core, decaying as it cools. The fray term flickers
    // the interior brightness so the body churns instead of reading as flat.
    float emis = mix(uEmissiveHot, 0.2, smoothstep(0.0, 0.78, vLife));
    color *= emis * (0.7 + 0.55 * fray);

    // Lifetime alpha: quick flash-in, fade out into smoke.
    float fadeIn = smoothstep(0.0, 0.05, vLife);
    float fadeOut = 1.0 - smoothstep(0.55, 1.0, vLife);
    float alpha = shape * fadeIn * fadeOut;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface FireParticleMaterialOptions {
  colors: FireColorSet;
  /** Core emissive multiplier (HDR, drives bloom). Default 3.2. */
  emissiveHot?: number;
}

export function createFireParticleMaterial(
  options: FireParticleMaterialOptions,
): ShaderMaterial {
  const { colors, emissiveHot } = options;
  return new ShaderMaterial({
    uniforms: {
      uHot: { value: colors.hot.clone() },
      uWarm: { value: colors.warm.clone() },
      uCool: { value: colors.cool.clone() },
      uSmoke: { value: colors.smoke.clone() },
      uEmissiveHot: { value: emissiveHot ?? 3.2 },
      uTime: { value: 0 },
      // Stretch tuning (world-unit factors of aSize).
      uLenBase: { value: 1.0 },
      uLenPerSpeed: { value: 0.55 },
      uLenMax: { value: 3.6 },
      uWidth: { value: 0.55 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}

/** Push a new color set into an existing material's uniforms (preset switch). */
export function applyFireParticleColors(material: ShaderMaterial, colors: FireColorSet): void {
  (material.uniforms.uHot!.value as Color).copy(colors.hot);
  (material.uniforms.uWarm!.value as Color).copy(colors.warm);
  (material.uniforms.uCool!.value as Color).copy(colors.cool);
  (material.uniforms.uSmoke!.value as Color).copy(colors.smoke);
}
