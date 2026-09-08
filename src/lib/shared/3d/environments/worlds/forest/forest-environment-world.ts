import {
  FogExp2,
  Group,
  PointLight,
  Vector2,
  Vector3,
  type Camera,
  type Mesh,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from "three";
import { QualityTier } from "../../../effects/types";
import { VolumetricFireMesh } from "../../../effects/fire/volumetric-fire-mesh";
import {
  createDefaultForestFireflyConfig,
  type ForestSceneConfig,
} from "../../domain/models/scene-configs";
import { shouldShowForestNearFrame } from "../../domain/models/scene-configs/forest-scene-config";
import { FOREST_FIREFLY_FIELDS } from "../../scenes/forest/forest-firefly-fields";
import {
  resolveForestNearFrameShadowRole,
  resolveForestShadowRole,
} from "../../scenes/forest/forest-shadow-roles";
import {
  createRainbowParticleField,
  type RainbowParticleField,
} from "../rainbow/rainbow-particle-field";
import {
  createForestAtmosphereMaterialController,
  type ForestAtmosphereMaterialController,
} from "./forest-atmosphere-materials";
import {
  createForestCanopyFlight,
  type ForestCanopyFlight,
} from "./forest-canopy-flight";
import {
  createForestClearingWind,
  type ForestClearingWind,
} from "./forest-clearing-wind";
import {
  createForestGroundDetailRuntime,
  type ForestGroundDetailRuntime,
} from "./forest-ground-detail-runtime";
import {
  createForestLightingRig,
  type ForestLightingRig,
} from "./forest-lighting-rig";
import {
  createForestMeteorStreaks,
  type ForestMeteorStreaks,
} from "./forest-meteor-streaks";
import { createForestSky, type ForestSky } from "./forest-sky";
import {
  createForestStarfield,
  type ForestStarfield,
} from "./forest-starfield";

export interface ForestEnvironmentAssets {
  environmentRoot: Object3D;
  nearFrameRoot?: Object3D | null;
  campsiteRoot?: Object3D | null;
  stageRoot?: Object3D | null;
  moonTexture?: Texture | null;
}

/** One asset contract shared by the Svelte and worker Forest adapters. */
export const FOREST_ENVIRONMENT_ASSET_URLS = {
  environment: "/models/forest/forest-environment.glb",
  nearFrame: "/models/forest/forest-near-frame.glb",
  campsite: "/models/forest/forest-campsite.glb",
  stage: "/models/forest/forest-stage.glb",
  moon: "/textures/moon.png",
} as const;

export interface ForestEnvironmentWorldOptions {
  assets: ForestEnvironmentAssets;
  renderer: WebGLRenderer;
  config?: ForestSceneConfig;
  groundY: number;
  stageWidth?: number;
  stageDepth?: number;
  stageZOffset?: number;
  showStage?: boolean;
  clearingRadius?: number;
  showTents?: boolean;
  showCampfire?: boolean;
  shadowsEnabled?: boolean;
  qualityTier?: QualityTier;
  motionScale?: number;
  random?: () => number;
  assetUrl?: (path: string) => string;
  loadTexture?: (url: string) => Promise<Texture>;
}

export interface ForestEnvironmentWorld {
  root: Group;
  fog: FogExp2;
  ready: Promise<void>;
  update(deltaSeconds: number, camera: Camera): void;
  setGroundY(groundY: number): void;
  setMoonTexture(texture: Texture | null): void;
  dispose(): void;
}

function configureFire(fire: VolumetricFireMesh): void {
  fire.name = "SharedVolumetricFire";
  fire.setIntensity(1.34);
  fire.setTurbulence(1.16);
  fire.setScrollSpeed(1.34);
  fire.setWarp(0.94);
  fire.setErosion(0.39);
  fire.setEmission(3.1);
  fire.setFlameRadius(0.74);
}

function setAllShadows(root: Object3D, cast: boolean, receive: boolean): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

/**
 * Exact renderer-neutral owner of the production moonlit Forest scene.
 *
 * The configurable Scene Lab path remains in ForestConfigurableScene because
 * its 2D Celestial cloud source requires a document-backed canvas. Production
 * Forest has no cloud layer and is completely owned here.
 */
export function createForestEnvironmentWorld(
  options: ForestEnvironmentWorldOptions
): ForestEnvironmentWorld {
  const config = options.config ?? createDefaultForestFireflyConfig();
  if (config.clouds?.enabled) {
    throw new Error(
      "Forest's document-backed Celestial cloud editor stays on the configurable Svelte path"
    );
  }
  const root = new Group();
  root.name = "forest-environment-world";
  const particles: RainbowParticleField[] = [];
  const materialControllers: ForestAtmosphereMaterialController[] = [];
  const assets = options.assets;
  const showNearFrame = shouldShowForestNearFrame(options.clearingRadius);
  const showCampfire = options.showCampfire ?? true;
  const showTents = options.showTents ?? true;
  const shadowsEnabled = options.shadowsEnabled ?? true;
  const qualityTier = options.qualityTier ?? QualityTier.MEDIUM;
  const motionScale = options.motionScale ?? 1;
  const random = options.random ?? Math.random;
  let groundY = options.groundY;
  let fireElapsed = 0;
  let disposed = false;

  const sky: ForestSky = createForestSky({
    sky: config.sky,
    moon: config.moon,
    sun: config.sun,
    moonTexture: assets.moonTexture,
  });
  root.add(sky.object);
  const starfield: ForestStarfield | null = config.starfield?.enabled
    ? createForestStarfield(config.starfield, motionScale, random)
    : null;
  if (starfield) root.add(starfield.object);
  const viewport = new Vector2();
  const meteors: ForestMeteorStreaks | null = config.shootingStars?.enabled
    ? createForestMeteorStreaks({
        config: config.shootingStars,
        viewportSize: () => options.renderer.getSize(viewport),
        random,
      })
    : null;
  if (meteors) root.add(meteors.object);

  const environment = assets.environmentRoot;
  const environmentPlacement = new Group();
  environmentPlacement.name = "forest-authored-environment-placement";
  environment.name ||= "forest-authored-environment";
  environment.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const shadow = resolveForestShadowRole(child.userData?.tka_role);
    mesh.castShadow = shadow.cast;
    mesh.receiveShadow = shadow.receive;
  });
  environmentPlacement.add(environment);
  root.add(environmentPlacement);

  const isNightMaster = Boolean(
    config.moon?.enabled && !config.materialResponse
  );
  const groundDetail: ForestGroundDetailRuntime =
    createForestGroundDetailRuntime({
      root: environment,
      strength: isNightMaster ? 0.18 : 0.9,
      normalResponse: isNightMaster ? 0.12 : 0.3,
      roughnessFloor: isNightMaster ? 0.99 : 0.98,
      anisotropy: options.renderer.capabilities.getMaxAnisotropy(),
      assetUrl: options.assetUrl,
      loadTexture: options.loadTexture,
    });
  if (config.materialResponse) {
    materialControllers.push(
      createForestAtmosphereMaterialController(
        environment,
        config.materialResponse,
        "environment"
      )
    );
  }

  const nearFrame = showNearFrame ? (assets.nearFrameRoot ?? null) : null;
  const nearFramePlacement = nearFrame ? new Group() : null;
  if (nearFrame) {
    nearFramePlacement!.name = "forest-near-frame-placement";
    nearFrame.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const shadow = resolveForestNearFrameShadowRole(
        child.userData?.tka_role,
        shadowsEnabled
      );
      mesh.castShadow = shadow.cast;
      mesh.receiveShadow = shadow.receive;
    });
    nearFramePlacement!.add(nearFrame);
    root.add(nearFramePlacement!);
  }
  const wind: ForestClearingWind | null = nearFrame
    ? createForestClearingWind(nearFrame, qualityTier)
    : null;
  if (nearFrame && config.materialResponse) {
    materialControllers.push(
      createForestAtmosphereMaterialController(
        nearFrame,
        config.materialResponse,
        "near-frame"
      )
    );
  }

  const campsite = showNearFrame ? (assets.campsiteRoot ?? null) : null;
  const campsitePlacement = campsite ? new Group() : null;
  if (campsite) {
    campsitePlacement!.name = "forest-campsite-placement";
    setAllShadows(campsite, true, true);
    campsite.traverse((child) => {
      const role = child.userData?.tka_role;
      if (role === "tent" || role === "tent-pad") child.visible = showTents;
      if (role === "fire-pit" || role === "camp-chair") {
        child.visible = showCampfire;
      }
    });
    campsitePlacement!.add(campsite);
    root.add(campsitePlacement!);
    if (config.materialResponse) {
      materialControllers.push(
        createForestAtmosphereMaterialController(
          campsite,
          config.materialResponse,
          "camp"
        )
      );
    }
  }

  const stage = options.showStage !== false ? (assets.stageRoot ?? null) : null;
  const stagePlacement = stage ? new Group() : null;
  if (stage) {
    stagePlacement!.name = "forest-stage-placement";
    setAllShadows(stage, true, true);
    stagePlacement!.scale.set(
      (options.stageWidth ?? 6) / 6,
      1,
      (options.stageDepth ?? 4.5) / 6
    );
    stagePlacement!.position.z = options.stageZOffset ?? 0;
    stagePlacement!.add(stage);
    root.add(stagePlacement!);
    if (config.materialResponse) {
      materialControllers.push(
        createForestAtmosphereMaterialController(
          stage,
          config.materialResponse,
          "stage"
        )
      );
    }
  }

  const leaves = createRainbowParticleField({
    ...config.leaves,
    spin: config.leaves.spin ?? true,
    motionScale,
    random,
  });
  leaves.points.name = "forest-falling-leaves";
  particles.push(leaves);
  root.add(leaves.points);

  if (config.fireflies) {
    if (showNearFrame) {
      for (const field of FOREST_FIREFLY_FIELDS) {
        const particlesForField = createRainbowParticleField({
          ...config.fireflies,
          spin: config.fireflies.spin ?? true,
          count: Math.max(
            8,
            Math.round(config.fireflies.count * field.countScale)
          ),
          area: { ...field.area },
          motionScale,
          random,
        });
        particlesForField.points.name = `forest-fireflies-${field.id}`;
        particlesForField.points.position.set(
          field.position[0],
          groundY + field.position[1],
          field.position[2]
        );
        particles.push(particlesForField);
        root.add(particlesForField.points);
      }
    } else {
      const field = createRainbowParticleField({
        ...config.fireflies,
        spin: config.fireflies.spin ?? true,
        motionScale,
        random,
      });
      field.points.name = "forest-fireflies";
      particles.push(field);
      root.add(field.points);
    }
  }

  const canopy: ForestCanopyFlight | null =
    showNearFrame && (config.canopyFlight ?? "bats") === "bats"
      ? createForestCanopyFlight(motionScale)
      : null;
  if (canopy) root.add(canopy.object);

  const campfire =
    showCampfire && config.campfire?.enabled ? config.campfire : null;
  const fire = campfire
    ? new VolumetricFireMesh({
        preset: "classic",
        qualityTier: QualityTier.MEDIUM,
        boxScale: new Vector3(
          campfire.fireScale,
          campfire.fireHeight * campfire.fireScale,
          campfire.fireScale
        ),
      })
    : null;
  if (fire) {
    configureFire(fire);
    fire.scale.set(
      campfire!.fireScale,
      campfire!.fireHeight * campfire!.fireScale,
      campfire!.fireScale
    );
    root.add(fire);
  }
  const smoke = campfire
    ? createRainbowParticleField({
        type: "smoke",
        count: campfire.smokeCount,
        area: { width: 1, height: 4, depth: 1 },
        speed: 0.04,
        colors: campfire.smokeColors,
        sizeRange: [0.15, 0.4],
        spin: false,
        motionScale,
        random,
      })
    : null;
  if (smoke) {
    smoke.points.name = "forest-campfire-smoke";
    particles.push(smoke);
    root.add(smoke.points);
  }
  const primaryLight = campfire
    ? new PointLight(
        campfire.primaryLight.color,
        campfire.primaryLight.intensity,
        campfire.primaryLight.distance,
        campfire.primaryLight.decay
      )
    : null;
  const fillLight = campfire
    ? new PointLight(
        campfire.fillLight.color,
        campfire.fillLight.intensity,
        campfire.fillLight.distance,
        campfire.fillLight.decay
      )
    : null;
  if (primaryLight) root.add(primaryLight);
  if (fillLight) root.add(fillLight);

  const lighting: ForestLightingRig = createForestLightingRig({
    hemisphere: config.hemisphereLight,
    profile: config.lighting,
    groundY,
    shadowsEnabled,
  });
  root.add(lighting.object);
  const fog = new FogExp2(config.fog.color, config.fog.density);

  function setGroundY(nextGroundY: number): void {
    groundY = nextGroundY;
    environmentPlacement.position.y = groundY;
    if (nearFramePlacement) nearFramePlacement.position.y = groundY;
    const campsiteGroundY = groundY + (config.campfire?.groundOffset ?? 0);
    if (campsitePlacement) campsitePlacement.position.y = campsiteGroundY;
    if (stagePlacement) stagePlacement.position.y = groundY;
    if (campfire && fire) {
      fire.position.set(
        campfire.position.x,
        campsiteGroundY + (campfire.fireHeight * campfire.fireScale) / 2,
        campfire.position.z
      );
    }
    if (campfire && smoke) {
      smoke.points.position.set(
        campfire.position.x,
        campsiteGroundY + (campfire.fireHeight * campfire.fireScale) / 2 + 0.5,
        campfire.position.z
      );
    }
    primaryLight?.position.set(
      campfire?.position.x ?? 0,
      campsiteGroundY + (campfire?.primaryLight.heightOffset ?? 0),
      campfire?.position.z ?? 0
    );
    fillLight?.position.set(
      campfire?.position.x ?? 0,
      campsiteGroundY + (campfire?.fillLight.heightOffset ?? 0),
      campfire?.position.z ?? 0
    );
    if (config.fireflies && showNearFrame) {
      FOREST_FIREFLY_FIELDS.forEach((field) => {
        root
          .getObjectByName(`forest-fireflies-${field.id}`)
          ?.position.set(
            field.position[0],
            groundY + field.position[1],
            field.position[2]
          );
      });
    }
    lighting.setGroundY(groundY);
  }
  setGroundY(groundY);

  return {
    root,
    fog,
    ready: groundDetail.ready,
    update(deltaSeconds, camera) {
      if (disposed) return;
      sky.update(camera);
      starfield?.update(deltaSeconds);
      meteors?.update(deltaSeconds);
      canopy?.update(deltaSeconds, camera, groundY);
      wind?.update(deltaSeconds, motionScale);
      lighting.update(deltaSeconds);
      for (const field of particles) field.update(deltaSeconds);
      if (fire) {
        fireElapsed += Math.min(Math.max(deltaSeconds, 0), 1 / 15);
        fire.setTime(fireElapsed);
      }
    },
    setGroundY,
    setMoonTexture(texture) {
      sky.setMoonTexture(texture);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      groundDetail.dispose();
      for (const controller of materialControllers) controller.dispose();
      sky.dispose();
      starfield?.dispose();
      meteors?.dispose();
      canopy?.dispose();
      for (const field of particles) field.dispose();
      lighting.dispose();
      fire?.dispose();
      environmentPlacement.remove(environment);
      if (nearFrame && nearFramePlacement) nearFramePlacement.remove(nearFrame);
      if (campsite && campsitePlacement) campsitePlacement.remove(campsite);
      if (stage && stagePlacement) stagePlacement.remove(stage);
      root.clear();
    },
  };
}
