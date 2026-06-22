<script lang="ts">
  /**
   * AutumnFlora
   *
   * Authored kit-scatter for the Enchanted Autumn Dusk scene. Reuses CC0
   * Kenney/Quaternius-style vegetation GLBs (autumn-tinted fill trees,
   * mushrooms, rocks, logs, grass, flowers) scattered in rings around the
   * performer via the shared `ringPlacements` helper. GLBs are cloned ONCE
   * per load (not per render) and disposed on destroy.
   *
   * The scene's signature: GLOWING MUSHROOMS. Mushroom GLBs are deep-cloned
   * with their materials cloned and made emissive (teal, with violet across
   * variants). The cloned emissive materials are exposed back to the caller
   * via `onMushroomMaterials` so the interaction layer (Task 11) can pulse
   * `emissiveIntensity` at runtime.
   *
   * This component does NOT load the Meshy hero GLBs — those load separately
   * in the orchestrator (Task 13). Props/progress/ready mirror
   * ocean/authored/FloraInstances.svelte.
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onDestroy } from "svelte";
  import {
    Color,
    type Material,
    type MeshStandardMaterial,
    type Object3D,
  } from "three";
  import { disposeSceneGraph } from "../../../utils/dispose-scene";
  import { ringPlacements, type Placement } from "./placements";
  import type { AutumnQualityConfig } from "../quality/autumn-quality";

  interface Props {
    quality: AutumnQualityConfig;
    groundY: number;
    onProgress?: (fraction: number) => void;
    onReady?: () => void;
    /**
     * Receives the cloned, emissive mushroom materials once the mushroom GLBs
     * have loaded. The interaction layer (Task 11) holds these and animates
     * `emissiveIntensity` to make mushrooms pulse on touch. Fired once.
     */
    onMushroomMaterials?: (materials: MeshStandardMaterial[]) => void;
  }

  let {
    quality,
    groundY,
    onProgress,
    onReady,
    onMushroomMaterials,
  }: Props = $props();

  // ── CC0 kit GLBs (confirmed under static/models/vegetation/) ──────────
  // Fill trees: autumn-colored Kenney Nature Kit variants.
  const treeOak = useGltf("/models/vegetation/tree/tree_oak_fall.glb");
  const treeFat = useGltf("/models/vegetation/tree/tree_fat_fall.glb");
  const treeDetailed = useGltf("/models/vegetation/tree/tree_detailed_fall.glb");
  const treeTall = useGltf("/models/vegetation/tree/tree_tall_fall.glb");
  const treeDefault = useGltf("/models/vegetation/tree/tree_default_fall.glb");
  const treeCone = useGltf("/models/vegetation/tree/tree_cone_fall.glb");

  // Mushrooms: the glow set.
  const mushRed = useGltf("/models/vegetation/mushroom/mushroom_red.glb");
  const mushRedGroup = useGltf("/models/vegetation/mushroom/mushroom_redGroup.glb");
  const mushRedTall = useGltf("/models/vegetation/mushroom/mushroom_redTall.glb");
  const mushTanGroup = useGltf("/models/vegetation/mushroom/mushroom_tanGroup.glb");

  // Detail dressing.
  const stumpOld = useGltf("/models/vegetation/log/stump_old.glb");
  const logModel = useGltf("/models/vegetation/log/log.glb");
  const grassLarge = useGltf("/models/vegetation/grass/grass_large.glb");
  const flowerRed = useGltf("/models/vegetation/flower/flower_redA.glb");
  const rockLargeA = useGltf("/models/vegetation/rock/rock_largeA.glb");
  const rockTallC = useGltf("/models/vegetation/rock/rock_tallC.glb");

  // Svelte store auto-subscription ($store) only works on top-level-declared
  // store variables, so each GLB is unwrapped here by name into a $derived
  // scene (null until loaded). Downstream code reads these, never the stores.
  const treeScenes = $derived(
    [$treeOak, $treeFat, $treeDetailed, $treeTall, $treeDefault, $treeCone].map((g) => g?.scene ?? null)
  );
  const mushroomScenes = $derived(
    [$mushRed, $mushRedGroup, $mushRedTall, $mushTanGroup].map((g) => g?.scene ?? null)
  );
  const stumpScene = $derived($stumpOld?.scene ?? null);
  const logScene = $derived($logModel?.scene ?? null);
  const grassScene = $derived($grassLarge?.scene ?? null);
  const flowerScene = $derived($flowerRed?.scene ?? null);
  const rockAScene = $derived($rockLargeA?.scene ?? null);
  const rockCScene = $derived($rockTallC?.scene ?? null);

  // ── Load progress: fraction of GLBs resolved; fire onReady once ───────
  const TOTAL_GLBS = 16;
  let readyFired = false;
  $effect(() => {
    const all = [
      ...treeScenes,
      ...mushroomScenes,
      stumpScene,
      logScene,
      grassScene,
      flowerScene,
      rockAScene,
      rockCScene,
    ];
    const loaded = all.filter(Boolean).length;
    onProgress?.(loaded / TOTAL_GLBS);
    if (loaded === TOTAL_GLBS && !readyFired) {
      readyFired = true;
      onReady?.();
    }
  });

  // ── Placements ────────────────────────────────────────────────────────
  // Fill trees across 3 rings totaling ~quality.fillTreeCount.
  const treePlacements = $derived.by<Placement[]>(() => {
    const total = quality.fillTreeCount;
    const inner = Math.round(total * 0.3);
    const mid = Math.round(total * 0.35);
    const outer = total - inner - mid;
    return [
      ...ringPlacements({ count: inner, radius: 11, radiusJitter: 1.8, scaleBase: 1, scaleVariation: 0.4, seed: 1 }),
      ...ringPlacements({ count: mid, radius: 16, radiusJitter: 2.2, scaleBase: 1.1, scaleVariation: 0.5, seed: 2 }),
      ...ringPlacements({ count: outer, radius: 22, radiusJitter: 2.6, scaleBase: 1.2, scaleVariation: 0.6, seed: 3 }),
    ];
  });

  // Mushrooms: clustered, smaller radius, two rings so they read as patches.
  const mushroomPlacements = $derived.by<Placement[]>(() => {
    const total = quality.mushroomCount;
    const inner = Math.round(total * 0.55);
    const outer = total - inner;
    return [
      ...ringPlacements({ count: inner, radius: 5.5, radiusJitter: 2.2, scaleBase: 0.8, scaleVariation: 0.4, seed: 11 }),
      ...ringPlacements({ count: outer, radius: 9, radiusJitter: 2.8, scaleBase: 0.7, scaleVariation: 0.5, seed: 12 }),
    ];
  });

  // Detail dressing: modest fixed counts (not quality-driven), distinct seeds.
  const rockPlacements = ringPlacements({ count: 10, radius: 8, radiusJitter: 3, scaleBase: 0.9, scaleVariation: 0.5, seed: 21 });
  const logPlacements = ringPlacements({ count: 6, radius: 7, radiusJitter: 2.5, scaleBase: 0.9, scaleVariation: 0.4, seed: 22 });
  const grassPlacements = ringPlacements({ count: 16, radius: 6.5, radiusJitter: 3.2, scaleBase: 1, scaleVariation: 0.5, seed: 23 });
  const flowerPlacements = ringPlacements({ count: 12, radius: 5, radiusJitter: 2.4, scaleBase: 1, scaleVariation: 0.4, seed: 24 });

  // ── Glowing-mushroom clone: deep-clone, clone each material, set emissive ─
  // Adapted from WinterScene's tintSnowy/snowyClone — emissive instead of tint.
  const TEAL = new Color("#00c8b4");
  const VIOLET = new Color("#6a5acd");
  const EMISSIVE_INTENSITY = 0.8;

  // Collected so the caller can pulse them at runtime (Task 11 hook).
  const collectedMushroomMaterials: MeshStandardMaterial[] = [];

  function emissiveClone(sourceScene: Object3D, variantIndex: number): Object3D {
    // Variants alternate the emissive hue so the mushroom patch isn't monochrome.
    const glow = variantIndex % 2 === 0 ? TEAL : VIOLET;
    const cloned = sourceScene.clone();
    cloned.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloneds = mats.map((mat) => {
        const c = (mat as MeshStandardMaterial).clone();
        if (c.emissive) {
          c.emissive.copy(glow);
          c.emissiveIntensity = EMISSIVE_INTENSITY;
          collectedMushroomMaterials.push(c);
        }
        return c;
      });
      (m as { material: unknown }).material = Array.isArray(m.material) ? cloneds : cloneds[0];
    });
    return cloned;
  }

  // ── Clone caching — clone (+ glow for mushrooms) ONCE per load ─────────
  const treeClones = $derived.by(() => {
    const scenes = treeScenes.filter((s) => s !== null);
    if (scenes.length === 0) return [];
    return treePlacements.map((_, i) => scenes[i % scenes.length]!.clone());
  });

  const mushroomClones = $derived.by(() => {
    const scenes = mushroomScenes.filter((s) => s !== null);
    if (scenes.length === 0) return [];
    collectedMushroomMaterials.length = 0;
    const clones = mushroomPlacements.map((_, i) =>
      emissiveClone(scenes[i % scenes.length]!, i)
    );
    onMushroomMaterials?.(collectedMushroomMaterials.slice());
    return clones;
  });

  const rockClones = $derived.by(() => {
    if (!rockAScene || !rockCScene) return [];
    return rockPlacements.map((_, i) => (i % 2 === 0 ? rockAScene : rockCScene).clone());
  });

  const logClones = $derived.by(() => {
    if (!stumpScene || !logScene) return [];
    return logPlacements.map((_, i) => (i % 2 === 0 ? stumpScene : logScene).clone());
  });

  const grassClones = $derived.by(() => {
    if (!grassScene) return [];
    return grassPlacements.map(() => grassScene.clone());
  });

  const flowerClones = $derived.by(() => {
    if (!flowerScene) return [];
    return flowerPlacements.map(() => flowerScene.clone());
  });

  onDestroy(() => {
    for (const group of [treeClones, mushroomClones, rockClones, logClones, grassClones, flowerClones]) {
      for (const c of group) disposeSceneGraph(c as Object3D);
    }
  });
</script>

{#each treeClones as clone, i}
  {@const p = treePlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale * 2.4} rotation.y={p.rotationY} />
  {/if}
{/each}

{#each mushroomClones as clone, i}
  {@const p = mushroomPlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale} rotation.y={p.rotationY} />
  {/if}
{/each}

{#each rockClones as clone, i}
  {@const p = rockPlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale * 1.8} rotation.y={p.rotationY} />
  {/if}
{/each}

{#each logClones as clone, i}
  {@const p = logPlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale * 1.2} rotation.y={p.rotationY} />
  {/if}
{/each}

{#each grassClones as clone, i}
  {@const p = grassPlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale} rotation.y={p.rotationY} />
  {/if}
{/each}

{#each flowerClones as clone, i}
  {@const p = flowerPlacements[i]}
  {#if p}
    <T is={clone} position.x={p.x} position.y={groundY} position.z={p.z} scale={p.scale} rotation.y={p.rotationY} />
  {/if}
{/each}
