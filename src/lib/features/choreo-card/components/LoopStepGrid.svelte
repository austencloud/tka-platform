<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";

  interface Props {
    catalogs: Catalog[];
    onSelectBeatCount: (stepCount: number) => void;
  }

  const { catalogs, onSelectBeatCount }: Props = $props();

  const beatGroups = $derived((() => {
    const groups = new Map<number, Catalog[]>();
    for (const catalog of catalogs) {
      const bc = catalog.stepCount;
      if (!groups.has(bc)) groups.set(bc, []);
      groups.get(bc)!.push(catalog);
    }
    return [...groups.entries()]
      .map(([stepCount, groupCatalogs]) => ({
        stepCount,
        catalogCount: groupCatalogs.length,
        totalSequences: groupCatalogs.reduce((s, d) => s + d.totalSequences, 0),
        familyCount: new Set(groupCatalogs.flatMap(d => d.families.map(f => f.label))).size,
      }))
      .sort((a, b) => a.stepCount - b.stepCount);
  })());
</script>

<div class="step-grid-layout">
  <h3 class="section-header">BY BEATS</h3>

  <div class="step-grid">
    {#each beatGroups as group (group.stepCount)}
      <button
        type="button"
        class="step-card"
        aria-label="Browse {group.stepCount}-step LOOP sequences"
        onclick={() => onSelectBeatCount(group.stepCount)}
      >
        <span class="big-number">{group.stepCount}</span>
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
  .step-grid-layout {
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

  .step-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }

  @media (max-width: 700px) {
    .step-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .step-grid {
      grid-template-columns: 1fr;
    }
  }

  .step-card {
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

  .step-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-4px);
    box-shadow: var(--shadow-card, 0 6px 20px rgba(0, 0, 0, 0.25));
  }

  @media (prefers-reduced-motion: reduce) {
    .step-card:hover {
      transform: none;
    }
  }

  .step-card:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-card {
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
