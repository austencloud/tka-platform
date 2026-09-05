<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    nearestQuarterTurn,
    quarterPhase,
    timingFromPhases,
    type TimingMode,
  } from "./timing-intro-phase";

  type DirectionMode = "same" | "opposite";
  const timingOptions: Array<{ value: TimingMode; label: string }> = [
    { value: "together", label: "Together" },
    { value: "split", label: "Split" },
    { value: "quarter", label: "Quarter" },
  ];
  const directionOptions: Array<{ value: DirectionMode; label: string }> = [
    { value: "same", label: "Same" },
    { value: "opposite", label: "Opposite" },
  ];
  const timingDetails = {
    together: {
      description: "Both reach the downbeat together.",
      offset: "",
    },
    split: {
      description: "Their downbeats alternate evenly.",
      offset: "Half a cycle apart.",
    },
    quarter: {
      description: "Their downbeats are a quarter cycle apart.",
      offset: "",
    },
  };
  const points = [
    { phase: 0, x: 50, y: 83.75, name: "bottom" },
    { phase: 1, x: 16.25, y: 50, name: "left side" },
    { phase: 2, x: 50, y: 16.25, name: "top" },
    { phase: 3, x: 83.75, y: 50, name: "right side" },
  ];
  let phases = $state([0, 0]);
  let clockwise = $state([true, true]);
  const timingMode = $derived(timingFromPhases(phases[0]!, phases[1]!));
  const directionMode = $derived<DirectionMode>(
    clockwise[0] === clockwise[1] ? "same" : "opposite"
  );
  const timingDetail = $derived(timingDetails[timingMode]);

  function movePoint(index: number, phase: number): void {
    phases[index] = nearestQuarterTurn(phases[index]!, phase);
  }

  function setTiming(mode: TimingMode): void {
    movePoint(
      1,
      phases[0]! + (mode === "together" ? 0 : mode === "split" ? 2 : 1)
    );
  }

  function setDirection(mode: DirectionMode): void {
    clockwise[1] = mode === "same" ? clockwise[0]! : !clockwise[0];
  }
</script>

<div
  class="concept-model"
  role="group"
  aria-label="Interactive timing and direction examples"
>
  <section class="concept-panel timing-panel" aria-labelledby="timing-heading">
    <h3 id="timing-heading">Timing</h3>
    <p class="concept-prose">
      Timing compares when the two motions reach their downbeats.
    </p>
    <div
      class="instrument timing-instrument"
      data-timing={timingMode}
      role="group"
      aria-label="Choose a point on either timing circle"
    >
      {#each phases as phase, index}
        <div
          class="circle-control"
          class:blue={index === 0}
          class:red={index === 1}
        >
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <g transform="translate(80 80)">
              <circle class="cycle-reference" r="54" />
              <g
                class="phase-rotation"
                style:transform={`rotate(${phase * 90}deg)`}
              >
                <circle class="motion-marker" cx="0" cy="54" r="10" />
              </g>
            </g>
          </svg>
          {#each points as point}
            <button
              type="button"
              class="timing-point"
              style:left={`${point.x}%`}
              style:top={`${point.y}%`}
              aria-label={`${index === 0 ? "Left" : "Right"} timing circle: ${point.name}`}
              aria-pressed={quarterPhase(phase) === point.phase}
              onclick={() => movePoint(index, point.phase)}
              ><span class="point-hint"></span></button
            >
          {/each}
        </div>
      {/each}
    </div>
    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={timingMode}>
        <p>{timingDetail.description}</p>
        {#if timingDetail.offset}<p class="offset">
            {timingDetail.offset}
          </p>{/if}
      </Crossfade>
    </div>
    <div class="selector timing-selector">
      <SegmentedControl
        options={timingOptions}
        value={timingMode}
        onchange={setTiming}
        color="accent"
        density="tight"
        semantics="radiogroup"
        ariaLabel="Timing relationship"
      />
    </div>
  </section>

  <section
    class="concept-panel direction-panel"
    aria-labelledby="direction-heading"
  >
    <h3 id="direction-heading">Direction</h3>
    <p class="concept-prose">
      Direction compares rotation: circling the same way or opposite ways.
    </p>
    <div
      class="instrument direction-instrument"
      data-direction={directionMode}
      role="group"
      aria-label="Click either arrow to flip its rotation"
    >
      {#each clockwise as isClockwise, index}
        <button
          type="button"
          class="arrow-control"
          class:blue={index === 0}
          class:red={index === 1}
          aria-label={`${index === 0 ? "Left" : "Right"} rotation: ${isClockwise ? "clockwise" : "counterclockwise"}. Click to flip.`}
          onclick={() => (clockwise[index] = !isClockwise)}
        >
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <g transform="translate(80 80)">
              <g
                class="arrow-flip"
                style:transform={`scaleX(${isClockwise ? 1 : -1})`}
              >
                <path
                  class="rotation-arc"
                  d="M-38.184 38.184A54 54 0 1 1 54 0"
                />
                <path
                  class="arrowhead"
                  d="M40-7 Q37-7 39-4 L52 17 Q54 20 56 17 L69-4 Q71-7 68-7 Z"
                />
              </g>
            </g>
          </svg>
        </button>
      {/each}
    </div>
    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={directionMode}
        ><p>
          {directionMode === "same"
            ? "Both rotate the same way."
            : "They rotate opposite ways."}
        </p></Crossfade
      >
    </div>
    <div class="selector direction-selector">
      <SegmentedControl
        options={directionOptions}
        value={directionMode}
        onchange={setDirection}
        color="accent"
        density="tight"
        semantics="radiogroup"
        ariaLabel="Direction relationship"
      />
    </div>
  </section>
</div>

<style>
  .concept-model {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    margin-inline: auto;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-xl, 1rem);
    background: var(--theme-card-bg);
  }
  .concept-panel {
    display: grid;
    grid-template-rows: auto 3em minmax(6rem, 1fr) 4.75em auto;
    justify-items: center;
    align-content: start;
    gap: 0.75rem;
    min-width: 0;
    min-height: 0;
    padding: clamp(1rem, 2cqw, 2rem);
    font-size: clamp(1rem, 1.35cqw, 2rem);
  }
  .direction-panel {
    border-inline-start: 1px solid var(--theme-stroke);
  }
  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.35rem, 2.4cqw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  p {
    margin: 0;
  }
  .concept-prose,
  .relationship-caption {
    max-width: 35ch;
    color: var(--theme-text-dim);
    line-height: 1.5;
    text-align: center;
    text-wrap: balance;
  }
  .relationship-caption {
    align-self: center;
  }
  .offset {
    margin-top: 0.25em;
    white-space: nowrap;
  }
  .instrument {
    position: relative;
    width: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
  }
  .circle-control,
  .arrow-control {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    min-width: 0;
  }
  .timing-point,
  .arrow-control {
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .timing-point {
    position: absolute;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: inherit;
  }
  .point-hint {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.8;
  }
  .timing-point[aria-pressed="true"] .point-hint {
    opacity: 0;
  }
  .timing-point:hover .point-hint {
    opacity: 1;
  }
  .timing-point:focus-visible,
  .arrow-control:focus-visible {
    outline: 2px solid var(--theme-text);
    outline-offset: 2px;
  }
  .arrow-control {
    border-radius: var(--radius-lg, 0.75rem);
  }
  .arrow-control:hover {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.04));
  }
  .phase-rotation {
    transition: transform var(--transition-dramatic);
  }
  .arrow-flip {
    transition: transform var(--transition-emphasis);
  }
  .phase-rotation,
  .arrow-flip {
    transform-origin: 0 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .phase-rotation,
    .arrow-flip {
      transition: none;
    }
  }
  :global([data-motion-preference="reduce"]) .phase-rotation,
  :global([data-motion-preference="reduce"]) .arrow-flip {
    transition: none;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .blue {
    color: var(--prop-blue, #3d44b8);
  }
  .red {
    color: var(--prop-red, #ed1c24);
  }
  .motion-marker,
  .arrowhead {
    fill: currentColor;
  }
  .cycle-reference {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    opacity: 0.6;
  }
  .rotation-arc {
    fill: none;
    stroke: currentColor;
    stroke-width: 7.5;
    stroke-linecap: round;
  }
  .selector {
    width: 100%;
    max-width: 19.5rem;
    min-width: 0;
  }
  .direction-selector {
    max-width: 13rem;
  }
  @media (max-width: 640px) {
    .concept-model {
      grid-template-columns: minmax(0, 1fr);
      min-height: 56rem;
    }
    .direction-panel {
      border-inline-start: 0;
      border-block-start: 1px solid var(--theme-stroke);
    }
    .concept-panel {
      padding: 1rem 0.35rem;
      gap: 0.65rem;
      font-size: 0.875rem;
      grid-template-rows: auto auto minmax(8rem, 1fr) auto auto;
    }
    .concept-prose,
    .relationship-caption {
      padding-inline: 0.2rem;
    }
  }
</style>
