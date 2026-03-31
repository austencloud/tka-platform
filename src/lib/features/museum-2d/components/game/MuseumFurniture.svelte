<!--
  MuseumFurniture.svelte

  Places GLTF furniture models from the Kenney Furniture Kit (CC0)
  into the museum 3D scene. Models are loaded asynchronously and
  placed at positions derived from the tile grid.

  This is a proof-of-concept: individual <T.Group> placements,
  not instanced. For 5-20 models this is fine. If we need hundreds,
  we'd batch by model type into InstancedMesh with merged geometry.
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
    type FixedModelPlacement,
    type ModelPlacement,
  } from "../../domain/model-placement-map";
  import { MuseumModelLoader } from "../../services/implementations/MuseumModelLoader";
  import type { MuseumModelRole } from "../../services/contracts/IMuseumModelLoader";

  interface Props {
    grid: MuseumGrid;
    tileSize: number;
  }

  let { grid, tileSize }: Props = $props();

  const loader = new MuseumModelLoader();

  // ── Collect all placements from the tile grid ──

  interface ResolvedPlacement {
    role: MuseumModelRole;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  function collectPlacements(): ResolvedPlacement[] {
    const placements: ResolvedPlacement[] = [];

    // Tile-driven placements
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

    // Fixed decorative placements (coordinates are in tile space)
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

  // ── Load all models concurrently ──

  interface LoadedModel {
    model: Group;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  let loadedModels: LoadedModel[] = $state([]);

  async function loadAllModels(): Promise<void> {
    // Preload the role templates first (deduplicates network requests).
    const uniqueRoles = [...new Set(placements.map((p) => p.role))];
    await Promise.all(uniqueRoles.map((role) => loader.load(role)));

    // Now clone for each placement (instant since templates are cached).
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

  // Fire-and-forget load. Models appear as they resolve.
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
