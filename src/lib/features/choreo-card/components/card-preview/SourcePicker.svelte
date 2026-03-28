<script lang="ts">
  import type { Deck } from "../../domain/models/Deck";
  import type { CardPreviewSource } from "../../state/card-preview-state.svelte";

  interface Props {
    decks: Deck[];
    onSelect: (source: CardPreviewSource) => void;
  }

  let { decks, onSelect }: Props = $props();

  let loopDecks = $derived(decks.filter(d => d.collection === 'LOOPs'));
  let vtgDecks = $derived(decks.filter(d => d.collection === 'VTG'));

  let sources = $derived([
    {
      id: 'loops' as CardPreviewSource,
      label: 'LOOP Decks',
      description: 'Algorithmic loop pattern decks',
      deckCount: loopDecks.length,
      sequenceCount: loopDecks.reduce((sum, d) => sum + d.totalSequences, 0),
    },
    {
      id: 'vtg' as CardPreviewSource,
      label: 'VTG Decks',
      description: 'Per-hand learning decks',
      deckCount: vtgDecks.length,
      sequenceCount: vtgDecks.reduce((sum, d) => sum + d.totalSequences, 0),
    },
  ]);
</script>

<div class="source-grid">
  {#each sources as source}
    <button class="source-card" onclick={() => onSelect(source.id)}>
      <h3 class="source-label">{source.label}</h3>
      <p class="source-desc">{source.description}</p>
      <div class="source-stats">
        <span>{source.deckCount} decks</span>
        <span>{source.sequenceCount.toLocaleString()} sequences</span>
      </div>
    </button>
  {/each}
</div>

<style>
  .source-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    padding: 24px;
    max-width: 600px;
    margin: 0 auto;
  }

  .source-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 24px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, transform 0.15s;
    color: var(--theme-text, #ffffff);
  }

  .source-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .source-label {
    margin: 0 0 8px;
    font-size: var(--font-size-lg, 18px);
  }

  .source-desc {
    margin: 0 0 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .source-stats {
    display: flex;
    gap: 16px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }
</style>
