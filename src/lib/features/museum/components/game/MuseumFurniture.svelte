<!--
  MuseumFurniture.svelte

  Places GLTF furniture models from the Kenney Furniture Kit (CC0)
  into the museum 3D scene. Models are loaded asynchronously and
  placed at positions derived from the tile grid.

  All loading is tracked by Three.js DefaultLoadingManager, which
  useProgress() reads globally. No manual progress reporting needed.
-->
<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Group } from "three";
  import { MuseumModelLoader } from "../../services/implementations/MuseumModelLoader";
  import type { MuseumModelRole } from "../../services/contracts/IMuseumModelLoader";

  interface FurniturePlacement {
    id: string;
    role: string;
    tileX: number;
    tileY: number;
    rotationY: number;
  }

  interface Props {
    placements: FurniturePlacement[];
    tileSize: number;
  }

  let { placements, tileSize }: Props = $props();

  const loader = new MuseumModelLoader();

  interface ResolvedPlacement {
    id: string;
    role: MuseumModelRole;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  function collectPlacements(): ResolvedPlacement[] {
    return placements.map((f) => ({
      id: f.id,
      role: f.role as MuseumModelRole,
      worldX: f.tileX * tileSize,
      worldZ: f.tileY * tileSize,
      rotationY: f.rotationY,
      extraY: 0,
    }));
  }

  const resolved = collectPlacements();

  interface LoadedModel {
    id: string;
    model: Group;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  let loadedModels: LoadedModel[] = $state([]);

  async function loadAllModels(): Promise<void> {
    if (resolved.length === 0) return;

    // Preload unique role templates (deduplicates network requests)
    const uniqueRoles = [...new Set(resolved.map((p) => p.role))];
    await Promise.all(uniqueRoles.map((role) => loader.load(role)));

    // Clone for each placement (instant since templates are cached)
    const results: LoadedModel[] = [];
    for (const placement of resolved) {
      const model = await loader.load(placement.role);
      results.push({
        id: placement.id,
        model,
        worldX: placement.worldX,
        worldZ: placement.worldZ,
        rotationY: placement.rotationY,
        extraY: placement.extraY,
      });
    }
    loadedModels = results;
  }

  loadAllModels().catch((err) => {
    console.error("[MuseumFurniture] Failed to load models:", err);
  });

  onDestroy(() => {
    loader.dispose();
  });
</script>

{#each loadedModels as { id, model, worldX, worldZ, rotationY, extraY }}
  <T.Group
    name={`furniture-${id}`}
    position.x={worldX}
    position.y={extraY}
    position.z={worldZ}
    rotation.y={rotationY}
  >
    <T is={model} castShadow receiveShadow />
  </T.Group>
{/each}
