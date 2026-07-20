<!--
  StepStrip.svelte

  Focus-locked read-ahead carousel: the active pictograph is pinned center under a
  gold focus frame; the whole track slides one cell-stride left per step. Neighbors
  dim + shrink with distance (spotlight). Virtualized window keeps the DOM lean.

  Pure view: it reads notation cells (or derives them from a sequence) plus a float
  currentStep + bpm and renders. No engine, no playback ownership. Extracted from
  the landing Infinite Spinner so landing and practice surfaces share one carousel.
  cellSize drives read-ahead depth (zoom); compact density fits the same behavior
  into smaller editorial surfaces without changing the established default.
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { buildNotationCells, type NotationCell } from "./notation-cell";

  let {
    cells = null,
    sequence = null,
    currentStep,
    bpm,
    cellSize = 72,
    density = "standard",
    anchor = "center",
    fillHeight = false,
    loop = false,
    bluePropType = null,
    redPropType = null,
    stepPulse = false,
    onCellClick = null,
  }: {
    /** Prebuilt cells for callers that already own the notation mapping. */
    cells?: NotationCell[] | null;
    /** Convenience input for lazy surfaces that should keep notation-cell
     *  derivation inside this component's deferred chunk. Ignored when cells
     *  are supplied. */
    sequence?: SequenceData | null;
    /** Float: integer = step number, fraction = progress within step. */
    currentStep: number;
    bpm: number;
    /** Cell width/height in px. Smaller = more read-ahead visible (zoom out). */
    cellSize?: number;
    /** Standard preserves the original Play with It geometry. Compact keeps
     *  the focus treatment while fitting an editorial/card-sized rail. */
    density?: "standard" | "compact";
    /** "start" pins the focus toward the left so upcoming cells fill the space
     *  to the right and finished moves fall off-screen; "center" keeps it mid. */
    anchor?: "center" | "start";
    /** Size cells from the container height instead of using cellSize. Standard
     *  density leaves room around the focus in a tall practice column; compact
     *  density uses nearly all of a short rail's height. */
    fillHeight?: boolean;
    /** Seamless wrap: when the track reaches the end the first cell follows (the
     *  sequence repeats) instead of snapping back to the start. */
    loop?: boolean;
    bluePropType?: PropType | null;
    redPropType?: PropType | null;
    /** Flash the focus frame each time the active step advances. */
    stepPulse?: boolean;
    /** Seek callback when a cell is tapped (receives the cell's stepNumber). */
    onCellClick?: ((stepNumber: number) => void) | null;
  } = $props();

  const GAP = 6;
  const BUFFER = 3;
  const resolvedCells = $derived(cells ?? buildNotationCells(sequence));
  const heroScale = $derived(density === "compact" ? 1.15 : 1.32);

  let currentStepNumber = $derived(Math.floor(currentStep ?? 0));
  let activeIndex = $derived(
    Math.min(
      Math.max(currentStepNumber, 0),
      Math.max(0, resolvedCells.length - 1)
    )
  );

  // Smooth progress within the current step (0→1) from the float step — drives
  // the calm per-step countdown cue under the focus frame.
  let stepPhase = $derived(
    Math.min(1, Math.max(0, (currentStep ?? 0) - currentStepNumber))
  );

  // Monotonic virtual index for seamless looping: the raw step wraps (…N→0…), so
  // on each wrap we add cells.length — the track keeps sliding forward into a
  // repeated copy instead of snapping back. Reset when the sequence changes.
  let loopOffset = $state(0);
  let prevRawStep = -1;
  let prevSeqKey: string | undefined = undefined;
  $effect(() => {
    const raw = currentStepNumber;
    const seqKey = resolvedCells[0]?.key;
    if (seqKey !== prevSeqKey) {
      loopOffset = 0;
      prevRawStep = raw;
      prevSeqKey = seqKey;
      return;
    }
    if (loop && prevRawStep !== -1 && raw < prevRawStep) {
      loopOffset += resolvedCells.length;
    }
    prevRawStep = raw;
  });
  let virtualActive = $derived(loop ? activeIndex + loopOffset : activeIndex);

  let stepStripEl = $state<HTMLDivElement | null>(null);
  let stripContainerWidth = $state(375);
  let stripContainerHeight = $state(70);

  // Focus position. "start" pins it a touch in from the left so upcoming cells
  // fill the space to the right; "center" keeps it mid. The frame is centred on
  // the focus cell either way.
  const FOCUS_MARGIN = $derived(Math.max(28, stripContainerWidth * 0.1));

  // Effective cell px. fillHeight sizes the focus to a fraction of the column
  // HEIGHT — so it stays clearly smaller than the animation canvas — but is also
  // capped by WIDTH so the next couple of cells fit fully. The smaller bound
  // wins. Otherwise the fixed cellSize prop (portrait foot).
  const HEIGHT_FILL = 0.5; // focus pictograph ≈ half the column height
  const WIDTH_CELLS = 2.4; // ≈ how many cell-widths share the row
  const COMPACT_RAIL_INSET = 4;
  const COMPACT_VISIBLE_CELLS = 5.25;
  const compactCell = $derived.by(() => {
    if (stripContainerWidth <= 375) return 44;
    if (stripContainerWidth <= 440) return 48;
    if (stripContainerWidth <= 600) return 56;
    return 64;
  });
  const effCell = $derived.by(() => {
    if (!fillHeight) return density === "compact" ? compactCell : cellSize;

    // The homepage rail is intentionally short. Its compact cells should use
    // that height instead of inheriting the practice pane's half-height rule;
    // otherwise a 79px rail displays the same tiny 48px cells as a 70px rail.
    if (density === "compact") {
      const byHeight = (stripContainerHeight - COMPACT_RAIL_INSET) / heroScale;
      const byWidth = stripContainerWidth / COMPACT_VISIBLE_CELLS;
      return Math.max(44, Math.floor(Math.min(byHeight, byWidth)));
    }

    const byHeight = (stripContainerHeight * HEIGHT_FILL) / heroScale;
    const byWidth = (stripContainerWidth - FOCUS_MARGIN) / WIDTH_CELLS;
    return Math.max(64, Math.floor(Math.min(byHeight, byWidth)));
  });
  const STRIDE = $derived(effCell + GAP);
  const FRAME = $derived(Math.round(effCell * heroScale) + 3); // gold frame hugs the scaled hero
  const verticalHeadroom = $derived(
    density === "compact" ? (effCell >= 64 ? 14 : 12) : 26
  );
  const viewportHeight = $derived(FRAME + verticalHeadroom);

  let focusLeft = $derived(
    anchor === "start" ? FOCUS_MARGIN : stripContainerWidth / 2 - effCell / 2
  );
  let frameLeft = $derived(focusLeft - (FRAME - effCell) / 2);

  // Windowed render list of virtual indices around the focus. For loop, indices
  // run past the ends and map to cells circularly (seamless wrap); otherwise they
  // clamp to the real range. Cells are absolutely placed at vi * STRIDE.
  let renderCells = $derived.by(() => {
    const len = resolvedCells.length;
    if (len === 0)
      return [] as { vi: number; cell: NotationCell; dist: number }[];
    const a = virtualActive;
    let start: number;
    let end: number;
    if (anchor === "start") {
      // Forward-biased: one finished cell (graceful exit) + as many upcoming as
      // the width holds. No deep past — practice only needs what's next.
      const ahead =
        Math.ceil((stripContainerWidth - focusLeft) / STRIDE) + BUFFER;
      start = a - 1;
      end = a + ahead + 1;
    } else {
      const half = Math.ceil(stripContainerWidth / STRIDE / 2) + BUFFER;
      start = a - half;
      end = a + half + 1;
    }
    if (!loop) {
      start = Math.max(0, start);
      end = Math.min(len, end);
    }
    const out: { vi: number; cell: NotationCell; dist: number }[] = [];
    for (let vi = start; vi < end; vi++) {
      const ci = loop ? ((vi % len) + len) % len : vi;
      const cell = resolvedCells[ci];
      if (cell) out.push({ vi, cell, dist: Math.abs(vi - a) });
    }
    return out;
  });

  let trackX = $state(0);
  let animateTrack = $state(false);
  let prevVirtual = -1;
  $effect(() => {
    const idx = virtualActive;
    const left = focusLeft;
    // virtualActive only decreases on init or a backward scrub — loop wraps keep
    // increasing, so the track slides forward through the wrap with no snap.
    const isBackOrInit = prevVirtual === -1 || idx < prevVirtual;
    animateTrack = !isBackOrInit;
    prevVirtual = idx;
    trackX = left - idx * STRIDE;
  });

  // Slide duration tracks the step interval (half a step, clamped) — fast tempos
  // get a shorter, less-visible travel.
  let slideDurMs = $derived(
    Math.round(
      Math.min(0.42, Math.max(0.12, (60 / Math.max(1, bpm)) * 0.5)) * 1000
    )
  );

  function cellOpacity(dist: number) {
    if (dist === 0) return 1;
    return Math.max(0.14, 0.66 - (dist - 1) * 0.18);
  }
  function cellScale(dist: number) {
    if (dist === 0) return heroScale;
    return Math.max(0.62, 0.84 - (dist - 1) * 0.09);
  }

  $effect(() => {
    const el = stepStripEl;
    if (!el) return;
    stripContainerWidth = el.clientWidth;
    stripContainerHeight = el.clientHeight;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        stripContainerWidth = entry.contentRect.width;
        stripContainerHeight = entry.contentRect.height;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

{#if resolvedCells.length > 0}
  <div
    class="step-viewport"
    class:anchor-start={anchor === "start"}
    class:fill-height={fillHeight}
    bind:this={stepStripEl}
    style="--slide-dur: {slideDurMs}ms; --cell: {effCell}px; --frame: {FRAME}px; {fillHeight
      ? 'height: 100%'
      : `height: ${viewportHeight}px`}"
  >
    <div class="step-focus" style="left: {frameLeft}px">
      {#if stepPulse}
        <div class="step-progress" style="transform: scaleX({stepPhase})"></div>
      {/if}
    </div>
    <div
      class="step-track"
      class:no-anim={!animateTrack}
      style="transform: translateX({trackX}px)"
    >
      {#each renderCells as item (item.vi)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="step-cell"
          class:start-cell={item.cell.isStart}
          class:is-focus={item.dist === 0}
          class:clickable={!!onCellClick}
          style="left: {item.vi * STRIDE}px; opacity: {cellOpacity(item.dist)}"
          role={onCellClick ? "button" : undefined}
          tabindex={onCellClick ? 0 : undefined}
          onclick={onCellClick
            ? () => onCellClick?.(item.cell.stepNumber)
            : undefined}
          onkeydown={onCellClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCellClick?.(item.cell.stepNumber);
                }
              }
            : undefined}
        >
          <div
            class="step-pictograph"
            style="transform: scale({cellScale(item.dist)})"
          >
            <PictographContainer
              pictographData={item.cell.data}
              darkMode={true}
              disableTransitions={true}
              disableContentTransitions={true}
              bluePropTypeOverride={bluePropType ?? undefined}
              redPropTypeOverride={redPropType ?? undefined}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .step-viewport {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      black 10%,
      black 90%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      black 10%,
      black 90%,
      transparent 100%
    );
  }
  .step-viewport.fill-height {
    height: 100%;
  }
  /* Start-anchored: focus sits left, so fade only the upcoming (right) edge —
     the left stays solid so the big focus pictograph is never dimmed. */
  .step-viewport.anchor-start {
    -webkit-mask-image: linear-gradient(
      to right,
      black 0,
      black 86%,
      transparent 100%
    );
    mask-image: linear-gradient(to right, black 0, black 86%, transparent 100%);
  }
  /* Cells are absolutely placed at vi * STRIDE inside the track; the track
     translateX slides the whole window. (Absolute, not flex, so the virtual
     window can run past the ends for seamless looping.) */
  .step-track {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    will-change: transform;
    transition: transform var(--slide-dur, 420ms) cubic-bezier(0.4, 0, 0.2, 1);
  }
  .step-track.no-anim {
    transition: none;
  }
  .step-focus {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--frame, 98px);
    height: var(--frame, 98px);
    border: 2px solid #d4813a;
    border-radius: 8px;
    box-shadow: 0 0 12px rgba(212, 129, 58, 0.32); /* calm steady glow — no pulse */
    pointer-events: none;
    z-index: 2;
    overflow: hidden; /* clip the countdown line to the rounded frame */
    transition: left 0.2s ease;
  }
  /* Calm per-step countdown: a thin amber line fills left→right across the step,
     reaching full as the next move takes focus. Replaces the distracting border
     expand/contract — anticipatory and steady instead of flashy. */
  .step-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: #d4813a;
    transform-origin: left center;
    will-change: transform;
  }
  .step-cell {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--cell, 72px);
    height: var(--cell, 72px);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    transition: opacity var(--slide-dur, 420ms) ease;
  }
  .step-cell.clickable {
    cursor: pointer;
  }
  .step-cell.start-cell {
    border-color: rgba(255, 255, 255, 0.15);
  }
  .step-cell.is-focus {
    overflow: visible;
    border-color: transparent;
    z-index: 3;
  }
  .step-pictograph {
    width: 100%;
    height: 100%;
    transform-origin: center;
    transition: transform var(--slide-dur, 420ms) ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-track,
    .step-cell,
    .step-pictograph {
      transition: none;
    }
  }
</style>
