<!--
  BeatStrip.svelte

  Focus-locked read-ahead carousel: the active pictograph is pinned center under a
  gold focus frame; the whole track slides one cell-stride left per step. Neighbors
  dim + shrink with distance (spotlight). Virtualized window keeps the DOM lean.

  Pure view: it reads cells + a float currentStep + bpm and renders. No engine, no
  playback ownership. Extracted from the landing Infinite Spinner so the landing and
  practice surfaces share one carousel. cellSize drives read-ahead depth (zoom).
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { NotationCell } from "./notation-cell";

  let {
    cells,
    currentStep,
    bpm,
    cellSize = 72,
    bluePropType = null,
    redPropType = null,
    beatPulse = false,
    onCellClick = null,
  }: {
    cells: NotationCell[];
    /** Float: integer = step number, fraction = progress within step. */
    currentStep: number;
    bpm: number;
    /** Cell width/height in px. Smaller = more read-ahead visible (zoom out). */
    cellSize?: number;
    bluePropType?: PropType | null;
    redPropType?: PropType | null;
    /** Flash the focus frame each time the active step advances. */
    beatPulse?: boolean;
    /** Seek callback when a cell is tapped (receives the cell's stepNumber). */
    onCellClick?: ((stepNumber: number) => void) | null;
  } = $props();

  const GAP = 6;
  const BUFFER = 3;
  const HERO_SCALE = 1.32;
  const STRIDE = $derived(cellSize + GAP);
  const FRAME = $derived(Math.round(cellSize * HERO_SCALE) + 3); // gold frame hugs the scaled hero (cellSize 72 → 98)
  const viewportHeight = $derived(FRAME + 26); // headroom above/below the hero

  let currentStepNumber = $derived(Math.floor(currentStep ?? 0));
  let activeIndex = $derived(
    Math.min(Math.max(currentStepNumber, 0), Math.max(0, cells.length - 1))
  );

  let beatStripEl = $state<HTMLDivElement | null>(null);
  let stripContainerWidth = $state(375);

  let focusLeft = $derived(stripContainerWidth / 2 - cellSize / 2);
  let frameLeft = $derived(stripContainerWidth / 2 - FRAME / 2);

  let visibleRange = $derived.by(() => {
    const half = Math.ceil(stripContainerWidth / STRIDE / 2) + BUFFER;
    return { start: Math.max(0, activeIndex - half), end: Math.min(cells.length, activeIndex + half + 1) };
  });

  let trackX = $state(0);
  let animateTrack = $state(false);
  let prevActiveIndex = -1;
  let pulseKey = $state(0); // bumps on step advance to retrigger the focus-frame pulse
  $effect(() => {
    const idx = activeIndex;
    const left = focusLeft;
    const isWrapOrInit = prevActiveIndex === -1 || idx < prevActiveIndex;
    animateTrack = !isWrapOrInit;
    if (beatPulse && idx !== prevActiveIndex && !isWrapOrInit) pulseKey++;
    prevActiveIndex = idx;
    trackX = left - idx * STRIDE;
  });

  // Slide duration tracks the beat interval (half a beat, clamped) — fast tempos
  // get a shorter, less-visible travel.
  let slideDurMs = $derived(
    Math.round(Math.min(0.42, Math.max(0.12, (60 / Math.max(1, bpm)) * 0.5)) * 1000)
  );

  function cellOpacity(dist: number) {
    if (dist === 0) return 1;
    return Math.max(0.14, 0.66 - (dist - 1) * 0.18);
  }
  function cellScale(dist: number) {
    if (dist === 0) return HERO_SCALE;
    return Math.max(0.62, 0.84 - (dist - 1) * 0.09);
  }

  $effect(() => {
    const el = beatStripEl;
    if (!el) return;
    stripContainerWidth = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) stripContainerWidth = entry.contentRect.width;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

{#if cells.length > 0}
  <div
    class="beat-viewport"
    bind:this={beatStripEl}
    style="--slide-dur: {slideDurMs}ms; --cell: {cellSize}px; --frame: {FRAME}px; height: {viewportHeight}px"
  >
    {#key pulseKey}
      <div class="beat-focus" class:pulse={beatPulse} style="left: {frameLeft}px"></div>
    {/key}
    <div class="beat-track" class:no-anim={!animateTrack} style="transform: translateX({trackX}px)">
      {#each cells as cell, i (cell.key)}
        {#if i >= visibleRange.start && i < visibleRange.end}
          {@const dist = Math.abs(i - activeIndex)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="beat-cell"
            class:start-cell={cell.isStart}
            class:is-focus={dist === 0}
            class:clickable={!!onCellClick}
            style="opacity: {cellOpacity(dist)}"
            role={onCellClick ? "button" : undefined}
            tabindex={onCellClick ? 0 : undefined}
            onclick={onCellClick ? () => onCellClick?.(cell.stepNumber) : undefined}
            onkeydown={onCellClick
              ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCellClick?.(cell.stepNumber); } }
              : undefined}
          >
            <div class="beat-pictograph" style="transform: scale({cellScale(dist)})">
              <PictographContainer
                pictographData={cell.data}
                darkMode={true}
                disableTransitions={true}
                disableContentTransitions={true}
                bluePropTypeOverride={bluePropType}
                redPropTypeOverride={redPropType}
              />
            </div>
          </div>
        {:else}
          <div class="beat-cell beat-cell-placeholder" aria-hidden="true"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .beat-viewport {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    -webkit-mask-image: linear-gradient(to right, transparent 0, black 10%, black 90%, transparent 100%);
    mask-image: linear-gradient(to right, transparent 0, black 10%, black 90%, transparent 100%);
  }
  .beat-track {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    will-change: transform;
    transition: transform var(--slide-dur, 420ms) cubic-bezier(0.4, 0, 0.2, 1);
  }
  .beat-track.no-anim { transition: none; }
  .beat-focus {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--frame, 98px);
    height: var(--frame, 98px);
    border: 2px solid #d4813a;
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(212, 129, 58, 0.5);
    pointer-events: none;
    z-index: 2;
    transition: left 0.2s ease;
  }
  .beat-focus.pulse { animation: focus-pulse 0.32s ease-out; }
  @keyframes focus-pulse {
    0% { box-shadow: 0 0 16px rgba(212, 129, 58, 0.5); transform: translateY(-50%) scale(1); }
    40% { box-shadow: 0 0 28px rgba(212, 129, 58, 0.95); transform: translateY(-50%) scale(1.06); }
    100% { box-shadow: 0 0 16px rgba(212, 129, 58, 0.5); transform: translateY(-50%) scale(1); }
  }
  .beat-cell {
    position: relative;
    flex: 0 0 var(--cell, 72px);
    width: var(--cell, 72px);
    height: var(--cell, 72px);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    transition: opacity var(--slide-dur, 420ms) ease;
  }
  .beat-cell.clickable { cursor: pointer; }
  .beat-cell.start-cell { border-color: rgba(255, 255, 255, 0.15); }
  .beat-cell.is-focus { overflow: visible; border-color: transparent; z-index: 3; }
  .beat-pictograph {
    width: 100%;
    height: 100%;
    transform-origin: center;
    transition: transform var(--slide-dur, 420ms) ease;
  }
  .beat-cell-placeholder { border-color: transparent; background: transparent; pointer-events: none; }

  @media (prefers-reduced-motion: reduce) {
    .beat-track,
    .beat-cell,
    .beat-pictograph { transition: none; }
    .beat-focus.pulse { animation: none; }
  }
</style>
