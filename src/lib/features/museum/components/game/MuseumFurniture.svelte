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
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import { parseTileKey } from "../../domain/museum-grid-types";
  import {
    TILE_MODEL_MAP,
    FIXED_PLACEMENTS,
  } from "../../domain/model-placement-map";
  import { MuseumModelLoader } from "../../services/implementations/MuseumModelLoader";
  import type { MuseumModelRole } from "../../services/contracts/IMuseumModelLoader";

  interface Props {
    grid: MuseumGrid;
    tileSize: number;
  }

  let { grid, tileSize }: Props = $props();

  const loader = new MuseumModelLoader();

  interface ResolvedPlacement {
    role: MuseumModelRole;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  function collectPlacements(): ResolvedPlacement[] {
    const placements: ResolvedPlacement[] = [];

    for (const [key, tile] of grid.tiles) {
      const mapping = TILE_MODEL_MAP[tile.type];
      if (!mapping) continue;
      const { x: tileX, y: tileY } = parseTileKey(key);
      placements.push({
        role: mapping.role,
        worldX: tileX * tileSize,
        worldZ: tileY * tileSize,
        rotationY: mapping.rotationY,
        extraY: mapping.extraY,
      });
    }

    for (const fixed of FIXED_PLACEMENTS) {
      placements.push({
        role: fixed.role,
        worldX: fixed.worldX * tileSize,
        worldZ: fixed.worldZ * tileSize,
        rotationY: fixed.rotationY,
        extraY: 0,
      });
    }

    return placements;
  }

  const placements = collectPlacements();

  interface LoadedModel {
    model: Group;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  let loadedModels: LoadedModel[] = $state([]);

  async function loadAllModels(): Promise<void> {
    // Preload unique role templates (deduplicates network requests)
    const uniqueRoles = [...new Set(placements.map((p) => p.role))];
    await Promise.all(uniqueRoles.map((role) => loader.load(role)));

    // Clone for each placement (instant since templates are cached)
    const results: LoadedModel[] = [];
    for (const placement of placements) {
      const model = await loader.load(placement.role);
      results.push({
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

{#each loadedModels as { model, worldX, worldZ, rotationY, extraY }}
  <T.Group
    position.x={worldX}
    position.y={extraY}
    position.z={worldZ}
    rotation.y={rotationY}
  >
    <T is={model} />
  </T.Group>
{/each}
