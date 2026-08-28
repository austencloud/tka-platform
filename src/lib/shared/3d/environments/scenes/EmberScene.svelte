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
  import {
    type EmberSceneConfig,
    createDefaultEmberConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import ObsidianPlatform from "./ember/ObsidianPlatform.svelte";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";
  import GltfAsset from "../primitives/GltfAsset.svelte";
  import volcanicWorldR7 from "../domain/models/scene-configs/ember-volcanic-world-r7.json";

  interface Props {
    config?: EmberSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let { config, stageRadius = 3, stageRadiusGrowth = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultEmberConfig());

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

  const lavaRiverMouth = $derived.by(() => {
    const points = activeConfig.lavaRivers?.channels[0]?.points;
    const mouth = points?.[points.length - 1];
    return mouth
      ? { x: mouth[0], z: mouth[1] }
      : activeConfig.lavaPool.position;
  });

  const logModel = useGltf("/models/camping/tree-log.glb");
  const logSmall = useGltf("/models/camping/tree-log-small.glb");
  const campfire = useGltf("/models/camping/campfire-pit.glb");
  let productionSliceProgress = $state(0);

  const { scene, renderer, camera } = useThrelte();

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

  function handleProductionSliceReady(_asset: Object3D): void {
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
  <HeatDistortion
    position={lavaRiverMouth}
    radius={2.4}
    height={4.5}
    intensity={0.035}
  />
{/if}

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

<!-- One distant plume makes the 100 m vent read as a working volcano, not a prop. -->
<T.Group
  position.x={volcanicWorldR7.distantVent.centerRuntimeXZ[0]}
  position.y={groundY + volcanicWorldR7.distantVent.height + 10}
  position.z={volcanicWorldR7.distantVent.centerRuntimeXZ[1]}
>
  <FallingParticles
    type="smoke"
    count={48}
    area={{ width: 15, height: 28, depth: 13 }}
    speed={0.032}
    colors={["#403b3a", "#383637", "#49413e", "#303436"]}
    sizeRange={[1.0, 2.4]}
    spin={false}
    opacity={0.09}
    emissionShape="ellipse"
    motionScale={0.72}
  />
</T.Group>

<T.PointLight
  position.x={volcanicWorldR7.distantVent.centerRuntimeXZ[0]}
  position.y={groundY + volcanicWorldR7.distantVent.height * 0.72}
  position.z={volcanicWorldR7.distantVent.centerRuntimeXZ[1]}
  color="#ff3d0d"
  intensity={92}
  distance={34}
  decay={2}
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
  />
{/if}

<!-- Opposing moon fills keep the caldera sculptural through the complete orbit. -->
<T.DirectionalLight position={[14, 11, 18]} color="#c8cbc3" intensity={0.72} />
<T.DirectionalLight position={[-16, 8, 10]} color="#687e80" intensity={0.46} />
<T.DirectionalLight position={[0, 22, 3]} color="#eee4d5" intensity={0.36} />
<T.DirectionalLight position={[-30, 18, 82]} color="#8b4330" intensity={0.34} />

<!-- Local heat reveals the faults without washing the whole scene orange. -->
<T.PointLight
  position={[-7.0, groundY + 8.0, 14.0]}
  color="#a9c1bd"
  intensity={145}
  distance={36}
  decay={2}
/>
<T.PointLight
  position={[2.4, groundY + 3.2, 13.2]}
  color="#ff5418"
  intensity={30}
  distance={16}
  decay={2}
/>
<T.PointLight
  position={[-5.0, groundY + 0.75, -0.5]}
  color="#ff5418"
  intensity={16}
  distance={7}
  decay={2}
/>
<T.PointLight
  position={[1.4, groundY + 3.8, 13.35]}
  color="#ff3d0d"
  intensity={38}
  distance={12}
  decay={2}
/>

<ObsidianPlatform config={activeConfig.platform} embedded={embeddedExpansion} />
