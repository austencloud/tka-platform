<!--
  LoopCardRow — filter the loaded community pool by loopType and render the real
  cards in a wrapping grid. The community `loopType` lens works today (Phase 1).
-->
<script lang="ts">
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
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
      .slice(0, 60)
  );

  function open(seq: SequenceData) {
    openSequenceViewer(seq, { returnPath: "/browse/gallery", returnLabel: "Browse" });
  }
</script>

<section class="loop">
  <header class="head"><h2>{loopType}</h2></header>
  {#if cards.length === 0}
    <div class="state">No {loopType} examples loaded.</div>
  {:else}
    <div class="grid">
      {#each cards as card (card.id)}
        <ChoreoCardThumbnail sequence={card} addWord onPrimaryAction={open} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .loop {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
  }
  .head { flex: 0 0 auto; }
  .head h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    text-transform: capitalize;
  }
  .state {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--theme-text-muted, #9aa6b8);
  }
  .grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 1rem;
    align-content: start;
    padding-bottom: 1rem;
  }
</style>
