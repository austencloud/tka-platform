<script lang="ts">
  /**
   * GalleryTorches
   *
   * Places torches BETWEEN exhibit frames along gallery walls.
   * Avoids collision with artwork by using exhibit slot positions.
   */

  import type { GalleryLayout } from "../../domain/models/GalleryLayout";
  import TorchSconce from "./TorchSconce.svelte";
  import {
    TORCH_HEIGHT,
    TORCH_WALL_OFFSET,
    HALLWAY_BUFFER,
  } from "../../domain/constants/gallery-dimensions";

  interface TorchPosition {
    id: string;
    position: { x: number; y: number; z: number };
    rotation: number;
  }

  interface Props {
    /** Gallery layout */
    layout: GalleryLayout;
    /** Whether torches are lit */
    enabled?: boolean;
    /** Fire intensity (0-1) */
    intensity?: number;
  }

  let { layout, enabled = true, intensity = 0.75 }: Props = $props();

  // Generate torch positions BETWEEN exhibits (not overlapping them)
  // NOTE: Torches are disabled until wall geometry is added back to GalleryLayout
  const torchPositions = $derived.by(() => {
    const positions: TorchPosition[] = [];

    // TODO: Re-enable torches once GalleryLayout includes wall geometry
    // The current model-based approach uses exhibitSlots directly without wall grouping
    return positions;

    /* Original wall-based code (disabled):
    for (const wall of layout.walls) {
      // Only add torches to side walls (not front/back)
      if (!wall.id.includes("left") && !wall.id.includes("right")) {
        continue;
      }

      const isLeftWall = wall.id.includes("left");
      const slots = wall.exhibitSlots;

      // Sort slots by Z position
      const sortedSlots = [...slots].sort((a, b) => a.position.z - b.position.z);

      // Position torch offset from wall surface
      const x = isLeftWall
        ? wall.startPos.x + TORCH_WALL_OFFSET
        : wall.startPos.x - TORCH_WALL_OFFSET;

      // Rotation: left wall torches face right (+π/2), right wall face left (-π/2)
      const rotation = isLeftWall ? Math.PI / 2 : -Math.PI / 2;

      // Add torch at start of hallway (before first exhibit)
      if (sortedSlots.length > 0) {
        const firstSlot = sortedSlots[0];
        const startZ = wall.startPos.z + HALLWAY_BUFFER / 2;
        if (firstSlot && firstSlot.position.z - startZ > 100) {
          positions.push({
            id: `torch-${wall.id}-start`,
            position: { x, y: TORCH_HEIGHT, z: (startZ + firstSlot.position.z) / 2 },
            rotation,
          });
        }
      }

      // Add torches BETWEEN each pair of exhibits
      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const currentSlot = sortedSlots[i];
        const nextSlot = sortedSlots[i + 1];

        if (currentSlot && nextSlot) {
          // Place torch midway between exhibits
          const midZ = (currentSlot.position.z + nextSlot.position.z) / 2;

          positions.push({
            id: `torch-${wall.id}-${i}`,
            position: { x, y: TORCH_HEIGHT, z: midZ },
            rotation,
          });
        }
      }

      // Add torch at end of hallway (after last exhibit)
      if (sortedSlots.length > 0) {
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        const endZ = wall.endPos.z - HALLWAY_BUFFER / 2;
        if (lastSlot && endZ - lastSlot.position.z > 100) {
          positions.push({
            id: `torch-${wall.id}-end`,
            position: { x, y: TORCH_HEIGHT, z: (lastSlot.position.z + endZ) / 2 },
            rotation,
          });
        }
      }
    }

    return positions;
    */
  });
</script>

{#each torchPositions as torch (torch.id)}
  <TorchSconce
    position={torch.position}
    rotation={torch.rotation}
    {enabled}
    {intensity}
  />
{/each}
