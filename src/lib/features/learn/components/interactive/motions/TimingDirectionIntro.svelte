<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  type TimingMode = "together" | "split" | "quarter";
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
      x: 0,
      y: 54,
      description: "Both hands reach the downbeat together.",
      offset: "",
    },
    split: {
      x: 0,
      y: -54,
      description: "The hands are on opposite sides of their circles.",
      offset: "Half a cycle apart.",
    },
    quarter: {
      x: -54,
      y: 0,
      description:
        "When either hand reaches the downbeat, the other is at the side.",
      offset: "A quarter cycle apart.",
    },
  };
  let timingMode = $state<TimingMode>("together");
  let directionMode = $state<DirectionMode>("same");
  const timingDetail = $derived(timingDetails[timingMode]);
</script>

<div
  class="concept-model"
  role="group"
  aria-label="Interactive timing and direction examples"
>
  <section class="concept-panel timing-panel" aria-labelledby="timing-heading">
    <h3 id="timing-heading">Timing</h3>
    <p class="concept-prose">
      Timing compares when each hand reaches the bottom of its circle: the
      downbeat.
    </p>
    <div
      class="instrument"
      data-timing={timingMode}
      role="img"
      aria-label={`${timingDetail.description} ${timingDetail.offset}`.trim()}
    >
      <Crossfade key={timingMode} fill>
        <svg viewBox="0 0 320 160" aria-hidden="true">
          <!-- A still moment at the left hand's downbeat: no direction implied. -->
          <g class="blue" transform="translate(80 80)">
            <circle class="cycle-reference" r="54" />
            <circle class="hand-marker" cx="0" cy="54" r="10" />
          </g>
          <g class="red" transform="translate(240 80)">
            <circle class="cycle-reference" r="54" />
            <circle
              class="hand-marker"
              cx={timingDetail.x}
              cy={timingDetail.y}
              r="10"
            />
          </g>
        </svg>
      </Crossfade>
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
        onchange={(value) => (timingMode = value)}
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
      Direction compares the hands’ rotation: circling the same way or opposite
      ways.
    </p>
    <div
      class="instrument"
      data-direction={directionMode}
      role="img"
      aria-label={directionMode === "same"
        ? "Same rotation: both hands circle clockwise."
        : "Opposite rotation: the left hand circles clockwise and the right hand circles counterclockwise."}
    >
      <Crossfade key={directionMode} fill>
        <svg viewBox="0 0 320 160" aria-hidden="true">
          <!-- Static rotation symbols have no hand positions or rhythm. -->
          <g class="blue" transform="translate(80 80)">
            <path class="rotation-arc" d="M-38.184 38.184A54 54 0 1 1 54 0" />
            <path
              class="arrowhead"
              d="M40-7 Q37-7 39-4 L52 17 Q54 20 56 17 L69-4 Q71-7 68-7 Z"
            />
          </g>
          <g
            class="red"
            transform={`translate(240 80) scale(${directionMode === "same" ? 1 : -1} 1)`}
          >
            <path class="rotation-arc" d="M-38.184 38.184A54 54 0 1 1 54 0" />
            <path
              class="arrowhead"
              d="M40-7 Q37-7 39-4 L52 17 Q54 20 56 17 L69-4 Q71-7 68-7 Z"
            />
          </g>
        </svg>
      </Crossfade>
    </div>
    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={directionMode}
        ><p>
          {directionMode === "same"
            ? "Both clockwise, or both counterclockwise."
            : "One clockwise. One counterclockwise."}
        </p></Crossfade
      >
    </div>
    <div class="selector direction-selector">
      <SegmentedControl
        options={directionOptions}
        value={directionMode}
        onchange={(value) => (directionMode = value)}
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
  .hand-marker,
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
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    }
    .concept-panel {
      padding: 1rem 0.35rem;
      gap: 0.65rem;
      font-size: 0.875rem;
      grid-template-rows: auto 9em minmax(5rem, 1fr) 7.5em auto;
    }
    .concept-prose,
    .relationship-caption {
      padding-inline: 0.2rem;
    }
  }
</style>
