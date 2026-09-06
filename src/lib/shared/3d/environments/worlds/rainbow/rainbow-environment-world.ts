import {
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  type Camera,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";
import {
  createDefaultRainbowConfig,
  type RainbowSceneConfig,
} from "../../domain/models/scene-configs/rainbow-scene-config";
import { disposeSceneGraph } from "../../utils/dispose-scene";
import {
  SKY_FRAGMENT_SHADER,
  SKY_VERTEX_SHADER,
} from "./rainbow-world-shaders";
import { createRainbowLake } from "./rainbow-lake";

export const RAINBOW_VENUE_URL = "/models/rainbow/spectrum-commons.glb";
export const RAINBOW_COURT_RADIUS = 6;
const AUTHORED_COURT_HEIGHT = 0.45;

export interface RainbowEnvironmentWorldOptions {
  config?: RainbowSceneConfig;
  groundY: number;
  stageRadius?: number;
  stageRadiusGrowth?: number;
  worldYOffset?: number;
  motionScale?: number;
  reflectionResolution?: number;
}

export interface RainbowEnvironmentWorld {
  root: Group;
  fog: FogExp2;
  background: Color;
  update(deltaSeconds: number, elapsedSeconds: number, camera: Camera): void;
  setLayout(
    groundY: number,
    stageRadius: number,
    stageRadiusGrowth: number,
    worldYOffset?: number
  ): void;
  setMotionScale(scale: number): void;
  setConfig(config?: RainbowSceneConfig): void;
  dispose(): void;
}

/** Expanding a cast moves the seating and supports outside its clear floor too. */
export function getRainbowVenueScale(
  stageRadius: number,
  minimumRadius: number,
  stageRadiusGrowth = 0
): number {
  return (
    resolveCircularStageRadius(
      stageRadius,
      Math.max(RAINBOW_COURT_RADIUS, minimumRadius),
      undefined,
      stageRadiusGrowth
    ) / RAINBOW_COURT_RADIUS
  );
}

export function createRainbowEnvironmentWorld(
  options: RainbowEnvironmentWorldOptions,
  venue: Object3D
): RainbowEnvironmentWorld {
  let config = options.config ?? createDefaultRainbowConfig();
  const root = new Group();
  root.name = "rainbow-environment-world";
  const ground = new Group();
  ground.name = "rainbow-pavilion-layout";
  ground.add(venue);
  root.add(ground);
  const fog = new FogExp2(config.fog.color, config.fog.density);
  const background = new Color("#07111f");
  const time = { value: 0 };
  let motionScale = options.motionScale ?? 1;
  const sails: MeshStandardMaterial[] = [];
  const courts: Object3D[] = [];

  venue.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const role = object.userData.rainbowRole;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = 0.35;
      if (role === "sail") {
        sails.push(material);
        material.side = DoubleSide;
        material.emissive.copy(material.color);
        material.emissiveIntensity = 0.35 * config.platform.glowIntensity;
        material.roughness = 0.65;
        if (material instanceof MeshPhysicalMaterial) {
          material.sheen = 0.35;
          material.sheenColor.copy(material.color);
        }
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uRainbowTime = time;
          shader.vertexShader =
            "uniform float uRainbowTime;\n" +
            shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
             float alongSail = clamp((9.0 - position.z) / 19.0, 0.0, 1.0);
             transformed.y += sin(alongSail * 3.14159265) *
               sin(uRainbowTime * 0.7 + position.x * 0.3 + alongSail * 4.0) * 0.055;`
            );
        };
        material.customProgramCacheKey = () => "spectrum-commons-sail-v1";
      }
      if (role === "stars") {
        material.emissiveIntensity = 2;
        material.fog = false;
      }
      if (role === "court") material.roughness = 0.72;
    }
    if (role === "court") {
      courts.push(object);
      object.visible = config.platform.enabled;
    }
  });

  const lake = createRainbowLake(options.reflectionResolution ?? 512);
  ground.add(lake);
  const lakeMaterial = lake.material as ShaderMaterial;
  const sky = new Mesh(
    new SphereGeometry(450, 24, 16),
    new ShaderMaterial({
      uniforms: {
        uTopColor: { value: new Color("#030817") },
        uMidColor: { value: new Color("#14293f") },
        uBottomColor: { value: new Color("#07111f") },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: BackSide,
      depthWrite: false,
    })
  );
  sky.name = "rainbow-sky-gradient";
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  root.add(sky);

  const hemisphere = new HemisphereLight(
    config.hemisphereLight.skyColor,
    config.hemisphereLight.groundColor,
    config.hemisphereLight.intensity
  );
  ground.add(hemisphere);
  const moon = new DirectionalLight("#9cbbe8", 0.65);
  moon.position.set(12, 25, 18);
  ground.add(moon);
  const key = new PointLight("#dbeaff", 65, 28, 2);
  key.position.set(0, 6.8, 3);
  ground.add(key);
  for (const [x, color] of [
    [-9, "#ff3459"],
    [-3, "#ffb347"],
    [3, "#29cda4"],
    [9, "#6c71ff"],
  ] as const) {
    const light = new PointLight(color, 40, 22, 2);
    light.position.set(x, 4.5, -3);
    ground.add(light);
  }

  let disposed = false;
  let layout: [number, number, number, number] = [
    options.groundY,
    options.stageRadius ?? 3,
    options.stageRadiusGrowth ?? 0,
    options.worldYOffset ?? 0,
  ];
  function setLayout(
    groundY: number,
    stageRadius: number,
    growth: number,
    worldYOffset = 0
  ) {
    if (disposed) return;
    layout = [groundY, stageRadius, growth, worldYOffset];
    const scale = getRainbowVenueScale(
      stageRadius,
      config.platform.radius,
      growth
    );
    ground.scale.set(scale, 1, scale);
    ground.position.y =
      groundY + worldYOffset + config.platform.height - AUTHORED_COURT_HEIGHT;
  }
  setLayout(
    options.groundY,
    options.stageRadius ?? 3,
    options.stageRadiusGrowth ?? 0,
    options.worldYOffset
  );

  return {
    root,
    fog,
    background,
    setLayout,
    setMotionScale(scale) {
      motionScale = scale;
    },
    setConfig(next) {
      if (disposed) return;
      config = next ?? createDefaultRainbowConfig();
      fog.color.set(config.fog.color);
      fog.density = config.fog.density;
      hemisphere.color.set(config.hemisphereLight.skyColor);
      hemisphere.groundColor.set(config.hemisphereLight.groundColor);
      hemisphere.intensity = config.hemisphereLight.intensity;
      for (const material of sails)
        material.emissiveIntensity = 0.35 * config.platform.glowIntensity;
      for (const court of courts) court.visible = config.platform.enabled;
      setLayout(...layout);
    },
    update(deltaSeconds, _elapsedSeconds, camera) {
      if (disposed) return;
      time.value += deltaSeconds * motionScale * config.platform.spectrumSpeed;
      const waterTime = lakeMaterial.uniforms.uTime;
      if (waterTime) waterTime.value = time.value * 0.35;
      sky.position.copy(camera.position);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lake.getRenderTarget().dispose();
      disposeSceneGraph(root);
      root.clear();
    },
  };
}

export async function createLoadedRainbowEnvironmentWorld(
  options: RainbowEnvironmentWorldOptions & {
    onProgress?: (fraction: number) => void;
  }
): Promise<RainbowEnvironmentWorld> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const url = new URL(RAINBOW_VENUE_URL, globalThis.location.href).href;
  const gltf = await loader.loadAsync(url, (event) => {
    options.onProgress?.(event.total > 0 ? event.loaded / event.total : 0.3);
  });
  options.onProgress?.(1);
  return createRainbowEnvironmentWorld(options, gltf.scene);
}
