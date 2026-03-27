<script lang="ts">
  import type { Deck } from "../domain/models/Deck";

  interface Props {
    decks: Deck[];
    onSelectBeatCount: (beatCount: number) => void;
  }

  const { decks, onSelectBeatCount }: Props = $props();

  const beatGroups = $derived((() => {
    const groups = new Map<number, Deck[]>();
    for (const deck of decks) {
      const bc = deck.beatCount || 0;
      if (!groups.has(bc)) groups.set(bc, []);
      groups.get(bc)!.push(deck);
    }
    return [...groups.entries()]
      .map(([beatCount, groupDecks]) => ({
        beatCount,
        deckCount: groupDecks.length,
        totalSequences: groupDecks.reduce((s, d) => s + d.totalSequences, 0),
        familyCount: new Set(groupDecks.flatMap(d => d.families.map(f => f.label))).size,
      }))
      .sort((a, b) => a.beatCount - b.beatCount);
  })());
</script>

<div class="beat-grid-layout">
  <h3 class="section-header">BY BEATS</h3>

  <div class="beat-grid">
    {#each beatGroups as group (group.beatCount)}
      <button
        type="button"
        class="beat-card"
        aria-label="Browse {group.beatCount}-beat LOOP sequences"
        onclick={() => onSelectBeatCount(group.beatCount)}
      >
        <span class="big-number">{group.beatCount}</span>
        <span class="unit-label">beats</span>
        <div class="meta">
          <span>{group.totalSequences} sequences</span>
          <span>{group.familyCount} {group.familyCount === 1 ? 'family' : 'families'}</span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .beat-grid-layout {
    width: 100%;
  }

  .section-header {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    letter-spacing: 0.15em;
    text-align: center;
    text-transform: uppercase;
    font-weight: 600;
    margin: 0 0 16px;
  }

  .beat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }

  .beat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease;
    text-align: center;
  }

  .beat-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .beat-card:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .beat-card {
      transition: none;
    }
  }

  .big-number {
    font-size: 28px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    line-height: 1;
  }

  .unit-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 4px;
  }

  .meta span {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
  }
</style>
