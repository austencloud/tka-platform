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
      offset: 0,
      label: "In sync",
      description: "The two lights flash at the same time.",
    },
    split: {
      offset: 0.5,
      label: "½ cycle apart",
      description: "The two lights take turns, evenly spaced.",
    },
    quarter: {
      offset: 0.25,
      label: "¼ cycle apart",
      description:
        "Blue flashes, then red a quarter cycle later, followed by a longer gap.",
    },
  } satisfies Record<
    TimingMode,
    { offset: number; label: string; description: string }
  >;

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

    <div
      class="instrument timing-instrument"
      data-timing={timingMode}
      role="img"
      aria-label={`${timingOptions.find((option) => option.value === timingMode)?.label} timing: ${timingDetail.description}`}
    >
      <svg class="concept-diagram" viewBox="0 0 240 240" aria-hidden="true">
        <!-- Brightness carries timing; neither light changes size or position. -->
        <g class="pulse-lights">
          {#each ["blue", "red"] as hand, index}
            <g
              class="timing-light {hand}"
              style:--pulse-offset={index === 0 ? 0 : timingDetail.offset}
            >
              <circle class="lamp-base" cx={72 + index * 96} cy="120" r="28" />
              <g class="light-pulse">
                <circle
                  class="lamp-halo"
                  cx={72 + index * 96}
                  cy="120"
                  r="38"
                />
                <circle
                  class="lamp-core"
                  cx={72 + index * 96}
                  cy="120"
                  r="28"
                />
                <circle
                  class="lamp-highlight"
                  cx={72 + index * 96}
                  cy="120"
                  r="18"
                />
              </g>
            </g>
          {/each}
        </g>
        <!-- Reduced motion keeps the relationship visible as four stationary beat positions. -->
        <g class="static-rhythm">
          {#each [0, 1, 2, 3] as beat}
            <circle
              class="beat blue"
              class:beat-on={beat === 0}
              cx={54 + beat * 44}
              cy="94"
              r="13"
            />
            <circle
              class="beat red"
              class:beat-on={beat === timingDetail.offset * 4}
              cx={54 + beat * 44}
              cy="146"
              r="13"
            />
          {/each}
        </g>
      </svg>
    </div>

    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={timingMode}><span>{timingDetail.label}</span></Crossfade>
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

    <div
      class="instrument direction-instrument"
      data-direction={directionMode}
      role="img"
      aria-label={directionMode === "same"
        ? "Same direction: both arrows point right."
        : "Opposite direction: the blue arrow points right and the red arrow points left."}
    >
      <Crossfade key={directionMode} fill>
        <svg class="concept-diagram" viewBox="0 0 240 240" aria-hidden="true">
          <path
            class="direction-arrow blue"
            d="M54 84h132m-28-28 28 28-28 28"
          />
          <path
            class="direction-arrow red"
            d={directionMode === "same"
              ? "M54 156h132m-28-28 28 28-28 28"
              : "M186 156H54m28-28-28 28 28 28"}
          />
        </svg>
      </Crossfade>
    </div>

    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={directionMode}
        ><span>{directionMode === "same" ? "Same way" : "Opposite ways"}</span
        ></Crossfade
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
    --cycle-duration: calc(var(--duration-dramatic) * 6);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: min(100%, 64rem);
    height: min(100%, 28rem);
    min-height: 0;
    margin-inline: auto;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-xl, 1rem);
    background: var(--theme-card-bg);
  }

  .concept-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    justify-items: center;
    gap: clamp(0.5rem, 1.5cqh, 0.875rem);
    min-width: 0;
    min-height: 0;
    padding: clamp(1rem, 2cqw, 2rem);
  }

  .direction-panel {
    border-inline-start: 1px solid var(--theme-stroke);
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.25rem, 2cqw, 1.75rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-align: center;
  }

  .instrument {
    position: relative;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  .concept-diagram {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .blue {
    color: var(--prop-blue, #3d44b8);
  }
  .red {
    color: var(--prop-red, #ed1c24);
  }

  .lamp-base,
  .lamp-core {
    fill: currentColor;
  }
  .lamp-base {
    opacity: 0.28;
  }
  .lamp-halo {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    opacity: 0.45;
  }
  .lamp-highlight {
    fill: white;
    opacity: 0.28;
  }
  .light-pulse {
    opacity: 0;
    animation: light-beat var(--cycle-duration) linear infinite;
    animation-delay: calc(var(--cycle-duration) * var(--pulse-offset));
  }

  .static-rhythm {
    display: none;
  }
  .beat {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    opacity: 0.4;
  }
  .beat-on {
    fill: currentColor;
    opacity: 1;
  }

  .direction-arrow {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 10;
  }

  .relationship-caption {
    height: 1.5rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
    line-height: 1.5rem;
    text-align: center;
    white-space: nowrap;
  }

  .selector {
    width: 100%;
    max-width: 19.5rem;
    min-width: 0;
  }
  .direction-selector {
    max-width: 13rem;
  }

  @keyframes light-beat {
    0%,
    5% {
      opacity: 1;
    }
    20%,
    100% {
      opacity: 0;
    }
  }

  @media (max-width: 640px) {
    .concept-model {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      height: min(100%, 18rem);
    }
    .concept-panel {
      padding: 0.875rem 0.25rem;
      gap: 0.5rem;
    }
    .instrument {
      width: min(100%, 7.5rem);
    }
  }

  @media (max-height: 540px) and (min-width: 641px) {
    .concept-panel {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 0.75rem;
      row-gap: 0.35rem;
      padding: 0.75rem;
    }
    h3 {
      grid-column: 1;
      font-size: 1.25rem;
    }
    .instrument {
      grid-column: 2;
      grid-row: 1 / -1;
      align-self: stretch;
    }
    .relationship-caption {
      grid-column: 1;
      grid-row: 2;
    }
    .selector {
      grid-column: 1;
      grid-row: 3;
    }
  }

  @media (min-width: 2400px) and (min-height: 1300px) {
    .concept-model {
      width: min(100%, 84rem);
      height: min(100%, 36rem);
    }
  }

  @media (max-height: 540px) and (min-width: 641px) and (max-width: 800px) {
    .instrument {
      grid-row: 1 / 3;
    }
    .selector {
      grid-column: 1 / -1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .light-pulse {
      animation: none;
    }
    .pulse-lights {
      display: none;
    }
    .static-rhythm {
      display: inline;
    }
  }
</style>
