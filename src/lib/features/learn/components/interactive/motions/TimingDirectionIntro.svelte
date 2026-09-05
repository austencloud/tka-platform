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
      redX: 120,
      redY: 174,
      label: "Together",
      description:
        "At blue's downbeat, both hands are at the bottom of the circle.",
    },
    split: {
      redX: 120,
      redY: 22,
      label: "½ cycle",
      description:
        "At blue's downbeat, red is at the top of the circle: half a cycle apart.",
    },
    quarter: {
      redX: 44,
      redY: 98,
      label: "¼ cycle",
      description:
        "At blue's downbeat, red is at the side of the circle: a quarter cycle apart.",
    },
  } satisfies Record<
    TimingMode,
    { redX: number; redY: number; label: string; description: string }
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
      <Crossfade key={timingMode} fill>
        <svg class="concept-diagram" viewBox="0 0 240 240" aria-hidden="true">
          <!-- A downbeat snapshot shows phase without choosing a rotation direction. -->
          <circle class="cycle-reference" cx="120" cy="98" r="76" />
          <path class="downbeat-reference" d="M92 194h56M120 194v10" />
          <text class="diagram-label" x="120" y="234">Downbeat</text>
          <text class="phase-label" x="120" y="108">{timingDetail.label}</text>
          {#if timingMode === "together"}
            <!-- Both colors occupy the exact same point, not neighboring tracks. -->
            <path class="hand-marker blue" d="M120 158a16 16 0 0 0 0 32Z" />
            <path class="hand-marker red" d="M120 158a16 16 0 0 1 0 32Z" />
          {:else}
            <circle class="hand-marker blue" cx="120" cy="174" r="16" />
            <circle
              class="hand-marker red"
              cx={timingDetail.redX}
              cy={timingDetail.redY}
              r="16"
            />
          {/if}
        </svg>
      </Crossfade>
    </div>

    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <span>At blue’s downbeat</span>
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
        ? "Same rotation direction: both hands circle clockwise. No timing is shown."
        : "Opposite rotation directions: blue circles clockwise and red circles counterclockwise. No timing is shown."}
    >
      <Crossfade key={directionMode} fill>
        <svg class="concept-diagram" viewBox="0 0 240 240" aria-hidden="true">
          <!-- Rotation symbols have no hand positions or shared beat to imply timing. -->
          <g transform="translate(60 120)">
            <path
              class="direction-arrow blue"
              d="M-24 24A34 34 0 1 1 34 0M22-12 34 0 46-12"
            />
          </g>
          <g
            transform={`translate(180 120) scale(${directionMode === "same" ? 1 : -1} 1)`}
          >
            <path
              class="direction-arrow red"
              d="M-24 24A34 34 0 1 1 34 0M22-12 34 0 46-12"
            />
          </g>
        </svg>
      </Crossfade>
    </div>

    <div class="relationship-caption" aria-live="polite" aria-atomic="true">
      <Crossfade key={directionMode}
        ><span
          >{directionMode === "same"
            ? "Same rotation"
            : "Opposite rotation"}</span
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

  .hand-marker {
    fill: currentColor;
  }
  .cycle-reference {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-width: 3;
    opacity: 0.35;
  }
  .downbeat-reference {
    fill: none;
    stroke: var(--theme-text);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .diagram-label,
  .phase-label {
    fill: var(--theme-text-dim);
    font-family: inherit;
    font-size: 28px;
    text-anchor: middle;
  }
  .phase-label {
    fill: var(--theme-text);
    font-weight: 600;
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
</style>
