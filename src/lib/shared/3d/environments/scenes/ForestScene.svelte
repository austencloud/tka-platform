<script lang="ts">
  /**
   * ForestScene
   *
   * A forest clearing environment with KayKit 3D models arranged in a ring
   * around the performer. Includes falling leaves and supports autumn/firefly variants.
   *
   * Production callers pass just `variant` and get the baked-in look.
   * The Scene Lab can pass a full `config` object instead to drive every
   * knob reactively for tuning.
   */

  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { ForestVariant } from "../domain/enums/environment-enums";
  import {
    type ForestSceneConfig,
    createDefaultForestFireflyConfig,
    createDefaultForestAutumnConfig,
  } from "../domain/models/scene-configs";
  import { onMount } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import { Vector3, FogExp2, Color } from "three";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    /** Color variant. Ignored if `config` is provided. */
    variant?: ForestVariant;
    /** Full scene config (overrides variant defaults). Used by Scene Lab. */
    config?: ForestSceneConfig;
  }

  let { variant = "autumn", config }: Props = $props();

  // When no explicit config, fall back to the variant's baked defaults.
  const activeConfig = $derived(
    config ??
      (variant === "firefly"
        ? createDefaultForestFireflyConfig()
        : createDefaultForestAutumnConfig())
  );

  /** R2 CDN base URL for large assets */
  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  const tree1 = useGltf(`${R2_CDN}/models/forest/Tree_1_A_Color1.gltf`);
  const tree2 = useGltf(`${R2_CDN}/models/forest/Tree_2_A_Color1.gltf`);
  const tree3 = useGltf(`${R2_CDN}/models/forest/Tree_3_A_Color1.gltf`);
  const rock1 = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`);
  const rock2 = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`);
  const bush1 = useGltf(`${R2_CDN}/models/forest/Bush_1_A_Color1.gltf`);
  const bush2 = useGltf(`${R2_CDN}/models/forest/Bush_2_A_Color1.gltf`);

  const campfire = useGltf("/models/camping/campfire-pit.glb");
  const tent = useGltf("/models/camping/tent-canvas.glb");
  const fallenLog = useGltf("/models/camping/tree-log.glb");
  const fallenLogSmall = useGltf("/models/camping/tree-log-small.glb");

  const { scene } = useThrelte();

  // ========================================
  // All positions and scales in METERS (1 unit = 1 meter)
  // ========================================

  // Scene feature context - gate campfire/tent visibility and report loading readiness
  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(null);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // ForestScene may be rendered outside the scene feature system (e.g. standalone environments).
    // In that case, all features are shown and no readiness reporting is needed.
  }

  // Tree placements derived reactively from config
  const treePlacements = $derived.by(() => {
    return activeConfig.treeRings.flatMap((ring, ringIndex) =>
      Array.from({ length: ring.count }, (_, i) => {
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation =
          ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;
        const scale =
          ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotation = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;
        return [x, z, scale, rotation] as [number, number, number, number];
      })
    );
  });

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  const bushPlacements = $derived.by(() => {
    const count = activeConfig.bushCount;
    const clearingRadius = activeConfig.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.15;
      const radius = clearingRadius - 1.5 + Math.sin(i * 5.3) * 1.75;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.4 + Math.abs(Math.sin(i * 2.1) * 0.25);
      const rotation = Math.sin(i * 3.4) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  // Fallen log placements stay hand-authored - they're intentional focal details.
  const fallenLogPlacements: [number, number, number, number, boolean][] = [
    [7.0, 4.0, 2.0, Math.PI * 0.3, true],
    [-6.0, 5.5, 1.75, Math.PI * 0.7, true],
    [4.5, -6.5, 1.5, Math.PI * 1.2, false],
    [-7.5, -3.0, 1.4, Math.PI * 0.1, false],
    [11.0, 2.0, 1.6, Math.PI * 0.5, true],
    [-10.0, -6.0, 1.5, Math.PI * 1.4, false],
    [9.0, -9.0, 1.75, Math.PI * 0.9, true],
    [14.0, 7.5, 1.4, Math.PI * 0.2, false],
    [-13.0, 9.0, 1.5, Math.PI * 1.1, true],
  ];

  const groundY = $derived(userProportionsState.groundY);

  // Fire emitter position (reactive to config + groundY)
  const firePosition = $derived.by(() => {
    const cf = activeConfig.campfire;
    if (!cf) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (cf.fireHeight * cf.fireScale) / 2;
    return new Vector3(cf.position.x, groundY + fireHalfHeight, cf.position.z);
  });

  // Apply fog reactively
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // Report per-GLB progress so the loading curtain fills smoothly
  // instead of jumping 0% → 100%.
  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$tree1, $tree2, $tree3, $rock1, $rock2, $bush1, $bush2, $campfire, $tent, $fallenLog, $fallenLogSmall];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
  });

  // Safety valve: if GLBs stall (CDN timeout, CORS failure), lift the
  // curtain after 15 s so the user isn't stuck on a permanent loading screen.
  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[ForestScene] GLB loading timed out - lifting curtain");
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

{#key `${activeConfig.leaves.count}|${activeConfig.leaves.sizeRange[0]}|${activeConfig.leaves.sizeRange[1]}|${activeConfig.leaves.area.width}|${activeConfig.leaves.speed}|${activeConfig.leaves.spin}`}
  <FallingParticles
    type={activeConfig.leaves.type}
    count={activeConfig.leaves.count}
    area={activeConfig.leaves.area}
    speed={activeConfig.leaves.speed}
    colors={activeConfig.leaves.colors}
    sizeRange={activeConfig.leaves.sizeRange}
    spin={activeConfig.leaves.spin}
  />
{/key}

{#if activeConfig.fireflies}
  {#key `${activeConfig.fireflies.count}|${activeConfig.fireflies.sizeRange[0]}|${activeConfig.fireflies.sizeRange[1]}|${activeConfig.fireflies.area.width}`}
    <FallingParticles
      type={activeConfig.fireflies.type}
      count={activeConfig.fireflies.count}
      area={activeConfig.fireflies.area}
      speed={activeConfig.fireflies.speed}
      colors={activeConfig.fireflies.colors}
      sizeRange={activeConfig.fireflies.sizeRange}
      spin={activeConfig.fireflies.spin}
    />
  {/key}
{/if}

{#if $tree1 && $tree2 && $tree3}
  {#each treePlacements as [x, z, scale, rotY], i}
    {@const treeModel = i % 3 === 0 ? $tree1 : i % 3 === 1 ? $tree2 : $tree3}
    <T
      is={treeModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

{#if $rock1 && $rock2}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const rockModel = i % 2 === 0 ? $rock1 : $rock2}
    <T
      is={rockModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

{#if $bush1 && $bush2}
  {#each bushPlacements as [x, z, scale, rotY], i}
    {@const bushModel = i % 2 === 0 ? $bush1 : $bush2}
    <T
      is={bushModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

{#if $fallenLog && $fallenLogSmall}
  {#each fallenLogPlacements as [x, z, scale, rotY, isLarge]}
    {@const logModel = isLarge ? $fallenLog : $fallenLogSmall}
    <T
      is={logModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

{#if activeConfig.campfire?.enabled && $campfire && (sceneFeatures?.isEnabled("campfire") ?? true)}
  {@const cf = activeConfig.campfire}
  <T
    is={$campfire.scene.clone()}
    position.x={cf.position.x}
    position.y={groundY}
    position.z={cf.position.z}
    scale={cf.modelScale}
  />
  <VolumetricFireComponent
    position={firePosition}
    width={1.0}
    height={cf.fireHeight}
    depth={1.0}
    scale={cf.fireScale}
    sliceSpacing={0.15}
  />
  <T.PointLight
    position.x={cf.position.x}
    position.y={groundY + cf.primaryLight.heightOffset}
    position.z={cf.position.z}
    color={cf.primaryLight.color}
    intensity={cf.primaryLight.intensity}
    distance={cf.primaryLight.distance}
    decay={cf.primaryLight.decay}
  />
  <T.PointLight
    position.x={cf.position.x}
    position.y={groundY + cf.fillLight.heightOffset}
    position.z={cf.position.z}
    color={cf.fillLight.color}
    intensity={cf.fillLight.intensity}
    distance={cf.fillLight.distance}
    decay={cf.fillLight.decay}
  />
  <T.Group
    position.x={cf.position.x}
    position.y={groundY + (cf.fireHeight * cf.fireScale) / 2 + 0.5}
    position.z={cf.position.z}
  >
    {#key cf.smokeCount}
      <FallingParticles
        type="smoke"
        count={cf.smokeCount}
        area={{ width: 1, height: 4, depth: 1 }}
        speed={0.04}
        colors={cf.smokeColors}
        sizeRange={[0.15, 0.4]}
        spin={false}
      />
    {/key}
  </T.Group>
{/if}

<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

{#if activeConfig.tent.enabled && $tent && (sceneFeatures?.isEnabled("tent") ?? true)}
  <T
    is={$tent.scene.clone()}
    position.x={activeConfig.tent.position.x}
    position.y={groundY}
    position.z={activeConfig.tent.position.z}
    scale={activeConfig.tent.scale}
    rotation.y={activeConfig.tent.rotationY}
  />
{/if}
