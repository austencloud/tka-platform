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
  import { useGltf, useMeshopt } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import Starfield from "../primitives/Starfield.svelte";
  import MeteorStreaks from "./cosmic/MeteorStreaks.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { ForestVariant } from "../domain/enums/environment-enums";
  import {
    type ForestSceneConfig,
    createDefaultForestFireflyConfig,
  } from "../domain/models/scene-configs";
  import { onMount } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import Stage3D from "../../components/Stage3D.svelte";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import { Vector3, FogExp2, Color } from "three";
  import { onDestroy } from "svelte";
  import { disposeSceneGraph } from "../utils/dispose-scene";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    /** Color variant. Ignored if `config` is provided. */
    variant?: ForestVariant;
    /** Full scene config (overrides variant defaults). Used by Scene Lab. */
    config?: ForestSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Hide the single built-in Stage3D (hub mounts its own coven stages). */
    showStage?: boolean;
    /** Override the clearing radius so the hub can widen it for N stations. */
    clearingRadius?: number;
  }

  let {
    variant = "firefly", config, stageWidth = 6, stageDepth = 4.5, stageZOffset = 0,
    showStage = true, clearingRadius,
  }: Props = $props();

  const activeConfig = $derived.by(() => {
    const base = config ?? createDefaultForestFireflyConfig();
    return clearingRadius != null ? { ...base, clearingRadius } : base;
  });

  import { R2_CDN } from "../../constants/r2-cdn";

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
  const forestEnvironment = useGltf("/models/forest/forest-environment.glb", {
    meshoptDecoder: useMeshopt(),
  });

  const { scene, renderer, camera } = useThrelte();

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

  // ── Clone caching — clone once per GLB load, not per render ─────────

  const treeClones = $derived.by(() => {
    if (!$tree1 || !$tree2 || !$tree3) return [];
    const models = [$tree1, $tree2, $tree3];
    return treePlacements.map((_, i) => models[i % 3]!.scene.clone());
  });

  const rockClones = $derived.by(() => {
    if (!$rock1 || !$rock2) return [];
    const models = [$rock1, $rock2];
    return rockPlacements.map((_, i) => models[i % 2]!.scene.clone());
  });

  const bushClones = $derived.by(() => {
    if (!$bush1 || !$bush2) return [];
    const models = [$bush1, $bush2];
    return bushPlacements.map((_, i) => models[i % 2]!.scene.clone());
  });

  const logClones = $derived.by(() => {
    if (!$fallenLog || !$fallenLogSmall) return [];
    return fallenLogPlacements.map(([, , , , isLarge]) =>
      (isLarge ? $fallenLog : $fallenLogSmall)!.scene.clone()
    );
  });

  const campfireClone = $derived($campfire ? $campfire.scene.clone() : null);
  const tentClone = $derived($tent ? $tent.scene.clone() : null);

  onDestroy(() => {
    for (const c of treeClones) disposeSceneGraph(c);
    for (const c of rockClones) disposeSceneGraph(c);
    for (const c of bushClones) disposeSceneGraph(c);
    for (const c of logClones) disposeSceneGraph(c);
    if (campfireClone) disposeSceneGraph(campfireClone);
    if (tentClone) disposeSceneGraph(tentClone);
  });

  // Fire emitter position (reactive to config + groundY)
  const firePosition = $derived.by(() => {
    const cf = activeConfig.campfire;
    if (!cf) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (cf.fireHeight * cf.fireScale) / 2;
    return new Vector3(cf.position.x, groundY + fireHalfHeight, cf.position.z);
  });

  // Apply fog reactively — reuse instance, mutate instead of reallocating
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

  // Report per-GLB progress so the loading curtain fills smoothly
  // instead of jumping 0% → 100%.
  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [
      $tree1,
      $tree2,
      $tree3,
      $rock1,
      $rock2,
      $bush1,
      $bush2,
      $campfire,
      $tent,
      $fallenLog,
      $fallenLogSmall,
      $forestEnvironment,
    ];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      if (renderer.current && camera.current && scene.current) {
        renderer.current.compile(scene.current, camera.current);
      }
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
  moon={activeConfig.moon}
/>

{#if activeConfig.starfield}
  <Starfield config={activeConfig.starfield} />
{/if}

{#if activeConfig.shootingStars}
  <MeteorStreaks config={activeConfig.shootingStars} />
{/if}

{#if !config && $forestEnvironment}
  <T is={$forestEnvironment.scene} position.y={groundY} />
{:else if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
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

{#key activeConfig.leaves.count}
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
  {#key activeConfig.fireflies.count}
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

{#each treeClones as clone, i}
  {@const [x, z, scale, rotY] = treePlacements[i] ?? [0, 0, 1, 0]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} {scale} rotation.y={rotY} />
{/each}

{#each rockClones as clone, i}
  {@const [x, z, scale, rotY] = rockPlacements[i] ?? [0, 0, 1, 0]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} {scale} rotation.y={rotY} />
{/each}

{#each bushClones as clone, i}
  {@const [x, z, scale, rotY] = bushPlacements[i] ?? [0, 0, 1, 0]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} {scale} rotation.y={rotY} />
{/each}

{#each logClones as clone, i}
  {@const [x, z, scale, rotY] = fallenLogPlacements[i] ?? [0, 0, 1, 0, true]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} {scale} rotation.y={rotY} />
{/each}

{#if activeConfig.campfire?.enabled && campfireClone && (sceneFeatures?.isEnabled("campfire") ?? true)}
  {@const cf = activeConfig.campfire}
  <T
    is={campfireClone}
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

{#if activeConfig.tent.enabled && tentClone && (sceneFeatures?.isEnabled("tent") ?? true)}
  <T
    is={tentClone}
    position.x={activeConfig.tent.position.x}
    position.y={groundY}
    position.z={activeConfig.tent.position.z}
    scale={activeConfig.tent.scale}
    rotation.y={activeConfig.tent.rotationY}
  />
{/if}

{#if showStage}
  <T.Group position.z={stageZOffset}>
    <Stage3D width={stageWidth} depth={stageDepth} />
  </T.Group>
{/if}
