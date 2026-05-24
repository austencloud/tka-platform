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
  } from "three";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import CraterGround from "./ember/CraterGround.svelte";
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

  interface Props {
    config?: EmberSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { config, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultEmberConfig());

  const activeConfig = $derived.by(() => {
    const neededRadius = Math.max(stageWidth, stageDepth) / 2;
    const r = Math.max(baseConfig.platform.radius, neededRadius);
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const rockA = useGltf("/models/winter/rock_largeA.glb");
  const rockB = useGltf("/models/winter/rock_largeB.glb");
  const logModel = useGltf("/models/camping/tree-log.glb");
  const logSmall = useGltf("/models/camping/tree-log-small.glb");
  const campfire = useGltf("/models/camping/campfire-pit.glb");

  const { scene, renderer, camera } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null,
  );
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  // ── Volcanic tint ──────────────────────────────────────────────────────

  function volcanicClone(
    sourceScene: {
      clone: () => { traverse: (cb: (obj: unknown) => void) => void };
    },
    color: string,
    blend: number,
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

  // ── Rock placements ────────────────────────────────────────────────────

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const cr = activeConfig.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = cr - 2.0 + Math.sin(i * 4.1) * 1.5;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 0.4 + Math.abs(Math.sin(i * 3.2) * 0.35),
        rotY: Math.sin(i * 2.8) * Math.PI,
      };
    });
  });

  const logPlacements: { x: number; z: number; scale: number; rotY: number; large: boolean }[] = [
    { x: 7.0, z: -1.5, scale: 1.8, rotY: Math.PI * 0.3, large: true },
    { x: 3.5, z: -5.0, scale: 1.5, rotY: Math.PI * 0.8, large: false },
    { x: 8.5, z: -5.5, scale: 1.4, rotY: Math.PI * 1.3, large: true },
    { x: -8.0, z: -4.0, scale: 1.6, rotY: Math.PI * 0.5, large: false },
    { x: 10.0, z: 2.5, scale: 1.3, rotY: Math.PI * 1.1, large: true },
    { x: -9.5, z: 7.0, scale: 1.5, rotY: Math.PI * 0.2, large: false },
  ];

  // ── Fire vent position ─────────────────────────────────────────────────

  const firePosition = $derived.by(() => {
    const fv = activeConfig.fireVent;
    if (!fv) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (fv.fireHeight * fv.fireScale) / 2;
    return new Vector3(fv.position.x, groundY + fireHalfHeight, fv.position.z);
  });

  // ── Clone caching — clone + tint once per GLB/config change, not per render

  const rockClones = $derived.by(() => {
    if (!$rockA || !$rockB) return [];
    return rockPlacements.map((_, i) =>
      volcanicClone(
        (i % 2 === 0 ? $rockA : $rockB)!.scene,
        activeConfig.rockTintColor,
        activeConfig.rockTintBlend,
      )
    );
  });

  const logClones = $derived.by(() => {
    if (!$logModel || !$logSmall || !activeConfig.fireVent?.enabled) return [];
    return logPlacements.map((log) =>
      volcanicClone((log.large ? $logModel : $logSmall)!.scene, "#0a0505", 0.6)
    );
  });

  const campfireClone = $derived($campfire ? $campfire.scene.clone() : null);

  onDestroy(() => {
    for (const c of rockClones) disposeSceneGraph(c as import("three").Object3D);
    for (const c of logClones) disposeSceneGraph(c as import("three").Object3D);
    if (campfireClone) disposeSceneGraph(campfireClone as import("three").Object3D);
  });

  // ── Fog ────────────────────────────────────────────────────────────────

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

  // ── Loading progress ───────────────────────────────────────────────────

  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$rockA, $rockB, $logModel, $logSmall, $campfire];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
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

<!-- Volcanic ground with crater -->
{#if activeConfig.lavaPool.enabled && activeConfig.lavaPool.craterDepth}
  <CraterGround
    groundColor={activeConfig.ground.color}
    groundSize={activeConfig.ground.size}
    groundOpacity={activeConfig.ground.opacity ?? 1}
    craterPosition={activeConfig.lavaPool.position}
    craterRadius={activeConfig.lavaPool.radius}
    craterDepth={activeConfig.lavaPool.craterDepth}
    wallColor={activeConfig.lavaPool.craterWallColor ?? "#1a0806"}
  />
{:else}
  <GroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    opacity={activeConfig.ground.opacity ?? 1}
  />
{/if}

<!-- Lava cracks overlay on ground -->
<LavaCracks config={activeConfig.lavaCracks} groundSize={activeConfig.ground.size} />

<!-- Lava pool with domain-warped shader -->
<LavaPool config={activeConfig.lavaPool} />

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

<!-- Volcanic rock formations -->
{#each rockClones as clone, i}
  {@const rock = rockPlacements[i]}
  {#if rock}
    <T is={clone} position.x={rock.x} position.y={groundY} position.z={rock.z} scale={rock.scale * 2.2} rotation.y={rock.rotY} />
  {/if}
{/each}

<!-- Charred fallen logs (only with fire vent) -->
{#each logClones as clone, i}
  {@const log = logPlacements[i]}
  {#if log}
    <T is={clone} position.x={log.x} position.y={groundY} position.z={log.z} scale={log.scale * 0.5} rotation.y={log.rotY} />
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

<ObsidianPlatform config={activeConfig.platform} />
