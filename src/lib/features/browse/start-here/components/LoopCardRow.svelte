<!--
  LoopCardRow — filter the loaded community pool by loopType and render the real
  cards. The community `loopType` lens works on real data today (Phase 1).
-->
<script lang="ts">
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    loopType: string;
    /** All loaded community sequences (from the host engine). */
    pool: readonly SequenceData[];
  }
  let { loopType, pool }: Props = $props();

  const cards = $derived(
    pool
      .filter((s) => (s.loopType ?? "").toLowerCase() === loopType.toLowerCase())
      .slice(0, 24)
  );
</script>

<section class="loop">
  <header class="head"><h2>{loopType}</h2></header>
  {#if cards.length === 0}
    <div class="state">No {loopType} examples loaded.</div>
  {:else}
    <HorizontalSwipeContainer height="320px" showArrows showIndicators={false}>
      {#each cards as card (card.id)}
        <div class="embla__slide slide">
          <ChoreoCardThumbnail sequence={card} eager addWord />
        </div>
      {/each}
    </HorizontalSwipeContainer>
  {/if}
</section>

<style>
  .loop {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.25rem;
  }
  .head { text-align: center; }
  .head h2 { margin: 0; font-size: 1.5rem; font-weight: 800; text-transform: capitalize; }
  .state { padding: 2.5rem; text-align: center; color: var(--theme-text-muted, #9aa6b8); }
  .slide { flex: 0 0 240px; padding: 0 0.5rem; }
</style>
