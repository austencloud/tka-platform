<script lang="ts">
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    sequence: SequenceData;
    notes: string;
  }
  const { sequence, notes }: Props = $props();

  let mounted = $state(false);

  function lazy(node: HTMLElement) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mounted = true;
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(node);
    return { destroy: () => obs.disconnect() };
  }
</script>

<div class="lazy-cell" use:lazy>
  {#if mounted}
    <ChoreoCard {sequence} cardMode showWord customNotesText={notes} showQRCodes={false} />
  {/if}
</div>

<style>
  .lazy-cell {
    width: 100%;
    aspect-ratio: 5 / 7;
  }
</style>
