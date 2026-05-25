<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";

  interface Props {
    catalogs: Catalog[];
    onSelectTurns: (turns: string) => void;
  }

  const { catalogs, onSelectTurns }: Props = $props();

  const turnsGroups = $derived((() => {
    const groups = new Map<string, Catalog[]>();
    for (const catalog of catalogs) {
      const t = catalog.turnPattern;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(catalog);
    }
    return [...groups.entries()]
      .map(([turns, groupCatalogs]) => ({
        turns,
        catalogCount: groupCatalogs.length,
        totalSequences: groupCatalogs.reduce((s, d) => s + d.totalSequences, 0),
      }))
      .sort((a, b) => a.turns.localeCompare(b.turns));
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
        <span class="unit-label">{group.turns === '1' ? 'turn' : 'turns'}</span>
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
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    text-align: center;
    text-transform: uppercase;
    font-weight: 600;
    margin: 0 0 20px;
  }

  .turns-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }

  @media (max-width: 700px) {
    .turns-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .turns-grid {
      grid-template-columns: 1fr;
    }
  }

  .turns-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 24px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    text-align: center;
  }

  .turns-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-4px);
    box-shadow: var(--shadow-card, 0 6px 20px rgba(0, 0, 0, 0.25));
  }

  @media (prefers-reduced-motion: reduce) {
    .turns-card:hover {
      transform: none;
    }
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
    font-size: 32px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    line-height: 1;
  }

  .unit-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
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
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
