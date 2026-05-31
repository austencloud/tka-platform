<!--
  CatalogFamilySection.svelte - Collapsible section for one hand-path family within a deck

  Renders a header with family name, type combo, and sequence count.
  When expanded, shows hand path summary cards (one per unique spatial pattern)
  followed by the full sequence grid.
  Clicking the header toggles collapse/expand state.
-->
<script lang="ts">

import { buildFromHandPathId } from "$lib/features/choreo-card/services/hand-path-data-builder";
  import { resolveCollisions } from "$lib/features/choreo-card/services/arrow-collision-resolver";
  import type { CatalogFamily } from "../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import ChoreoCard from "./ChoreoCard.svelte";
  import MotionTypePills from "./MotionTypePills.svelte";
  import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";

  interface Props {
    family: CatalogFamily;
    sequences: SequenceData[];
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    /** Start expanded (used for the first family in a deck) */
    initiallyExpanded?: boolean;
    /** Hide the collapsible header (when parent already shows the family identity) */
    hideHeader?: boolean;
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
    hideHeader = false,
    onSelectSequence,
    onContextMenu,
  }: Props = $props();

  let expanded = $state((() => initiallyExpanded)());

  /**
   * Converts PictographData[] (from HandPathDataBuilder) into StepData[].
   *
   * StepData extends PictographData with beat-context fields. The hand path
   * builder only knows about spatial data - it doesn't set stepNumber, duration,
   * or reversal flags. We add those here so the render pipeline accepts the beats
   * as a valid sequence.
   */
  function toStepData(beats: PictographData[]): StepData[] {
    return beats.map((step, i) => ({
      ...step,
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
   * NOT look up sequence data from Firestore - the beats ARE the data.
   *
   * The name is set to the handPathId so the thumbnail cache key is unique per
   * hand path pattern. These thumbnails are not cloud-cached (handPathMode is a
   * non-default visibility override) but they do land in IndexedDB for instant
   * subsequent loads.
   */
  function buildHandPathSequence(handPathId: string, representative: SequenceData): SequenceData {
    const rawSteps = buildFromHandPathId(handPathId, representative);
    const resolvedBeats = resolveCollisions(rawSteps);
    const steps = toStepData(resolvedBeats);

    return createSequenceData({
      id: `hand-path-${handPathId}`,
      name: handPathId,
      word: handPathId,
      steps,
      thumbnails: [],
      metadata: { handPathId, isHandPathVisualization: true },
    });
  }

  // Group sequences by handPathId and pick one representative per unique hand path.
  // For each representative, build a synthetic sequence with purpose-built step data
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
          // If the hand path ID is malformed, skip it - don't break the whole section.
        }
      }
    }
    return Array.from(seen.values());
  });

  // Motion type pill parsing is shared via MotionTypePills component

  /**
   * A halved loop is a 6-step sequence with a detected LOOP pattern.
   * These display better in landscape orientation (7:5) with the start
   * position column on the left and 3 columns of beats.
   */
  function isHalvedLoop(seq: SequenceData): boolean {
    return seq.steps.length === 6 && !!seq.loopType;
  }

  /**
   * Pick the best start position layout for a sequence's beat count.
   * - 4 beats: row on top → 2×2 beat grid fits portrait cards better
   * - 6 beats (halved loop): column on left → 3×2 beat grid in landscape
   * - Everything else: column (default portrait layout)
   */
  function getStartPositionLayout(seq: SequenceData): "row" | "column" {
    return getCatalogLayoutPolicy(seq.steps.length);
  }

  function toggle() {
    expanded = !expanded;
  }

  // ── Lazy card rendering via IntersectionObserver ──
  // Cards render as empty placeholders until they scroll into view (within 400px).
  // Once visible, they stay mounted - no unloading on scroll-out.

  let lazyVisible = $state<Set<string>>(new Set());

  function lazyLoad(node: HTMLElement) {
    const seqId = node.dataset.seqId;
    if (!seqId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            lazyVisible = new Set([...lazyVisible, seqId]);
            observer.unobserve(node);
          }
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return { destroy() { observer.disconnect(); } };
  }

  /**
   * Svelte action: detect the rendered image's natural aspect ratio and
   * toggle the card between portrait (5:7) and landscape (7:5).
   * Sequences wider than 1.3:1 get landscape orientation - same logic
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
  {#if !hideHeader}
    <button
      class="family-header"
      onclick={toggle}
      aria-expanded={expanded}
      aria-label="{expanded ? 'Collapse' : 'Expand'} {family.label} family"
      type="button"
    >
      <i
        class="fas fa-chevron-down chevron"
        class:collapsed={!expanded}
        aria-hidden="true"
      ></i>
      <span class="family-label">
        <MotionTypePills label={family.label} />
      </span>
      <span class="family-meta">
        ({family.typeCombo}) &middot; {sequences.length}
        {sequences.length === 1 ? "sequence" : "sequences"}
      </span>
    </button>
  {/if}

  {#if expanded}
    <!-- Hand path cards - each backed by purpose-built PictographData (HAND props, float arrows) -->
    {#if handPathSequences.length > 0}
      <span class="section-label">
        {handPathSequences.length} hand {handPathSequences.length === 1 ? "path" : "paths"}
      </span>
      <div class="card-grid">
        {#each handPathSequences as hpSeq (hpSeq.id)}
          <div class="playing-card" data-seq-id={hpSeq.id} use:lazyLoad use:detectOrientation>
            {#if lazyVisible.has(hpSeq.id)}
              <ChoreoCard
                sequence={hpSeq}
                printMode={true}
                handPathMode={true}
                {handPointsVisible}
                {showGrid}
                showTKA={false}
                showWord={false}
                {includeStartPosition}
                startPositionLayout={getCatalogLayoutPolicy(hpSeq.steps?.length ?? 0)}
                onSelect={onSelectSequence}
                {onContextMenu}
              />
            {:else}
              <div class="card-placeholder"></div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Sequence cards, sorted by first letter of the word -->
    <span class="section-label">Sequences</span>
    <div class="card-grid">
      {#each [...sequences].sort((a, b) => (a.word ?? "").localeCompare(b.word ?? "")) as sequence (sequence.id)}
        {@const halvedLoop = isHalvedLoop(sequence)}
        <div
          class="playing-card"
          class:halved-loop={halvedLoop}
          data-seq-id={sequence.id}
          use:lazyLoad
          use:detectOrientation
        >
          {#if lazyVisible.has(sequence.id)}
            <ChoreoCard
              {sequence}
              printMode={true}
              {handPointsVisible}
              {showGrid}
              {showTKA}
              {showWord}
              {includeStartPosition}
              startPositionLayout={getStartPositionLayout(sequence)}
              showMandala={true}
              onSelect={onSelectSequence}
              {onContextMenu}
            />
          {:else}
            <div class="card-placeholder"></div>
          {/if}
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
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
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

  /* Playing card grid - cards at 5:7 portrait ratio */
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
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.15));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--print-bg, #ffffff);
  }

  /* Landscape orientation for wide sequences (aspect > 1.3) */
  .playing-card:global(.landscape) {
    aspect-ratio: 7 / 5;
  }

  /* Halved loops (6-step LOOP sequences) display horizontally with
     start position as a top row and 3 columns of beats */
  .playing-card.halved-loop {
    aspect-ratio: 7 / 5;
  }

  /* ChoreoCard inside the playing card frame fills the entire space */
  .playing-card :global(> button) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .card-placeholder {
    width: 100%;
    height: 100%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron,
    .family-header {
      transition: none;
    }
  }
</style>
