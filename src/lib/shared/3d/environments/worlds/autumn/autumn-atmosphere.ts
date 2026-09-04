import {
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  AdditiveBlending,
  type Camera,
  type Texture,
} from "three";

import type {
  MoonConfig,
  StarfieldConfig,
} from "../../domain/models/scene-configs";
import type { SkyGradientConfig } from "../../domain/models/environment-models";
import {
  allocateAutumnCanopyLeaves,
  allocateAutumnFireflies,
  AUTUMN_FIREFLY_CLUSTERS,
  AUTUMN_LEAF_EMITTERS,
} from "../../scenes/autumn/runtime/atmosphere/autumn-ground-life-layout";
import type { AutumnQualityConfig } from "../../scenes/autumn/quality/autumn-quality";
import { createRainbowParticleField } from "../rainbow/rainbow-particle-field";
import {
  COSMIC_SKY_FRAGMENT_SHADER,
  COSMIC_SKY_VERTEX_SHADER,
  COSMIC_STARFIELD_FRAGMENT_SHADER,
  COSMIC_STARFIELD_VERTEX_SHADER,
} from "../cosmic/cosmic-world-shaders";

export interface AutumnSky {
  object: Mesh<SphereGeometry, ShaderMaterial>;
  update(camera: Camera): void;
  setColors(sky: SkyGradientConfig): void;
  dispose(): void;
}

export interface AutumnStarfield {
  object: Points<BufferGeometry, ShaderMaterial>;
  update(deltaSeconds: number): void;
  setConfig(config: StarfieldConfig): void;
  setMotionScale(scale: number): void;
  dispose(): void;
}

export interface AutumnParticleLayers {
  object: Group;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  setMotionScale(scale: number): void;
  dispose(): void;
}

function moonDirection(config: MoonConfig): Vector3 {
  return new Vector3(
    ...(config.direction ?? config.position ?? [0, 0.25, -1])
  ).normalize();
}

function moonAngularDiameter(config: MoonConfig): number {
  if (config.angularDiameterDegrees !== undefined) {
    return config.angularDiameterDegrees;
  }
  if (config.diameter !== undefined && config.position !== undefined) {
    const distance = new Vector3(...config.position).length();
    return MathUtils.radToDeg(2 * Math.atan(config.diameter / (2 * distance)));
  }
  return 0.52;
}

/** Exact Autumn configuration of the production SkyGradient shader. */
export function createAutumnSky(
  sky: SkyGradientConfig,
  moon: MoonConfig,
  moonTexture: Texture | null
): AutumnSky {
  const geometry = new SphereGeometry(200, 32, 32);
  const top = new Color(sky.topColor);
  const bottom = new Color(sky.bottomColor);
  const material = new ShaderMaterial({
    uniforms: {
      uTopColor: { value: top },
      uMidColor: {
        value: sky.midColor
          ? new Color(sky.midColor)
          : new Color().lerpColors(top, bottom, 0.5),
      },
      uBottomColor: { value: bottom },
      uHasMid: { value: sky.midColor ? 1 : 0 },
      uGradientStart: { value: 0.56 },
      uGradientEnd: { value: 0.78 },
      uMoonEnabled: { value: moon.enabled && moonTexture ? 1 : 0 },
      uMoonTexture: { value: moonTexture },
      uMoonDirection: { value: moonDirection(moon) },
      uMoonAngularRadius: {
        value: MathUtils.degToRad(moonAngularDiameter(moon) * 0.5),
      },
      uMoonOpacity: { value: moon.opacity ?? 1 },
      uMoonGlowScale: { value: moon.glowScale ?? 1.12 },
      uMoonGlowOpacity: { value: moon.glowOpacity ?? 0.025 },
      uMoonSurfaceLift: { value: moon.surfaceLift ?? 0 },
      uMoonHorizonWarmth: { value: moon.horizonWarmth ?? 1 },
      uSunEnabled: { value: 0 },
      uSunDirection: { value: new Vector3(0, 0.5, -1).normalize() },
      uSunAngularRadius: { value: MathUtils.degToRad(0.53 * 0.5) },
      uSunColor: { value: new Color("#fff4d2") },
      uSunOpacity: { value: 1 },
      uSunGlowScale: { value: 6 },
      uSunGlowOpacity: { value: 0.12 },
      uHorizonGlowColor: { value: new Color("#000000") },
      uHorizonGlowBearing: { value: new Vector2(0, -1) },
      uHorizonGlowHeight: { value: 0.2 },
      uHorizonGlowSpread: { value: 0.5 },
      uHorizonGlowIntensity: { value: 0 },
    },
    vertexShader: COSMIC_SKY_VERTEX_SHADER,
    fragmentShader: COSMIC_SKY_FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = "autumn-sky-gradient";
  object.renderOrder = -1;
  object.frustumCulled = false;
  let disposed = false;

  return {
    object,
    update(camera) {
      if (!disposed) object.position.copy(camera.position);
    },
    setColors(nextSky) {
      if (disposed) return;
      const nextTop = new Color(nextSky.topColor);
      const nextBottom = new Color(nextSky.bottomColor);
      material.uniforms.uTopColor!.value.copy(nextTop);
      material.uniforms.uMidColor!.value.copy(
        nextSky.midColor
          ? new Color(nextSky.midColor)
          : new Color().lerpColors(nextTop, nextBottom, 0.5)
      );
      material.uniforms.uBottomColor!.value.copy(nextBottom);
      material.uniforms.uHasMid!.value = nextSky.midColor ? 1 : 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Exact renderer-neutral form of Autumn's production Starfield instance. */
export function createAutumnStarfield(
  config: StarfieldConfig,
  motionScale = 1,
  random: () => number = Math.random
): AutumnStarfield {
  const positions = new Float32Array(config.count * 3);
  const sizes = new Float32Array(config.count);
  const phases = new Float32Array(config.count);
  const brightnesses = new Float32Array(config.count);
  const magnitudeFalloff = config.magnitudeFalloff ?? 3;
  const brightnessFloor = config.brightnessFloor ?? 0.3;
  const horizonSpread = config.horizonSpread ?? 0.6;

  for (let index = 0; index < config.count; index += 1) {
    const theta = random() * Math.PI * 2;
    if (config.elevationRangeDegrees) {
      const [minimum, maximum] = config.elevationRangeDegrees;
      const elevation =
        ((minimum + random() * (maximum - minimum)) * Math.PI) / 180;
      const horizontalRadius = config.radius * Math.cos(elevation);
      positions[index * 3] = horizontalRadius * Math.cos(theta);
      positions[index * 3 + 1] = config.radius * Math.sin(elevation);
      positions[index * 3 + 2] = horizontalRadius * Math.sin(theta);
    } else {
      const phi = Math.acos(2 * random() - 1) * horizonSpread;
      const sinPhi = Math.sin(phi);
      positions[index * 3] = config.radius * sinPhi * Math.cos(theta);
      positions[index * 3 + 1] = config.radius * Math.cos(phi);
      positions[index * 3 + 2] = config.radius * sinPhi * Math.sin(theta);
    }
    const magnitude = random() ** magnitudeFalloff;
    sizes[index] =
      config.sizeRange[0] +
      magnitude * (config.sizeRange[1] - config.sizeRange[0]);
    brightnesses[index] = brightnessFloor + magnitude * (1 - brightnessFloor);
    phases[index] = random() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
  geometry.setAttribute(
    "aBrightness",
    new Float32BufferAttribute(brightnesses, 1)
  );
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkleSpeed: { value: config.twinkleSpeed },
      uIntensity: { value: config.intensity ?? 1 },
    },
    vertexShader: COSMIC_STARFIELD_VERTEX_SHADER,
    fragmentShader: COSMIC_STARFIELD_FRAGMENT_SHADER,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const object = new Points(geometry, material);
  object.name = "autumn-starfield";
  object.frustumCulled = false;
  object.visible = config.enabled;
  let elapsed = 0;
  let activeMotionScale = Math.max(0, motionScale);
  let disposed = false;

  return {
    object,
    update(deltaSeconds) {
      if (disposed || !object.visible) return;
      elapsed += deltaSeconds * activeMotionScale;
      material.uniforms.uTime!.value = elapsed;
    },
    setConfig(nextConfig) {
      if (disposed) return;
      object.visible = nextConfig.enabled;
      material.uniforms.uTwinkleSpeed!.value = nextConfig.twinkleSpeed;
      material.uniforms.uIntensity!.value = nextConfig.intensity ?? 1;
    },
    setMotionScale(scale) {
      activeMotionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createAutumnParticleLayers(options: {
  quality: AutumnQualityConfig;
  groundY: number;
  pondCenter: readonly [number, number, number];
  motionScale?: number;
  random?: () => number;
}): AutumnParticleLayers {
  const root = new Group();
  root.name = "autumn-particle-layers";
  const fields: ReturnType<typeof createRainbowParticleField>[] = [];

  const leafCounts = allocateAutumnCanopyLeaves(options.quality.leafCount);
  AUTUMN_LEAF_EMITTERS.forEach((emitter, index) => {
    const group = new Group();
    group.name = `autumn-leaves-${emitter.id}`;
    group.position.set(
      emitter.position[0],
      options.groundY + emitter.area.height * 0.5 + 0.2,
      emitter.position[1]
    );
    const field = createRainbowParticleField({
      type: "leaves",
      count: leafCounts[index] ?? 0,
      area: emitter.area,
      speed: emitter.fallSpeed,
      colors: emitter.colors,
      sizeRange: [0.07, 0.16],
      spin: true,
      opacity: 0.94,
      emissionShape: "ellipse",
      random: options.random,
    });
    group.add(field.points);
    fields.push(field);
    root.add(group);
  });

  const spores = new Group();
  spores.name = "autumn-spores";
  spores.position.y = options.groundY + 4;
  const sporeField = createRainbowParticleField({
    type: "bubbles",
    count: options.quality.sporeCount,
    area: { width: 30, height: 8, depth: 30 },
    speed: 0.03,
    colors: ["#9af9e0", "#00c8b4"],
    sizeRange: [0.008, 0.022],
    spin: false,
    random: options.random,
  });
  spores.add(sporeField.points);
  fields.push(sporeField);
  root.add(spores);

  const fireflyCounts = allocateAutumnFireflies(options.quality.fireflyCount);
  AUTUMN_FIREFLY_CLUSTERS.forEach((cluster, index) => {
    const group = new Group();
    group.name = `autumn-fireflies-${cluster.id}`;
    group.position.set(
      cluster.id === "pond" ? options.pondCenter[0] : cluster.position[0],
      options.pondCenter[1] + 1.4,
      cluster.id === "pond" ? options.pondCenter[2] : cluster.position[1]
    );
    const field = createRainbowParticleField({
      type: "fireflies",
      count: fireflyCounts[index] ?? 0,
      area: cluster.area,
      speed: 0.032,
      colors:
        cluster.id === "pond" ? ["#deff9a", "#fff1ad"] : ["#fff2a0", "#ffbe3b"],
      sizeRange: [0.12 * cluster.sizeScale, 0.24 * cluster.sizeScale],
      spin: false,
      emissionShape: "ellipse",
      random: options.random,
    });
    group.add(field.points);
    fields.push(field);
    root.add(group);
  });

  let groundY = options.groundY;
  let activeMotionScale = Math.max(0, options.motionScale ?? 1);
  let disposed = false;
  return {
    object: root,
    update(deltaSeconds) {
      if (disposed) return;
      for (const field of fields) {
        field.update(deltaSeconds * activeMotionScale);
      }
    },
    setGroundY(nextGroundY) {
      if (disposed || nextGroundY === groundY) return;
      const shift = nextGroundY - groundY;
      groundY = nextGroundY;
      for (const child of root.children) child.position.y += shift;
    },
    setMotionScale(scale) {
      activeMotionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const field of fields) field.dispose();
      root.clear();
    },
  };
}
