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
   * variants). Each cloned emissive material is paired with its mushroom
   * placement's world position and exposed back to the caller via
   * `onMushroomTargets` so the interaction layer can pulse `emissiveIntensity`
   * by proximity at runtime.
   *
   * The authored mushroom-grove accent loads separately in the orchestrator.
   * Props/progress/ready mirror ocean/authored/FloraInstances.svelte.
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import {
    Color,
    Vector3,
    type InstancedMesh,
    type MeshStandardMaterial,
    type Object3D,
  } from "three";
  import { createAutumnPlacementLayout, type Placement } from "./placements";
  import {
    createAutumnVariantBatches,
    disposeAutumnInstanceBatches,
  } from "./autumn-instancing";
  import type { AutumnQualityConfig } from "../quality/autumn-quality";

  interface Props {
    quality: AutumnQualityConfig;
    groundY: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    onProgress?: (fraction: number) => void;
    onReady?: () => void;
    /**
     * Receives the cloned, emissive mushroom materials paired with their
     * placement world positions once the mushroom GLBs have loaded. The
     * interaction layer holds these and animates `emissiveIntensity` to make
     * mushrooms pulse by proximity. One placement may yield multiple materials
     * (multi-mesh GLB) — each material is emitted as its own target sharing the
     * placement position. Fired once.
     */
    onMushroomTargets?: (
      targets: { material: MeshStandardMaterial; position: Vector3 }[]
    ) => void;
  }

  let {
    quality,
    groundY,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    onProgress,
    onReady,
    onMushroomTargets,
  }: Props = $props();

  // ── CC0 kit GLBs (confirmed under static/models/vegetation/) ──────────
  // Fill trees: autumn-colored Kenney Nature Kit variants.
  const treeOak = useGltf("/models/vegetation/tree/tree_oak_fall.glb");
  const treeFat = useGltf("/models/vegetation/tree/tree_fat_fall.glb");
  const treeDetailed = useGltf(
    "/models/vegetation/tree/tree_detailed_fall.glb"
  );
  const treeTall = useGltf("/models/vegetation/tree/tree_tall_fall.glb");
  const treeDefault = useGltf("/models/vegetation/tree/tree_default_fall.glb");
  const treeCone = useGltf("/models/vegetation/tree/tree_cone_fall.glb");

  // Mushrooms: the glow set.
  const mushRed = useGltf("/models/vegetation/mushroom/mushroom_red.glb");
  const mushRedGroup = useGltf(
    "/models/vegetation/mushroom/mushroom_redGroup.glb"
  );
  const mushRedTall = useGltf(
    "/models/vegetation/mushroom/mushroom_redTall.glb"
  );
  const mushTanGroup = useGltf(
    "/models/vegetation/mushroom/mushroom_tanGroup.glb"
  );

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
    [$treeOak, $treeFat, $treeDetailed, $treeTall, $treeDefault, $treeCone].map(
      (g) => g?.scene ?? null
    )
  );
  const mushroomScenes = $derived(
    [$mushRed, $mushRedGroup, $mushRedTall, $mushTanGroup].map(
      (g) => g?.scene ?? null
    )
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
  // The forest edge follows the full stage footprint, including the negative-Z
  // expansion used for multiple performers. Nothing large enters the dance area.
  const placementLayout = $derived(
    createAutumnPlacementLayout({
      treeCount: quality.fillTreeCount,
      mushroomCount: quality.mushroomCount,
      stageWidth,
      stageDepth,
      stageZOffset,
    })
  );
  const treePlacements = $derived(placementLayout.trees);
  const mushroomPlacements = $derived(placementLayout.mushrooms);
  const rockPlacements = $derived(placementLayout.rocks);
  const logPlacements = $derived(placementLayout.logs);
  const grassPlacements = $derived(placementLayout.grass);
  const flowerPlacements = $derived(placementLayout.flowers);

  // ── Glowing-mushroom clone: deep-clone, clone each material, set emissive ─
  // Adapted from WinterScene's tintSnowy/snowyClone — emissive instead of tint.
  const TEAL = new Color("#00c8b4");
  const VIOLET = new Color("#6a5acd");
  const EMISSIVE_INTENSITY = 0.8;

  // Collected so the caller can pulse them at runtime. Each emissive material
  // is paired with its placement's world position (one placement → one or more
  // materials, all sharing that position).
  function emissiveClone(
    sourceScene: Object3D,
    placement: Placement,
    placementIndex: number,
    targets: { material: MeshStandardMaterial; position: Vector3 }[]
  ): Object3D {
    // Variants alternate the emissive hue so the mushroom patch isn't monochrome.
    const glow = placementIndex % 2 === 0 ? TEAL : VIOLET;
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
          targets.push({
            material: c,
            position: new Vector3(placement.x, groundY, placement.z),
          });
        }
        return c;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloneds
        : cloneds[0];
    });
    return cloned;
  }

  // ── GPU batches + interactive mushroom clones ─────────────────────────
  // Trees and static detail use InstancedMesh batches. Mushrooms stay as deep
  // material clones because their individual glow is animated by proximity.
  let treeBatches = $state.raw<InstancedMesh[]>([]);
  let rockBatches = $state.raw<InstancedMesh[]>([]);
  let logBatches = $state.raw<InstancedMesh[]>([]);
  let grassBatches = $state.raw<InstancedMesh[]>([]);
  let flowerBatches = $state.raw<InstancedMesh[]>([]);
  let mushroomClones = $state.raw<Object3D[]>([]);

  function loadedScenes(scenes: readonly (Object3D | null)[]): Object3D[] {
    return scenes.filter((scene): scene is Object3D => scene !== null);
  }

  function disposeCloneMaterials(scene: Object3D): void {
    scene.traverse((child) => {
      const mesh = child as {
        isMesh?: boolean;
        material?: MeshStandardMaterial | MeshStandardMaterial[];
      };
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) material.dispose();
    });
  }

  $effect(() => {
    const trees = loadedScenes(treeScenes);
    const mushrooms = loadedScenes(mushroomScenes);
    const rocks = loadedScenes([rockAScene, rockCScene]);
    const logs = loadedScenes([stumpScene, logScene]);
    const grasses = loadedScenes([grassScene]);
    const flowers = loadedScenes([flowerScene]);
    if (
      trees.length !== treeScenes.length ||
      mushrooms.length !== mushroomScenes.length ||
      rocks.length !== 2 ||
      logs.length !== 2 ||
      grasses.length !== 1 ||
      flowers.length !== 1
    )
      return;

    const nextTreeBatches = createAutumnVariantBatches(trees, treePlacements, {
      castShadow: quality.shadows,
    });
    const nextRockBatches = createAutumnVariantBatches(rocks, rockPlacements);
    const nextLogBatches = createAutumnVariantBatches(logs, logPlacements);
    const nextGrassBatches = createAutumnVariantBatches(
      grasses,
      grassPlacements
    );
    const nextFlowerBatches = createAutumnVariantBatches(
      flowers,
      flowerPlacements
    );
    const targets: { material: MeshStandardMaterial; position: Vector3 }[] = [];
    const nextMushroomClones = mushroomPlacements.map((placement, index) =>
      emissiveClone(
        mushrooms[index % mushrooms.length]!,
        placement,
        index,
        targets
      )
    );

    treeBatches = nextTreeBatches;
    rockBatches = nextRockBatches;
    logBatches = nextLogBatches;
    grassBatches = nextGrassBatches;
    flowerBatches = nextFlowerBatches;
    mushroomClones = nextMushroomClones;
    onMushroomTargets?.(targets);

    return () => {
      disposeAutumnInstanceBatches(nextTreeBatches);
      disposeAutumnInstanceBatches(nextRockBatches);
      disposeAutumnInstanceBatches(nextLogBatches);
      disposeAutumnInstanceBatches(nextGrassBatches);
      disposeAutumnInstanceBatches(nextFlowerBatches);
      for (const clone of nextMushroomClones) disposeCloneMaterials(clone);
      onMushroomTargets?.([]);
    };
  });
</script>

<T.Group position.y={groundY}>
  {#each treeBatches as batch}
    <T is={batch} />
  {/each}

  {#each rockBatches as batch}
    <T is={batch} />
  {/each}

  {#each logBatches as batch}
    <T is={batch} />
  {/each}

  {#each grassBatches as batch}
    <T is={batch} />
  {/each}

  {#each flowerBatches as batch}
    <T is={batch} />
  {/each}
</T.Group>

{#each mushroomClones as clone, i}
  {@const p = mushroomPlacements[i]}
  {#if p}
    <T
      is={clone}
      position.x={p.x}
      position.y={groundY}
      position.z={p.z}
      scale={p.scale}
      rotation.y={p.rotationY}
    />
  {/if}
{/each}
