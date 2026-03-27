<script lang="ts">
  import type { Deck } from "../domain/models/Deck";

  interface Props {
    decks: Deck[];
    onSelectTurns: (turns: number) => void;
  }

  const { decks, onSelectTurns }: Props = $props();

  const turnsGroups = $derived((() => {
    const groups = new Map<number, Deck[]>();
    for (const deck of decks) {
      const t = deck.turns ?? 0;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(deck);
    }
    return [...groups.entries()]
      .map(([turns, groupDecks]) => ({
        turns,
        deckCount: groupDecks.length,
        totalSequences: groupDecks.reduce((s, d) => s + d.totalSequences, 0),
      }))
      .sort((a, b) => a.turns - b.turns);
  })());
</script>

<div class="turns-grid-layout">
  <h3 class="section-header">BY TURNS</h3>

  <div class="turns-grid">
    {#each turnsGroups as group (group.turns)}
      <button
        type="button"
        class="turns-card"
        aria-label="Browse {group.turns}-turn LOOP sequences"
        onclick={() => onSelectTurns(group.turns)}
      >
        <span class="big-number">{group.turns}</span>
        <span class="unit-label">{group.turns === 1 ? 'turn' : 'turns'}</span>
        <div class="meta">
          <span>{group.totalSequences} sequences</span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .turns-grid-layout {
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

  .turns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }

  .turns-card {
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

  .turns-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .turns-card:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .turns-card {
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
