<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useGltf, useDraco } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { onDestroy, untrack } from "svelte";
  import { InstancedMesh, type MeshStandardMaterial, type MeshPhysicalMaterial } from "three";
  import {
    extractFromGLB,
    createGLBCrystalInstancedMesh,
    updateCrystalTime,
    disposeCrystalMesh,
    type CrystalPlacement,
    type GLBExtraction,
  } from "./cosmic-instancing";
  import type { CrystalFormationsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: CrystalFormationsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  function seedRng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  // ── GLB model loading (top-level, matching Ocean/ReefStructures pattern) ────

  const dracoLoader = useDraco("/draco/");
  const loaderOpts = { dracoLoader, meshoptDecoder: MeshoptDecoder };

  const glb0 = useGltf(config.models[0]?.path ?? "", loaderOpts);
  const glb1 = useGltf(config.models[1]?.path ?? "", loaderOpts);
  const glb2 = useGltf(config.models[2]?.path ?? "", loaderOpts);
  const glb3 = useGltf(config.models[3]?.path ?? "", loaderOpts);
  const glb4 = useGltf(config.models[4]?.path ?? "", loaderOpts);
  const glb5 = useGltf(config.models[5]?.path ?? "", loaderOpts);
  const glb6 = useGltf(config.models[6]?.path ?? "", loaderOpts);

  const allGlbs = $derived([$glb0, $glb1, $glb2, $glb3, $glb4, $glb5, $glb6]);

  // ── Build instanced meshes when models load ─────────────────────────────────

  interface MeshData {
    mesh: InstancedMesh;
    material: MeshStandardMaterial | MeshPhysicalMaterial;
  }

  let meshes = $state<MeshData[]>([]);

  function disposeAll(list: MeshData[]) {
    for (const { mesh } of list) disposeCrystalMesh(mesh);
  }

  function generatePlacements(cfg: CrystalFormationsConfig): CrystalPlacement[] {
    const rng = seedRng(cfg.seed);
    const [rMin, rMax] = cfg.placementRadius;
    const [sMin, sMax] = cfg.sizeRange;
    const total = cfg.totalCount;
    const result: CrystalPlacement[] = [];

    for (let i = 0; i < total; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = rMin + rng() * (rMax - rMin);
      result.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: 0,
        scale: sMin + rng() * (sMax - sMin),
        rotY: rng() * Math.PI * 2,
        glowIntensity: 0.5 + rng() * 0.8,
        glowPhase: rng() * Math.PI * 2,
      });
    }
    return result;
  }

  function assignToVariants(
    placements: CrystalPlacement[],
    modelCount: number,
    weights: number[],
    seed: number,
  ): CrystalPlacement[][] {
    const rng = seedRng(seed + 7777);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const groups: CrystalPlacement[][] = Array.from({ length: modelCount }, () => []);

    for (const p of placements) {
      let r = rng() * totalWeight;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]!;
        if (r <= 0) { idx = i; break; }
      }
      groups[idx]!.push(p);
    }
    return groups;
  }

  $effect(() => {
    if (!config.enabled || config.models.length === 0) {
      const old = untrack(() => meshes);
      disposeAll(old);
      meshes = [];
      return;
    }

    const readyModels: { index: number; extraction: GLBExtraction }[] = [];
    for (let i = 0; i < allGlbs.length; i++) {
      const gltf = allGlbs[i];
      if (gltf?.scene) {
        const ext = extractFromGLB(gltf.scene);
        if (ext) readyModels.push({ index: i, extraction: ext });
      }
    }

    if (readyModels.length === 0) return;

    const placements = generatePlacements(config);
    const weights = readyModels.map((rm) => config.models[rm.index]?.weight ?? 1);
    const groups = assignToVariants(placements, readyModels.length, weights, config.seed);

    const newMeshes: MeshData[] = [];
    for (let i = 0; i < readyModels.length; i++) {
      const group = groups[i]!;
      if (group.length === 0) continue;

      const modelCfg = config.models[readyModels[i]!.index]!;
      const glowScaled = group.map((p) => ({
        ...p,
        glowIntensity: p.glowIntensity * modelCfg.glowIntensity,
      }));

      const { mesh, material } = createGLBCrystalInstancedMesh(
        readyModels[i]!.extraction,
        glowScaled,
      );
      newMeshes.push({ mesh, material });
    }

    const old = untrack(() => meshes);
    disposeAll(old);
    meshes = newMeshes;

    return () => disposeAll(newMeshes);
  });

  // ── Animation ───────────────────────────────────────────────────────────────

  let time = $state(0);

  useTask((delta) => {
    if (!config.enabled || meshes.length === 0) return;
    time += delta;
    for (const { material } of meshes) {
      updateCrystalTime(material, time);
    }
  });

  onDestroy(() => disposeAll(meshes));

  // ── Ambient glow lights ─────────────────────────────────────────────────────

  const glowLights = $derived.by(() => {
    if (!config.enabled) return [];
    const rng = seedRng(config.seed + 333);
    const [rMin, rMax] = config.placementRadius;
    const lights: { x: number; z: number; color: string }[] = [];
    const count = Math.min(8, Math.floor(config.totalCount / 15));

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = rMin + rng() * (rMax - rMin) * 0.6;
      lights.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        color: "#4488ff",
      });
    }
    return lights;
  });
</script>

{#if config.enabled}
  {#each meshes as { mesh }}
    <T is={mesh} position.y={groundY} />
  {/each}

  {#each glowLights as light}
    <T.PointLight
      position.x={light.x}
      position.y={groundY + 1.5}
      position.z={light.z}
      color={light.color}
      intensity={4}
      distance={5}
      decay={2}
    />
  {/each}
{/if}
