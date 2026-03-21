<!--
  DeckBrowser.svelte - Browse and explore curated sequence decks

  Two states:
  1. Deck list: grid of deck cards when no deck is selected
  2. Deck detail: back button, header, and family sections when a deck is selected
-->
<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import DeckFamilySection from "./DeckFamilySection.svelte";

  interface Props {
    decks: Deck[];
    selectedDeckId: string | null;
    deckSequences: SequenceData[];
    isLoading: boolean;
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onSelectDeck: (deckId: string) => void;
    onBackToList: () => void;
    onSelectSequence: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    decks,
    selectedDeckId,
    deckSequences,
    isLoading,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onSelectDeck,
    onBackToList,
    onSelectSequence,
    onContextMenu,
  }: Props = $props();

  let selectedDeck = $derived(decks.find((d) => d.id === selectedDeckId) ?? null);

  let sequenceMap = $derived(new Map(deckSequences.map((s) => [s.id, s])));

  // When there's only one deck, skip the list view and go straight to it
  $effect(() => {
    if (decks.length === 1 && !selectedDeckId && !isLoading) {
      onSelectDeck(decks[0]!.id);
    }
  });

  function getFamilySequences(sequenceIds: readonly string[]): SequenceData[] {
    const uniqueIds = [...new Set(sequenceIds)];
    return uniqueIds
      .map((id) => sequenceMap.get(id))
      .filter((s): s is SequenceData => s !== undefined);
  }
</script>

<div class="deck-browser">
  {#if selectedDeck}
    <div class="deck-detail">
      <button
        class="back-btn"
        onclick={onBackToList}
        type="button"
        aria-label="Back to deck list"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to Decks
      </button>

      <div class="deck-header">
        <h2 class="deck-title">{selectedDeck.name}</h2>
        <p class="deck-desc">{selectedDeck.description}</p>
        <p class="deck-count">
          {selectedDeck.totalSequences} sequences in {selectedDeck.families.length}
          {selectedDeck.families.length === 1 ? "family" : "families"}
        </p>
      </div>

      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading sequences...
        </div>
      {:else}
        <div class="families-list">
          {#each selectedDeck.families as family, i (family.id)}
            <DeckFamilySection
              {family}
              sequences={getFamilySequences(family.sequenceIds)}
              initiallyExpanded={i === 0}
              {handPointsVisible}
              {showGrid}
              {showTKA}
              {showWord}
              {includeStartPosition}
              {onSelectSequence}
              {onContextMenu}
            />
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="deck-list-container">
      {#if isLoading}
        <div class="loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading decks...
        </div>
      {:else if decks.length === 0}
        <div class="empty-state" role="status">
          <i class="fas fa-layer-group empty-icon" aria-hidden="true"></i>
          <p class="empty-text">No decks available</p>
        </div>
      {:else}
        <div class="deck-grid">
          {#each decks as deck (deck.id)}
            <button
              class="deck-card"
              onclick={() => onSelectDeck(deck.id)}
              type="button"
              aria-label="Open deck: {deck.name}"
            >
              <div class="deck-card-header">
                <i class="fas fa-layer-group deck-icon" aria-hidden="true"></i>
                <h3 class="deck-name">{deck.name}</h3>
              </div>
              <p class="deck-description">{deck.description}</p>
              <div class="deck-badges">
                <span class="badge">Level {deck.level}</span>
                <span class="badge">{deck.gridMode}</span>
                <span class="badge">{deck.totalSequences} sequences</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .deck-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .deck-browser::-webkit-scrollbar {
    width: 8px;
  }

  .deck-browser::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .deck-browser::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .deck-browser::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35));
  }

  /* ── Deck List ── */

  .deck-list-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: var(--spacing-md, 12px);
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-md, 12px);
  }

  .deck-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-lg, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .deck-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .deck-card-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .deck-icon {
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-sm, 14px);
    flex-shrink: 0;
  }

  .deck-name {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .deck-description {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .deck-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
    margin-top: auto;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--spacing-sm, 8px);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    white-space: nowrap;
  }

  /* ── Deck Detail ── */

  .deck-detail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-md, 12px);
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    align-self: flex-start;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .back-btn:hover {
    border-color: var(--theme-accent, #6366f1);
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .back-btn i {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .deck-header {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
  }

  .deck-title {
    margin: 0;
    font-size: var(--font-size-xl, 20px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .deck-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .deck-count {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .families-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
  }

  /* ── Loading & Empty States ── */

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xl, 24px);
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    animation: pulse 1.5s ease-in-out infinite;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-xl, 24px) var(--spacing-md, 12px);
    flex: 1;
  }

  .empty-icon {
    font-size: 2rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    opacity: 0.5;
  }

  .empty-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card,
    .back-btn {
      transition: none;
    }

    .loading {
      animation: none;
    }
  }
</style>
