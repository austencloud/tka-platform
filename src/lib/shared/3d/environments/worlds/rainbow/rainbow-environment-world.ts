import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Camera,
  type Material,
} from "three";
import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";
import {
  createDefaultRainbowConfig,
  type RainbowSceneConfig,
} from "../../domain/models/scene-configs";
import {
  createRainbowParticleField,
  type RainbowParticleField,
} from "./rainbow-particle-field";
import {
  ACCENT_FRAGMENT_SHADER,
  AURORA_FRAGMENT_SHADER,
  AURORA_VERTEX_SHADER,
  GROUND_FRAGMENT_SHADER,
  PRISM_FRAGMENT_SHADER,
  PRISM_VERTEX_SHADER,
  SHAFT_FRAGMENT_SHADER,
  SHAFT_VERTEX_SHADER,
  SKY_FRAGMENT_SHADER,
  SKY_VERTEX_SHADER,
  WORLD_VERTEX_SHADER,
} from "./rainbow-world-shaders";

export interface RainbowEnvironmentWorldOptions {
  config?: RainbowSceneConfig;
  groundY: number;
  stageRadius?: number;
  stageRadiusGrowth?: number;
  motionScale?: number;
  random?: () => number;
}

export interface RainbowEnvironmentWorld {
  root: Group;
  fog: FogExp2;
  update(deltaSeconds: number, elapsedSeconds: number, camera: Camera): void;
  dispose(): void;
}

interface PrismaticOrb {
  group: Group;
  baseY: number;
  baseX: number;
  baseZ: number;
  speed: number;
  phase: number;
  bobAmplitude: number;
  driftRadius: number;
}

interface LightShaftConfig {
  angle: number;
  color: string;
  height: number;
  radius: number;
  topRadius: number;
}

const RING_COLORS = [
  "#ff1744",
  "#ff9100",
  "#ffea00",
  "#00e676",
  "#2979ff",
  "#651fff",
  "#d500f9",
] as const;

const ORB_CONFIGS = [
  { color: "#ff4466", angle: 0.3, radius: 6, height: 2.8, scale: 0.18 },
  { color: "#ffaa22", angle: 1.1, radius: 7.5, height: 3.5, scale: 0.22 },
  { color: "#44ff66", angle: 2.0, radius: 5.5, height: 1.8, scale: 0.15 },
  { color: "#4488ff", angle: 2.9, radius: 8, height: 4.2, scale: 0.2 },
  { color: "#aa44ff", angle: 3.7, radius: 6.5, height: 2.2, scale: 0.16 },
  { color: "#ff44aa", angle: 4.5, radius: 7, height: 3.0, scale: 0.19 },
  { color: "#ffee44", angle: 5.3, radius: 5.8, height: 3.8, scale: 0.14 },
] as const;

const LIGHT_SHAFTS: readonly LightShaftConfig[] = [
  { angle: 0.4, color: "#ff2255", height: 12, radius: 0.3, topRadius: 1.2 },
  { angle: 1.6, color: "#ffcc00", height: 14, radius: 0.25, topRadius: 1.0 },
  { angle: 2.8, color: "#00dd66", height: 11, radius: 0.28, topRadius: 1.1 },
  { angle: 4.0, color: "#3366ff", height: 13, radius: 0.22, topRadius: 0.9 },
  { angle: 5.2, color: "#9933ff", height: 12, radius: 0.26, topRadius: 1.0 },
] as const;

const RAINBOW_LIGHTS = [
  { color: "#ff3333", angle: Math.PI / 8 },
  { color: "#ffdd00", angle: (Math.PI * 3) / 8 },
  { color: "#00cc66", angle: (Math.PI * 5) / 8 },
  { color: "#6633ff", angle: (Math.PI * 7) / 8 },
] as const;

function timeMaterial(
  vertexShader: string,
  fragmentShader: string,
  options: ConstructorParameters<typeof ShaderMaterial>[0] = {}
): ShaderMaterial {
  return new ShaderMaterial({
    ...options,
    uniforms: { uTime: { value: 0 }, ...options.uniforms },
    vertexShader,
    fragmentShader,
  });
}

function addPointLight(
  root: Group,
  color: string,
  intensity: number,
  distance: number,
  decay: number,
  position: readonly [number, number, number]
): PointLight {
  const light = new PointLight(color, intensity, distance, decay);
  light.position.set(...position);
  root.add(light);
  return light;
}

export function createRainbowEnvironmentWorld(
  options: RainbowEnvironmentWorldOptions
): RainbowEnvironmentWorld {
  const root = new Group();
  root.name = "rainbow-environment-world";
  const fog = new FogExp2("#08001a", 0.008);
  const config = options.config ?? createDefaultRainbowConfig();
  const stageRadius = resolveCircularStageRadius(
    options.stageRadius ?? 3,
    config.platform.radius,
    undefined,
    options.stageRadiusGrowth ?? 0
  );
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const particleFields: RainbowParticleField[] = [];
  const animatedMaterials: ShaderMaterial[] = [];
  const prismaticOrbs: PrismaticOrb[] = [];

  function geometry<T extends BufferGeometry>(value: T): T {
    geometries.add(value);
    return value;
  }

  function material<T extends Material>(value: T): T {
    materials.add(value);
    return value;
  }

  function animated(value: ShaderMaterial): ShaderMaterial {
    animatedMaterials.push(value);
    return material(value);
  }

  const sky = new Mesh(
    geometry(new SphereGeometry(200, 32, 32)),
    material(
      new ShaderMaterial({
        uniforms: {
          uTopColor: { value: new Color("#050012") },
          uMidColor: { value: new Color("#0e0028") },
          uBottomColor: { value: new Color("#08001a") },
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
      })
    )
  );
  sky.name = "rainbow-sky-gradient";
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  root.add(sky);

  const aurora = new Mesh(
    geometry(new SphereGeometry(70, 48, 48)),
    animated(
      timeMaterial(AURORA_VERTEX_SHADER, AURORA_FRAGMENT_SHADER, {
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  aurora.name = "rainbow-aurora-curtains";
  aurora.renderOrder = -0.5;
  aurora.frustumCulled = false;
  root.add(aurora);

  const ground = new Mesh(
    geometry(new CircleGeometry(22, 64)),
    animated(
      timeMaterial(WORLD_VERTEX_SHADER, GROUND_FRAGMENT_SHADER, {
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      })
    )
  );
  ground.name = "rainbow-caustic-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = options.groundY;
  root.add(ground);

  const accentRing = new Mesh(
    geometry(new RingGeometry(4.8, 5.3, 128)),
    animated(
      timeMaterial(WORLD_VERTEX_SHADER, ACCENT_FRAGMENT_SHADER, {
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      })
    )
  );
  accentRing.name = "rainbow-accent-ring";
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.y = options.groundY + 0.02;
  root.add(accentRing);

  const dotGeometry = geometry(new SphereGeometry(0.05, 8, 8));
  RING_COLORS.forEach((color, index) => {
    const angle = (index / RING_COLORS.length) * Math.PI * 2;
    const x = Math.cos(angle) * 5.05;
    const z = Math.sin(angle) * 5.05;
    addPointLight(root, color, 8, 6, 2, [x, options.groundY + 0.15, z]);
    const dot = new Mesh(
      dotGeometry,
      material(
        new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 3,
        })
      )
    );
    dot.position.set(x, options.groundY + 0.05, z);
    root.add(dot);
  });

  const sharedCoreGeometry = geometry(new SphereGeometry(1, 24, 24));
  const sharedGlowGeometry = geometry(new SphereGeometry(1, 16, 16));
  ORB_CONFIGS.forEach((orbConfig, index) => {
    const group = new Group();
    const core = new Mesh(
      sharedCoreGeometry,
      material(
        new MeshStandardMaterial({
          color: orbConfig.color,
          roughness: 0.08,
          metalness: 0.15,
          transparent: true,
          opacity: 0.58,
          emissive: orbConfig.color,
          emissiveIntensity: 1,
          side: DoubleSide,
        })
      )
    );
    core.scale.setScalar(orbConfig.scale);
    group.add(core);
    const glow = new Mesh(
      sharedGlowGeometry,
      material(
        new MeshStandardMaterial({
          color: orbConfig.color,
          transparent: true,
          opacity: 0.12,
          emissive: orbConfig.color,
          emissiveIntensity: 1.2,
          side: BackSide,
          depthWrite: false,
        })
      )
    );
    glow.scale.setScalar(orbConfig.scale * 2.2);
    group.add(glow);
    group.add(new PointLight(orbConfig.color, 12, 8, 2));
    const baseX = Math.cos(orbConfig.angle) * orbConfig.radius;
    const baseZ = Math.sin(orbConfig.angle) * orbConfig.radius;
    group.position.set(baseX, orbConfig.height, baseZ);
    root.add(group);
    prismaticOrbs.push({
      group,
      baseX,
      baseZ,
      baseY: orbConfig.height,
      speed: 0.15 + index * 0.04,
      phase: index * 1.3,
      bobAmplitude: 0.4 + index * 0.08,
      driftRadius: 0.6 + index * 0.1,
    });
  });

  LIGHT_SHAFTS.forEach((shaft) => {
    const shaftMaterial = animated(
      timeMaterial(SHAFT_VERTEX_SHADER, SHAFT_FRAGMENT_SHADER, {
        uniforms: { uColor: { value: new Color(shaft.color) } },
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      })
    );
    const mesh = new Mesh(
      geometry(
        new CylinderGeometry(
          shaft.topRadius,
          shaft.radius,
          shaft.height,
          12,
          1,
          true
        )
      ),
      shaftMaterial
    );
    mesh.position.set(
      Math.cos(shaft.angle) * 8,
      options.groundY + shaft.height / 2,
      Math.sin(shaft.angle) * 8 - 2
    );
    root.add(mesh);
  });

  RAINBOW_LIGHTS.forEach((light) => {
    addPointLight(root, light.color, 22, 20, 1.6, [
      Math.cos(light.angle) * 7,
      options.groundY + 3.5,
      -3 - Math.sin(light.angle) * 3,
    ]);
  });

  root.add(new HemisphereLight("#3a1870", "#0c0620", 0.65));
  const coldFill = new DirectionalLight("#6644aa", 0.5);
  coldFill.position.set(-15, 20, 10);
  root.add(coldFill);
  const warmFill = new DirectionalLight("#ff6644", 0.25);
  warmFill.position.set(10, -5, -8);
  root.add(warmFill);

  const particleOptions = [
    {
      type: "fireflies" as const,
      count: 80,
      area: { width: 10, height: 5, depth: 10 },
      speed: 0.005,
      colors: ["#ff4466", "#ffaa22", "#44ff66", "#4488ff"],
      sizeRange: [0.1, 0.26] as const,
    },
    {
      type: "embers" as const,
      count: 60,
      area: { width: 8, height: 5, depth: 8 },
      speed: 0.06,
      colors: [
        "#ff2255",
        "#ff8800",
        "#ffee00",
        "#00cc55",
        "#4466ff",
        "#aa44ff",
      ],
      sizeRange: [0.015, 0.05] as const,
    },
    {
      type: "stars" as const,
      count: 180,
      area: { width: 30, height: 15, depth: 30 },
      speed: 0.004,
      colors: ["#ff6688", "#ffcc44", "#44ffaa", "#8866ff", "#ff44cc"],
      sizeRange: [0.012, 0.06] as const,
    },
    {
      type: "dust" as const,
      count: 100,
      area: { width: 14, height: 3, depth: 14 },
      speed: 0.008,
      colors: ["#ff88aa", "#ffdd66", "#88ffcc", "#aabbff"],
      sizeRange: [0.008, 0.025] as const,
    },
  ];

  particleOptions.forEach((particleOptionsForField) => {
    const field = createRainbowParticleField({
      ...particleOptionsForField,
      spin: false,
      motionScale: options.motionScale,
      random: options.random,
    });
    particleFields.push(field);
    root.add(field.points);
  });

  if (config.platform.enabled) {
    const body = new Mesh(
      geometry(
        new CylinderGeometry(
          stageRadius,
          stageRadius,
          config.platform.height,
          64,
          1,
          true
        )
      ),
      material(
        new MeshStandardMaterial({
          color: "#f6efff",
          roughness: 0.12,
          metalness: 0.12,
          transparent: true,
          opacity: 0.38,
          emissive: "#35135c",
          emissiveIntensity: 0.22,
          side: DoubleSide,
        })
      )
    );
    body.position.y = options.groundY + config.platform.height / 2;
    root.add(body);
    const platformMaterial = animated(
      timeMaterial(PRISM_VERTEX_SHADER, PRISM_FRAGMENT_SHADER, {
        uniforms: {
          uGlowIntensity: { value: config.platform.glowIntensity },
          uSpectrumSpeed: { value: config.platform.spectrumSpeed },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      })
    );
    const top = new Mesh(
      geometry(new CircleGeometry(stageRadius, 128)),
      platformMaterial
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = options.groundY + config.platform.height;
    root.add(top);
  }

  let disposed = false;
  let localElapsed = 0;
  return {
    root,
    fog,
    update(deltaSeconds, _elapsedSeconds, camera) {
      if (disposed) return;
      localElapsed += deltaSeconds;
      sky.position.copy(camera.position);
      for (const shader of animatedMaterials) {
        const time = shader.uniforms.uTime;
        if (time) time.value = localElapsed;
      }
      for (const field of particleFields) field.update(deltaSeconds);
      for (const orb of prismaticOrbs) {
        const time = localElapsed * orb.speed + orb.phase;
        orb.group.position.set(
          orb.baseX + Math.sin(time * 0.7) * orb.driftRadius,
          orb.baseY + Math.sin(time) * orb.bobAmplitude,
          orb.baseZ + Math.cos(time * 0.5) * orb.driftRadius
        );
        orb.group.rotation.y = time * 0.3;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const field of particleFields) field.dispose();
      for (const value of geometries) value.dispose();
      for (const value of materials) value.dispose();
      root.clear();
    },
  };
}
