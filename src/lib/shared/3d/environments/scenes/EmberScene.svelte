<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onDestroy, onMount } from "svelte";
  import { disposeSceneGraph } from "../utils/dispose-scene";
  import {
    Vector3,
    FogExp2,
    Color,
    type MeshStandardMaterial,
    type Object3D,
  } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import LavaPool from "./ember/LavaPool.svelte";
  import LavaCracks from "./ember/LavaCracks.svelte";
  import LavaRivers from "./ember/LavaRivers.svelte";
  import ObsidianPillars from "./ember/ObsidianPillars.svelte";
  import FireWisps from "./ember/FireWisps.svelte";
  import EmberFountains from "./ember/EmberFountains.svelte";
  import VolcanicHaze from "./ember/VolcanicHaze.svelte";
  import HeatDistortion from "./ember/HeatDistortion.svelte";
  import EmberGroundDetail from "./ember/EmberGroundDetail.svelte";
  import EmberSurfaceEcology from "./ember/EmberSurfaceEcology.svelte";
  import {
    type EmberSceneConfig,
    createDefaultEmberConfig,
    isEmberAtmosphereLookId,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import ObsidianPlatform from "./ember/ObsidianPlatform.svelte";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";
  import GltfAsset from "../primitives/GltfAsset.svelte";
  import { tryGetAdaptiveQualityContext } from "../../context/adaptive-quality-context";

  interface Props {
    config?: EmberSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let { config, stageRadius = 3, stageRadiusGrowth = 0 }: Props = $props();

  const requestedLook = (() => {
    if (
      typeof window === "undefined" ||
      !import.meta.env.DEV ||
      !window.location.pathname.startsWith("/test/")
    ) {
      return undefined;
    }
    const requested = new URLSearchParams(window.location.search).get(
      "emberLook"
    );
    return isEmberAtmosphereLookId(requested) ? requested : undefined;
  })();

  const baseConfig = $derived(
    config ?? createDefaultEmberConfig(requestedLook)
  );

  const activeConfig = $derived.by(() => {
    const r = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius,
      undefined,
      stageRadiusGrowth
    );
    const enabled = baseConfig.platform.enabled || stageRadiusGrowth > 0;
    if (
      r <= baseConfig.platform.radius &&
      enabled === baseConfig.platform.enabled
    )
      return baseConfig;
    return {
      ...baseConfig,
      platform: {
        ...baseConfig.platform,
        enabled,
        radius: r,
        ...(baseConfig.platform.enabled
          ? {}
          : {
              primaryColor: "#202c3b",
              glowIntensity: 0.11,
              crackIntensity: 0.16,
              lavaSpeed: 0.18,
            }),
      },
    };
  });

  const embeddedExpansion = $derived(
    !baseConfig.platform.enabled && stageRadiusGrowth > 0
  );

  const logModel = useGltf("/models/camping/tree-log.glb");
  const logSmall = useGltf("/models/camping/tree-log-small.glb");
  const campfire = useGltf("/models/camping/campfire-pit.glb");
  let productionSliceProgress = $state(0);
  let productionSliceAsset = $state<Object3D | null>(null);

  const { scene, renderer, camera } = useThrelte();
  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const shadowsEnabled = $derived(
    adaptiveQuality?.config.enableShadows ?? true
  );

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null
  );
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  function volcanicClone(
    sourceScene: {
      clone: () => { traverse: (cb: (obj: unknown) => void) => void };
    },
    color: string,
    blend: number
  ) {
    const tintColor = new Color(color);
    const cloned = sourceScene.clone();
    cloned.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const clonedMats = mats.map((mat) => {
        const clone = (mat as MeshStandardMaterial).clone();
        if (clone.color) clone.color.lerp(tintColor, blend);
        if (clone.emissive) clone.emissive.lerp(new Color("#220800"), 0.2);
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? clonedMats
        : clonedMats[0];
    });
    return cloned;
  }

  const logPlacements: {
    x: number;
    z: number;
    scale: number;
    rotY: number;
    large: boolean;
  }[] = [
    { x: 7.0, z: -1.5, scale: 1.8, rotY: Math.PI * 0.3, large: true },
    { x: 3.5, z: -5.0, scale: 1.5, rotY: Math.PI * 0.8, large: false },
    { x: 8.5, z: -5.5, scale: 1.4, rotY: Math.PI * 1.3, large: true },
    { x: -8.0, z: -4.0, scale: 1.6, rotY: Math.PI * 0.5, large: false },
    { x: 10.0, z: 2.5, scale: 1.3, rotY: Math.PI * 1.1, large: true },
    { x: -9.5, z: 7.0, scale: 1.5, rotY: Math.PI * 0.2, large: false },
  ];

  const firePosition = $derived.by(() => {
    const fv = activeConfig.fireVent;
    if (!fv) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (fv.fireHeight * fv.fireScale) / 2;
    return new Vector3(fv.position.x, groundY + fireHalfHeight, fv.position.z);
  });

  // ── Clone caching — clone + tint once per GLB/config change, not per render

  const logClones = $derived.by(() => {
    if (!$logModel || !$logSmall || !activeConfig.fireVent?.enabled) return [];
    return logPlacements.map((log) =>
      volcanicClone((log.large ? $logModel : $logSmall)!.scene, "#0a0505", 0.6)
    );
  });

  const campfireClone = $derived($campfire ? $campfire.scene.clone() : null);

  onDestroy(() => {
    for (const c of logClones) disposeSceneGraph(c as import("three").Object3D);
    if (campfireClone)
      disposeSceneGraph(campfireClone as import("three").Object3D);
  });

  let fogInstance: FogExp2 | null = null;
  let fogBackground: Color | null = null;
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    if (!fogInstance) {
      fogInstance = new FogExp2(fog.color, fog.density);
      fogBackground = new Color(fog.color);
      scene.current.fog = fogInstance;
      scene.current.background = fogBackground;
    } else {
      fogInstance.color.set(fog.color);
      fogBackground?.set(fog.color);
      fogInstance.density = fog.density;
    }
    return () => {
      if (scene.current) {
        if (scene.current.fog === fogInstance) scene.current.fog = null;
        if (scene.current.background === fogBackground)
          scene.current.background = null;
      }
      fogInstance = null;
      fogBackground = null;
    };
  });

  function handleProductionSliceProgress(fraction: number): void {
    productionSliceProgress = fraction;
  }

  function handleProductionSliceReady(asset: Object3D): void {
    productionSliceAsset = asset;
    const treatments = activeConfig.atmosphere.materials;
    asset.traverse((child) => {
      const mesh = child as {
        isMesh?: boolean;
        material?: MeshStandardMaterial | MeshStandardMaterial[];
        castShadow: boolean;
        receiveShadow: boolean;
      };
      if (!mesh.isMesh || !mesh.material) return;

      const role = child.userData.tka_role as string | undefined;
      mesh.receiveShadow = true;
      mesh.castShadow =
        shadowsEnabled &&
        role !== "playable-surface" &&
        role !== "playable-shelf" &&
        role !== "volcanic-basin" &&
        role !== "lava-channel-levee";

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!material.isMeshStandardMaterial) continue;
        const name = material.name;
        const treatment =
          role === "playable-surface" ||
          role === "playable-shelf" ||
          role === "shelf-stratum" ||
          role === "stage-crust-transition"
            ? treatments.playableSurface
            : role?.startsWith("meshy-")
              ? treatments.meshyGeology
              : name.includes("iron-contact") ||
                  name.includes("windborne-ash") ||
                  name.includes("Mineral") ||
                  name.includes("Ash_Deposit")
                ? treatments.mineral
                : treatments.world;
        material.color.lerp(new Color(treatment.tint), treatment.tintBlend);
        material.emissive.lerp(
          new Color(treatment.emissive),
          treatment.emissiveBlend
        );
        material.emissiveIntensity = treatment.emissiveIntensity;
        material.roughness = Math.min(
          1,
          material.roughness * treatment.roughnessScale
        );
        material.metalness = Math.max(
          0,
          Math.min(1, material.metalness + treatment.metalnessAdd)
        );
        material.needsUpdate = true;
      }
    });
    asset.userData.emberAtmosphereLook = activeConfig.atmosphere.id;
    productionSliceProgress = 1;
  }

  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$logModel, $logSmall, $campfire];
    const loaded = glbs.filter(Boolean).length + productionSliceProgress;
    const total = glbs.length + 1;
    sceneFeatures.reportProgress("environment", loaded / total);
    if (loaded === total) {
      if (renderer.current && camera.current && scene.current) {
        renderer.current.compile(scene.current, camera.current);
      }
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[EmberScene] GLB loading timed out — lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Smoky volcanic sky -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Lava cracks overlay on ground -->
<LavaCracks
  config={activeConfig.lavaCracks}
  groundSize={activeConfig.ground.size}
/>

<!-- Lava pool with domain-warped shader -->
<LavaPool config={activeConfig.lavaPool} />

<!-- Gate 4 R7 owns the complete ground surface; a second flat ground plane made the world read as a graybox. -->
<GltfAsset
  url="/models/ember/ember-production-slice.glb"
  position={[0, groundY, 0]}
  onProgress={handleProductionSliceProgress}
  onReady={handleProductionSliceReady}
/>

<EmberGroundDetail scene={productionSliceAsset} />

<!-- Runtime geology breaks the playable shelf into physical clinker, rafted
     plates, and heat-stained fragments without consuming the clear stage. -->
<EmberSurfaceEcology stageRadius={activeConfig.platform.radius} />

<!-- Heat distortion shimmer above lava -->
{#if activeConfig.lavaPool.enabled}
  <HeatDistortion
    position={activeConfig.lavaPool.position}
    radius={activeConfig.lavaPool.radius * 0.7}
  />
{/if}

<!-- Lava rivers flowing from pool -->
{#if activeConfig.lavaRivers?.enabled}
  <LavaRivers
    config={activeConfig.lavaRivers}
    poolPosition={activeConfig.lavaPool.position}
  />
{/if}

{#each activeConfig.atmosphere.heatFields as field}
  <HeatDistortion
    position={field.position}
    radius={field.radius}
    height={field.height}
    intensity={field.intensity}
  />
{/each}

<!-- Obsidian crystal pillars with animated veins -->
<ObsidianPillars config={activeConfig.obsidianPillars} />

<!-- Fire vent with volumetric fire -->
{#if activeConfig.fireVent?.enabled && campfireClone}
  {@const fv = activeConfig.fireVent}
  <T
    is={campfireClone}
    position.x={fv.position.x}
    position.y={groundY}
    position.z={fv.position.z}
    scale={fv.modelScale}
  />
  <VolumetricFireComponent
    position={firePosition}
    width={1.0}
    height={fv.fireHeight}
    depth={1.0}
    scale={fv.fireScale}
    sliceSpacing={0.15}
  />
  <T.PointLight
    position.x={fv.position.x}
    position.y={groundY + fv.primaryLight.heightOffset}
    position.z={fv.position.z}
    color={fv.primaryLight.color}
    intensity={fv.primaryLight.intensity}
    distance={fv.primaryLight.distance}
    decay={fv.primaryLight.decay}
  />
  <T.PointLight
    position.x={fv.position.x}
    position.y={groundY + fv.fillLight.heightOffset}
    position.z={fv.position.z}
    color={fv.fillLight.color}
    intensity={fv.fillLight.intensity}
    distance={fv.fillLight.distance}
    decay={fv.fillLight.decay}
  />
  <T.Group
    position.x={fv.position.x}
    position.y={groundY + (fv.fireHeight * fv.fireScale) / 2 + 0.5}
    position.z={fv.position.z}
  >
    {#key fv.smokeCount}
      <FallingParticles
        type="smoke"
        count={fv.smokeCount}
        area={{ width: 1.5, height: 5, depth: 1.5 }}
        speed={0.04}
        colors={fv.smokeColors}
        sizeRange={[0.15, 0.45]}
        spin={false}
      />
    {/key}
  </T.Group>
{/if}

<!-- Drifting fire wisps with dynamic lighting -->
{#if activeConfig.fireWisps?.enabled}
  <FireWisps config={activeConfig.fireWisps} />
{/if}

<!-- Volcanic ember fountain eruptions (positioned at pool center) -->
{#if activeConfig.emberFountains?.enabled}
  <T.Group
    position.x={activeConfig.lavaPool.position.x}
    position.y={-(activeConfig.lavaPool.craterDepth ?? 0)}
    position.z={activeConfig.lavaPool.position.z}
  >
    <EmberFountains config={activeConfig.emberFountains} />
  </T.Group>
{/if}

<!-- Charred fallen logs (only with fire vent) -->
{#each logClones as clone, i}
  {@const log = logPlacements[i]}
  {#if log}
    <T.Group
      name={`EmberLog_${i}`}
      userData={{ tka_composer_id: `ember-log-${i}`, tka_role: "deadwood" }}
      position.x={log.x}
      position.y={groundY}
      position.z={log.z}
      scale={log.scale * 0.5}
      rotation.y={log.rotY}
    >
      <T is={clone} />
    </T.Group>
  {/if}
{/each}

<!-- Rising embers — main field -->
{#key activeConfig.embers.count}
  <FallingParticles
    type={activeConfig.embers.type}
    count={activeConfig.embers.count}
    area={activeConfig.embers.area}
    speed={activeConfig.embers.speed}
    colors={activeConfig.embers.colors}
    sizeRange={activeConfig.embers.sizeRange}
    spin={activeConfig.embers.spin ?? false}
  />
{/key}

<!-- Falling ash -->
{#if activeConfig.ash}
  {#key activeConfig.ash.count}
    <FallingParticles
      type={activeConfig.ash.type}
      count={activeConfig.ash.count}
      area={activeConfig.ash.area}
      speed={activeConfig.ash.speed}
      colors={activeConfig.ash.colors}
      sizeRange={activeConfig.ash.sizeRange}
      spin={activeConfig.ash.spin ?? false}
    />
  {/key}
{/if}

<!-- Ambient smoke layer -->
{#if activeConfig.smoke}
  {#key activeConfig.smoke.count}
    <FallingParticles
      type={activeConfig.smoke.type}
      count={activeConfig.smoke.count}
      area={activeConfig.smoke.area}
      speed={activeConfig.smoke.speed}
      colors={activeConfig.smoke.colors}
      sizeRange={activeConfig.smoke.sizeRange}
      spin={activeConfig.smoke.spin ?? false}
    />
  {/key}
{/if}

<!-- Floating glowing cinders -->
{#if activeConfig.cinders}
  {#key activeConfig.cinders.count}
    <FallingParticles
      type={activeConfig.cinders.type}
      count={activeConfig.cinders.count}
      area={activeConfig.cinders.area}
      speed={activeConfig.cinders.speed}
      colors={activeConfig.cinders.colors}
      sizeRange={activeConfig.cinders.sizeRange}
      spin={activeConfig.cinders.spin ?? false}
    />
  {/key}
{/if}

<!-- Atmospheric volcanic haze dome -->
{#if activeConfig.volcanicHaze?.enabled}
  <VolcanicHaze config={activeConfig.volcanicHaze} />
{/if}

<!-- Layered fumaroles stitch the playable shelf into the distant active caldera. -->
{#each activeConfig.atmosphere.plumes as plume}
  <T.Group
    position.x={plume.position[0]}
    position.y={groundY + plume.position[1]}
    position.z={plume.position[2]}
  >
    <FallingParticles
      type="smoke"
      count={plume.count}
      area={plume.area}
      speed={plume.speed}
      colors={plume.colors}
      sizeRange={plume.sizeRange}
      spin={false}
      opacity={plume.opacity}
      emissionShape="ellipse"
      motionScale={plume.motionScale}
    />
  </T.Group>
{/each}

<T.PointLight
  position={[
    activeConfig.atmosphere.calderaLight.position[0],
    groundY + activeConfig.atmosphere.calderaLight.position[1],
    activeConfig.atmosphere.calderaLight.position[2],
  ]}
  color={activeConfig.atmosphere.calderaLight.color}
  intensity={activeConfig.atmosphere.calderaLight.intensity}
  distance={activeConfig.atmosphere.calderaLight.distance}
  decay={activeConfig.atmosphere.calderaLight.decay}
/>

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

<!-- Directional volcanic sky light -->
{#if activeConfig.skyLight?.enabled}
  {@const sl = activeConfig.skyLight}
  <T.DirectionalLight
    color={sl.color}
    intensity={sl.intensity}
    position.x={sl.position[0]}
    position.y={sl.position[1]}
    position.z={sl.position[2]}
    castShadow={shadowsEnabled}
    shadow.mapSize.width={1024}
    shadow.mapSize.height={1024}
    shadow.camera.near={1}
    shadow.camera.far={120}
    shadow.camera.left={-42}
    shadow.camera.right={42}
    shadow.camera.top={42}
    shadow.camera.bottom={-42}
    shadow.bias={-0.0007}
    shadow.normalBias={0.045}
    shadow.radius={3}
    shadow.intensity={0.55}
  />
{/if}

<!-- The look owns one complementary sky key and a restrained lava-bounce rig. -->
{#each activeConfig.atmosphere.directionals as light}
  <T.DirectionalLight
    position={light.position}
    color={light.color}
    intensity={light.intensity}
  />
{/each}

{#each activeConfig.atmosphere.points as light}
  <T.PointLight
    position={[
      light.position[0],
      groundY + light.position[1],
      light.position[2],
    ]}
    color={light.color}
    intensity={light.intensity}
    distance={light.distance}
    decay={light.decay}
  />
{/each}

<ObsidianPlatform config={activeConfig.platform} embedded={embeddedExpansion} />
