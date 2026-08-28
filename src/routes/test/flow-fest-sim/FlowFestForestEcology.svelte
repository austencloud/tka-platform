<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { useDraco, useGltf, useMeshopt } from "@threlte/extras";
  import { untrack } from "svelte";
  import {
    Group,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
  } from "three";
  import {
    createForestRuntimeGrassField,
    createForestRuntimeTreeInstances,
    disposeForestRuntimeEcology,
  } from "$lib/shared/3d/environments/scenes/forest/forest-runtime-ecology";
  import {
    createInstanceFrustumCuller,
    type InstanceFrustumCuller,
    type InstanceFrustumCullingStats,
  } from "$lib/shared/3d/rendering/instance-frustum-culling";
  import ForestClearingWind from "$lib/shared/3d/environments/scenes/forest/ForestClearingWind.svelte";
  import {
    FLOW_FEST_FOREST_GRASS_ASSET,
    FLOW_FEST_FOREST_TREE_ASSETS,
    type FlowFestForestEcologyLayout,
    type FlowFestForestTreeFamilyId,
  } from "./flow-fest-forest-ecology";

  interface Props {
    layout: FlowFestForestEcologyLayout;
    foliageTint: string;
    barkTint: string;
    onReady?: (details: {
      treeInstances: number;
      grassInstances: number;
      groundLifeInstances: number;
      treeFamilies: number;
      treeDrawBatches: number;
      treeRenderedTriangles: number;
      treeCullingSourceBatches: number;
      treeCullingBatches: number;
      treeCullingCoveredVertices: number;
    }) => void;
    onCullingSample?: (details: InstanceFrustumCullingStats) => void;
  }

  let { layout, foliageTint, barkTint, onReady, onCullingSample }: Props =
    $props();
  const { camera } = useThrelte();
  const loaderOptions = {
    dracoLoader: useDraco("/draco/"),
    meshoptDecoder: useMeshopt(),
  };
  const islandTree01 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["island-tree-01"],
    loaderOptions
  );
  const islandTree02 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["island-tree-02"],
    loaderOptions
  );
  const islandTree03 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["island-tree-03"],
    loaderOptions
  );
  const treeSmall02 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["tree-small-02"],
    loaderOptions
  );
  const plantCatalogAesculusCarnea = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-aesculus-carnea"],
    loaderOptions
  );
  const plantCatalogOakUrban = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-oak-urban"],
    loaderOptions
  );
  const plantCatalogOakColonised = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-oak-colonised"],
    loaderOptions
  );
  const plantCatalogWillow = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-willow"],
    loaderOptions
  );
  const plantCatalogBuckeye31 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-buckeye-31"],
    loaderOptions
  );
  const plantCatalogBuckeye79 = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-buckeye-79"],
    loaderOptions
  );
  const plantCatalogHabitatSnag = useGltf(
    FLOW_FEST_FOREST_TREE_ASSETS["plantcatalog-habitat-snag"],
    loaderOptions
  );
  const grassPrototypes = useGltf(FLOW_FEST_FOREST_GRASS_ASSET, loaderOptions);
  const dampSedge = useGltf(
    "/models/forest/ground-life/damp-sedge-tussock.glb",
    loaderOptions
  );
  const hazelShrub = useGltf(
    "/models/forest/ground-life/woodland-hazel-shrub.glb",
    loaderOptions
  );

  let treeRoot = $state<Group | null>(null);
  let grassRoot = $state<Group | null>(null);
  let groundLifeRoot = $state<Group | null>(null);
  let treeCuller: InstanceFrustumCuller | null = null;
  let lastCullingSignature = "";

  const familyColorGrade: Partial<
    Record<
      FlowFestForestTreeFamilyId,
      { foliage: [number, number, number]; bark: [number, number, number] }
    >
  > = {
    "island-tree-01": {
      foliage: [-0.01, -0.02, -0.03],
      bark: [0, -0.02, -0.02],
    },
    "island-tree-02": {
      foliage: [0.015, -0.04, 0.015],
      bark: [0.01, -0.02, 0.01],
    },
    "island-tree-03": {
      foliage: [-0.02, 0.02, 0.035],
      bark: [-0.01, 0, 0.015],
    },
    "tree-small-02": {
      foliage: [0.025, -0.05, -0.045],
      bark: [0.015, -0.03, -0.025],
    },
    "plantcatalog-aesculus-carnea": {
      foliage: [-0.018, 0.045, 0.04],
      bark: [-0.01, 0.02, 0.015],
    },
    "plantcatalog-oak-urban": {
      foliage: [0.012, -0.025, -0.025],
      bark: [0.01, -0.02, 0.02],
    },
    "plantcatalog-oak-colonised": {
      foliage: [0.028, 0, -0.065],
      bark: [0.015, 0.01, -0.025],
    },
    "plantcatalog-willow": {
      foliage: [0.04, -0.07, 0.07],
      bark: [0.025, -0.04, 0.04],
    },
    "plantcatalog-buckeye-31": {
      foliage: [-0.025, 0.04, 0.02],
      bark: [-0.01, 0.01, 0],
    },
    "plantcatalog-buckeye-79": {
      foliage: [0.018, 0.02, -0.015],
      bark: [0.01, -0.01, -0.015],
    },
    "plantcatalog-habitat-snag": {
      foliage: [0, -0.08, 0.06],
      bark: [0.015, -0.08, 0.08],
    },
  };

  const treeSources = $derived.by(() => {
    const sources = new Map<FlowFestForestTreeFamilyId, Object3D>();
    const candidates: Array<
      readonly [FlowFestForestTreeFamilyId, Object3D | undefined]
    > = [
      ["island-tree-01", $islandTree01?.scene],
      ["island-tree-02", $islandTree02?.scene],
      ["island-tree-03", $islandTree03?.scene],
      ["tree-small-02", $treeSmall02?.scene],
      ["plantcatalog-aesculus-carnea", $plantCatalogAesculusCarnea?.scene],
      ["plantcatalog-oak-urban", $plantCatalogOakUrban?.scene],
      ["plantcatalog-oak-colonised", $plantCatalogOakColonised?.scene],
      ["plantcatalog-willow", $plantCatalogWillow?.scene],
      ["plantcatalog-buckeye-31", $plantCatalogBuckeye31?.scene],
      ["plantcatalog-buckeye-79", $plantCatalogBuckeye79?.scene],
      ["plantcatalog-habitat-snag", $plantCatalogHabitatSnag?.scene],
    ];
    for (const [familyId, source] of candidates) {
      if (source) sources.set(familyId, source);
    }
    return sources;
  });

  const grassSources = $derived.by(() => {
    const sources = new Map<"summer-sward" | "woodland-grass", Mesh>();
    const scene = $grassPrototypes?.scene;
    if (!scene) return sources;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.includes("summer-sward")) {
        sources.set("summer-sward", mesh);
      } else if (mesh.name.includes("woodland-grass")) {
        sources.set("woodland-grass", mesh);
      }
    });
    return sources;
  });

  $effect(() => {
    const sources = treeSources;
    const activeGrassSources = grassSources;
    if (
      sources.size !== Object.keys(FLOW_FEST_FOREST_TREE_ASSETS).length ||
      activeGrassSources.size !== 2
    )
      return;
    const nextTrees = new Group();
    nextTrees.name = "FFS_ForestScene_TreeFamilies";
    for (const [familyId, source] of sources) {
      const placements = layout.trees.filter(
        (placement) => placement.familyId === familyId
      );
      nextTrees.add(
        createForestRuntimeTreeInstances(source, placements, familyId)
      );
    }
    const nextGrass = createForestRuntimeGrassField(
      layout.grass,
      activeGrassSources
    );
    const nextTreeCuller = createInstanceFrustumCuller(nextTrees, {
      minRenderedVerticesPerBatch: 25_000,
      boundsPadding: 1.25,
    });
    const previousTrees = untrack(() => treeRoot);
    const previousGrass = untrack(() => grassRoot);
    treeCuller?.restore();
    treeCuller = nextTreeCuller;
    lastCullingSignature = "";
    treeRoot = nextTrees;
    grassRoot = nextGrass;
    if (previousTrees) disposeForestRuntimeEcology(previousTrees);
    if (previousGrass) disposeForestRuntimeEcology(previousGrass);
    return () => {
      if (treeRoot === nextTrees) treeRoot = null;
      if (grassRoot === nextGrass) grassRoot = null;
      if (treeCuller === nextTreeCuller) treeCuller = null;
      nextTreeCuller.restore();
      disposeForestRuntimeEcology(nextTrees);
      disposeForestRuntimeEcology(nextGrass);
    };
  });

  $effect(() => {
    for (const root of [treeRoot, groundLifeRoot]) {
      root?.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const familyId = mesh.userData.forestTreeFamily as
          | FlowFestForestTreeFamilyId
          | undefined;
        const grade = familyId ? familyColorGrade[familyId] : undefined;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const candidate of materials) {
          const material = candidate as MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) continue;
          const name = material.name.toLowerCase();
          const isFoliage =
            name.includes("leaf") ||
            name.includes("twig") ||
            name.includes("foliage") ||
            name.includes("sedge") ||
            name.includes("hazel");
          material.color.set(isFoliage ? foliageTint : barkTint);
          const adjustment = grade?.[isFoliage ? "foliage" : "bark"];
          if (adjustment) material.color.offsetHSL(...adjustment);
        }
      });
    }
  });

  $effect(() => {
    const sedge = $dampSedge?.scene;
    const hazel = $hazelShrub?.scene;
    if (!sedge || !hazel) return;
    const next = new Group();
    next.name = "FFS_ForestScene_GroundLife";
    for (const [species, source] of [
      ["damp-sedge-tussock", sedge],
      ["woodland-hazel-shrub", hazel],
    ] as const) {
      const placements = layout.groundLife
        .filter((placement) => placement.species === species)
        .map((placement) => ({
          ...placement,
          renderedHeightMeters:
            (species === "woodland-hazel-shrub" ? 1.45 : 0.72) *
            placement.scale,
        }));
      next.add(createForestRuntimeTreeInstances(source, placements, species));
    }
    const previous = untrack(() => groundLifeRoot);
    groundLifeRoot = next;
    if (previous) disposeForestRuntimeEcology(previous);
    return () => {
      if (groundLifeRoot === next) groundLifeRoot = null;
      disposeForestRuntimeEcology(next);
    };
  });

  $effect(() => {
    if (!treeRoot || !grassRoot || !groundLifeRoot) return;
    let treeDrawBatches = 0;
    let treeRenderedTriangles = 0;
    treeRoot.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const instanceCount = "count" in mesh ? Number(mesh.count) : 1;
      const triangleCount =
        (mesh.geometry.index?.count ??
          mesh.geometry.getAttribute("position")?.count ??
          0) / 3;
      treeDrawBatches += instanceCount > 0 ? 1 : 0;
      treeRenderedTriangles += triangleCount * instanceCount;
    });
    onReady?.({
      treeInstances: layout.trees.length,
      grassInstances: layout.grass.length,
      groundLifeInstances: layout.groundLife.length,
      treeFamilies: treeSources.size,
      treeDrawBatches,
      treeRenderedTriangles,
      treeCullingSourceBatches: treeCuller?.stats.sourceBatches ?? 0,
      treeCullingBatches: treeCuller?.stats.culledBatches ?? 0,
      treeCullingCoveredVertices:
        treeCuller?.stats.estimatedVerticesCovered ?? 0,
    });
  });

  useTask(() => {
    if (!treeCuller || !camera.current) return;
    const stats = treeCuller.update(camera.current);
    const signature = `${stats.visibleInstances}:${stats.estimatedSubmittedVertices}`;
    if (signature === lastCullingSignature) return;
    lastCullingSignature = signature;
    onCullingSample?.(stats);
  });
</script>

{#if treeRoot}
  <T is={treeRoot} />
{/if}
{#if grassRoot}
  <T is={grassRoot} />
  <ForestClearingWind scene={grassRoot} />
{/if}
{#if groundLifeRoot}
  <T is={groundLifeRoot} />
{/if}
