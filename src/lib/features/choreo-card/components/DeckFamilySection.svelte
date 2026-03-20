<!--
  DeckFamilySection.svelte - Collapsible section for one hand-path family within a deck

  Renders a header with family name, type combo, and sequence count.
  When expanded, shows hand path summary cards (one per unique spatial pattern)
  followed by the full sequence grid.
  Clicking the header toggles collapse/expand state.
-->
<script lang="ts">
  import type { DeckFamily } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ChoreoCard from "./ChoreoCard.svelte";

  interface Props {
    family: DeckFamily;
    sequences: SequenceData[];
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onSelectSequence?: (sequence: SequenceData) => void;
  }

  let {
    family,
    sequences,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onSelectSequence,
  }: Props = $props();

  let expanded = $state(false);

  // Group sequences by handPathId and pick one representative per unique hand path.
  // Each representative renders as a hand path card showing the spatial pattern.
  const handPathRepresentatives = $derived.by(() => {
    const seen = new Map<string, SequenceData>();
    for (const seq of sequences) {
      const hpId = (seq.metadata?.handPathId as string) ?? "";
      if (hpId && !seen.has(hpId)) {
        seen.set(hpId, seq);
      }
    }
    return Array.from(seen.values());
  });

  function toggle() {
    expanded = !expanded;
  }
</script>

<section class="family-section">
  <button
    class="family-header"
    onclick={toggle}
    aria-expanded={expanded}
    type="button"
  >
    <i
      class="fas fa-chevron-down chevron"
      class:collapsed={!expanded}
      aria-hidden="true"
    ></i>
    <span class="family-label">{family.label}</span>
    <span class="family-meta">
      ({family.typeCombo}) &middot; {sequences.length}
      {sequences.length === 1 ? "sequence" : "sequences"}
    </span>
  </button>

  {#if expanded}
    <!-- Hand path summary: one card per unique spatial pattern in this family -->
    {#if handPathRepresentatives.length > 0}
      <div class="hand-path-row">
        <span class="hand-path-label">
          {handPathRepresentatives.length} hand {handPathRepresentatives.length === 1 ? "path" : "paths"}
        </span>
        <div class="hand-path-cards">
          {#each handPathRepresentatives as rep (rep.metadata?.handPathId)}
            <ChoreoCard
              sequence={rep}
              printMode={true}
              handPathMode={true}
              {handPointsVisible}
              {showGrid}
              showTKA={false}
              showWord={false}
              {includeStartPosition}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Full sequence grid -->
    <div class="family-grid">
      {#each sequences as sequence (sequence.id)}
        <ChoreoCard
          {sequence}
          printMode={true}
          {handPointsVisible}
          {showGrid}
          {showTKA}
          {showWord}
          {includeStartPosition}
          onSelect={onSelectSequence}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .family-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .family-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease;
  }

  .family-header:hover {
    border-color: var(--theme-accent, #6366f1);
  }

  .family-header:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chevron {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .chevron.collapsed {
    transform: rotate(-90deg);
  }

  .family-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .family-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-left: auto;
    white-space: nowrap;
  }

  /* Hand path summary row — shows spatial patterns before the full sequence grid */
  .hand-path-row {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-xs, 4px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-bottom: var(--spacing-xs, 4px);
  }

  .hand-path-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .hand-path-cards {
    display: flex;
    gap: var(--spacing-sm, 8px);
    overflow-x: auto;
  }

  .hand-path-cards :global(> *) {
    flex: 0 0 200px;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm, 8px);
    padding: 0 var(--spacing-xs, 4px);
  }

  @media (min-width: 640px) {
    .family-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron,
    .family-header {
      transition: none;
    }
  }
</style>
