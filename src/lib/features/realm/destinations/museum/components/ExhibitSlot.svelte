<script lang="ts">
  import type { ExhibitSlot as SlotType, MuseumExhibit } from "../domain/museum-types";
  import FramedSequence from "./FramedSequence.svelte";
  import EmptySlotIndicator from "./EmptySlotIndicator.svelte";

  interface Props {
    slot: SlotType;
    exhibit: MuseumExhibit | undefined;
    thumbnailUrl: string | undefined;
    playerPosition: { x: number; y: number; z: number };
    isOwner: boolean;
  }

  let { slot, exhibit, thumbnailUrl, playerPosition, isOwner }: Props = $props();

  const NEARBY_DISTANCE = 5; // meters

  const isNearby = $derived.by(() => {
    const dx = playerPosition.x - slot.position.x;
    const dz = playerPosition.z - slot.position.z;
    return Math.sqrt(dx * dx + dz * dz) < NEARBY_DISTANCE;
  });
</script>

{#if slot.type === "wall"}
  {#if exhibit && thumbnailUrl}
    <FramedSequence {slot} {thumbnailUrl} />
  {:else if isOwner}
    <EmptySlotIndicator {slot} {isNearby} />
  {/if}
{/if}
