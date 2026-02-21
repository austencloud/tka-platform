<script lang="ts">
  import { calculateMuseumLayout } from "../domain/layout-calculator";
  import Pavilion from "./Pavilion.svelte";
  import type { MuseumState } from "../state/museum-state.svelte";

  interface Props {
    museumState: MuseumState;
    groundY: number;
    playerPosition: { x: number; y: number; z: number };
  }

  let { museumState, groundY, playerPosition }: Props = $props();

  // Recalculate layout when exhibit count changes
  const layout = $derived.by(() => {
    const count = Math.max(1, museumState.populatedCount);
    return calculateMuseumLayout(count);
  });

  // Push layout to state whenever it recalculates
  $effect(() => {
    museumState.setLayout(layout);
  });
</script>

{#each layout.pavilions as pavilion (pavilion.id)}
  <Pavilion {pavilion} {groundY} />
{/each}
