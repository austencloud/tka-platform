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
    FLOW_FEST_FOREST_GROUND_LIFE_ASSETS,
    FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY,
    FLOW_FEST_FOREST_DISTANCE_LOD,
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS,
    FLOW_FEST_FOREST_TREE_ASSETS,
    type FlowFestForestEcologyLayout,
    type FlowFestForestDistanceTreeFamilyId,
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
      treeMidRenderedTriangles: number;
      treeFarRenderedTriangles: number;
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
  const islandTree01Mid = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid["island-tree-01"],
    loaderOptions
  );
  const islandTree02Mid = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid["island-tree-02"],
    loaderOptions
  );
  const islandTree03Mid = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid["island-tree-03"],
    loaderOptions
  );
  const treeSmall02Mid = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid["tree-small-02"],
    loaderOptions
  );
  const islandTree01Far = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far["island-tree-01"],
    loaderOptions
  );
  const islandTree02Far = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far["island-tree-02"],
    loaderOptions
  );
  const islandTree03Far = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far["island-tree-03"],
    loaderOptions
  );
  const treeSmall02Far = useGltf(
    FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far["tree-small-02"],
    loaderOptions
  );
  const grassPrototypes = useGltf(FLOW_FEST_FOREST_GRASS_ASSET, loaderOptions);
  const dampSedge = useGltf(
    FLOW_FEST_FOREST_GROUND_LIFE_ASSETS["damp-sedge-tussock"],
    loaderOptions
  );
  const hazelShrub = useGltf(
    FLOW_FEST_FOREST_GROUND_LIFE_ASSETS["woodland-hazel-shrub"],
    loaderOptions
  );

  let treeRoots = $state<Group[]>([]);
  let grassRoot = $state<Group | null>(null);
  let groundLifeRoot = $state<Group | null>(null);
  let treeCullers: InstanceFrustumCuller[] = [];
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

  const midTreeSources = $derived.by(() => {
    const sources = new Map<FlowFestForestDistanceTreeFamilyId, Object3D>();
    const candidates: Array<
      readonly [FlowFestForestDistanceTreeFamilyId, Object3D | undefined]
    > = [
      ["island-tree-01", $islandTree01Mid?.scene],
      ["island-tree-02", $islandTree02Mid?.scene],
      ["island-tree-03", $islandTree03Mid?.scene],
      ["tree-small-02", $treeSmall02Mid?.scene],
    ];
    for (const [familyId, source] of candidates) {
      if (source) sources.set(familyId, source);
    }
    return sources;
  });

  const farTreeSources = $derived.by(() => {
    const sources = new Map<FlowFestForestDistanceTreeFamilyId, Object3D>();
    const candidates: Array<
      readonly [FlowFestForestDistanceTreeFamilyId, Object3D | undefined]
    > = [
      ["island-tree-01", $islandTree01Far?.scene],
      ["island-tree-02", $islandTree02Far?.scene],
      ["island-tree-03", $islandTree03Far?.scene],
      ["tree-small-02", $treeSmall02Far?.scene],
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

  function buildDistanceTierRoot(
    tier: "mid" | "far",
    geometrySources: ReadonlyMap<FlowFestForestDistanceTreeFamilyId, Object3D>,
    materialSources: ReadonlyMap<FlowFestForestTreeFamilyId, Object3D>
  ): Group {
    const root = new Group();
    root.name = `FFS_ForestScene_TreeFamilies_${tier}`;
    for (const [familyId, geometrySource] of geometrySources) {
      const materialSource = materialSources.get(familyId);
      if (!materialSource) continue;
      const placements = layout.trees.filter(
        (placement) =>
          FLOW_FEST_FOREST_DISTANCE_FALLBACK_FAMILY[placement.familyId] ===
          familyId
      );
      root.add(
        createForestRuntimeTreeInstances(geometrySource, placements, familyId, {
          materialSource,
          distanceTier: tier,
        })
      );
    }
    return root;
  }

  $effect(() => {
    const sources = treeSources;
    const activeMidTreeSources = midTreeSources;
    const activeFarTreeSources = farTreeSources;
    const activeGrassSources = grassSources;
    if (
      sources.size !== Object.keys(FLOW_FEST_FOREST_TREE_ASSETS).length ||
      activeMidTreeSources.size !==
        Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.mid).length ||
      activeFarTreeSources.size !==
        Object.keys(FLOW_FEST_FOREST_DISTANCE_TREE_ASSETS.far).length ||
      activeGrassSources.size !== 2
    )
      return;
    const nextNearTrees = new Group();
    nextNearTrees.name = "FFS_ForestScene_TreeFamilies_near";
    for (const [familyId, source] of sources) {
      const placements = layout.trees.filter(
        (placement) => placement.familyId === familyId
      );
      nextNearTrees.add(
        createForestRuntimeTreeInstances(source, placements, familyId, {
          distanceTier: "near",
        })
      );
    }
    const nextMidTrees = buildDistanceTierRoot(
      "mid",
      activeMidTreeSources,
      sources
    );
    const nextFarTrees = buildDistanceTierRoot(
      "far",
      activeFarTreeSources,
      sources
    );
    const nextTreeRoots = [nextNearTrees, nextMidTrees, nextFarTrees];
    nextTreeRoots.forEach((root) => (root.visible = false));
    const nextGrass = createForestRuntimeGrassField(
      layout.grass,
      activeGrassSources
    );
    const sharedCullingOptions = {
      minRenderedVerticesPerBatch: 0,
      boundsPadding: 1.25,
      cameraPositionThresholdMeters:
        FLOW_FEST_FOREST_DISTANCE_LOD.cameraPositionThresholdMeters,
      cameraRotationThresholdRadians:
        FLOW_FEST_FOREST_DISTANCE_LOD.cameraRotationThresholdRadians,
    };
    const nextTreeCullers = [
      createInstanceFrustumCuller(nextNearTrees, {
        ...sharedCullingOptions,
        maximumDistanceMeters: FLOW_FEST_FOREST_DISTANCE_LOD.nearMaximumMeters,
      }),
      createInstanceFrustumCuller(nextMidTrees, {
        ...sharedCullingOptions,
        minimumDistanceMeters: FLOW_FEST_FOREST_DISTANCE_LOD.nearMaximumMeters,
        maximumDistanceMeters: FLOW_FEST_FOREST_DISTANCE_LOD.midMaximumMeters,
      }),
      createInstanceFrustumCuller(nextFarTrees, {
        ...sharedCullingOptions,
        minimumDistanceMeters: FLOW_FEST_FOREST_DISTANCE_LOD.midMaximumMeters,
      }),
    ];
    const previousTreeRoots = untrack(() => treeRoots);
    const previousTreeCullers = treeCullers;
    const previousGrass = untrack(() => grassRoot);
    previousTreeCullers.forEach((culler) => culler.restore());
    treeCullers = nextTreeCullers;
    lastCullingSignature = "";
    treeRoots = nextTreeRoots;
    grassRoot = nextGrass;
    previousTreeRoots.forEach(disposeForestRuntimeEcology);
    if (previousGrass) disposeForestRuntimeEcology(previousGrass);
    return () => {
      if (treeRoots[0] === nextNearTrees) treeRoots = [];
      if (grassRoot === nextGrass) grassRoot = null;
      if (treeCullers[0] === nextTreeCullers[0]) treeCullers = [];
      nextTreeCullers.forEach((culler) => culler.restore());
      nextTreeRoots.forEach(disposeForestRuntimeEcology);
      disposeForestRuntimeEcology(nextGrass);
    };
  });

  $effect(() => {
    for (const root of [...treeRoots, groundLifeRoot]) {
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
    if (treeRoots.length !== 3 || !grassRoot || !groundLifeRoot) return;
    const tierMetrics = treeRoots.map((root) => {
      let drawBatches = 0;
      let renderedTriangles = 0;
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const instanceCount = "count" in mesh ? Number(mesh.count) : 1;
        const triangleCount =
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute("position")?.count ??
            0) / 3;
        drawBatches += instanceCount > 0 ? 1 : 0;
        renderedTriangles += triangleCount * instanceCount;
      });
      return { drawBatches, renderedTriangles };
    });
    const culling = aggregateCullingStats(treeCullers);
    onReady?.({
      treeInstances: layout.trees.length,
      grassInstances: layout.grass.length,
      groundLifeInstances: layout.groundLife.length,
      treeFamilies: treeSources.size,
      treeDrawBatches: tierMetrics.reduce(
        (total, tier) => total + tier.drawBatches,
        0
      ),
      treeRenderedTriangles: tierMetrics[0]?.renderedTriangles ?? 0,
      treeMidRenderedTriangles: tierMetrics[1]?.renderedTriangles ?? 0,
      treeFarRenderedTriangles: tierMetrics[2]?.renderedTriangles ?? 0,
      treeCullingSourceBatches: culling.sourceBatches,
      treeCullingBatches: culling.culledBatches,
      treeCullingCoveredVertices: culling.estimatedVerticesCovered,
    });
  });

  function aggregateCullingStats(
    cullers: readonly InstanceFrustumCuller[]
  ): InstanceFrustumCullingStats {
    return cullers.reduce<InstanceFrustumCullingStats>(
      (total, culler) => {
        const stats = culler.stats;
        total.sourceBatches += stats.sourceBatches;
        total.culledBatches += stats.culledBatches;
        total.instances += stats.instances;
        total.estimatedVerticesCovered += stats.estimatedVerticesCovered;
        total.visibleInstances += stats.visibleInstances;
        total.estimatedSubmittedVertices += stats.estimatedSubmittedVertices;
        total.distanceRejectedInstances += stats.distanceRejectedInstances;
        total.frustumRejectedInstances += stats.frustumRejectedInstances;
        total.updates += stats.updates;
        total.skippedUpdates += stats.skippedUpdates;
        return total;
      },
      {
        sourceBatches: 0,
        culledBatches: 0,
        instances: 0,
        estimatedVerticesCovered: 0,
        visibleInstances: 0,
        estimatedSubmittedVertices: 0,
        distanceRejectedInstances: 0,
        frustumRejectedInstances: 0,
        updates: 0,
        skippedUpdates: 0,
      }
    );
  }

  useTask(() => {
    const activeCamera = camera.current;
    if (treeCullers.length !== 3 || !activeCamera) return;
    treeCullers.forEach((culler) => culler.update(activeCamera));
    treeRoots.forEach((root) => (root.visible = true));
    const stats = aggregateCullingStats(treeCullers);
    const signature = `${stats.visibleInstances}:${stats.estimatedSubmittedVertices}:${stats.updates}`;
    if (signature === lastCullingSignature) return;
    lastCullingSignature = signature;
    onCullingSample?.(stats);
  });
</script>

{#each treeRoots as treeRoot (treeRoot.uuid)}
  <T is={treeRoot} />
{/each}
{#if grassRoot}
  <T is={grassRoot} />
  <ForestClearingWind scene={grassRoot} />
{/if}
{#if groundLifeRoot}
  <T is={groundLifeRoot} />
{/if}
