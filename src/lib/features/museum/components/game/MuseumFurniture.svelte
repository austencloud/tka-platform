<!--
  MuseumFurniture.svelte

  Places GLTF furniture models from the Kenney Furniture Kit (CC0)
  into the museum 3D scene. Models are loaded asynchronously and
  placed at positions derived from the tile grid.

  All loading is tracked by Three.js DefaultLoadingManager, which
  useProgress() reads globally. No manual progress reporting needed.
-->
<script module lang="ts">
  import { MuseumModelLoader } from "../../services/museum-model-loader";

  // One loader shared across all mounts and HMR cycles. The internal
  // GLB cache survives remounts so furniture models are never re-fetched.
  const loader = new MuseumModelLoader();
  const warnedRoles = new Set<string>();
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import type { Group } from "three";
  import type {
    FurnitureDefinition,
    MuseumFurnitureRole,
  } from "../../domain/museum-grid-types";
  import { getFurnitureObjectByRole } from "../../domain/placeable-object-registry";

  interface Props {
    placements: FurnitureDefinition[];
    tileSize: number;
    materialTintLift?: number;
  }

  let { placements, tileSize, materialTintLift = 0 }: Props = $props();

  interface ResolvedPlacement {
    id: string;
    role: MuseumFurnitureRole;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  function collectPlacements(source: FurnitureDefinition[]): ResolvedPlacement[] {
    return source.map((f) => ({
      id: f.id,
      role: f.role,
      worldX: f.tileX * tileSize,
      worldZ: f.tileY * tileSize,
      rotationY: f.rotationY,
      extraY: 0,
    }));
  }

  interface LoadedModel {
    id: string;
    model: Group;
    worldX: number;
    worldZ: number;
    rotationY: number;
    extraY: number;
  }

  let loadedModels: LoadedModel[] = $state([]);
  let loadRevision = 0;

  async function loadAllModels(
    source: FurnitureDefinition[],
    revision: number,
    tintLift: number
  ): Promise<void> {
    const resolved = collectPlacements(source);
    if (resolved.length === 0) return;

    const results = await Promise.all(
      resolved.map(async (placement): Promise<LoadedModel | null> => {
        if (!getFurnitureObjectByRole(placement.role)) {
          if (!warnedRoles.has(placement.role)) {
            warnedRoles.add(placement.role);
            console.warn(
              `[MuseumFurniture] No model registered for role "${placement.role}"; placement skipped.`
            );
          }
          return null;
        }

        try {
          const model = await loader.load(
            placement.role,
            placement.role === "rug" ? 0 : tintLift
          );
          return {
            id: placement.id,
            model,
            worldX: placement.worldX,
            worldZ: placement.worldZ,
            rotationY: placement.rotationY,
            extraY: placement.extraY,
          };
        } catch (error) {
          console.error(
            `[MuseumFurniture] Failed to load ${placement.role}:`,
            error
          );
          return null;
        }
      })
    );

    if (revision === loadRevision) {
      loadedModels = results.filter(
        (result): result is LoadedModel => result !== null
      );
    }
  }

  $effect(() => {
    const source = placements;
    const tintLift = materialTintLift;
    const revision = ++loadRevision;
    if (source.length === 0) {
      loadedModels = [];
      return;
    }
    void loadAllModels(source, revision, tintLift);
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
