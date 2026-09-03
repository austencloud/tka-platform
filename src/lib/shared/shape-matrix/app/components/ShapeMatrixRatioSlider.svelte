<!--
  One hand's rate, as a line you can slide along.

  The ticks are not decoration and not evenly spaced: each one sits at its own
  exact value, so the comb the eye reads IS the Farey sequence. Halves and
  thirds stand tall with clear approaches; ninths crowd. Detents are scaled the
  same way, so a landmark ratio catches the thumb and a ninth has to be aimed
  at.
-->
<script lang="ts">
  import {
    bracketStops,
    detentRadius,
    nearestStop,
    snapToStop,
    stepStop,
    type RatioStop,
  } from "$lib/shared/shape-matrix/domain/ratio-tuner";

  interface Props {
    stops: readonly RatioStop[];
    value: number;
    /** The stop the value has settled on, or null while it sits between two. */
    locked: RatioStop | null;
    label: string;
    color: string;
    onchange: (value: number) => void;
  }

  let { stops, value, locked, label, color, onchange }: Props = $props();

  let track = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  const bracket = $derived(bracketStops(stops, value));
  const near = $derived(nearestStop(stops, value));

  /*
   * How close the thumb is to catching. Feeding it back into the tick's glow
   * is what makes the well feel physical: the landmark brightens as you come
   * in, before anything snaps.
   */
  const approach = $derived(
    Math.max(0, 1 - near.distance / (detentRadius(near.stop) * 3.5))
  );

  function valueFromPointer(clientX: number): number {
    const rect = track?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function commit(raw: number): void {
    const snapped = snapToStop(stops, raw);
    onchange(snapped ? snapped.value : raw);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    commit(valueFromPointer(event.clientX));
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragging) return;
    commit(valueFromPointer(event.clientX));
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (direction !== 0) {
      event.preventDefault();
      const next = stepStop(stops, value, direction as 1 | -1);
      if (next) onchange(next.value);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onchange(stops[0].value);
    }
    if (event.key === "End") {
      event.preventDefault();
      onchange(stops[stops.length - 1].value);
    }
  }

  const readout = $derived.by(() => {
    if (locked) return locked.key;
    const { below, above } = bracket;
    if (!below || !above) return value.toFixed(3);
    return `between ${below.key} and ${above.key}`;
  });
</script>

<div class="slider-row" style={`--hand-color: ${color};`}>
  <div class="slider-caption">
    <span class="hand-label">{label}</span>
    <span class="hand-readout" class:free={!locked}>{readout}</span>
  </div>

  <div
    bind:this={track}
    class="track"
    class:dragging
    role="slider"
    tabindex="0"
    aria-label={`${label} prop-to-hand ratio`}
    aria-valuemin={0}
    aria-valuemax={1}
    aria-valuenow={Number(value.toFixed(4))}
    aria-valuetext={locked
      ? `${locked.key}, closes in ${locked.ratio.handCycles} hand ${locked.ratio.handCycles === 1 ? "cycle" : "cycles"}`
      : `${readout}, open path`}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onkeydown={handleKeydown}
  >
    <div class="rail"></div>
    {#each stops as stop (stop.key)}
      <span
        class="tick"
        class:current={locked?.key === stop.key}
        style={`left: ${stop.value * 100}%; --prominence: ${stop.prominence.toFixed(3)}; --approach: ${(stop.key === near.stop.key ? approach : 0).toFixed(3)};`}
      ></span>
    {/each}
    <span class="thumb" style={`left: ${value * 100}%;`}></span>
  </div>
</div>

<style>
  .slider-row {
    display: grid;
    gap: 0.35rem;
  }

  .slider-caption {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
  }

  .hand-label {
    color: var(--hand-color);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .hand-readout {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    white-space: nowrap;
  }

  /* A free value is a real state, not a failure, so it stays legible and only
     drops the weight that says "this one is a named shape". */
  .hand-readout.free {
    color: color-mix(in srgb, var(--theme-text, #fff) 66%, transparent);
    font-weight: 500;
  }

  .track {
    position: relative;
    display: block;
    height: var(--min-touch-target, 44px);
    border-radius: 10px;
    cursor: pointer;
    touch-action: none;
  }

  .track:focus-visible {
    outline: 2px solid var(--hand-color);
    outline-offset: 3px;
  }

  .rail {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    height: 3px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--theme-text, #fff) 16%, transparent);
    transform: translateY(-50%);
  }

  /* Height and brightness both read the denominator, so the comb itself shows
     which ratios are landmarks before any label is read. */
  .tick {
    position: absolute;
    top: 50%;
    width: 2px;
    height: calc(9px + var(--prominence) * 17px);
    border-radius: 1px;
    background: color-mix(
      in srgb,
      var(--hand-color) calc((22% + var(--prominence) * 46%) + var(--approach) * 32%),
      transparent
    );
    transform: translate(-50%, -50%);
    transition: background var(--transition-fast, 120ms) ease;
  }

  .tick.current {
    width: 3px;
    background: var(--hand-color);
  }

  .thumb {
    position: absolute;
    top: 50%;
    width: 15px;
    height: 15px;
    border: 2px solid var(--theme-panel-bg, #0a0f14);
    border-radius: 50%;
    background: var(--hand-color);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hand-color) 55%, transparent);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .track.dragging .thumb {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--hand-color) 24%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .tick {
      transition: none;
    }
  }
</style>
