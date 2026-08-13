import { Color, DoubleSide, ShaderMaterial, type IUniform } from "three";
import { QualityTier } from "../types";

export interface GhostAgeVisual {
  fillAlpha: number;
  rimAlpha: number;
  emission: number;
  saturation: number;
}

export const GHOST_POOL_SIZE_BY_TIER: Record<QualityTier, number> = {
  [QualityTier.HIGH]: 10,
  [QualityTier.MEDIUM]: 6,
  [QualityTier.LOW]: 4,
};

export function resolveGhostPoolSize(qualityTier: QualityTier): number {
  return GHOST_POOL_SIZE_BY_TIER[qualityTier];
}

export function resolveGhostAgeVisual(
  ageSeconds: number,
  lifetimeSeconds: number,
  intensity: number
): GhostAgeVisual {
  const life = Math.max(0.001, lifetimeSeconds);
  const age = Math.max(0, Math.min(1, ageSeconds / life));
  const strength = Math.max(0, Math.min(1, intensity));
  const bodyVisibility = Math.pow(1 - age, 1.8);
  const rimVisibility = Math.pow(1 - age, 1.35);
  const sheddingProgress = Math.max(0, Math.min(1, (age - 0.22) / 0.53));
  const smoothShedding =
    sheddingProgress * sheddingProgress * (3 - 2 * sheddingProgress);
  const body = 1 - smoothShedding;

  return {
    fillAlpha: 0.62 * strength * body * bodyVisibility,
    rimAlpha: 0.54 * strength * rimVisibility,
    emission: 0.9 + 0.45 * body,
    saturation: Math.max(0, 1 - age / 0.68),
  };
}

/** The frost breakup belongs to the captured pose, never its reusable slot. */
export function resolveGhostPoseFrostSeed(poseKey: string): number {
  let hash = 2166136261;
  for (let index = 0; index < poseKey.length; index += 1) {
    hash = Math.imul(hash ^ poseKey.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 1024;
}

interface ChronoFrostUniforms extends Record<string, IUniform> {
  uColor: IUniform<Color>;
  uFillAlpha: IUniform<number>;
  uRimAlpha: IUniform<number>;
  uEmission: IUniform<number>;
  uSaturation: IUniform<number>;
  uRimPower: IUniform<number>;
  uFrostSeed: IUniform<number>;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vLocalPosition = position;
    vViewNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFillAlpha;
  uniform float uRimAlpha;
  uniform float uEmission;
  uniform float uSaturation;
  uniform float uRimPower;
  uniform float uFrostSeed;

  varying vec3 vLocalPosition;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  float frozenGrain(vec3 p) {
    float a = sin(dot(p, vec3(41.7, 73.1, 29.3)) + uFrostSeed);
    float b = sin(dot(p, vec3(87.9, 19.7, 61.3)) - uFrostSeed * 0.71);
    return 0.72 + 0.28 * (0.5 + 0.25 * (a + b));
  }

  void main() {
    float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
    float fresnel = pow(clamp(1.0 - facing, 0.0, 1.0), uRimPower);
    float grain = frozenGrain(vLocalPosition);
    float backFillWeight = gl_FrontFacing ? 1.0 : 0.55;
    float backRimWeight = gl_FrontFacing ? 1.0 : 0.18;
    float fill = uFillAlpha * grain * backFillWeight;
    float rim = uRimAlpha * fresnel * backRimWeight;
    float combinedAlpha = max(fill + rim, 0.00001);
    float alpha = 1.0 - (1.0 - clamp(fill, 0.0, 1.0)) *
      (1.0 - clamp(rim, 0.0, 1.0));
    if (alpha <= 0.001) discard;

    vec3 coldWhite = vec3(0.72, 0.90, 1.0);
    vec3 agedColor = mix(coldWhite, uColor, uSaturation);
    vec3 bodyRadiance = agedColor * (0.84 + 0.14 * grain);
    vec3 rimRadiance = agedColor * (0.72 + fresnel * uEmission);
    vec3 radiance =
      (bodyRadiance * fill + rimRadiance * rim) / combinedAlpha;
    gl_FragColor = vec4(radiance, alpha);
  }
`;

export function createChronoFrostMaterial(slotIndex: number): ShaderMaterial {
  const uniforms: ChronoFrostUniforms = {
    uColor: { value: new Color("#ffffff") },
    uFillAlpha: { value: 0 },
    uRimAlpha: { value: 0 },
    uEmission: { value: 1 },
    uSaturation: { value: 1 },
    uRimPower: { value: 2.35 },
    uFrostSeed: { value: slotIndex * 11.731 + 0.37 },
  };
  const material = new ShaderMaterial({
    name: `GhostChronoFrost:${slotIndex}`,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
  });
  material.forceSinglePass = true;
  material.toneMapped = false;
  return material;
}

export function updateChronoFrostMaterial(
  material: ShaderMaterial,
  color: string,
  visual: GhostAgeVisual,
  rimPower: number,
  frostSeed: number
): void {
  const uniforms = material.uniforms as ChronoFrostUniforms;
  uniforms.uColor.value.set(color);
  uniforms.uFillAlpha.value = visual.fillAlpha;
  uniforms.uRimAlpha.value = visual.rimAlpha;
  uniforms.uEmission.value = visual.emission;
  uniforms.uSaturation.value = visual.saturation;
  uniforms.uRimPower.value = rimPower;
  uniforms.uFrostSeed.value = frostSeed;
}
