import {
  Color,
  FogExp2,
  Group,
  type Camera,
  type Object3D,
  type Scene,
} from "three";

import {
  createDefaultAutumnConfig,
  type AutumnSceneConfig,
} from "../../domain/models/scene-configs/autumn-scene-config";
import type {
  AutumnQualityConfig,
  AutumnQualityTier,
} from "../../scenes/autumn/quality/autumn-quality";
import { getAutumnQualityConfig } from "../../scenes/autumn/quality/autumn-quality";
import {
  AUTUMN_MOON_TEXTURE_URL,
  AUTUMN_MOON_VISUAL_DIRECTION,
} from "../../scenes/autumn/runtime/lighting/autumn-moon";
import { AUTUMN_POND_LAYOUT } from "../../scenes/autumn/runtime/water/autumn-pond-layout";
import type {
  MoonConfig,
  StarfieldConfig,
} from "../../domain/models/scene-configs";
import {
  createAutumnParticleLayers,
  createAutumnSky,
  createAutumnStarfield,
  type AutumnParticleLayers,
  type AutumnStarfield,
} from "./autumn-atmosphere";
import type { AutumnEnvironmentAssets } from "./autumn-environment-assets";
import {
  createAutumnInteraction,
  type AutumnInteraction,
  type AutumnPresencePoint,
  type AutumnPulseTarget,
} from "./autumn-interaction";
import { createAutumnLightingRig } from "./autumn-lighting";
import { createAutumnMagicHabitats } from "./autumn-magic-habitats";
import { createAutumnMaterialRuntime } from "./autumn-material-runtime";
import { createAutumnPond } from "./autumn-pond";
import { createAutumnStage } from "./autumn-stage";
import { createAutumnWisps, type AutumnWisps } from "./autumn-wisps";

export interface AutumnEnvironmentWorldOptions {
  config?: AutumnSceneConfig;
  tier: AutumnQualityTier;
  groundY: number;
  stageWidth?: number;
  stageDepth?: number;
  stageZOffset?: number;
  showDirectionCues?: boolean;
  performerPositions?: readonly AutumnPresencePoint[];
  motionScale?: number;
  random?: () => number;
  active?: boolean;
}

export interface AutumnEnvironmentWorld {
  root: Group;
  fog: FogExp2;
  background: Color;
  environmentRoot: Object3D;
  update(deltaSeconds: number, elapsedSeconds: number, camera: Camera): void;
  pointerMove(ndcX: number, ndcY: number): boolean;
  pointerLeave(): void;
  setActive(active: boolean): void;
  setConfig(config: AutumnSceneConfig): void;
  setGroundY(groundY: number): void;
  setMotionScale(scale: number): void;
  setPerformers(performers: readonly AutumnPresencePoint[]): void;
  setTier(tier: AutumnQualityTier): void;
  dispose(): void;
}

const AUTUMN_MOON: MoonConfig = {
  enabled: true,
  texture: AUTUMN_MOON_TEXTURE_URL,
  direction: AUTUMN_MOON_VISUAL_DIRECTION,
  angularDiameterDegrees: 2.8,
  opacity: 0.96,
  glowScale: 1.52,
  glowOpacity: 0.075,
  surfaceLift: 0.34,
  horizonWarmth: 0.25,
};

function starfieldConfig(
  config: AutumnSceneConfig,
  tier: AutumnQualityTier
): StarfieldConfig {
  return {
    enabled: config.stars.enabled,
    count: Math.round(
      (tier === "high" ? 720 : tier === "medium" ? 520 : 320) *
        config.stars.countScale
    ),
    radius: 88,
    sizeRange: [0.45 * config.stars.sizeScale, 1.35 * config.stars.sizeScale],
    twinkleSpeed: 0.34,
    intensity: config.stars.intensity,
    magnitudeFalloff: 1.8,
    brightnessFloor: 0.24,
    horizonSpread: 0.52,
    elevationRangeDegrees: [4, 24],
  };
}

/** Builds the complete production Autumn graph from shared authored assets. */
export function createAutumnEnvironmentWorld(
  options: AutumnEnvironmentWorldOptions,
  assets: AutumnEnvironmentAssets
): AutumnEnvironmentWorld {
  const root = new Group();
  root.name = "autumn-environment-world";
  let config = options.config ?? createDefaultAutumnConfig();
  let tier = options.tier;
  let quality: AutumnQualityConfig = getAutumnQualityConfig(tier);
  let groundY = options.groundY;
  let motionScale = Math.max(0, options.motionScale ?? 1);
  let active = options.active ?? true;
  let disposed = false;

  const environment = assets.environment;
  environment.name ||= "autumn-authored-environment";
  environment.position.y = groundY;

  const sky = createAutumnSky(config.sky, AUTUMN_MOON, assets.moonTexture);
  const stars: AutumnStarfield = createAutumnStarfield(
    starfieldConfig(config, tier),
    motionScale,
    options.random
  );
  const stage = createAutumnStage({
    width: options.stageWidth,
    depth: options.stageDepth,
    groundY,
    stageZOffset: options.stageZOffset,
    showDirectionCues: options.showDirectionCues,
  });
  const lighting = createAutumnLightingRig(quality, groundY);
  const materials = createAutumnMaterialRuntime({
    environment,
    tier,
    quality,
    groundDetailMap: assets.groundDetailMap,
    groundDetailStrength: config.groundDetailStrength,
    motionScale,
    active,
  });
  const pondCenter = [
    AUTUMN_POND_LAYOUT.centerX,
    groundY,
    AUTUMN_POND_LAYOUT.centerZ,
  ] as const;
  const pond = createAutumnPond({ groundY, position: pondCenter, motionScale });
  const habitats = createAutumnMagicHabitats({
    environment,
    groundY,
    intensity: config.magicIntensity,
  });
  let particles: AutumnParticleLayers = createAutumnParticleLayers({
    quality,
    groundY,
    pondCenter,
    motionScale,
    random: options.random,
  });
  let wisps: AutumnWisps = createAutumnWisps({
    count: quality.wispCount,
    groundY,
    active,
    motionScale,
  });
  const pulseTargets: AutumnPulseTarget[] = [
    ...wisps.targets,
    ...habitats.targets,
  ];
  const interaction: AutumnInteraction = createAutumnInteraction({
    targets: pulseTargets,
    presence: options.performerPositions,
    groundY,
    active,
    magicIntensity: config.magicIntensity,
  });

  root.add(
    sky.object,
    stars.object,
    environment,
    stage.object,
    lighting.object,
    particles.object,
    wisps.object,
    habitats.object,
    pond.object
  );
  root.visible = active;

  const fog = new FogExp2(config.fog.color, config.fog.density);
  const background = new Color("#120b2b");

  function replaceTieredEcology(nextQuality: AutumnQualityConfig): void {
    root.remove(particles.object, wisps.object);
    particles.dispose();
    wisps.dispose();
    const nextPondCenter = [
      AUTUMN_POND_LAYOUT.centerX,
      groundY,
      AUTUMN_POND_LAYOUT.centerZ,
    ] as const;
    particles = createAutumnParticleLayers({
      quality: nextQuality,
      groundY,
      pondCenter: nextPondCenter,
      motionScale,
      random: options.random,
    });
    wisps = createAutumnWisps({
      count: nextQuality.wispCount,
      groundY,
      active,
      motionScale,
    });
    pulseTargets.splice(
      0,
      pulseTargets.length,
      ...wisps.targets,
      ...habitats.targets
    );
    root.add(particles.object, wisps.object);
  }

  return {
    root,
    fog,
    background,
    environmentRoot: environment,
    update(deltaSeconds, _elapsedSeconds, camera) {
      if (disposed || !active) return;
      sky.update(camera);
      stars.update(deltaSeconds);
      materials.update(deltaSeconds);
      particles.update(deltaSeconds);
      wisps.update(deltaSeconds, camera);
      pond.update(deltaSeconds);
      interaction.update(deltaSeconds, camera);
    },
    pointerMove(ndcX, ndcY) {
      return interaction.pointerMove(ndcX, ndcY);
    },
    pointerLeave() {
      interaction.pointerLeave();
    },
    setActive(nextActive) {
      if (disposed) return;
      active = nextActive;
      root.visible = nextActive;
      materials.setActive(nextActive);
      lighting.setActive(nextActive);
      pond.setActive(nextActive);
      wisps.setActive(nextActive);
      interaction.setActive(nextActive);
    },
    setConfig(nextConfig) {
      if (disposed) return;
      config = nextConfig;
      sky.setColors(config.sky);
      stars.setConfig(starfieldConfig(config, tier));
      fog.color.set(config.fog.color);
      fog.density = config.fog.density;
      materials.setGroundDetailStrength(config.groundDetailStrength);
      habitats.setIntensity(config.magicIntensity);
      interaction.setMagicIntensity(config.magicIntensity);
    },
    setGroundY(nextGroundY) {
      if (disposed || nextGroundY === groundY) return;
      groundY = nextGroundY;
      environment.position.y = nextGroundY;
      stage.setGroundY(nextGroundY);
      lighting.setGroundY(nextGroundY);
      particles.setGroundY(nextGroundY);
      wisps.setGroundY(nextGroundY);
      habitats.setGroundY(nextGroundY);
      pond.setGroundY(nextGroundY);
      interaction.setGroundY(nextGroundY);
    },
    setMotionScale(scale) {
      if (disposed) return;
      const nextMotionScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
      if (nextMotionScale === motionScale) return;
      motionScale = nextMotionScale;
      materials.setMotionScale(motionScale);
      stars.setMotionScale(motionScale);
      particles.setMotionScale(motionScale);
      wisps.setMotionScale(motionScale);
      pond.setMotionScale(motionScale);
    },
    setPerformers(performers) {
      interaction.setPresence(performers);
    },
    setTier(nextTier) {
      if (disposed || nextTier === tier) return;
      tier = nextTier;
      quality = getAutumnQualityConfig(tier);
      materials.setQuality(tier, quality);
      lighting.setQuality(quality);
      stars.setConfig(starfieldConfig(config, tier));
      replaceTieredEcology(quality);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      interaction.dispose();
      materials.dispose();
      sky.dispose();
      stars.dispose();
      stage.dispose();
      lighting.dispose();
      particles.dispose();
      wisps.dispose();
      habitats.dispose();
      pond.dispose();
      root.remove(environment);
      root.clear();
    },
  };
}

/** Shared attachment contract used by the Svelte and worker adapters. */
export function attachAutumnEnvironmentWorld(
  scene: Scene,
  world: AutumnEnvironmentWorld
): () => void {
  scene.add(world.root);
  return () => scene.remove(world.root);
}
