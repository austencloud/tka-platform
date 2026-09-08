import {
  AdditiveBlending,
  BackSide,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Camera,
} from "three";

import coordinateManifest from "../../../../../../../docs/superpowers/specs/seraphic-vault/seraphic-vault-gate2-cloudbreak-r2-coordinate-manifest.json";
import type {
  CelestialGodRaysConfig,
  CelestialSceneConfig,
  CloudIslandsConfig,
} from "../../domain/models/scene-configs";
import { createRainbowParticleField } from "../rainbow/rainbow-particle-field";
import { CLOUDBREAK_SKY_SUN } from "../../scenes/celestial/cloudbreak-layout";
import { createCelestialVolumeClouds } from "./celestial-volume-clouds";
import { disposeCelestialObjectTree } from "./celestial-disposal";

export interface CelestialAtmosphereOptions {
  config: CelestialSceneConfig;
  cloudBankCount: number;
  stageWidth: number;
  stageDepth: number;
  worldYOffset: number;
  motionScale: number;
  random?: () => number;
}

export interface CelestialAtmosphere {
  object: Group;
  update(deltaSeconds: number, camera: Camera): void;
  pulse(): void;
  dispose(): void;
}

interface TimedMaterial {
  material: ShaderMaterial;
  speed: number;
}

function createSkyGradient(config: CelestialSceneConfig["sky"]): {
  mesh: Mesh;
  material: ShaderMaterial;
} {
  const material = new ShaderMaterial({
    uniforms: {
      uTopColor: { value: new Color(config.topColor) },
      uMidColor: { value: new Color(config.midColor ?? config.topColor) },
      uBottomColor: { value: new Color(config.bottomColor) },
      uHasMid: { value: config.midColor ? 1 : 0 },
      uGradientStart: { value: 0 },
      uGradientEnd: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uBottomColor;
      uniform float uHasMid;
      uniform float uGradientStart;
      uniform float uGradientEnd;
      varying vec3 vSkyDirection;
      void main() {
        float rawHeight = normalize(vSkyDirection).y * 0.5 + 0.5;
        float h = clamp(
          (rawHeight - uGradientStart) / max(uGradientEnd - uGradientStart, 0.0001),
          0.0,
          1.0
        );
        vec3 color;
        if (uHasMid > 0.5) {
          color = h < 0.5
            ? mix(uBottomColor, uMidColor, h * 2.0)
            : mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
        } else {
          color = mix(uBottomColor, uTopColor, h);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(
    new SphereGeometry(config.radius ?? 200, 32, 32),
    material
  );
  mesh.name = "celestial-sky-gradient";
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, material };
}

function gridNoise(x: number, y: number, seed: number): number {
  const signal = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return signal - Math.floor(signal);
}

function periodicValueNoise(
  u: number,
  v: number,
  cellsX: number,
  cellsY: number,
  seed: number
): number {
  const gx = u * cellsX;
  const gy = v * cellsY;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const wrapX = (value: number) => ((value % cellsX) + cellsX) % cellsX;
  const wrapY = (value: number) => ((value % cellsY) + cellsY) % cellsY;
  const top =
    gridNoise(wrapX(x0), wrapY(y0), seed) * (1 - sx) +
    gridNoise(wrapX(x0 + 1), wrapY(y0), seed) * sx;
  const bottom =
    gridNoise(wrapX(x0), wrapY(y0 + 1), seed) * (1 - sx) +
    gridNoise(wrapX(x0 + 1), wrapY(y0 + 1), seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

function fractalNoise(u: number, v: number, seed: number): number {
  const octaves = [
    [3, 2, 0.52],
    [6, 4, 0.26],
    [12, 8, 0.14],
    [24, 16, 0.08],
  ] as const;
  return octaves.reduce(
    (sum, [cellsX, cellsY, weight], index) =>
      sum +
      periodicValueNoise(u, v, cellsX, cellsY, seed + index * 13) * weight,
    0
  );
}

function createCloudNoiseTexture(): DataTexture {
  const width = 512;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const offset = (y * width + x) * 4;
      data[offset] = Math.round(fractalNoise(u, v, 17) * 255);
      data[offset + 1] = Math.round(fractalNoise(u, v, 53) * 255);
      data[offset + 2] = Math.round(fractalNoise(u, v, 101) * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createCloudDome(config: CelestialSceneConfig["cloudDome"]): {
  mesh: Mesh;
  timed: TimedMaterial;
} | null {
  if (!config.enabled) return null;
  const noiseTexture = createCloudNoiseTexture();
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoverage: { value: config.coverage },
      uDensity: { value: config.density },
      uOpacity: { value: config.opacity },
      uScale: { value: config.scale ?? 3.8 },
      uOffset: { value: new Vector2(...(config.offset ?? [0, 0])) },
      uHorizonFade: { value: config.horizonFade ?? -0.08 },
      uZenithFade: { value: config.zenithFade ?? 0.9 },
      uNoiseTexture: { value: noiseTexture },
      uSunDirection: {
        value: new Vector3(...config.sunDirection).normalize(),
      },
      uLitColor: { value: new Color(config.litColor) },
      uShadowColor: { value: new Color(config.shadowColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCoverage;
      uniform float uDensity;
      uniform float uOpacity;
      uniform float uScale;
      uniform vec2 uOffset;
      uniform float uHorizonFade;
      uniform float uZenithFade;
      uniform sampler2D uNoiseTexture;
      uniform vec3 uSunDirection;
      uniform vec3 uLitColor;
      uniform vec3 uShadowColor;
      varying vec3 vSkyDirection;
      void main() {
        vec3 skyDirection = normalize(vSkyDirection);
        vec2 skyUv = vec2(
          atan(skyDirection.z, skyDirection.x) / 6.2831853 + 0.5,
          asin(clamp(skyDirection.y, -1.0, 1.0)) / 3.14159265 + 0.5
        );
        vec2 drift = vec2(uTime * 0.007, uTime * 0.0025);
        vec4 broadNoise = texture2D(
          uNoiseTexture,
          skyUv * vec2(uScale * 0.42, uScale * 0.36) + uOffset + drift
        );
        vec4 detailNoise = texture2D(
          uNoiseTexture,
          skyUv * vec2(uScale * 0.92, uScale * 0.78)
            + uOffset * 0.73 - drift * 0.63
        );
        float broad = broadNoise.r * 0.62 + broadNoise.g * 0.38;
        float detail = detailNoise.b * 0.6 + detailNoise.g * 0.4;
        float field = broad * 0.8 + detail * 0.2;
        float coverage = clamp(uCoverage, 0.0, 1.0);
        float threshold = mix(0.72, 0.36, coverage);
        float softness = mix(0.18, 0.075, clamp(uDensity, 0.0, 1.0));
        float body = smoothstep(threshold, threshold + softness, field);
        float horizonMask = smoothstep(
          uHorizonFade, uHorizonFade + 0.16, skyDirection.y
        );
        float zenithMask = 1.0 - smoothstep(
          uZenithFade, min(1.0, uZenithFade + 0.1), skyDirection.y
        );
        body *= horizonMask * zenithMask;
        float sunFacing = pow(
          max(dot(skyDirection, normalize(uSunDirection)), 0.0), 3.2
        );
        float internalLight = smoothstep(threshold, threshold + 0.22, field);
        float lightMix = clamp(
          0.34 + sunFacing * 0.52 + internalLight * 0.14, 0.0, 1.0
        );
        vec3 color = mix(uShadowColor, uLitColor, lightMix);
        float brightEdge = body * (1.0 - internalLight) * sunFacing;
        color += uLitColor * brightEdge * 0.32;
        float alpha = body * uOpacity * mix(0.66, 1.0, internalLight);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    side: BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const mesh = new Mesh(new SphereGeometry(188, 64, 36), material);
  mesh.name = "celestial-cloud-sky-dome";
  mesh.renderOrder = -0.5;
  mesh.frustumCulled = false;
  return { mesh, timed: { material, speed: config.driftSpeed } };
}

function createSun(): {
  group: Group;
  core: Sprite;
  halo: Sprite;
  coreMaterial: SpriteMaterial;
  haloMaterial: SpriteMaterial;
} {
  const createTexture = (kind: "core" | "halo"): DataTexture => {
    const dimension = 192;
    const data = new Uint8Array(dimension * dimension * 4);
    for (let y = 0; y < dimension; y += 1) {
      for (let x = 0; x < dimension; x += 1) {
        const dx = x / (dimension - 1) - 0.5;
        const dy = y / (dimension - 1) - 0.5;
        const distance = Math.hypot(dx, dy) * 2;
        const edge = Math.max(0, Math.min(1, (distance - 0.78) / 0.16));
        const core = 1 - edge * edge * (3 - 2 * edge);
        const halo = Math.pow(Math.max(0, 1 - distance), 2.7);
        const alpha = kind === "core" ? core : halo;
        const index = (y * dimension + x) * 4;
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = Math.round(alpha * 255);
      }
    }
    const texture = new DataTexture(data, dimension, dimension, RGBAFormat);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };
  const coreMaterial = new SpriteMaterial({
    map: createTexture("core"),
    color: "#fff8dc",
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const haloMaterial = new SpriteMaterial({
    map: createTexture("halo"),
    color: "#f2bf78",
    transparent: true,
    opacity: 0.27,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const skyRadius = 145;
  const coreSize =
    2 *
    skyRadius *
    Math.tan(
      ((CLOUDBREAK_SKY_SUN.angularDiameterDegrees ?? 0.78) * Math.PI) / 360
    );
  const halo = new Sprite(haloMaterial);
  halo.name = "celestial-sun-halo";
  halo.scale.set(coreSize * 2.15, coreSize * 2.15, 1);
  halo.renderOrder = 0;
  halo.frustumCulled = false;
  const core = new Sprite(coreMaterial);
  core.name = "celestial-sun-core";
  core.scale.set(coreSize, coreSize, 1);
  core.renderOrder = 0;
  core.frustumCulled = false;
  const group = new Group();
  group.name = "celestial-sun";
  group.add(halo, core);
  return { group, core, halo, coreMaterial, haloMaterial };
}

function createGodRays(config: CelestialGodRaysConfig): {
  mesh: Mesh;
  timed: TimedMaterial;
} | null {
  if (!config.enabled) return null;
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(config.color) },
      uIntensity: { value: config.intensity },
      uCount: { value: config.count },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uCount;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        const float sourceY = 0.53;
        float descent = clamp((sourceY - vUv.y) / sourceY, 0.0, 1.0);
        float belowSun = 1.0 - smoothstep(sourceY, sourceY + 0.035, vUv.y);
        float beams = 0.0;
        for (float i = 0.0; i < 8.0; i++) {
          if (i >= uCount) break;
          float fan = (hash(i * 127.1) - 0.5) * 1.35;
          float drift = sin(uTime * 0.28 + i * 2.1) * 0.015;
          float center = 0.5 + fan * descent + drift * descent;
          float width = 0.035 + descent * (0.085 + hash(i * 311.7) * 0.055);
          float beam = smoothstep(width, 0.0, abs(vUv.x - center));
          beam *= (0.32 + hash(i * 197.3) * 0.28);
          beams += beam;
        }
        float vFade = smoothstep(0.0, 0.12, vUv.y) * belowSun;
        float noise = fract(
          sin(dot(vUv * 32.0 + uTime * 0.06, vec2(12.9898, 78.233))) * 43758.5453
        );
        beams *= (0.9 + noise * 0.1);
        float alpha = beams * vFade * uIntensity;
        gl_FragColor = vec4(uColor * 1.5, alpha);
      }
    `,
    side: DoubleSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(38, 28, 1, 1), material);
  mesh.name = "celestial-god-rays";
  mesh.position.set(0, 5, -25);
  mesh.renderOrder = -1;
  return { mesh, timed: { material, speed: config.speed } };
}

function deterministicRandom(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function cloudNoise2d(
  u: number,
  v: number,
  scale: number,
  seed: number
): number {
  const x = u * scale;
  const y = v * scale;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(0, 1, x - x0);
  const ty = smoothstep(0, 1, y - y0);
  const sample = (sampleX: number, sampleY: number) =>
    deterministicRandom(seed + sampleX * 127.1 + sampleY * 311.7);
  const lower = sample(x0, y0) * (1 - tx) + sample(x0 + 1, y0) * tx;
  const upper = sample(x0, y0 + 1) * (1 - tx) + sample(x0 + 1, y0 + 1) * tx;
  return lower * (1 - ty) + upper * ty;
}

function createCloudSpriteTexture(seed: number): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const lobes = Array.from({ length: 11 }, (_, index) => ({
    x: 0.12 + deterministicRandom(seed + index * 7 + 1) * 0.76,
    y: 0.25 + deterministicRandom(seed + index * 7 + 2) * 0.48,
    radiusX: 0.14 + deterministicRandom(seed + index * 7 + 3) * 0.22,
    radiusY: 0.11 + deterministicRandom(seed + index * 7 + 4) * 0.2,
    weight: 0.72 + deterministicRandom(seed + index * 7 + 5) * 0.42,
  }));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      let field = 0;
      for (const lobe of lobes) {
        const dx = (u - lobe.x) / lobe.radiusX;
        const dy = (v - lobe.y) / lobe.radiusY;
        field = Math.max(
          field,
          Math.exp(-(dx * dx + dy * dy) * 1.7) * lobe.weight
        );
      }
      const detail =
        cloudNoise2d(u, v, 5, seed + 19) * 0.52 +
        cloudNoise2d(u, v, 13, seed + 31) * 0.3 +
        cloudNoise2d(u, v, 31, seed + 47) * 0.18;
      const density = field * (0.72 + detail * 0.46);
      const textureEdge = Math.min(u, v, 1 - u, 1 - v);
      const alpha =
        smoothstep(0.16, 0.72, density) * smoothstep(0.015, 0.095, textureEdge);
      const verticalLight = smoothstep(0.12, 0.88, v);
      const innerDepth = smoothstep(0.25, 0.92, density);
      const edgeLight =
        smoothstep(0.08, 0.34, alpha) * (1 - smoothstep(0.42, 0.86, alpha));
      const light = Math.max(
        0,
        Math.min(
          1,
          0.34 +
            verticalLight * 0.45 +
            detail * 0.13 -
            innerDepth * (1 - verticalLight) * 0.24 +
            edgeLight * 0.28
        )
      );
      const index = (y * size + x) * 4;
      data[index] = Math.round(116 + light * 139);
      data[index + 1] = Math.round(132 + light * 122);
      data[index + 2] = Math.round(158 + light * 94);
      data[index + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createCloudBanks(
  root: Group,
  config: CloudIslandsConfig,
  count: number,
  stageWidth: number,
  stageDepth: number
): void {
  if (!config.enabled || count <= 0) return;
  const textures = [
    createCloudSpriteTexture(17),
    createCloudSpriteTexture(53),
    createCloudSpriteTexture(101),
  ];
  const materials = [
    new SpriteMaterial({
      map: textures[0],
      color: config.color,
      opacity: 0.96,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: textures[1],
      color: "#cad5e2",
      opacity: 0.88,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: textures[2],
      color: "#f1d9bd",
      opacity: 0.72,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: textures[0],
      color: "#8496b0",
      opacity: 0.78,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
  ];
  const guides = [
    ...coordinateManifest.distantMesas.map((mesa) => ({
      position: [mesa.position[0], mesa.cloudBaseY + 1.2, mesa.position[2]] as [
        number,
        number,
        number,
      ],
      width: mesa.width * 1.72,
      depthWidth: Math.max(5.4, mesa.width * 0.62),
      height: 3.4,
      puffCount: Math.max(8, Math.round(mesa.width * 0.82)),
    })),
    {
      position: [-46, -4, -92] as [number, number, number],
      width: 34,
      depthWidth: 12,
      height: 7,
      puffCount: 14,
    },
    {
      position: [48, -4.5, -98] as [number, number, number],
      width: 36,
      depthWidth: 13,
      height: 7,
      puffCount: 15,
    },
    {
      position: [0, -8, -108] as [number, number, number],
      width: 44,
      depthWidth: 10,
      height: 4,
      puffCount: 16,
    },
  ];
  const addPuff = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    material: SpriteMaterial
  ) => {
    const sprite = new Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(width, height, 1);
    sprite.renderOrder = 1;
    root.add(sprite);
  };
  const protectedRadius = Math.hypot(stageWidth, stageDepth) / 2;
  const ringRadius = Math.max(config.spawnRadius, protectedRadius + 3.6);
  for (let cluster = 0; cluster < count; cluster += 1) {
    const angle =
      (cluster / count) * Math.PI * 2 + deterministicRandom(cluster + 2) * 0.24;
    const radius =
      ringRadius * (0.82 + deterministicRandom(cluster + 11) * 0.24);
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius - 1.4;
    const baseSize =
      config.sizeRange[0] +
      deterministicRandom(cluster + 31) *
        (config.sizeRange[1] - config.sizeRange[0]);
    const depthFade = Math.max(0.65, Math.min(1.18, (22 - centerZ) / 22));
    for (let lobe = 0; lobe < 4; lobe += 1) {
      const seed = cluster * 7 + lobe;
      const width =
        baseSize * depthFade * (1.05 + deterministicRandom(seed + 43) * 0.62);
      addPuff(
        centerX +
          (lobe - 1.5) * baseSize * 0.68 +
          (deterministicRandom(seed + 53) - 0.5),
        -6.4 + deterministicRandom(seed + 61) * 2.1 + lobe * 0.22,
        centerZ + (deterministicRandom(seed + 71) - 0.5) * 1.8,
        width,
        width * (0.42 + deterministicRandom(seed + 83) * 0.16),
        materials[(cluster + lobe) % materials.length]!
      );
    }
  }
  for (const [guideIndex, guide] of guides.entries()) {
    const [centerX, centerY, centerZ] = guide.position;
    const baseSize = guide.width / Math.max(3.2, guide.puffCount * 0.42);
    for (let index = 0; index < guide.puffCount; index += 1) {
      const seed = 1_000 + guideIndex * 31 + index;
      const normalized =
        guide.puffCount === 1 ? 0.5 : index / (guide.puffCount - 1);
      const width =
        baseSize *
        (1.75 + deterministicRandom(seed + 17) * 0.95) *
        (guideIndex < coordinateManifest.distantMesas.length ? 0.92 : 1.08);
      addPuff(
        centerX +
          (normalized - 0.5) * guide.width +
          (deterministicRandom(seed + 29) - 0.5) * baseSize * 1.6,
        centerY + (deterministicRandom(seed + 41) - 0.38) * guide.height * 1.8,
        centerZ + (deterministicRandom(seed + 53) - 0.5) * guide.depthWidth,
        width,
        width * (0.44 + deterministicRandom(seed + 67) * 0.16),
        materials[(guideIndex + index + 1) % materials.length]!
      );
    }
  }
}

export function createCelestialAtmosphere(
  options: CelestialAtmosphereOptions
): CelestialAtmosphere {
  const object = new Group();
  object.name = "celestial-atmosphere";
  object.position.y = options.worldYOffset;
  const timed: TimedMaterial[] = [];
  const sky = createSkyGradient(options.config.sky);
  const clouds = createCelestialVolumeClouds(
    options.worldYOffset,
    options.cloudBankCount < 20 ? 16 : 28
  );
  object.add(sky.mesh, clouds);
  clouds.traverse((part) => {
    if (part instanceof Mesh)
      timed.push({ material: part.material as ShaderMaterial, speed: 1 });
  });
  const cloudDome = createCloudDome(options.config.cloudDome);
  if (cloudDome) {
    object.add(cloudDome.mesh);
    timed.push(cloudDome.timed);
  }
  const sun = createSun();
  object.add(sun.group);
  const rays = createGodRays(options.config.godRays);
  if (rays) {
    object.add(rays.mesh);
    timed.push(rays.timed);
  }
  createCloudBanks(
    object,
    options.config.cloudIslands,
    options.cloudBankCount,
    options.stageWidth,
    options.stageDepth
  );

  const particles = [options.config.motes, options.config.wisps]
    .filter((config): config is NonNullable<typeof config> => Boolean(config))
    .map((config) =>
      createRainbowParticleField({
        ...config,
        spin: config.spin ?? false,
        motionScale: options.motionScale,
        random: options.random,
      })
    );
  for (const field of particles) object.add(field.points);

  const sunDirection = new Vector3(...CLOUDBREAK_SKY_SUN.direction).normalize();
  const sunPosition = new Vector3();
  let elapsed = 0;
  let pulseEnergy = 0;
  let disposed = false;
  return {
    object,
    update(deltaSeconds, camera) {
      if (disposed) return;
      const motionDelta = deltaSeconds * options.motionScale;
      elapsed += motionDelta;
      sky.mesh.position.copy(camera.position);
      if (cloudDome) cloudDome.mesh.position.copy(camera.position);
      sunPosition.copy(camera.position).addScaledVector(sunDirection, 145);
      sun.core.position.copy(sunPosition);
      sun.halo.position.copy(sunPosition);
      pulseEnergy = Math.max(0, pulseEnergy - deltaSeconds * 0.55);
      sun.haloMaterial.opacity =
        0.26 + Math.sin(elapsed * 0.22) * 0.014 + pulseEnergy * 0.08;
      sun.coreMaterial.opacity = 0.985 + pulseEnergy * 0.015;
      for (const { material, speed } of timed) {
        material.uniforms.uTime!.value += motionDelta * speed;
      }
      for (const field of particles) field.update(deltaSeconds);
    },
    pulse() {
      pulseEnergy = 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeCelestialObjectTree(object);
    },
  };
}
