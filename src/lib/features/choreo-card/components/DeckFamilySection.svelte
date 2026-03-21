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
  import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { container } from "$lib/shared/di";
  import type { IHandPathDataBuilder } from "../services/contracts/IHandPathDataBuilder";
  import type { IArrowCollisionResolver } from "../services/contracts/IArrowCollisionResolver";
  import ChoreoCard from "./ChoreoCard.svelte";

  interface Props {
    family: DeckFamily;
    sequences: SequenceData[];
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    /** Start expanded (used for the first family in a deck) */
    initiallyExpanded?: boolean;
    onSelectSequence?: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    family,
    sequences,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    initiallyExpanded = false,
    onSelectSequence,
    onContextMenu,
  }: Props = $props();

  let expanded = $state((() => initiallyExpanded)());

  // Resolve DI services once — these are cheap singletons.
  const handPathBuilder = container.items.handPathDataBuilder as IHandPathDataBuilder;
  const collisionResolver = container.items.arrowCollisionResolver as IArrowCollisionResolver;

  /**
   * Converts PictographData[] (from HandPathDataBuilder) into StepData[].
   *
   * StepData extends PictographData with beat-context fields. The hand path
   * builder only knows about spatial data — it doesn't set stepNumber, duration,
   * or reversal flags. We add those here so the render pipeline accepts the beats
   * as a valid sequence.
   */
  function toStepData(beats: PictographData[]): StepData[] {
    return beats.map((beat, i) => ({
      ...beat,
      stepNumber: i + 1,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    }));
  }

  /**
   * Builds a synthetic SequenceData from a hand path ID.
   *
   * The resulting sequence has purpose-built PictographData beats (HAND props,
   * float arrows, no TKA glyphs) derived from the raw hand path trace. It does
   * NOT look up sequence data from Firestore — the beats ARE the data.
   *
   * The name is set to the handPathId so the thumbnail cache key is unique per
   * hand path pattern. These thumbnails are not cloud-cached (handPathMode is a
   * non-default visibility override) but they do land in IndexedDB for instant
   * subsequent loads.
   */
  function buildHandPathSequence(handPathId: string, representative: SequenceData): SequenceData {
    const rawBeats = handPathBuilder.buildFromHandPathId(handPathId, representative);
    const resolvedBeats = collisionResolver.resolveCollisions(rawBeats);
    const steps = toStepData(resolvedBeats);

    return createSequenceData({
      id: `hand-path-${handPathId}`,
      name: handPathId,
      word: handPathId,
      steps,
      thumbnails: [],
      metadata: { handPathId },
    });
  }

  // Group sequences by handPathId and pick one representative per unique hand path.
  // For each representative, build a synthetic sequence with purpose-built beat data
  // so the render pipeline receives pre-constructed PictographData, not a raw SequenceData
  // that would be transformed at render time (which caused multi-layer caching failures).
  const handPathSequences = $derived.by(() => {
    const seen = new Map<string, SequenceData>();
    for (const seq of sequences) {
      const hpId = (seq.metadata?.handPathId as string) ?? "";
      if (hpId && !seen.has(hpId)) {
        try {
          seen.set(hpId, buildHandPathSequence(hpId, seq));
        } catch {
          // If the hand path ID is malformed, skip it — don't break the whole section.
        }
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
    <!-- Hand path cards — each backed by purpose-built PictographData (HAND props, float arrows) -->
    {#if handPathSequences.length > 0}
      <span class="section-label">
        {handPathSequences.length} hand {handPathSequences.length === 1 ? "path" : "paths"}
      </span>
      <div class="card-grid">
        {#each handPathSequences as hpSeq (hpSeq.id)}
          <div class="playing-card" use:detectOrientation>
            <ChoreoCard
              sequence={hpSeq}
              printMode={true}
              handPathMode={true}
              {handPointsVisible}
              {showGrid}
              showTKA={false}
              showWord={false}
              {includeStartPosition}
              onSelect={onSelectSequence}
              {onContextMenu}
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
            {onContextMenu}
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
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--spacing-lg, 16px);
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
