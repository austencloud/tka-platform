<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount } from "svelte";
  import {
    BoxGeometry,
    PlaneGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    createBodyMaterial,
    createTopMaterial,
    applyDaisConfig,
    advanceDaisTime,
  } from "./ruins-shaders";
  import { patchCausticsMaterial } from "./atmosphere/seabed-caustics";

  // Self-contained config, recovered with the component from the pre-ocean-v2
  // monolith (was RuinsPlatformConfig in scene-configs before that rewrite).
  interface RuinsPlatformConfig {
    enabled: boolean;
    width: number;
    depth: number;
    height: number;
    elevation?: number;
    stoneColor: string;
    runeGlowColor: string;
    glowIntensity: number;
    mossIntensity: number;
    columnCount: number;
    zOffset?: number;
    /** Lifts the platform's base above groundY — set to the seabed surface height
     *  so the dais sits ON the sand instead of buried in it. */
    groundOffset?: number;
  }

  interface Props {
    config: RuinsPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const enabled = $derived(config.enabled);
  const width = $derived(config.width);
  const depth = $derived(config.depth);
  const height = $derived(config.height);
  const elevation = $derived(config.elevation ?? 0);
  const groundOffset = $derived(config.groundOffset ?? 0);
  const zOffset = $derived(config.zOffset ?? 0);
  const columnCount = $derived(config.columnCount);
  const materialConfig = $derived({
    stoneColor: config.stoneColor,
    runeGlowColor: config.runeGlowColor,
    glowIntensity: config.glowIntensity,
    mossIntensity: config.mossIntensity,
  });
  // Base reference for all vertical placement. groundOffset raises it to the
  // seabed surface so the platform stands on the sand rather than sinking in.
  const baseY = $derived(groundY + groundOffset);

  let bodyGeometry = $state<BoxGeometry | undefined>(undefined);
  let topGeometry = $state<PlaneGeometry | undefined>(undefined);
  let columnGeometry = $state<CylinderGeometry | undefined>(undefined);
  let supportPillarGeometry = $state<CylinderGeometry | undefined>(undefined);

  $effect(() => {
    const geo = new BoxGeometry(width, height, depth);
    bodyGeometry = geo;
    return () => geo.dispose();
  });
  $effect(() => {
    const geo = new PlaneGeometry(width, depth);
    topGeometry = geo;
    return () => geo.dispose();
  });
  $effect(() => {
    const geo = new CylinderGeometry(0.12, 0.15, 0.6, 8);
    columnGeometry = geo;
    return () => geo.dispose();
  });
  $effect(() => {
    if (elevation <= 0) {
      supportPillarGeometry = undefined;
      return;
    }
    const geo = new CylinderGeometry(0.2, 0.35, elevation, 8);
    supportPillarGeometry = geo;
    return () => geo.dispose();
  });

  const columns = $derived.by(() => {
    const count = columnCount;
    if (count === 0) return [];
    const hw = width * 0.46;
    const hd = depth * 0.46;
    const corners: [number, number][] = [
      [-hw, -hd],
      [-hw, hd],
      [hw, -hd],
      [hw, hd],
    ];
    const result: { x: number; z: number; scaleY: number }[] = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      const [cx, cz] = corners[i]!;
      result.push({ x: cx, z: cz, scaleY: (0.3 + ((i * 0.17) % 0.4)) / 0.6 });
    }
    if (count > 4) {
      const midpoints: [number, number][] = [
        [0, -hd],
        [0, hd],
        [-hw, 0],
        [hw, 0],
        [-hw * 0.5, -hd],
        [hw * 0.5, -hd],
        [-hw * 0.5, hd],
        [hw * 0.5, hd],
      ];
      for (let i = 0; i < count - 4 && i < midpoints.length; i++) {
        const [mx, mz] = midpoints[i]!;
        result.push({
          x: mx,
          z: mz,
          scaleY: (0.25 + ((i * 0.13) % 0.35)) / 0.6,
        });
      }
    }
    return result;
  });

  const supportPillars = $derived.by(() => {
    if (elevation <= 0) return [];
    const hw = width * 0.4;
    const hd = depth * 0.4;
    return [
      { x: -hw, z: -hd },
      { x: -hw, z: hd },
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: 0, z: -hd },
      { x: 0, z: hd },
    ];
  });

  // Stone lives in ruins-shaders.ts, which patches the procedural look into a
  // MeshStandardMaterial so the dais is lit, fogged and tone-mapped like every
  // other surface. The three hand-written ShaderMaterials that used to live here
  // wrote gl_FragColor directly and took part in none of that — which is what
  // made the stage read as a flat cut-out in front of the water.
  let bodyMaterial = $state<MeshStandardMaterial | undefined>(undefined);
  let topMaterial = $state<MeshStandardMaterial | undefined>(undefined);
  let columnMaterial = $state<MeshStandardMaterial | undefined>(undefined);

  onMount(() => {
    const body = createBodyMaterial(materialConfig);
    const top = createTopMaterial(materialConfig, width, depth);
    // The deck catches the same drifting light-dapple as the seabed. It sits
    // ~2.5 m above the floor, inside the caustic fade band, so the stage stops
    // being the one surface the water is not playing across.
    patchCausticsMaterial(top);
    const column = createBodyMaterial(materialConfig);
    bodyMaterial = body;
    topMaterial = top;
    columnMaterial = column;
    return () => {
      body.dispose();
      top.dispose();
      column.dispose();
    };
  });

  $effect(() => {
    if (!bodyMaterial || !topMaterial || !columnMaterial) return;
    applyDaisConfig(bodyMaterial, materialConfig);
    applyDaisConfig(topMaterial, materialConfig, { width, depth });
    applyDaisConfig(columnMaterial, materialConfig);
  });

  useTask((delta) => {
    if (!bodyMaterial || !topMaterial || !columnMaterial) return;
    const dt = delta * 0.8;
    advanceDaisTime(bodyMaterial, dt);
    advanceDaisTime(topMaterial, dt);
    advanceDaisTime(columnMaterial, dt);
  });
</script>

{#if enabled}
  <T.Group position.z={zOffset}>
    <!-- Weathered stone body (elevated above terrain) -->
    <T.Mesh
      geometry={bodyGeometry}
      material={bodyMaterial}
      position.y={baseY + elevation + height / 2}
      castShadow
      receiveShadow
    />

    <!-- Bioluminescent top surface -->
    <T.Mesh
      geometry={topGeometry}
      material={topMaterial}
      rotation.x={-Math.PI / 2}
      position.y={baseY + elevation + height + 0.001}
      receiveShadow
    />

    <!-- Overgrown column stumps on top -->
    {#each columns as col}
      {@const colHeight = col.scaleY * 0.6}
      <T.Mesh
        geometry={columnGeometry}
        material={columnMaterial}
        position.x={col.x}
        position.y={baseY + elevation + height + colHeight * 0.5}
        position.z={col.z}
        scale.y={col.scaleY}
        castShadow
        receiveShadow
      />
    {/each}

    <!-- Support pillars from seabed to platform -->
    {#if supportPillarGeometry}
      {#each supportPillars as pillar}
        <T.Mesh
          geometry={supportPillarGeometry}
          material={bodyMaterial}
          position.x={pillar.x}
          position.y={baseY + elevation / 2}
          position.z={pillar.z}
          castShadow
          receiveShadow
        />
      {/each}
    {/if}
  </T.Group>
{/if}
