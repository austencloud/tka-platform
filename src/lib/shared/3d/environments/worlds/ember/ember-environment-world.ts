import {
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Scene,
  Texture,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from "three";

import { VolumetricFireMesh } from "../../../effects/fire/volumetric-fire-mesh";
import { QualityTier } from "../../../effects/types";
import { withMidflankAtmosphere } from "./ember-midflank-finish";
import { resolveCircularStageRadius } from "../../domain/performer-stage-bounds";
import {
  createDefaultEmberConfig,
  type EmberSceneConfig,
} from "../../domain/models/scene-configs";
import { disposeSceneGraph } from "../../utils/dispose-scene";
import { createRainbowParticleField } from "../rainbow/rainbow-particle-field";
import {
  createEmberFireWisps,
  createEmberFountains,
  createEmberHeatDistortion,
  createEmberParticleFields,
  createEmberPlumes,
  createEmberSky,
  createEmberVolcanicHaze,
  type EmberAtmosphereElement,
} from "./ember-atmosphere";
import {
  createEmberAuthoredSurface,
  type EmberAuthoredSurface,
} from "./ember-authored-surface";
import {
  EMBER_AUTHORED_RESOURCE_URLS,
  loadEmberEnvironmentAssets,
  type EmberEnvironmentAssets,
  type LoadEmberEnvironmentAssetsOptions,
} from "./ember-environment-assets";
import {
  createEmberLavaCracks,
  createEmberLavaPool,
  createEmberLavaRivers,
  createEmberObsidianPillars,
  createEmberObsidianPlatform,
  resolveEmberConfig,
  type EmberWorldElement,
} from "./ember-lava-features";

export interface EmberEnvironmentWorldOptions {
  renderer: WebGLRenderer;
  groundY: number;
  config?: EmberSceneConfig;
  stageRadius?: number;
  stageRadiusGrowth?: number;
  qualityTier?: QualityTier;
  shadows?: boolean;
  reducedMotion?: boolean;
  groundDetailEnabled?: boolean;
  random?: () => number;
}

export interface EmberEnvironmentWorld {
  root: Group;
  fog: FogExp2;
  background: Color;
  config: EmberSceneConfig;
  authoredResourceUrls: readonly string[];
  update(deltaSeconds: number, elapsedSeconds: number, camera: Camera): void;
  setGroundY(groundY: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

interface FireRuntime extends EmberWorldElement {
  clones: Object3D[];
}

const LOG_PLACEMENTS = [
  { x: 7, z: -1.5, scale: 1.8, rotY: Math.PI * 0.3, large: true },
  { x: 3.5, z: -5, scale: 1.5, rotY: Math.PI * 0.8, large: false },
  { x: 8.5, z: -5.5, scale: 1.4, rotY: Math.PI * 1.3, large: true },
  { x: -8, z: -4, scale: 1.6, rotY: Math.PI * 0.5, large: false },
  { x: 10, z: 2.5, scale: 1.3, rotY: Math.PI * 1.1, large: true },
  { x: -9.5, z: 7, scale: 1.5, rotY: Math.PI * 0.2, large: false },
] as const;

function volcanicClone(source: Object3D): Object3D {
  const tint = new Color("#0a0505");
  const emissive = new Color("#220800");
  const clone = source.clone();
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const copies = materials.map((candidate) => {
      const material = (candidate as MeshStandardMaterial).clone();
      material.color?.lerp(tint, 0.6);
      material.emissive?.lerp(emissive, 0.2);
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? copies : copies[0]!;
  });
  return clone;
}

function createFireRuntime(
  assets: EmberEnvironmentAssets,
  config: EmberSceneConfig,
  groundY: number,
  motionScale: number,
  random: () => number
): FireRuntime | null {
  const vent = config.fireVent;
  if (!vent?.enabled) return null;
  const root = new Group();
  root.name = "EmberFireVent";
  root.position.y = groundY;
  const clones: Object3D[] = [];

  const campfire = assets.campfire.clone();
  campfire.name ||= "EmberCampfire";
  campfire.position.set(vent.position.x, 0, vent.position.z);
  campfire.scale.setScalar(vent.modelScale);
  root.add(campfire);
  clones.push(campfire);

  const fire = new VolumetricFireMesh({
    preset: "classic",
    qualityTier: QualityTier.MEDIUM,
    boxScale: new Vector3(
      vent.fireScale,
      vent.fireHeight * vent.fireScale,
      vent.fireScale
    ),
  });
  fire.name = "SharedVolumetricFire";
  fire.setIntensity(1.34);
  fire.setTurbulence(1.16);
  fire.setScrollSpeed(1.34);
  fire.setWarp(0.94);
  fire.setErosion(0.39);
  fire.setEmission(3.1);
  fire.setFlameRadius(0.74);
  fire.position.set(
    vent.position.x,
    (vent.fireHeight * vent.fireScale) / 2,
    vent.position.z
  );
  root.add(fire);

  const primary = new PointLight(
    vent.primaryLight.color,
    vent.primaryLight.intensity,
    vent.primaryLight.distance,
    vent.primaryLight.decay
  );
  primary.name = "EmberFirePrimaryLight";
  primary.position.set(
    vent.position.x,
    vent.primaryLight.heightOffset,
    vent.position.z
  );
  const fill = new PointLight(
    vent.fillLight.color,
    vent.fillLight.intensity,
    vent.fillLight.distance,
    vent.fillLight.decay
  );
  fill.name = "EmberFireFillLight";
  fill.position.set(
    vent.position.x,
    vent.fillLight.heightOffset,
    vent.position.z
  );
  root.add(primary, fill);

  const smoke = createRainbowParticleField({
    type: "smoke",
    count: vent.smokeCount,
    area: { width: 1.5, height: 5, depth: 1.5 },
    speed: 0.04,
    colors: vent.smokeColors,
    sizeRange: [0.15, 0.45],
    spin: false,
    motionScale,
    random,
  });
  smoke.points.name = "EmberFireSmoke";
  smoke.points.position.set(
    vent.position.x,
    (vent.fireHeight * vent.fireScale) / 2 + 0.5,
    vent.position.z
  );
  root.add(smoke.points);

  for (const [index, placement] of LOG_PLACEMENTS.entries()) {
    const clone = volcanicClone(
      placement.large ? assets.largeLog : assets.smallLog
    );
    const group = new Group();
    group.name = `EmberLog_${index}`;
    group.userData = {
      tka_composer_id: `ember-log-${index}`,
      tka_role: "deadwood",
    };
    group.position.set(placement.x, 0, placement.z);
    group.scale.setScalar(placement.scale * 0.5);
    group.rotation.y = placement.rotY;
    group.add(clone);
    root.add(group);
    clones.push(clone);
  }

  let elapsed = 0;
  return {
    object: root,
    clones,
    update(deltaSeconds) {
      elapsed += Math.min(Math.max(deltaSeconds, 0), 1 / 15);
      fire.setTime(elapsed);
      smoke.update(deltaSeconds);
    },
    setGroundY(value) {
      root.position.y = value;
    },
    dispose() {
      smoke.dispose();
      fire.dispose();
      for (const clone of clones) disposeSceneGraph(clone);
      root.clear();
    },
  };
}

function addLighting(
  root: Group,
  config: EmberSceneConfig,
  groundY: number,
  shadows: boolean
): {
  grounded: Array<{ light: PointLight; offset: number }>;
} {
  const grounded: Array<{ light: PointLight; offset: number }> = [];
  const caldera = config.atmosphere.calderaLight;
  const calderaLight = new PointLight(
    caldera.color,
    caldera.intensity,
    caldera.distance,
    caldera.decay
  );
  calderaLight.name = "EmberCalderaLight";
  calderaLight.position.set(
    caldera.position[0],
    groundY + caldera.position[1],
    caldera.position[2]
  );
  root.add(calderaLight);
  grounded.push({ light: calderaLight, offset: caldera.position[1] });

  const hemisphere = new HemisphereLight(
    config.hemisphereLight.skyColor,
    config.hemisphereLight.groundColor,
    config.hemisphereLight.intensity
  );
  hemisphere.name = "EmberHemisphereLight";
  root.add(hemisphere);

  if (config.skyLight?.enabled) {
    const source = config.skyLight;
    const light = new DirectionalLight(source.color, source.intensity);
    light.name = "EmberSkyLight";
    light.position.set(...source.position);
    light.castShadow = shadows;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 120;
    light.shadow.camera.left = -42;
    light.shadow.camera.right = 42;
    light.shadow.camera.top = 42;
    light.shadow.camera.bottom = -42;
    light.shadow.bias = -0.0007;
    light.shadow.normalBias = 0.045;
    light.shadow.radius = 3;
    light.shadow.intensity = 0.55;
    root.add(light);
  }
  for (const [index, source] of config.atmosphere.directionals.entries()) {
    const light = new DirectionalLight(source.color, source.intensity);
    light.name = `EmberAtmosphereDirectional-${index}`;
    light.position.set(...source.position);
    root.add(light);
  }
  for (const [index, source] of config.atmosphere.points.entries()) {
    const light = new PointLight(
      source.color,
      source.intensity,
      source.distance,
      source.decay
    );
    light.name = `EmberAtmospherePoint-${index}`;
    light.position.set(
      source.position[0],
      groundY + source.position[1],
      source.position[2]
    );
    root.add(light);
    grounded.push({ light, offset: source.position[1] });
  }
  return { grounded };
}

function disposeLoadedAssets(assets: EmberEnvironmentAssets): void {
  const roots = [
    assets.productionSlice,
    assets.largeLog,
    assets.smallLog,
    assets.campfire,
  ];
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>([
    assets.skyMoonTexture,
    ...Object.values(assets.detailMaps),
    ...Object.values(assets.surfaceMaps),
    assets.familyMask,
  ]);
  for (const root of roots) {
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (!mesh.material) return;
      const values = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of values) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture) textures.add(value);
        }
      }
    });
  }
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  roots.forEach((root) => root.clear());
}

/** Build the exact production Ember graph from already-loaded authored assets. */
export function createEmberEnvironmentWorld(
  options: EmberEnvironmentWorldOptions,
  assets: EmberEnvironmentAssets
): EmberEnvironmentWorld {
  const midflank = !!assets.productionSlice.getObjectByName("EMBER_Terrain");
  const requestedConfig = options.config ?? createDefaultEmberConfig();
  const baseConfig = midflank ? withMidflankAtmosphere(requestedConfig) : requestedConfig;
  const stageRadius = options.stageRadius ?? 3;
  const growth = midflank ? 0 : options.stageRadiusGrowth ?? 0;
  const platformRadius = resolveCircularStageRadius(
    stageRadius,
    baseConfig.platform.radius,
    undefined,
    growth
  );
  const embeddedExpansion = !baseConfig.platform.enabled && growth > 0;
  const config = resolveEmberConfig(
    baseConfig,
    platformRadius,
    baseConfig.platform.enabled || growth > 0
  );
  const qualityTier = options.qualityTier ?? QualityTier.HIGH;
  const shadows = options.shadows ?? true;
  const motionScale = options.reducedMotion ? 0 : 1;
  const random = options.random ?? Math.random;
  let groundY = options.groundY;
  let disposed = false;

  const root = new Group();
  root.name = "ember-environment-world";
  const fog = new FogExp2(config.fog.color, config.fog.density);
  const background = new Color(config.fog.color);
  const authoredSurface: EmberAuthoredSurface = createEmberAuthoredSurface({
    assets,
    config,
    groundY,
    stageRadius: config.platform.radius,
    shadows,
    groundDetailEnabled: options.groundDetailEnabled,
  });
  assets.productionSlice.name ||= "ember-production-slice";

  const elements: EmberAtmosphereElement[] = [];
  const add = <T extends EmberWorldElement | null>(element: T): T => {
    if (element) {
      root.add(element.object);
      elements.push(element as EmberAtmosphereElement);
    }
    return element;
  };

  add(createEmberSky(config.sky, assets.skyMoonTexture));
  add(createEmberLavaCracks(config.lavaCracks, config.ground.size, groundY));
  add(createEmberLavaPool(config.lavaPool, groundY));
  root.add(assets.productionSlice, authoredSurface.object);
  if (config.lavaPool.enabled) {
    add(
      createEmberHeatDistortion({
        position: config.lavaPool.position,
        radius: config.lavaPool.radius * 0.7,
        groundY,
      })
    );
  }
  add(
    createEmberLavaRivers(
      config.lavaRivers,
      config.lavaPool.position,
      assets.productionSlice,
      groundY,
      qualityTier
    )
  );
  for (const field of config.atmosphere.heatFields) {
    add(createEmberHeatDistortion({ ...field, groundY }));
  }
  add(createEmberObsidianPillars(config.obsidianPillars, groundY));
  const fire = add(
    createFireRuntime(assets, config, groundY, motionScale, random)
  );
  add(createEmberFireWisps(config.fireWisps, groundY));
  add(
    createEmberFountains(
      config.emberFountains,
      config.lavaPool,
      groundY,
      random
    )
  );
  for (const field of createEmberParticleFields({
    config,
    motionScale,
    random,
  })) {
    add(field);
  }
  add(createEmberVolcanicHaze(config.volcanicHaze));
  add(
    createEmberPlumes({
      plumes: config.atmosphere.plumes,
      groundY,
      fogColor: config.fog.color,
      fogDensity: config.fog.density,
      motionScale,
      random,
    })
  );
  const lighting = addLighting(root, config, groundY, shadows);
  add(createEmberObsidianPlatform(config.platform, groundY, embeddedExpansion));

  return {
    root,
    fog,
    background,
    config,
    authoredResourceUrls: EMBER_AUTHORED_RESOURCE_URLS,
    update(deltaSeconds, elapsedSeconds, camera) {
      if (disposed) return;
      for (const element of elements) {
        element.update(deltaSeconds * motionScale, motionScale ? elapsedSeconds : 0, camera);
      }
    },
    setGroundY(value) {
      if (value === groundY) return;
      groundY = value;
      authoredSurface.setGroundY(value);
      for (const element of elements) element.setGroundY(value);
      for (const { light, offset } of lighting.grounded) {
        light.position.y = value + offset;
      }
    },
    setActive(active) {
      root.visible = active;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const element of elements) element.dispose();
      fire?.clones.splice(0);
      authoredSurface.dispose();
      root.remove(assets.productionSlice);
      disposeLoadedAssets(assets);
      root.clear();
    },
  };
}

export async function createLoadedEmberEnvironmentWorld(
  options: EmberEnvironmentWorldOptions & LoadEmberEnvironmentAssetsOptions
): Promise<EmberEnvironmentWorld> {
  const assets = await loadEmberEnvironmentAssets(options);
  return createEmberEnvironmentWorld(options, assets);
}

export function attachEmberEnvironmentWorld(
  scene: Scene,
  world: EmberEnvironmentWorld
): () => void {
  scene.add(world.root);
  scene.fog = world.fog;
  scene.background = world.background;
  return () => {
    scene.remove(world.root);
    if (scene.fog === world.fog) scene.fog = null;
    if (scene.background === world.background) scene.background = null;
  };
}
