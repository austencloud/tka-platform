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

  function handleSelectPattern(patternId: string): void {
    console.log("Selected reversal pattern:", patternId);
  }
</script>

<div class="vtg-collection-view">
  <!-- Wide screens: show both sections stacked with a divider -->
  <div class="dual-layout">
    <section class="section">
      <h3 class="section-label">By Family</h3>
      <VtgFamilyGrid {decks} {onSelectFamily} />
    </section>

    <hr class="divider" />

    <section class="section">
      <h3 class="section-label">By Ratio</h3>
      <VtgRatioGrid {decks} {onSelectDeck} />
    </section>

    <hr class="divider" />

    <section class="section">
      <VtgReversalGrid {decks} onSelectPattern={handleSelectPattern} />
    </section>
  </div>

  <!-- Narrow screens: toggle between views -->
  <div class="toggle-layout">
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

    {#if activeView === "family"}
      <VtgFamilyGrid {decks} {onSelectFamily} />
    {:else if activeView === "ratio"}
      <VtgRatioGrid {decks} {onSelectDeck} />
    {:else}
      <VtgReversalGrid {decks} onSelectPattern={handleSelectPattern} />
    {/if}
  </div>
</div>

<style>
  .vtg-collection-view {
    width: 100%;
  }

  /* Wide screens: both sections visible */
  .dual-layout {
    display: block;
  }

  .toggle-layout {
    display: none;
  }

  .section {
    margin-bottom: 8px;
  }

  .section-label {
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 16px;
  }

  .divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin: 28px auto;
    max-width: 960px;
  }

  /* Narrow screens: toggle between views */
  @media (max-width: 900px) {
    .dual-layout {
      display: none;
    }

    .toggle-layout {
      display: block;
    }
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

  .toggle-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }
</style>
