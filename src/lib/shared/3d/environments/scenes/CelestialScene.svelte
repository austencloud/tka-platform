<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { FogExp2, Color } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import CloudSkyDome from "../primitives/CloudSkyDome.svelte";
  import GodRays from "./celestial/GodRays.svelte";
  import CelestialCloudBanks from "./celestial/CelestialCloudBanks.svelte";
  import CelestialCloudPanorama from "./celestial/CelestialCloudPanorama.svelte";
  import CelestialInteraction from "./celestial/CelestialInteraction.svelte";
  import OliveCloudbreakSlice from "./celestial/OliveCloudbreakSlice.svelte";
  import CelestialSun from "./celestial/CelestialSun.svelte";
  import { CLOUDBREAK_SKY_SUN } from "./celestial/cloudbreak-layout";
  import {
    type CelestialSceneConfig,
    createDefaultCelestialConfig,
  } from "../domain/models/scene-configs";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";

  interface Props {
    config?: CelestialSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageRadius?: number;
    stageRadiusGrowth?: number;
    stageZOffset?: number;
    /** World-space lift applied by Environment3D to the declarative scene tree. */
    worldYOffset?: number;
    /** Retained film worlds load while hidden but only the active one owns globals. */
    active?: boolean;
  }

  let {
    config,
    stageWidth = 6,
    stageDepth = 6,
    stageRadius = 3,
    stageRadiusGrowth = 0,
    stageZOffset = 0,
    worldYOffset = 0,
    active = true,
  }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultCelestialConfig());

  const activeConfig = $derived(baseConfig);

  const { scene } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const cloudBankCount = $derived(
    adaptiveQuality?.contentTier === "low"
      ? 12
      : adaptiveQuality?.contentTier === "high"
        ? 26
        : 20
  );
  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null
  );
  let cloudbreakLoaded = $state(false);
  let interactionPulse = $state(0);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  $effect(() => {
    if (!active) return;
    if (!scene.current) return;
    const fog = activeConfig.fog;
    const fogInstance = new FogExp2(fog.color, fog.density);
    scene.current.fog = fogInstance;
    const background = new Color(activeConfig.sky.topColor);
    scene.current.background = background;
    return () => {
      if (!scene.current) return;
      if (scene.current.fog === fogInstance) scene.current.fog = null;
      if (scene.current.background === background)
        scene.current.background = null;
    };
  });

  function handleCloudbreakReady(): void {
    cloudbreakLoaded = true;
  }

  $effect(() => {
    if (!active) return;
    sceneFeatures?.reportProgress("environment", cloudbreakLoaded ? 1 : 0);
    if (cloudbreakLoaded) {
      sceneFeatures?.reportReady("environment");
    }
  });

  $effect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[CelestialScene] loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Warm celestial sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<CelestialCloudPanorama />

<!-- Volumetric cloud dome -->
<CloudSkyDome config={activeConfig.cloudDome} />

<OliveCloudbreakSlice
  {interactionPulse}
  {stageRadius}
  {stageRadiusGrowth}
  {worldYOffset}
  {active}
  onReady={handleCloudbreakReady}
/>

<CelestialSun
  direction={CLOUDBREAK_SKY_SUN.direction}
  angularDiameterDegrees={CLOUDBREAK_SKY_SUN.angularDiameterDegrees}
  color={CLOUDBREAK_SKY_SUN.color}
  pulse={interactionPulse}
/>

{#if activeConfig.godRays.enabled}
  <GodRays config={activeConfig.godRays} />
{/if}

{#if activeConfig.cloudIslands.enabled}
  <CelestialCloudBanks
    config={activeConfig.cloudIslands}
    count={cloudBankCount}
    {stageWidth}
    {stageDepth}
  />
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
    castShadow
    shadow.mapSize.width={1024}
    shadow.mapSize.height={1024}
    shadow.camera.near={1}
    shadow.camera.far={180}
    shadow.camera.left={-32}
    shadow.camera.right={32}
    shadow.camera.top={28}
    shadow.camera.bottom={-28}
    shadow.bias={-0.0007}
    shadow.normalBias={0.05}
    shadow.radius={3}
    shadow.intensity={0.64}
  />
{/if}

<T.DirectionalLight
  color="#bfd3e8"
  intensity={0.42}
  position.x={-18}
  position.y={12}
  position.z={24}
/>

<CelestialInteraction onActivate={() => (interactionPulse += 1)} />
