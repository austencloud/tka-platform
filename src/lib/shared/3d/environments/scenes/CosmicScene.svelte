<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { FogExp2, Color } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import StationPlatform from "./cosmic/StationPlatform.svelte";
  import EarthSphere from "./cosmic/EarthSphere.svelte";
  import NebulaLayer from "./cosmic/NebulaLayer.svelte";
  import EnergyParticles from "./cosmic/EnergyParticles.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
  import LunarCrystals from "./cosmic/LunarCrystals.svelte";
  import CrystalFormations from "./cosmic/CrystalFormations.svelte";
  import PrismaticCaustics from "./cosmic/PrismaticCaustics.svelte";
  import EarthGodRays from "./cosmic/EarthGodRays.svelte";
  import LunarGroundPlane from "./cosmic/LunarGroundPlane.svelte";
  import Starfield from "./cosmic/Starfield.svelte";
  import type { CosmicVariant } from "../domain/enums/environment-enums";
  import {
    type CosmicSceneConfig,
    createDefaultCosmicNightConfig,
    createDefaultCosmicAuroraConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    variant?: CosmicVariant;
    config?: CosmicSceneConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
  }

  let { variant = "night", config, performerCount = 1, stageWidth = 6, stageDepth = 6 }: Props = $props();

  const defaultConfigs = {
    night: createDefaultCosmicNightConfig,
    aurora: createDefaultCosmicAuroraConfig,
  };

  const baseConfig = $derived(config ?? defaultConfigs[variant]());

  const activeConfig = $derived.by(() => {
    const neededRadius = Math.max(stageWidth, stageDepth) / 2;
    const r = Math.max(baseConfig.platform.radius, neededRadius);
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const { scene } = useThrelte();
  const groundY = $derived(userProportionsState.groundY);

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  let earthReady = $state(false);

  $effect(() => {
    if (!sceneFeatures) return;
    if (earthReady || !activeConfig.earth.enabled) {
      sceneFeatures.reportReady("environment");
    } else {
      sceneFeatures.reportProgress("environment", 0.5);
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[CosmicScene] texture loading timed out — lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });

</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<NebulaLayer config={activeConfig.nebula} />

<LunarGroundPlane veins={activeConfig.lunarGround} groundConfig={activeConfig.ground} />

{#if activeConfig.crystalFormations.enabled}
  <CrystalFormations config={activeConfig.crystalFormations} />
{:else}
  <LunarCrystals config={activeConfig.crystals} />
{/if}

{#if activeConfig.caustics.enabled}
  <PrismaticCaustics config={activeConfig.caustics} groundSize={activeConfig.ground.size} />
{/if}

<StationPlatform config={activeConfig.platform} />

<EarthSphere
  config={activeConfig.earth}
  onReady={() => (earthReady = true)}
/>

{#if activeConfig.lighting.warmStation.enabled}
  <T.PointLight
    position.x={0}
    position.y={groundY + activeConfig.lighting.warmStation.heightOffset}
    position.z={0}
    color={activeConfig.lighting.warmStation.color}
    intensity={activeConfig.lighting.warmStation.intensity}
    distance={activeConfig.lighting.warmStation.distance}
    decay={activeConfig.lighting.warmStation.decay}
  />
{/if}

{#if activeConfig.lighting.coldDirectional.enabled}
  <T.DirectionalLight
    color={activeConfig.lighting.coldDirectional.color}
    intensity={activeConfig.lighting.coldDirectional.intensity}
    position.x={activeConfig.lighting.coldDirectional.position[0]}
    position.y={activeConfig.lighting.coldDirectional.position[1]}
    position.z={activeConfig.lighting.coldDirectional.position[2]}
  />
{/if}

<T.HemisphereLight
  color={activeConfig.lighting.ambient.skyColor}
  groundColor={activeConfig.lighting.ambient.groundColor}
  intensity={activeConfig.lighting.ambient.intensity}
/>

<Starfield config={activeConfig.starfield} />

<EarthGodRays config={activeConfig.godRays} earthConfig={activeConfig.earth} />

{#if activeConfig.particles.cosmicDust}
  {#key activeConfig.particles.cosmicDust.count}
    <FallingParticles
      type={activeConfig.particles.cosmicDust.type}
      count={activeConfig.particles.cosmicDust.count}
      area={activeConfig.particles.cosmicDust.area}
      speed={activeConfig.particles.cosmicDust.speed}
      colors={activeConfig.particles.cosmicDust.colors}
      sizeRange={activeConfig.particles.cosmicDust.sizeRange}
      spin={activeConfig.particles.cosmicDust.spin ?? false}
    />
  {/key}
{/if}

{#if activeConfig.particles.energyParticles}
  {#key activeConfig.particles.energyParticles.count}
    <EnergyParticles config={activeConfig.particles.energyParticles} />
  {/key}
{/if}

{#if activeConfig.particles.meteorStreaks}
  <MeteorStreaks config={activeConfig.particles.meteorStreaks} />
{/if}
