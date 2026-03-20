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

  /**
   * Svelte action: detect the rendered image's natural aspect ratio and
   * toggle the card between portrait (5:7) and landscape (7:5).
   * Sequences wider than 1.3:1 get landscape orientation — same logic
   * as the Card Designer.
   */
  function detectOrientation(node: HTMLElement) {
    let attempts = 0;
    const check = () => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        if (aspect > 1.3) {
          node.classList.add("landscape");
        } else {
          node.classList.remove("landscape");
        }
        return;
      }
      if (attempts++ < 50) requestAnimationFrame(check);
    };
    check();

    // Re-check when the thumbnail image swaps (e.g. prop type change)
    const mo = new MutationObserver(() => {
      attempts = 0;
      check();
    });
    mo.observe(node, { childList: true, subtree: true });

    return { destroy() { mo.disconnect(); } };
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
    <!-- Hand path cards -->
    {#if handPathRepresentatives.length > 0}
      <span class="section-label">
        {handPathRepresentatives.length} hand {handPathRepresentatives.length === 1 ? "path" : "paths"}
      </span>
      <div class="card-grid">
        {#each handPathRepresentatives as rep (`hp-${rep.metadata?.handPathId}`)}
          <div class="playing-card" use:detectOrientation>
            <ChoreoCard
              sequence={rep}
              printMode={true}
              handPathMode={true}
              {handPointsVisible}
              {showGrid}
              showTKA={false}
              showWord={false}
              {includeStartPosition}
              onSelect={onSelectSequence}
            />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Sequence cards -->
    <span class="section-label">Sequences</span>
    <div class="card-grid">
      {#each sequences as sequence (sequence.id)}
        <div class="playing-card" use:detectOrientation>
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
        </div>
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

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 var(--spacing-xs, 4px);
  }

  /* Playing card grid — cards at 5:7 portrait ratio */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--spacing-md, 12px);
    padding: 0 var(--spacing-xs, 4px);
  }

  .playing-card {
    aspect-ratio: 5 / 7;
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      0 1px 4px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: #ffffff;
  }

  /* Landscape orientation for wide sequences (aspect > 1.3) */
  .playing-card:global(.landscape) {
    aspect-ratio: 7 / 5;
  }

  /* ChoreoCard inside the playing card frame fills the entire space */
  .playing-card :global(> button) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron,
    .family-header {
      transition: none;
    }
  }
</style>
