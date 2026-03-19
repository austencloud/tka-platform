<!--
  CardDesigner.svelte - Front/back card preview at matched dimensions

  Both cards are the SAME physical object — they share ONE size.
  The front card renders its thumbnail, we measure it, and force
  the back card to match. Both are capped at 48% of the available
  height so they always fit together without scrolling.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ChoreoCard from "./ChoreoCard.svelte";
  import CardBack from "./CardBack.svelte";

  interface Props {
    sequences: SequenceData[];
    isLoading: boolean;
  }

  let { sequences, isLoading }: Props = $props();

  let currentIndex = $state(0);
  let frontEl: HTMLDivElement | undefined = $state();
  let measuredW = $state(0);
  let measuredH = $state(0);

  const seq = $derived(sequences.length > 0 ? sequences[currentIndex] : null);
  const name = $derived(seq?.name || seq?.word || "");
  const counter = $derived(
    sequences.length > 0 ? `${currentIndex + 1} / ${sequences.length}` : ""
  );
  const hasPrev = $derived(currentIndex > 0);
  const hasNext = $derived(currentIndex < sequences.length - 1);

  function prev() {
    if (hasPrev) currentIndex--;
  }
  function next() {
    if (hasNext) currentIndex++;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  }

  // Clamp index when list shrinks
  $effect(() => {
    if (currentIndex >= sequences.length)
      currentIndex = Math.max(0, sequences.length - 1);
  });

  // Measure the front card so the back card matches its pixel size
  $effect(() => {
    if (!frontEl) return;
    const ro = new ResizeObserver((es) => {
      const r = es[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        measuredW = r.width;
        measuredH = r.height;
      }
    });
    ro.observe(frontEl);
    return () => ro.disconnect();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="designer" onkeydown={onKey} tabindex="0" role="application" aria-label="Card designer">
  {#if isLoading}
    <div class="placeholder">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading...</span>
    </div>
  {:else if !seq}
    <div class="placeholder">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <span>No sequences</span>
    </div>
  {:else}
    <!-- Compact nav: ‹ prev | Name  3/431 | next › -->
    <nav class="nav" aria-label="Card navigation">
      <button class="nav-btn" onclick={prev} disabled={!hasPrev} aria-label="Previous" type="button">
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <span class="nav-name" title={name}>{name}</span>
      <span class="nav-counter">{counter}</span>
      <button class="nav-btn" onclick={next} disabled={!hasNext} aria-label="Next" type="button">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>

    <!-- Card pair: front on top, back below, both fit without scroll -->
    <div class="pair">
      <div class="slot">
        <span class="label">Front</span>
        <div class="surface front" bind:this={frontEl}>
          <ChoreoCard sequence={seq} printMode={true} showQRCodes={true} />
        </div>
      </div>

      <div class="slot">
        <span class="label">Back</span>
        {#if measuredW > 0 && measuredH > 0}
          <div class="surface back" style="width:{measuredW}px; height:{measuredH}px;">
            <CardBack sequence={seq} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .designer {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-sm, 8px);
    overflow: hidden;
    outline: none;
  }

  /* ── Nav ── */
  .nav {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    flex-shrink: 0;
    padding-bottom: var(--spacing-sm, 8px);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 6px);
    background: transparent;
    color: var(--theme-text, #fff);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 12px;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .nav-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .nav-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .nav-counter {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* ── Card pair ──
     Both slots share the available height equally via flex: 1 1 0.
     min-height: 0 at every level lets flex actually shrink content.
     The front card's image scales down to fit. The back card is
     pixel-sized to match the front's measured dimensions.
  */
  .pair {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    min-height: 0;
    overflow: hidden;
  }

  .slot {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    overflow: hidden;
    width: 100%;
  }

  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    flex-shrink: 0;
  }

  .surface {
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    flex: 1;
    min-height: 0;
  }

  /* Front: every layer in the chain must allow shrinking */
  .surface.front :global(.choreo-card) {
    height: 100%;
    width: auto;
  }

  .surface.front :global(.card-content) {
    height: 100%;
  }

  .surface.front :global(.prop-thumbnail) {
    height: 100%;
    width: auto;
  }

  .surface.front :global(.prop-thumbnail img) {
    height: 100%;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }

  /* Back: explicit pixel dimensions from JS, never shrinks */
  .surface.back {
    flex: 0 0 auto;
  }

  /* ── States ── */
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }

  .placeholder i {
    font-size: 1.5rem;
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .placeholder i { animation: none; }
  }
</style>
