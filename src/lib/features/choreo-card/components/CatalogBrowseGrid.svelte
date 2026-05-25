<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import DeckCard from "./DeckCard.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { VTG_FAMILY_LABELS } from "../state/deck-browse-types";

  interface Props {
    groupedDecks: Map<string, Deck[]>;
    collection: 'LOOPs' | 'VTG';
    onSelectDeck: (deck: Deck) => void;
  }

  const { groupedDecks, collection, onSelectDeck }: Props = $props();

  function groupLabel(key: string): string {
    if (collection === 'LOOPs') {
      return (LOOP_TYPE_LABELS as Record<string, string>)[key] ?? capitalize(key);
    }
    return VTG_FAMILY_LABELS[key] ?? capitalize(key);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  function computeVaryingAxes(decks: Deck[]) {
    if (decks.length <= 1) return { stepCount: false, turn: false, reversal: false, slice: false, grid: false };
    return {
      stepCount: new Set(decks.map(d => d.stepCount)).size > 1,
      turn: new Set(decks.map(d => d.turnPattern)).size > 1,
      reversal: new Set(decks.map(d => d.reversalPattern)).size > 1,
      slice: new Set(decks.map(d => d.sliceType)).size > 1,
      grid: new Set(decks.map(d => d.gridMode)).size > 1,
    };
  }

  function contextTags(deck: Deck, axes: ReturnType<typeof computeVaryingAxes>): string {
    const parts: string[] = [];
    if (axes.stepCount) parts.push(`${deck.stepCount}-step`);
    if (axes.slice) parts.push(capitalize(deck.sliceType));
    if (axes.turn) parts.push(formatTurn(deck.turnPattern));
    if (axes.grid) parts.push(capitalize(deck.gridMode));
    if (parts.length === 0 && !axes.reversal) {
      parts.push(formatTurn(deck.turnPattern));
    }
    return parts.join(' · ');
  }
</script>

<div class="browse-grid-container">
  {#each [...groupedDecks.entries()] as [key, decks] (key)}
    {@const axes = computeVaryingAxes(decks)}
    <section class="deck-group">
      <div class="group-header">
        <span class="group-name">{groupLabel(key)}</span>
        <span class="group-rule" aria-hidden="true"></span>
        <span class="group-count">{decks.length} {decks.length === 1 ? 'deck' : 'decks'}</span>
      </div>
      <div class="deck-grid">
        {#each decks as deck (deck.id)}
          <DeckCard
            {deck}
            tags={contextTags(deck, axes)}
            onSelect={() => onSelectDeck(deck)}
          />
        {/each}
      </div>
    </section>
  {/each}

  {#if groupedDecks.size === 0}
    <div class="empty-state">
      <i class="fas fa-search empty-icon" aria-hidden="true"></i>
      <p class="empty-text">No decks match these filters</p>
    </div>
  {/if}
</div>

<style>
  .browse-grid-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .deck-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .group-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .group-rule {
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .group-count {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  @media (max-width: 768px) {
    .browse-grid-container { padding: 16px; gap: 24px; }
    .deck-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }
</style>
