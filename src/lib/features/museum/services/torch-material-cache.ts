/**
 * Torch Material Cache
 *
 * Pre-compiles flame and volumetric cone shader materials ONCE, then
 * provides clones for each MuseumTorch3D instance. Without this cache,
 * every torch triggers GPU shader compilation on mount - each taking
 * 200-800ms and causing visible stutter while walking.
 *
 * ShaderMaterial.clone() reuses the compiled GPU program, so cloning
 * is essentially free compared to creating from scratch.
 */

import {
  ShaderMaterial,
  PlaneGeometry,
  ConeGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  PointsMaterial,
  AdditiveBlending,
  DoubleSide,
  FrontSide,
  Color,
} from "three";

export interface TorchMaterials {
  flameMat: ShaderMaterial;
  flameGeo: PlaneGeometry;
  coneMat: ShaderMaterial;
  coneGeo: ConeGeometry;
  fallbackGeo: SphereGeometry;
  fallbackMat: MeshStandardMaterial;
  emberMat: PointsMaterial;
}

// Flame shader source - shared across all torch instances
const FLAME_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 billboardPos = camRight * position.x + camUp * position.y;
    vec4 worldPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    worldPos.xyz += billboardPos;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
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
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.1;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float xCenter = abs(uv.x - 0.5) * 2.0;
    float taper = 1.0 - pow(uv.y, 0.6);
    float mask = smoothstep(taper, taper - 0.3, xCenter);
    float vertFade = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.4, uv.y);
    vec2 noiseCoord = vec2(uv.x * 3.0, uv.y * 4.0 - uTime * 2.5);
    float n = fbm(noiseCoord);
    float flame = mask * vertFade * (0.6 + 0.4 * n);
    flame = smoothstep(0.1, 0.6, flame);

    vec3 white = vec3(1.0, 0.95, 0.85);
    vec3 yellow = vec3(1.0, 0.75, 0.2);
    vec3 orange = vec3(1.0, 0.4, 0.05);
    vec3 red = vec3(0.6, 0.1, 0.0);
    vec3 color = mix(red, orange, smoothstep(0.0, 0.3, flame));
    color = mix(color, yellow, smoothstep(0.3, 0.6, flame));
    color = mix(color, white, smoothstep(0.6, 0.9, flame));
    color *= 1.5 * uIntensity;

    gl_FragColor = vec4(color, flame * 0.9);
  }
`;

const CONE_VERTEX = /* glsl */ `
  varying float vHeight;
  void main() {
    vHeight = (position.y + 0.4) / 0.8;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vHeight;
  void main() {
    float alpha = vHeight * vHeight * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Module-level template materials (compiled once per page load)

let templateFlame: ShaderMaterial | null = null;
let templateCone: ShaderMaterial | null = null;
let sharedFlameGeo: PlaneGeometry | null = null;
let sharedConeGeo: ConeGeometry | null = null;
let sharedFallbackGeo: SphereGeometry | null = null;
let sharedEmberMat: PointsMaterial | null = null;

function ensureTemplates(): void {
  if (templateFlame) return;

  // Create template materials - GPU compiles shaders here, ONCE
  templateFlame = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
  });

  templateCone = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color("#ff8830") },
      uIntensity: { value: 0.15 },
    },
    vertexShader: CONE_VERTEX,
    fragmentShader: CONE_FRAGMENT,
  });

  // Shared geometries - same shape for every torch
  sharedFlameGeo = new PlaneGeometry(0.2, 0.35);
  sharedConeGeo = new ConeGeometry(0.4, 0.8, 12, 1, true);
  sharedFallbackGeo = new SphereGeometry(0.06, 8, 8);

  // Shared ember material - same visual for all fire torches
  sharedEmberMat = new PointsMaterial({
    color: "#ffaa40",
    size: 0.015,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
}

/** Clone materials for a new torch instance. Reuses compiled GPU programs. */
export function createTorchInstance(lightColor: string): TorchMaterials {
  ensureTemplates();

  const flameMat = templateFlame!.clone();
  flameMat.uniforms.uTime = { value: Math.random() * 100 };
  flameMat.uniforms.uIntensity = { value: 1.0 };

  const coneMat = templateCone!.clone();
  coneMat.uniforms.uColor = { value: new Color(lightColor) };
  coneMat.uniforms.uIntensity = { value: 0.15 };

  return {
    flameMat,
    flameGeo: sharedFlameGeo!,
    coneMat,
    coneGeo: sharedConeGeo!,
    fallbackGeo: sharedFallbackGeo!,
    fallbackMat: new MeshStandardMaterial({
      color: lightColor,
      emissive: lightColor,
      emissiveIntensity: 3.0,
    }),
    emberMat: sharedEmberMat!,
  };
}

export function disposeTorchMaterialCache(): void {
  templateFlame?.dispose();
  templateCone?.dispose();
  sharedFlameGeo?.dispose();
  sharedConeGeo?.dispose();
  sharedFallbackGeo?.dispose();
  sharedEmberMat?.dispose();

  templateFlame = null;
  templateCone = null;
  sharedFlameGeo = null;
  sharedConeGeo = null;
  sharedFallbackGeo = null;
  sharedEmberMat = null;
}
