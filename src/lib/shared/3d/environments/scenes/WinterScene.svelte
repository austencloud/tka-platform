<script lang="ts">
  /**
   * WinterScene: Moonlit Winter Hollow
   *
   * The static landscape comes from the deterministic Blender source. Runtime
   * owners remain responsible for snowfall, reflective ice, fire, steam,
   * lighting, and the interactive ice platform.
   */

  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { onMount } from "svelte";
  import {
    Color,
    FogExp2,
    Vector3,
    type InstancedMesh,
    type Object3D,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import type { WinterSceneConfig } from "../domain/models/scene-configs";
  import { createDefaultWinterConfig } from "../domain/models/scene-configs";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import IcePlatform from "./winter/IcePlatform.svelte";
  import WinterPond from "./winter/runtime/WinterPond.svelte";
  import {
    capWinterDetailTier,
    winterDetailTierFromAmount,
    winterObjectIsVisible,
  } from "./winter/authored/winter-layout";
  import {
    detectWinterQuality,
    getWinterQualityConfig,
  } from "./winter/quality/winter-quality";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";

  interface Props {
    config?: WinterSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
    stageZOffset?: number;
    platformVisible?: boolean;
  }

  let {
    config,
    stageRadius = 3,
    stageRadiusGrowth = 0,
    stageZOffset = 0,
    platformVisible = true,
  }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultWinterConfig());
  const activeConfig = $derived.by(() => {
    const radius = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius,
      undefined,
      stageRadiusGrowth
    );
    if (radius === baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius },
    };
  });

  const { scene, renderer, camera } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const deviceTier = $derived(
    adaptiveQuality?.contentTier ?? detectWinterQuality(renderer.current)
  );
  const requestedTier = $derived(
    winterDetailTierFromAmount(activeConfig.forestDetail ?? 1)
  );
  const tier = $derived(capWinterDetailTier(requestedTier, deviceTier));
  const quality = $derived(getWinterQualityConfig(tier));
  const groundY = $derived(userProportionsState.groundY);

  const winterEnvironment = useGltf("/models/winter/winter-environment.glb", {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });

  $effect(() => {
    const root = $winterEnvironment?.scene;
    if (!root) return;
    root.traverse((child: Object3D) => {
      if ("isInstancedMesh" in child && child.isInstancedMesh) {
        const instance = child as InstancedMesh;
        const maximumCount =
          typeof instance.userData.winterMaximumCount === "number"
            ? instance.userData.winterMaximumCount
            : instance.count;
        instance.userData.winterMaximumCount = maximumCount;
        instance.count = Math.max(
          1,
          Math.ceil(maximumCount * quality.sceneryMultiplier)
        );
        child.visible = instance.count > 0;
      } else {
        child.visible = winterObjectIsVisible(child.name, tier);
      }
      if (!("isMesh" in child) || !child.isMesh) return;
      const mesh = child as Object3D & {
        castShadow: boolean;
        receiveShadow: boolean;
      };
      mesh.castShadow = quality.shadows;
      mesh.receiveShadow = true;
    });
  });

  const snowCount = $derived(
    Math.round(activeConfig.snow.count * quality.snowMultiplier)
  );

  const firePosition = $derived.by(() => {
    const campfireConfig = activeConfig.campfire;
    if (!campfireConfig) return new Vector3(0, groundY, 0);
    const fireHalfHeight =
      (campfireConfig.fireHeight * campfireConfig.fireScale) / 2;
    return new Vector3(
      campfireConfig.position.x,
      groundY + (campfireConfig.groundOffset ?? 0) + fireHalfHeight,
      campfireConfig.position.z
    );
  });

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    const fogInstance = new FogExp2(fog.color, fog.density);
    scene.current.fog = fogInstance;
    scene.current.background = new Color(fog.color);
    return () => {
      if (!scene.current) return;
      scene.current.fog = null;
      scene.current.background = null;
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  let readyReported = false;
  $effect(() => {
    const loaded = $winterEnvironment ? 1 : 0;
    sceneFeatures?.reportProgress("environment", loaded);
    if (loaded === 1 && !readyReported) {
      readyReported = true;
      if (renderer.current && camera.current && scene.current) {
        renderer.current.compile(scene.current, camera.current);
      }
      sceneFeatures?.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[WinterScene] loading timed out - lifting curtain");
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
  moon={activeConfig.moon}
/>

{#if activeConfig.starfield}
  <Starfield config={activeConfig.starfield} />
{/if}

{#if $winterEnvironment}
  <T is={$winterEnvironment.scene} position.y={groundY} />
{/if}

{#if activeConfig.pond?.enabled}
  <WinterPond
    pond={activeConfig.pond}
    {groundY}
    surfaceDetail={quality.pondSurfaceDetail}
  />
{/if}

{#key snowCount}
  <FallingParticles
    type={activeConfig.snow.type}
    count={snowCount}
    area={activeConfig.snow.area}
    speed={activeConfig.snow.speed}
    colors={activeConfig.snow.colors}
    sizeRange={activeConfig.snow.sizeRange}
    spin={activeConfig.snow.spin}
  />
{/key}

{#if activeConfig.campfire?.enabled}
  {@const fire = activeConfig.campfire}
  <VolumetricFireComponent
    position={firePosition}
    width={1}
    height={fire.fireHeight}
    depth={1}
    scale={fire.fireScale}
    sliceSpacing={0.15}
  />
  <T.PointLight
    position.x={fire.position.x}
    position.y={groundY +
      (fire.groundOffset ?? 0) +
      fire.primaryLight.heightOffset}
    position.z={fire.position.z}
    color={fire.primaryLight.color}
    intensity={fire.primaryLight.intensity}
    distance={fire.primaryLight.distance}
    decay={fire.primaryLight.decay}
  />
  <T.PointLight
    position.x={fire.position.x}
    position.y={groundY +
      (fire.groundOffset ?? 0) +
      fire.fillLight.heightOffset}
    position.z={fire.position.z}
    color={fire.fillLight.color}
    intensity={fire.fillLight.intensity}
    distance={fire.fillLight.distance}
    decay={fire.fillLight.decay}
  />
  <T.Group
    position.x={fire.position.x}
    position.y={groundY +
      (fire.groundOffset ?? 0) +
      (fire.fireHeight * fire.fireScale) / 2 +
      0.4}
    position.z={fire.position.z}
  >
    {#key fire.smokeCount}
      <FallingParticles
        type="steam"
        count={fire.smokeCount}
        area={{ width: 1.8, height: 5, depth: 1.8 }}
        speed={0.08}
        colors={fire.smokeColors}
        sizeRange={[0.18, 0.42]}
        spin={false}
        opacity={0.22}
      />
    {/key}
  </T.Group>
{/if}

{#if activeConfig.cabin.enabled}
  {@const lodge = activeConfig.cabin}
  {#if lodge.smoke.enabled}
    <T.Group
      position.x={lodge.smoke.position.x}
      position.y={groundY + lodge.smoke.heightOffset}
      position.z={lodge.smoke.position.z}
    >
      {#key lodge.smoke.count}
        <FallingParticles
          type="smoke"
          count={lodge.smoke.count}
          area={lodge.smoke.area}
          speed={lodge.smoke.speed}
          colors={lodge.smoke.colors}
          sizeRange={lodge.smoke.sizeRange}
          spin={false}
          opacity={lodge.smoke.opacity}
          emissionShape="ellipse"
        />
      {/key}
    </T.Group>
  {/if}
  {#if lodge.windowLight.enabled}
    <T.PointLight
      position.x={lodge.windowLight.position.x}
      position.y={groundY + lodge.windowLight.heightOffset}
      position.z={lodge.windowLight.position.z}
      color={lodge.windowLight.color}
      intensity={lodge.windowLight.intensity}
      distance={lodge.windowLight.distance}
      decay={lodge.windowLight.decay}
    />
  {/if}
{/if}

<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

{#if activeConfig.moonLight?.enabled}
  {@const moon = activeConfig.moonLight}
  <T.DirectionalLight
    color={moon.color}
    intensity={moon.intensity}
    position.x={moon.position[0]}
    position.y={moon.position[1]}
    position.z={moon.position[2]}
    castShadow={quality.shadows}
  />
{/if}

{#if platformVisible}
  <T.Group position.z={stageZOffset}>
    <IcePlatform config={activeConfig.platform} />
  </T.Group>
{/if}
