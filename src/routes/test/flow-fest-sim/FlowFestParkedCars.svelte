<script lang="ts">
  import { T } from "@threlte/core";
  import { useDraco, useGltf, useMeshopt } from "@threlte/extras";
  import { untrack } from "svelte";
  import type { Group, Object3D } from "three";
  import {
    summarizeFlowFestForestEcologyAssets,
    type FlowFestForestEcologyAssetEntry,
    type FlowFestForestEcologyAssetReport,
  } from "./flow-fest-forest-ecology";
  import {
    createFlowFestParkedCarInstances,
    disposeFlowFestParkedCarInstances,
    FLOW_FEST_PARKED_CAR_MODELS,
    type FlowFestParkedCarPlacement,
  } from "./flow-fest-parked-cars";

  interface Props {
    placements: readonly FlowFestParkedCarPlacement[];
    visible?: boolean;
    onAssetReport?: (report: FlowFestForestEcologyAssetReport) => void;
    onReady?: (details: { carInstances: number; carModels: number }) => void;
  }

  let { placements, visible = true, onAssetReport, onReady }: Props = $props();

  const loaderOptions = {
    dracoLoader: useDraco("/draco/"),
    meshoptDecoder: useMeshopt(),
  };

  interface CarAssetSource {
    subscribe: (run: (value: unknown) => void) => () => void;
    error: {
      subscribe: (run: (value: Error | undefined) => void) => () => void;
    };
  }

  // Only bodies that actually have a stall load; a model the layout never
  // assigned is not a missing asset.
  const usedModels = FLOW_FEST_PARKED_CAR_MODELS.filter((model) =>
    placements.some((placement) => placement.modelId === model.id)
  );
  const sources = usedModels.map((model) => ({
    model,
    source: useGltf(model.url, loaderOptions) as unknown as CarAssetSource,
  }));
  const assetLedger = new Map<string, FlowFestForestEcologyAssetEntry>(
    usedModels.map((model) => [
      model.id,
      { key: `car:${model.id}`, url: model.url, state: "pending" as const },
    ])
  );
  let assetLedgerRevision = $state(0);
  const loadedScenes = new Map<string, Object3D>();

  $effect(() => {
    const unsubscribers: Array<() => void> = [];
    for (const { model, source } of sources) {
      unsubscribers.push(
        source.subscribe((value) => {
          const entry = assetLedger.get(model.id);
          if (!entry || !value || entry.state === "ready") return;
          const scene = (value as { scene?: Object3D }).scene;
          if (!scene) return;
          loadedScenes.set(model.id, scene);
          entry.state = "ready";
          entry.message = null;
          assetLedgerRevision += 1;
        })
      );
      unsubscribers.push(
        source.error.subscribe((error) => {
          const entry = assetLedger.get(model.id);
          if (!entry || !error || entry.state === "failed") return;
          entry.state = "failed";
          entry.message = error.message || String(error);
          console.error(
            `[flow-fest-sim] Parked-car asset failed to load: ${model.id} (${model.url})`,
            error
          );
          assetLedgerRevision += 1;
        })
      );
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  const assetReport = $derived.by(() => {
    void assetLedgerRevision;
    return summarizeFlowFestForestEcologyAssets([...assetLedger.values()]);
  });

  $effect(() => {
    onAssetReport?.(assetReport);
  });

  let carRoots = $state<Group[]>([]);

  $effect(() => {
    void assetLedgerRevision;
    const activePlacements = placements;
    const next: Group[] = [];
    for (const model of usedModels) {
      const scene = loadedScenes.get(model.id);
      if (!scene) continue;
      const stalls = activePlacements.filter(
        (placement) => placement.modelId === model.id
      );
      next.push(createFlowFestParkedCarInstances(scene, model, stalls));
    }
    const previous = untrack(() => carRoots);
    carRoots = next;
    previous.forEach(disposeFlowFestParkedCarInstances);
    return () => {
      if (carRoots === next) carRoots = [];
      next.forEach(disposeFlowFestParkedCarInstances);
    };
  });

  $effect(() => {
    if (carRoots.length !== usedModels.length) return;
    onReady?.({
      carInstances: carRoots.reduce((sum, root) => {
        let count = 0;
        root.traverse((object) => {
          if ((object as { isInstancedMesh?: boolean }).isInstancedMesh) {
            count = Math.max(
              count,
              (object as { count: number }).count
            );
          }
        });
        return sum + count;
      }, 0),
      carModels: carRoots.length,
    });
  });
</script>

{#each carRoots as carRoot (carRoot.uuid)}
  <T is={carRoot} {visible} />
{/each}
