<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onMount } from "svelte";
  import { FogExp2, Color, MeshStandardMaterial } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import StationPlatform from "./cosmic/StationPlatform.svelte";
  import EarthSphere from "./cosmic/EarthSphere.svelte";
  import NebulaLayer from "./cosmic/NebulaLayer.svelte";
  import EnergyParticles from "./cosmic/EnergyParticles.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
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
  }

  let { variant = "night", config }: Props = $props();

  const defaultConfigs = {
    night: createDefaultCosmicNightConfig,
    aurora: createDefaultCosmicAuroraConfig,
  };

  const activeConfig = $derived(config ?? defaultConfigs[variant]());

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

  const rockA = useGltf("/models/winter/rock_largeA.glb");
  const rockB = useGltf("/models/winter/rock_largeB.glb");

  const lunarMat = new MeshStandardMaterial({
    color: new Color("#3a3a44"),
    roughness: 0.9,
    metalness: 0.1,
  });

  function lunarClone(sourceScene: {
    clone: () => { traverse: (cb: (obj: unknown) => void) => void };
  }) {
    const cloned = sourceScene.clone();
    cloned.traverse((obj: unknown) => {
      const mesh = obj as { isMesh?: boolean; material?: unknown };
      if (!mesh.isMesh) return;
      mesh.material = lunarMat;
    });
    return cloned;
  }

  const rockPlacements: [number, number, number, number][] = [
    [5.5, -4.0, 0.6, 0.4],
    [-4.5, -6.0, 0.5, 1.8],
    [8.0, 2.5, 0.8, 2.5],
    [-7.0, 5.0, 0.45, 0.9],
    [-3.0, 8.5, 0.7, 3.1],
    [6.5, 7.0, 0.35, 1.2],
    [-9.0, -2.0, 0.55, 2.0],
    [3.0, -9.0, 0.5, 4.2],
  ];
</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<NebulaLayer config={activeConfig.nebula} />

{#if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
  <TexturedGroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    diffuseMap={activeConfig.ground.diffuseMap}
    normalMap={activeConfig.ground.normalMap}
    roughnessMap={activeConfig.ground.roughnessMap}
    normalScale={activeConfig.ground.normalScale ?? 1.0}
    textureRepeat={activeConfig.ground.textureRepeat ?? 8}
  />
{:else}
  <GroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    opacity={activeConfig.ground.opacity ?? 1}
  />
{/if}

{#if $rockA && $rockB}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const source = i % 2 === 0 ? $rockA : $rockB}
    <T
      is={lunarClone(source.scene)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      scale={scale * 2.0}
      rotation.y={rotY}
    />
  {/each}
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

{#if activeConfig.particles.starDrift}
  {#key `stars-${activeConfig.particles.starDrift.count}`}
    <FallingParticles
      type={activeConfig.particles.starDrift.type}
      count={activeConfig.particles.starDrift.count}
      area={activeConfig.particles.starDrift.area}
      speed={activeConfig.particles.starDrift.speed}
      colors={activeConfig.particles.starDrift.colors}
      sizeRange={activeConfig.particles.starDrift.sizeRange}
      spin={activeConfig.particles.starDrift.spin ?? false}
    />
  {/key}
{/if}

{#if activeConfig.particles.cosmicDust}
  {#key `dust-${activeConfig.particles.cosmicDust.count}`}
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
  {#key `energy-${activeConfig.particles.energyParticles.count}`}
    <EnergyParticles config={activeConfig.particles.energyParticles} />
  {/key}
{/if}

{#if activeConfig.particles.meteorStreaks}
  <MeteorStreaks config={activeConfig.particles.meteorStreaks} />
{/if}
