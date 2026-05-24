<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { onMount } from "svelte";
  import { FogExp2, Color } from "three";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import CloudDome from "./celestial/CloudDome.svelte";
  import GodRays from "./celestial/GodRays.svelte";
  import CloudPlatform from "./celestial/CloudPlatform.svelte";
  import CloudIslands from "./celestial/CloudIslands.svelte";
  import CelestialPillars from "./celestial/CelestialPillars.svelte";
  import {
    type CelestialSceneConfig,
    createDefaultCelestialConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    config?: CelestialSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { config, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultCelestialConfig());

  const activeConfig = $derived.by(() => {
    const neededRadius = Math.max(stageWidth, stageDepth) / 2;
    const r = Math.max(baseConfig.cloudPlatform.radius, neededRadius);
    if (r <= baseConfig.cloudPlatform.radius) return baseConfig;
    return {
      ...baseConfig,
      cloudPlatform: { ...baseConfig.cloudPlatform, radius: r },
    };
  });

  const { scene, renderer, camera } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null,
  );
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  // Fog — reuse instance, mutate properties instead of reallocating
  let fogInstance: FogExp2 | null = null;
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    if (!fogInstance) {
      fogInstance = new FogExp2(fog.color, fog.density);
      scene.current.fog = fogInstance;
    } else {
      fogInstance.color.set(fog.color);
      fogInstance.density = fog.density;
    }
    return () => {
      if (scene.current) scene.current.fog = null;
      fogInstance = null;
    };
  });

  // Report ready once on mount
  onMount(() => {
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    sceneFeatures?.reportProgress("environment", 1);
    sceneFeatures?.reportReady("environment");
  });
</script>

<!-- Warm celestial sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Volumetric cloud dome -->
<CloudDome config={activeConfig.cloudDome} />

<!-- Soft ground plane beneath cloud platform -->
<GroundPlane
  color={activeConfig.ground.color}
  size={activeConfig.ground.size}
  opacity={activeConfig.ground.opacity ?? 1}
/>

<!-- Cloud-textured platform -->
{#if activeConfig.cloudPlatform.enabled}
  <CloudPlatform config={activeConfig.cloudPlatform} />
{/if}

<!-- God rays piercing through clouds -->
{#if activeConfig.godRays.enabled}
  <GodRays config={activeConfig.godRays} />
{/if}

<!-- Floating cloud islands in the distance -->
{#if activeConfig.cloudIslands.enabled}
  <CloudIslands config={activeConfig.cloudIslands} />
{/if}

<!-- Luminous celestial pillars -->
{#if activeConfig.celestialPillars.enabled}
  <CelestialPillars config={activeConfig.celestialPillars} />
{/if}

<!-- Ascending golden motes -->
{#key activeConfig.motes.count}
  <FallingParticles
    type={activeConfig.motes.type}
    count={activeConfig.motes.count}
    area={activeConfig.motes.area}
    speed={activeConfig.motes.speed}
    colors={activeConfig.motes.colors}
    sizeRange={activeConfig.motes.sizeRange}
    spin={activeConfig.motes.spin ?? false}
  />
{/key}

<!-- Ground-level cloud wisps -->
{#if activeConfig.wisps}
  {#key activeConfig.wisps.count}
    <FallingParticles
      type={activeConfig.wisps.type}
      count={activeConfig.wisps.count}
      area={activeConfig.wisps.area}
      speed={activeConfig.wisps.speed}
      colors={activeConfig.wisps.colors}
      sizeRange={activeConfig.wisps.sizeRange}
      spin={activeConfig.wisps.spin ?? false}
    />
  {/key}
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

<!-- Directional sun light -->
{#if activeConfig.sunLight?.enabled}
  {@const sl = activeConfig.sunLight}
  <T.DirectionalLight
    color={sl.color}
    intensity={sl.intensity}
    position.x={sl.position[0]}
    position.y={sl.position[1]}
    position.z={sl.position[2]}
  />
{/if}
