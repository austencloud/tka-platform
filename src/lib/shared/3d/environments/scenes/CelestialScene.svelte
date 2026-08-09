<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { onMount } from "svelte";
  import {
    FogExp2,
    Color,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
  } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import CloudDome from "./celestial/CloudDome.svelte";
  import GodRays from "./celestial/GodRays.svelte";
  import CelestialCloudBanks from "./celestial/CelestialCloudBanks.svelte";
  import CelestialSun from "./celestial/CelestialSun.svelte";
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
    stageZOffset?: number;
  }

  let {
    config,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultCelestialConfig());

  const activeConfig = $derived(baseConfig);

  const { scene, renderer, camera } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const cloudBankCount = $derived(
    adaptiveQuality?.contentTier === "low"
      ? 10
      : adaptiveQuality?.contentTier === "high"
        ? 20
        : 16
  );
  const celestialEnvironment = useGltf(
    "/models/celestial/celestial-environment.glb?v=seraph-20260809",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null
  );
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    const fogInstance = new FogExp2(fog.color, fog.density);
    scene.current.fog = fogInstance;
    scene.current.background = new Color(activeConfig.sky.topColor);
    return () => {
      if (!scene.current) return;
      scene.current.fog = null;
      scene.current.background = null;
    };
  });

  $effect(() => {
    const root = $celestialEnvironment?.scene;
    if (!root) {
      sceneFeatures?.reportProgress("environment", 0);
      return;
    }
    root.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      const isStage = child.name.startsWith("Stage_");
      child.castShadow = !isStage;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.metalness = 0;
        material.roughness = Math.max(material.roughness, 0.62);
        material.envMapIntensity = 0.35;
        if (isStage) {
          material.color.set("#fffaf0");
          material.emissive.set("#5b4933");
          material.emissiveIntensity = 0.035;
        } else {
          material.color.set("#fffaf1");
          material.emissiveMap = material.map;
          material.emissive.set("#fff2d8");
          material.emissiveIntensity = 0.32;
        }
        material.needsUpdate = true;
      }
    });
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    sceneFeatures?.reportProgress("environment", 1);
    sceneFeatures?.reportReady("environment");
  });

  onMount(() => {
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

<!-- Volumetric cloud dome -->
<CloudDome config={activeConfig.cloudDome} />

{#if $celestialEnvironment}
  <T.Group position.z={stageZOffset}>
    <T is={$celestialEnvironment.scene} />
  </T.Group>
{/if}

<CelestialSun />

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
    shadow.mapSize.width={2048}
    shadow.mapSize.height={2048}
    shadow.camera.near={1}
    shadow.camera.far={80}
    shadow.camera.left={-20}
    shadow.camera.right={20}
    shadow.camera.top={20}
    shadow.camera.bottom={-20}
    shadow.bias={-0.0007}
    shadow.normalBias={0.05}
    shadow.radius={3}
    shadow.intensity={0.64}
  />
{/if}

<T.DirectionalLight
  color="#b8d1f2"
  intensity={0.82}
  position.x={0}
  position.y={9}
  position.z={18}
/>

<T.PointLight
  color="#ffd09a"
  intensity={72}
  distance={52}
  decay={2}
  position.x={0}
  position.y={7.5}
  position.z={-15}
/>
