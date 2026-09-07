import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  MathUtils,
  Mesh,
  NormalBlending,
  PointLight,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Texture,
} from "three";

import type {
  EmberFountainsConfig,
  EmberPlumeConfig,
  EmberSceneConfig,
  FireWispsConfig,
  VolcanicHazeConfig,
} from "../../domain/models/scene-configs";
import type { SkyGradientConfig } from "../../domain/models/environment-models";
import {
  advancePlumePuff,
  createPlumePuff,
  plumeLitFraction,
  type PlumePuff,
} from "../../scenes/ember/ember-plume-motion";
import {
  sampleVolcanicLightning,
  volcanicLightningCell,
} from "../../scenes/ember/volcanic-lightning";
import { createRainbowParticleField } from "../rainbow/rainbow-particle-field";
import {
  COSMIC_SKY_FRAGMENT_SHADER,
  COSMIC_SKY_VERTEX_SHADER,
} from "../cosmic/cosmic-world-shaders";
import {
  EMBER_FOUNTAIN_FRAGMENT_SHADER,
  EMBER_FOUNTAIN_VERTEX_SHADER,
  EMBER_HAZE_FRAGMENT_SHADER,
  EMBER_HAZE_VERTEX_SHADER,
  EMBER_HEAT_FRAGMENT_SHADER,
  EMBER_HEAT_VERTEX_SHADER,
  EMBER_PLUME_FRAGMENT_SHADER,
  EMBER_PLUME_VERTEX_SHADER,
  EMBER_WISP_FRAGMENT_SHADER,
  EMBER_WISP_VERTEX_SHADER,
} from "./ember-shaders";
import type { EmberWorldElement } from "./ember-lava-features";

export interface EmberAtmosphereElement extends EmberWorldElement {
  update(deltaSeconds: number, elapsedSeconds: number, camera?: Camera): void;
}

function horizonBearing(config: SkyGradientConfig["horizonGlow"]): Vector2 {
  const [x, , z] = config?.direction ?? [0, 0, -1];
  const bearing = new Vector2(x, z);
  return bearing.lengthSq() > 0 ? bearing.normalize() : new Vector2(0, -1);
}

/** Exact no-moon production SkyGradient path used by Ember. */
export function createEmberSky(
  config: SkyGradientConfig,
  moonTexture: Texture
): EmberAtmosphereElement {
  const geometry = new SphereGeometry(config.radius ?? 200, 32, 32);
  const material = new ShaderMaterial({
    uniforms: {
      uTopColor: { value: new Color(config.topColor) },
      uMidColor: { value: new Color(config.midColor ?? config.topColor) },
      uBottomColor: { value: new Color(config.bottomColor) },
      uHasMid: { value: config.midColor ? 1 : 0 },
      uGradientStart: { value: 0 },
      uGradientEnd: { value: 1 },
      uMoonEnabled: { value: 0 },
      uMoonTexture: { value: moonTexture },
      uMoonDirection: { value: new Vector3(0, 0.25, -1).normalize() },
      uMoonAngularRadius: { value: MathUtils.degToRad(0.52 * 0.5) },
      uMoonOpacity: { value: 1 },
      uMoonGlowScale: { value: 1.12 },
      uMoonGlowOpacity: { value: 0.025 },
      uMoonSurfaceLift: { value: 0 },
      uMoonHorizonWarmth: { value: 1 },
      uSunEnabled: { value: 0 },
      uSunDirection: { value: new Vector3(0, 0.5, -1).normalize() },
      uSunAngularRadius: { value: MathUtils.degToRad(0.53 * 0.5) },
      uSunColor: { value: new Color("#fff4d2") },
      uSunOpacity: { value: 1 },
      uSunGlowScale: { value: 6 },
      uSunGlowOpacity: { value: 0.12 },
      uHorizonGlowColor: {
        value: new Color(config.horizonGlow?.color ?? "#000000"),
      },
      uHorizonGlowBearing: { value: horizonBearing(config.horizonGlow) },
      uHorizonGlowHeight: { value: config.horizonGlow?.height ?? 0.2 },
      uHorizonGlowSpread: { value: config.horizonGlow?.spread ?? 0.5 },
      uHorizonGlowIntensity: {
        value: config.horizonGlow?.intensity ?? 0,
      },
    },
    vertexShader: COSMIC_SKY_VERTEX_SHADER,
    fragmentShader: COSMIC_SKY_FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = "EmberSkyGradient";
  object.renderOrder = -1;
  object.frustumCulled = false;
  return {
    object,
    update(_delta, _elapsed, camera) {
      if (camera) object.position.copy(camera.position);
    },
    setGroundY() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createEmberHeatDistortion(options: {
  position: { x: number; z: number };
  radius: number;
  height?: number;
  intensity?: number;
  groundY: number;
}): EmberAtmosphereElement {
  const height = options.height ?? 6;
  const geometry = new CylinderGeometry(
    options.radius * 0.8,
    options.radius * 0.25,
    height,
    32,
    24,
    true
  );
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: options.intensity ?? 0.06 },
    },
    vertexShader: EMBER_HEAT_VERTEX_SHADER,
    fragmentShader: EMBER_HEAT_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
  });
  const object = new Mesh(geometry, material);
  object.name = "EmberHeatDistortion";
  object.position.set(
    options.position.x,
    options.groundY + height / 2 + 1,
    options.position.z
  );
  return {
    object,
    update(deltaSeconds) {
      material.uniforms.uTime!.value += deltaSeconds;
    },
    setGroundY(value) {
      object.position.y = value + height / 2 + 1;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function hazeBearing(config: VolcanicHazeConfig): Vector2 {
  const [x, , z] = config.underglowDirection ?? [0, 0, 1];
  const bearing = new Vector2(x, z);
  return bearing.lengthSq() > 0 ? bearing.normalize() : new Vector2(0, 1);
}

export function createEmberVolcanicHaze(
  config: VolcanicHazeConfig | null
): EmberAtmosphereElement | null {
  if (!config?.enabled) return null;
  const geometry = new SphereGeometry(config.radius, 32, 24);
  const material = new ShaderMaterial({
    uniforms: {
      uColor1: { value: new Color(config.color1) },
      uColor2: { value: new Color(config.color2) },
      uOpacity: { value: config.opacity },
      uScale: { value: config.scale },
      uTime: { value: 0 },
      uFlashEnergy: { value: 0 },
      uFlashCell: { value: new Vector3() },
      uLightningIntensity: { value: config.lightningIntensity },
      uInnerGlowColor: { value: new Color(config.innerGlowColor) },
      uUnderglowColor: {
        value: new Color(config.underglowColor ?? config.innerGlowColor),
      },
      uUnderglowBearing: { value: hazeBearing(config) },
      uUnderglowStrength: { value: config.underglowStrength ?? 0 },
      uUnderglowFocus: { value: config.underglowFocus ?? 3.4 },
      uUnderglowWrap: { value: config.underglowWrap ?? 0 },
    },
    vertexShader: EMBER_HAZE_VERTEX_SHADER,
    fragmentShader: EMBER_HAZE_FRAGMENT_SHADER,
    side: BackSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.name = "EmberVolcanicHaze";
  object.renderOrder = -0.5;
  object.frustumCulled = false;
  let driftTime = 0;
  let flashTime = 0;
  return {
    object,
    update(deltaSeconds, _elapsed, camera) {
      driftTime += deltaSeconds * config.animationSpeed;
      flashTime += deltaSeconds;
      material.uniforms.uTime!.value = driftTime;
      const flash = sampleVolcanicLightning(
        flashTime,
        config.lightningInterval
      );
      material.uniforms.uFlashEnergy!.value = flash.energy;
      if (flash.energy > 0) {
        (material.uniforms.uFlashCell!.value as Vector3).set(
          ...volcanicLightningCell(flash.cycle)
        );
      }
      if (camera) object.position.copy(camera.position);
    },
    setGroundY() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

interface WispState {
  group: Group;
  head: Mesh;
  trails: Mesh[];
  light: PointLight;
  baseX: number;
  baseY: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  previous: Vector3[];
  phase: number;
  driftPhase: number;
  baseScale: number;
}

export function createEmberFireWisps(
  config: FireWispsConfig | null,
  groundY: number
): EmberAtmosphereElement | null {
  if (!config?.enabled) return null;
  const root = new Group();
  root.name = "EmberFireWisps";
  const geometry = new SphereGeometry(0.15, 16, 12);
  const materials = config.colors.map(
    (color) =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: 3 },
        },
        vertexShader: EMBER_WISP_VERTEX_SHADER,
        fragmentShader: EMBER_WISP_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      })
  );
  const trailScales = [0.6, 0.35, 0.15];
  const states: WispState[] = Array.from(
    { length: config.count },
    (_, index) => {
      const angle = (index / config.count) * Math.PI * 2 + index * 0.7;
      const radius = config.spawnRadius * (0.4 + Math.sin(index * 2.7) * 0.3);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y =
        config.heightRange[0] +
        ((index + 0.5) / config.count) *
          (config.heightRange[1] - config.heightRange[0]);
      const material = materials[index % materials.length]!;
      const group = new Group();
      group.name = `EmberFireWisp-${index}`;
      group.position.set(x, groundY + y, z);
      const head = new Mesh(geometry, material);
      const light = new PointLight(
        config.colors[index % config.colors.length],
        config.lightIntensity,
        config.lightDistance,
        2
      );
      group.add(head, light);
      const trails = trailScales.map((scale, trailIndex) => {
        const trail = new Mesh(geometry, material);
        trail.name = `EmberFireWispTrail-${index}-${trailIndex}`;
        trail.position.set(x, groundY + y, z);
        trail.scale.setScalar(scale);
        root.add(trail);
        return trail;
      });
      root.add(group);
      return {
        group,
        head,
        trails,
        light,
        baseX: x,
        baseY: y,
        baseZ: z,
        x,
        y,
        z,
        previous: [
          new Vector3(x, y, z),
          new Vector3(x, y, z),
          new Vector3(x, y, z),
        ],
        phase: index * 1.3,
        driftPhase: index * 2.7,
        baseScale: 0.8 + Math.sin(index * 3.1) * 0.4,
      };
    }
  );
  let currentGroundY = groundY;
  return {
    object: root,
    update(deltaSeconds) {
      const time = performance.now() * 0.001;
      for (const [index, state] of states.entries()) {
        for (
          let trailIndex = state.previous.length - 1;
          trailIndex > 0;
          trailIndex -= 1
        ) {
          state.previous[trailIndex]!.copy(state.previous[trailIndex - 1]!);
        }
        state.previous[0]!.set(state.x, state.y, state.z);
        state.driftPhase += deltaSeconds * config.driftSpeed;
        state.x =
          state.baseX +
          Math.sin(state.driftPhase * 0.7 + state.phase) * 2 +
          Math.cos(state.driftPhase * 0.3 + state.phase * 1.5) * 0.8;
        state.y =
          state.baseY +
          Math.sin(state.driftPhase * 0.4 + state.phase * 1.3) * 0.8;
        state.z =
          state.baseZ +
          Math.cos(state.driftPhase * 0.5 + state.phase * 0.8) * 2 +
          Math.sin(state.driftPhase * 0.25 + state.phase * 1.7) * 0.6;
        const pulse =
          0.5 +
          0.3 * Math.sin(time * config.pulseSpeed * Math.PI * 2 + state.phase) +
          0.2 * Math.sin(time * config.pulseSpeed * 1.7 + state.phase * 2.3);
        const scale = state.baseScale * (0.7 + pulse * 0.5);
        state.group.position.set(state.x, currentGroundY + state.y, state.z);
        state.head.scale.setScalar(scale);
        state.light.intensity = config.lightIntensity * pulse;
        for (const [trailIndex, trail] of state.trails.entries()) {
          const point = state.previous[trailIndex]!;
          trail.position.set(point.x, currentGroundY + point.y, point.z);
          trail.scale.setScalar(scale * (trailScales[trailIndex] ?? 0.15));
        }
      }
    },
    setGroundY(value) {
      currentGroundY = value;
    },
    dispose() {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      root.clear();
    },
  };
}

interface FountainParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  colorIndex: number;
  life: number;
  maxLife: number;
}

export function createEmberFountains(
  config: EmberFountainsConfig | null,
  pool: EmberSceneConfig["lavaPool"],
  groundY: number,
  random: () => number
): EmberAtmosphereElement | null {
  if (!config?.enabled) return null;
  const spawn = (burst: boolean): FountainParticle => {
    const angle = random() * Math.PI * 2;
    const spreadRadius = random() * config.spawnRadius * 0.3;
    const speed = burst ? 1.5 + random() * 0.5 : 0.6 + random() * 0.8;
    const lateral = burst ? 0.8 : 0.3;
    return {
      x: Math.cos(angle) * spreadRadius,
      y: 0,
      z: Math.sin(angle) * spreadRadius,
      vx: Math.cos(angle) * lateral * (random() * 0.5 + 0.5),
      vy: config.riseSpeed * speed,
      vz: Math.sin(angle) * lateral * (random() * 0.5 + 0.5),
      size:
        config.sizeRange[0] +
        random() * (config.sizeRange[1] - config.sizeRange[0]),
      colorIndex: Math.floor(random() * config.colors.length),
      life: 0,
      maxLife: (config.maxHeight / (config.riseSpeed * speed)) * 1.5,
    };
  };
  const particles = Array.from({ length: config.count }, () => {
    const particle = spawn(false);
    particle.life = random() * particle.maxLife;
    particle.x += particle.vx * particle.life;
    particle.y +=
      particle.vy * particle.life -
      0.5 * config.gravity * particle.life * particle.life;
    particle.z += particle.vz * particle.life;
    particle.vy -= config.gravity * particle.life;
    return particle;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(config.count * 3), 3)
  );
  geometry.setAttribute(
    "aSize",
    new Float32BufferAttribute(new Float32Array(config.count), 1)
  );
  geometry.setAttribute(
    "aAlpha",
    new Float32BufferAttribute(new Float32Array(config.count), 1)
  );
  geometry.setAttribute(
    "aColorIndex",
    new Float32BufferAttribute(new Float32Array(config.count), 1)
  );
  const colors = config.colors.slice(0, 4).map((color) => new Color(color));
  while (colors.length < 4) colors.push(colors[0] ?? new Color("#ff4400"));
  const material = new ShaderMaterial({
    uniforms: { uColors: { value: colors } },
    vertexShader: EMBER_FOUNTAIN_VERTEX_SHADER,
    fragmentShader: EMBER_FOUNTAIN_FRAGMENT_SHADER,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const object = new Points(geometry, material);
  object.name = "EmberFountains";
  object.frustumCulled = false;
  object.position.set(
    pool.position.x,
    groundY - (pool.craterDepth ?? 0),
    pool.position.z
  );
  let burstTimer = 0;
  return {
    object,
    update(deltaSeconds) {
      const position = geometry.getAttribute("position");
      const size = geometry.getAttribute("aSize");
      const alpha = geometry.getAttribute("aAlpha");
      const color = geometry.getAttribute("aColorIndex");
      burstTimer += deltaSeconds;
      if (burstTimer >= config.burstInterval) {
        burstTimer -= config.burstInterval;
        for (
          let index = 0;
          index < config.burstCount && index < particles.length;
          index += 1
        ) {
          Object.assign(
            particles[Math.floor(random() * particles.length)]!,
            spawn(true)
          );
        }
      }
      for (const [index, particle] of particles.entries()) {
        particle.vy -= config.gravity * deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.z += particle.vz * deltaSeconds;
        particle.life += deltaSeconds;
        const life = particle.life / particle.maxLife;
        if (particle.y < -0.5 || particle.life > particle.maxLife) {
          Object.assign(particle, spawn(false));
          continue;
        }
        position.setXYZ(index, particle.x, particle.y, particle.z);
        size.setX(index, particle.size * (1 - life * 0.4));
        alpha.setX(
          index,
          Math.min(life * 5, 1) * (1 - Math.pow(Math.max(life - 0.5, 0) * 2, 2))
        );
        color.setX(index, particle.colorIndex);
      }
      position.needsUpdate = true;
      size.needsUpdate = true;
      alpha.needsUpdate = true;
      color.needsUpdate = true;
      geometry.computeBoundingSphere();
    },
    setGroundY(value) {
      object.position.y = value - (pool.craterDepth ?? 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

interface PlumeRuntime {
  spec: EmberPlumeConfig;
  origin: [number, number, number];
  lit: Color;
  ash: Color;
  puffs: PlumePuff[];
  offset: number;
}

export function createEmberPlumes(options: {
  plumes: EmberPlumeConfig[];
  groundY: number;
  fogColor: string;
  fogDensity: number;
  motionScale: number;
  random?: () => number;
}): EmberAtmosphereElement | null {
  const total = options.plumes.reduce((sum, plume) => sum + plume.count, 0);
  if (total <= 0) return null;
  const random = options.random ?? Math.random;
  const runtimes: PlumeRuntime[] = [];
  let offset = 0;
  for (const spec of options.plumes) {
    const puffs = Array.from({ length: spec.count }, () => {
      const puff = createPlumePuff(spec, random);
      const steps = 12;
      const dt = (random() * 0.85 * puff.maxAge) / steps;
      for (let step = 0; step < steps; step += 1) {
        advancePlumePuff(puff, dt, spec);
      }
      return puff;
    });
    runtimes.push({
      spec,
      origin: spec.position,
      lit: new Color(spec.litColor),
      ash: new Color(spec.ashColor),
      puffs,
      offset,
    });
    offset += spec.count;
  }

  const geometry = new BufferGeometry();
  for (const [name, size] of [
    ["position", 3],
    ["puffColor", 3],
    ["size", 1],
    ["alpha", 1],
    ["rotation", 1],
    ["seed", 1],
  ] as const) {
    geometry.setAttribute(
      name,
      new Float32BufferAttribute(new Float32Array(total * size), size)
    );
  }
  const material = new ShaderMaterial({
    uniforms: {
      uMinPointSize: { value: 1 },
      uMaxPointSize: { value: 512 },
      uFogColor: { value: new Color(options.fogColor) },
      uFogDensity: { value: options.fogDensity },
    },
    vertexShader: EMBER_PLUME_VERTEX_SHADER,
    fragmentShader: EMBER_PLUME_FRAGMENT_SHADER,
    blending: NormalBlending,
    depthWrite: false,
    transparent: true,
  });
  const object = new Points(geometry, material);
  object.name = "EmberPlumes";
  object.frustumCulled = false;
  const scratch = new Color();
  let groundY = options.groundY;

  return {
    object,
    update(rawDelta) {
      const position = geometry.getAttribute("position");
      const color = geometry.getAttribute("puffColor");
      const size = geometry.getAttribute("size");
      const alpha = geometry.getAttribute("alpha");
      const rotation = geometry.getAttribute("rotation");
      const seed = geometry.getAttribute("seed");
      for (const runtime of runtimes) {
        const delta = rawDelta * options.motionScale * runtime.spec.motionScale;
        for (let index = 0; index < runtime.puffs.length; index += 1) {
          const puff = runtime.puffs[index]!;
          let sample = advancePlumePuff(puff, delta, runtime.spec);
          if (!sample) {
            Object.assign(puff, createPlumePuff(runtime.spec, random));
            sample = advancePlumePuff(puff, delta, runtime.spec);
            if (!sample) continue;
          }
          const target = runtime.offset + index;
          position.setXYZ(
            target,
            runtime.origin[0] + puff.x,
            groundY +
              runtime.origin[1] -
              runtime.spec.area.height * 0.4 +
              puff.y,
            runtime.origin[2] + puff.z
          );
          scratch
            .copy(runtime.ash)
            .lerp(runtime.lit, plumeLitFraction(sample.rise));
          color.setXYZ(target, scratch.r, scratch.g, scratch.b);
          size.setX(target, sample.size);
          alpha.setX(target, sample.alpha * runtime.spec.opacity);
          rotation.setX(target, puff.rotation);
          seed.setX(target, puff.seed);
        }
      }
      for (const attribute of [position, color, size, alpha, rotation, seed]) {
        attribute.needsUpdate = true;
      }
    },
    setGroundY(value) {
      groundY = value;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createEmberParticleFields(options: {
  config: EmberSceneConfig;
  motionScale: number;
  random?: () => number;
}): Array<{
  object: Points;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}> {
  const fields = [
    ["EmberParticles", options.config.embers],
    ["EmberAsh", options.config.ash],
    ["EmberSmoke", options.config.smoke],
    ["EmberCinders", options.config.cinders],
  ] as const;
  return fields.flatMap(([name, config]) => {
    if (!config) return [];
    const field = createRainbowParticleField({
      ...config,
      spin: config.spin ?? false,
      motionScale: options.motionScale,
      random: options.random,
    });
    field.points.name = name;
    return [
      {
        object: field.points,
        update: field.update,
        setGroundY() {},
        dispose: field.dispose,
      },
    ];
  });
}
