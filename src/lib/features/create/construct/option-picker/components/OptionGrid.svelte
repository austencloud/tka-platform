<!--
OptionGrid.svelte - Renders a grid of option cards

Single responsibility: Layout option cards in a responsive grid.
Filter animation: container crossfade with height interpolation.
  - Fade grid out, lock height, swap data, animate height + fade in.
  - Reorder (continuation swap): FLIP only, no fade.
Computes reversal indicators for options based on current sequence.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type {
    IReversalDetector,
    PictographWithReversals,
  } from "$lib/features/create/shared/services/contracts/IReversalDetector";
  import { container } from "$lib/shared/di";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { onDestroy, tick, untrack } from "svelte";
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    options: PictographData[];
    cardSize: number;
    columns: number;
    gap?: string;
    onSelect: (option: PreparedPictographData) => void;
    currentSequence?: PictographData[];
    typeSectionTitle?: string;
    onSlotClicked?: (typeSection: string, slotIndex: number) => void;
    continuationIndex?: number | null;
  }

  const {
    options,
    cardSize,
    columns,
    gap = "8px",
    onSelect,
    currentSequence = [],
    typeSectionTitle = "",
    onSlotClicked,
    continuationIndex = null,
  }: Props = $props();

  // Get reversal detection service
  const ReversalDetector = container.items.reversalDetector;

  // Compute target options with reversals
  const optionsWithReversals = $derived(() => {
    return ReversalDetector.detectReversalsForOptions(currentSequence, options);
  });

  // Respect reduced motion preference
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const FLIP_DURATION = reducedMotion ? 0 : 300;
  const FADE_OUT = reducedMotion ? 0 : 120;
  const FADE_IN = reducedMotion ? 0 : 180;

  // Animation state
  let displayedItems = $state<PictographWithReversals[]>([]);
  let fading = $state(false);
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let gridEl = $state<HTMLDivElement>();
  let heightCleanupTimer: ReturnType<typeof setTimeout> | null = null;

  /** Remove inline height/overflow styles from a previous animation */
  function clearHeightLock() {
    if (heightCleanupTimer) clearTimeout(heightCleanupTimer);
    if (gridEl) {
      gridEl.style.height = "";
      gridEl.style.overflow = "";
    }
  }

  $effect(() => {
    const target = optionsWithReversals();
    const current = untrack(() => displayedItems);

    // First render — show immediately
    if (current.length === 0) {
      displayedItems = target;
      return;
    }

    const targetIds = new Set(target.map((o) => o.id));
    const currentIds = new Set(current.map((o) => o.id));
    const setChanged =
      targetIds.size !== currentIds.size ||
      [...targetIds].some((id) => !currentIds.has(id));

    if (!setChanged) {
      // Same items, possibly reordered (continuation swap) — FLIP handles it
      displayedItems = target;
      return;
    }

    // Clean up any interrupted animation
    if (fadeTimer) clearTimeout(fadeTimer);
    clearHeightLock();

    // Lock current height so siblings don't jump during crossfade
    if (gridEl) {
      gridEl.style.height = `${gridEl.offsetHeight}px`;
      gridEl.style.overflow = "hidden";
    }

    fading = true;

    fadeTimer = setTimeout(async () => {
      // Swap data while grid is invisible
      displayedItems = target;

      // Wait for Svelte to flush DOM updates
      await tick();

      // Measure natural height by briefly removing the lock (grid is invisible)
      if (gridEl) {
        const lockedHeight = gridEl.style.height;
        gridEl.style.height = "";
        const newHeight = gridEl.offsetHeight;
        // Restore locked height so CSS transition can animate from old → new
        gridEl.style.height = lockedHeight;

        requestAnimationFrame(() => {
          if (gridEl) {
            gridEl.style.height = `${newHeight}px`;
          }
        });
        // Clear inline styles after height transition completes
        heightCleanupTimer = setTimeout(clearHeightLock, FADE_IN + 50);
      }

      fading = false;
      fadeTimer = null;
    }, FADE_OUT);
  });

  onDestroy(() => {
    if (fadeTimer) clearTimeout(fadeTimer);
    if (heightCleanupTimer) clearTimeout(heightCleanupTimer);
  });

  // Cap columns to actual item count
  const effectiveColumns = $derived(
    Math.min(columns, displayedItems.length) || 1
  );
</script>

<div
  class="option-grid"
  class:fading
  bind:this={gridEl}
  style:gap
  style:grid-template-columns="repeat({effectiveColumns}, {cardSize}px)"
  style:--fade-in="{FADE_IN}ms"
  style:--fade-out="{FADE_OUT}ms"
>
  {#each displayedItems as option, index (option.id)}
    <div
      class="option-card-wrapper"
      animate:flip={{ duration: FLIP_DURATION, easing: cubicOut }}
    >
      <OptionCard
        pictograph={option as PreparedPictographData}
        size={cardSize}
        blueReversal={option.blueReversal || false}
        redReversal={option.redReversal || false}
        isContinuation={continuationIndex === index}
        onSelect={(p) => {
          onSlotClicked?.(typeSectionTitle, index);
          onSelect(p);
        }}
      />
    </div>
  {/each}
</div>

<style>
  .option-grid {
    display: grid;
    justify-content: center;
    width: fit-content;
    margin: 0 auto;
    transition:
      opacity var(--fade-in) ease,
      height var(--fade-in) ease;
  }

  /* Container crossfade for filter changes */
  .option-grid.fading {
    opacity: 0;
    transition:
      opacity var(--fade-out) ease,
      height var(--fade-in) ease;
  }

  .option-card-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Disable prop/arrow CSS transitions inside option cards.
     These transitions are for the sequence viewer (smooth beat-to-beat movement).
     In the option grid, props must appear instantly at final position — otherwise
     the crossfade reveals them mid-transition, flying in from (0,0). */
  .option-card-wrapper :global(.prop-svg),
  .option-card-wrapper :global(.arrow-svg) {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .option-grid,
    .option-card-wrapper {
      transition: none;
    }
  }
</style>
