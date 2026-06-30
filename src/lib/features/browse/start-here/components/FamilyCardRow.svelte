<!--
  FamilyCardRow — given a TnD familyId, resolve that family's canonical cards
  (resolveTnDFamilyCards), take each seed's zero-turn base ("0|0"), and render
  the REAL ChoreoCardThumbnails in the shared HorizontalSwipeContainer.
-->
<script lang="ts">
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { resolveTnDFamilyCards } from "$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards";
  import { getTnDElement } from "$lib/features/choreo-card/domain/tnd-element";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    familyId: string;
  }
  let { familyId }: Props = $props();

  const element = $derived(getTnDElement(familyId));

  let cards = $state<SequenceData[]>([]);
  let loading = $state(true);

  $effect(() => {
    const id = familyId;
    loading = true;
    cards = [];
    let cancelled = false;
    resolveTnDFamilyCards(id)
      .then((seedMatrices) => {
        if (cancelled) return;
        cards = seedMatrices
          .map((m) => m.byTurn.get("0|0") ?? m.byTurn.values().next().value)
          .filter((s): s is SequenceData => Boolean(s));
        loading = false;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[start-here] resolveTnDFamilyCards FAILED", id, err);
        cards = [];
        loading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<section class="family">
  <header class="head" style="--accent: {element?.accentColor ?? '#6aa0ff'}">
    <h2>{element?.name ?? familyId}</h2>
    <span class="sub">{element?.element ?? ""} · base movements</span>
  </header>

  {#if loading}
    <div class="state">Loading {element?.name ?? familyId}…</div>
  {:else if cards.length === 0}
    <div class="state">No base cards for this family yet.</div>
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
  .family {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.25rem;
  }
  .head { text-align: center; }
  .head h2 { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--accent); }
  .sub { color: var(--theme-text-muted, #9aa6b8); text-transform: capitalize; }
  .state { padding: 2.5rem; text-align: center; color: var(--theme-text-muted, #9aa6b8); }
  .slide { flex: 0 0 240px; padding: 0 0.5rem; }
</style>
