<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { onMount } from "svelte";
  import { FogExp2, Color } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import StationPlatform from "./cosmic/StationPlatform.svelte";
  import EarthSphere from "./cosmic/EarthSphere.svelte";
  import NebulaLayer from "./cosmic/NebulaLayer.svelte";
  import EnergyParticles from "./cosmic/EnergyParticles.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
  import EarthGodRays from "./cosmic/EarthGodRays.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import type { CosmicVariant } from "../domain/enums/environment-enums";
  import {
    type CosmicSceneConfig,
    createDefaultCosmicNightConfig,
    createDefaultCosmicAuroraConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";

  interface Props {
    variant?: CosmicVariant;
    config?: CosmicSceneConfig;
    performerCount?: number;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let {
    variant = "night",
    config,
    performerCount = 1,
    stageRadius = 3,
    stageRadiusGrowth = 0,
  }: Props = $props();

  const defaultConfigs = {
    night: createDefaultCosmicNightConfig,
    aurora: createDefaultCosmicAuroraConfig,
  };

  const baseConfig = $derived(config ?? defaultConfigs[variant]());

  const activeConfig = $derived.by(() => {
    const r = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius,
      undefined,
      stageRadiusGrowth
    );
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const platformExpanded = $derived(
    activeConfig.platform.radius > baseConfig.platform.radius
  );

  // The authored reliquary owns the solo mechanism. Once the cast outgrows it,
  // the live deck becomes the complete mechanism instead of leaving a small
  // metal ring stranded in the middle of a larger safety surface.
  const performanceDeckConfig = $derived({
    ...activeConfig.platform,
    shape: "circle" as const,
    baseColor: "#070b12",
    emissiveIntensity: platformExpanded
      ? activeConfig.platform.emissiveIntensity
      : 0.08,
    gridIntensity: platformExpanded ? activeConfig.platform.gridIntensity : 0,
    accentLightCount: platformExpanded
      ? activeConfig.platform.accentLightCount
      : 0,
  });

  const { scene } = useThrelte();
  const groundY = $derived(userProportionsState.groundY);
  const environmentGlb = useGltf("/models/cosmic/cosmic-reliquary.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });

  $effect(() => {
    const authoredScene = $environmentGlb?.scene;
    if (!authoredScene) return;

    const authoredPlatform = authoredScene.children.filter(
      (child) => child.name !== "AR_Terrain"
    );
    for (const child of authoredPlatform) child.visible = !platformExpanded;

    return () => {
      for (const child of authoredPlatform) child.visible = true;
    };
  });

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
    const authoredReady = Boolean($environmentGlb);
    const planetReady = earthReady || !activeConfig.earth.enabled;
    sceneFeatures.reportProgress(
      "environment",
      (authoredReady ? 0.7 : 0) + (planetReady ? 0.3 : 0)
    );
    if (authoredReady && planetReady) {
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn(
          "[CosmicScene] texture loading timed out — lifting curtain"
        );
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

{#if $environmentGlb}
  <T.Group position.y={groundY}>
    <T is={$environmentGlb.scene} />
  </T.Group>
{/if}

<StationPlatform config={performanceDeckConfig} />

<EarthSphere config={activeConfig.earth} onReady={() => (earthReady = true)} />

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
