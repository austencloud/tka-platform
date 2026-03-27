<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import VtgFamilyGrid from "./VtgFamilyGrid.svelte";
  import VtgRatioGrid from "./VtgRatioGrid.svelte";
  import VtgReversalGrid from "./VtgReversalGrid.svelte";

  interface Props {
    decks: Deck[];
    onSelectDeck: (deckId: string) => void;
    onSelectFamily: (familyId: string) => void;
  }

  const { decks, onSelectDeck, onSelectFamily }: Props = $props();

  let activeView = $state<"family" | "ratio" | "reversal">("family");

  // Family and Ratio views only show continuous decks.
  // Reversal variants are browsed via the BY REVERSAL view.
  const continuousDecks = $derived(
    decks.filter(d => !d.reversalPattern || d.reversalPattern === 'continuous')
  );

  function handleSelectPattern(patternId: string): void {
    // TODO: drill down to filtered sequences for this reversal pattern
    console.log("Selected reversal pattern:", patternId);
  }
</script>

<div class="vtg-collection-view">
  <div class="toggle-bar">
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "family"}
      onclick={() => (activeView = "family")}
    >
      Family
    </button>
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "ratio"}
      onclick={() => (activeView = "ratio")}
    >
      Ratio
    </button>
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "reversal"}
      onclick={() => (activeView = "reversal")}
    >
      Reversal
    </button>
  </div>

  <div class="grid-content">
    {#if activeView === "family"}
      <VtgFamilyGrid decks={continuousDecks} {onSelectFamily} />
    {:else if activeView === "ratio"}
      <VtgRatioGrid decks={continuousDecks} {onSelectDeck} />
    {:else}
      <VtgReversalGrid {decks} onSelectPattern={handleSelectPattern} />
    {/if}
  </div>
</div>

<style>
  .vtg-collection-view {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .toggle-bar {
    display: flex;
    gap: 8px;
    justify-content: center;
    padding-bottom: 24px;
  }

  .toggle-pill {
    padding: 6px 20px;
    border-radius: 20px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
  }

  .toggle-pill.active {
    background: rgba(99, 183, 205, 0.2);
    border-color: rgba(99, 183, 205, 0.4);
    color: #63b7cd;
  }

  .toggle-pill:not(.active):hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
  }

  .toggle-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-pill {
      transition: none;
    }
  }

  .grid-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
</style>
