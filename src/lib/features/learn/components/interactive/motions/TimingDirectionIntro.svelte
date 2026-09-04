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
    together: { angle: 0, label: "In sync" },
    split: { angle: 180, label: "½ cycle apart" },
    quarter: { angle: 90, label: "¼ cycle apart" },
  } satisfies Record<TimingMode, { angle: number; label: string }>;

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
      class="instrument phase-instrument"
      data-timing={timingMode}
      role="img"
      aria-label={`${timingOptions.find((option) => option.value === timingMode)?.label} timing: ${timingDetail.label.toLowerCase()}. Both hands follow the same circle.`}
    >
      <svg class="motion-dial" viewBox="0 0 240 240" aria-hidden="true">
        <circle class="shared-path" cx="120" cy="120" r="88" />
        <path
          class="phase-ticks"
          d="M120 21v5 M214 120h5 M120 214v5 M21 120h5"
        />
        <g class="orbit timing-orbit">
          <circle class="hand-dot blue-dot" cx="120" cy="32" r="12" />
          <g
            class="phase-offset"
            style:--phase-angle={`${timingDetail.angle}deg`}
          >
            <circle class="hand-dot red-dot" cx="120" cy="32" r="12" />
            <!-- Coincident hands share one center; the two halves keep both identities visible. -->
            <path
              class="together-half blue-dot"
              d="M120 20a12 12 0 0 0 0 24Z"
            />
            <path class="together-seam" d="M120 22v20" />
          </g>
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
      aria-label={`${directionMode === "same" ? "Same direction: both hands go the same way" : "Opposite direction: the hands go opposite ways"} around one circle. Arrowheads show their travel.`}
    >
      <Crossfade key={directionMode} fill>
        <svg class="motion-dial" viewBox="0 0 240 240" aria-hidden="true">
          <circle class="shared-path" cx="120" cy="120" r="88" />
          <g class="orbit direction-orbit blue-orbit">
            <path
              class="motion-tail blue-tail"
              d="M76 43.79A88 88 0 0 1 120 32"
            />
            <circle class="hand-dot blue-dot" cx="120" cy="32" r="12" />
            <path class="travel-chevron" d="m117 27 5 5-5 5" />
          </g>
          <g class="direction-offset">
            <g
              class="orbit direction-orbit red-orbit"
              class:reverse={directionMode === "opposite"}
            >
              <g class:reverse-marker={directionMode === "opposite"}>
                <path
                  class="motion-tail red-tail"
                  d="M76 43.79A88 88 0 0 1 120 32"
                />
                <circle class="hand-dot red-dot" cx="120" cy="32" r="12" />
                <path class="travel-chevron" d="m117 27 5 5-5 5" />
              </g>
            </g>
          </g>
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
    --cycle-duration: calc(var(--duration-dramatic) * 10);
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

  .motion-dial {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .shared-path {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-text) 22%, transparent);
    stroke-width: 1.5;
  }

  .phase-ticks {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-linecap: round;
    stroke-width: 2;
  }

  .orbit,
  .phase-offset,
  .direction-offset,
  .reverse-marker {
    transform-box: view-box;
    transform-origin: center;
  }

  .orbit {
    animation: orbit-cycle var(--cycle-duration) linear infinite;
  }
  .timing-orbit {
    animation-delay: calc(var(--cycle-duration) * -0.125);
  }

  .phase-offset {
    transform: rotate(var(--phase-angle));
    transition: transform var(--duration-dramatic) var(--ease-out);
  }

  .hand-dot {
    stroke: color-mix(in srgb, var(--theme-text) 45%, transparent);
    stroke-width: 1.5;
  }

  .blue-dot {
    fill: var(--prop-blue, #3d44b8);
  }
  .red-dot {
    fill: var(--prop-red, #ed1c24);
  }
  .together-half,
  .together-seam {
    opacity: 0;
  }
  [data-timing="together"] .together-half,
  [data-timing="together"] .together-seam {
    opacity: 1;
  }

  .together-seam {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-text) 65%, transparent);
    stroke-width: 1;
  }

  .direction-offset {
    transform: rotate(180deg);
  }
  .reverse {
    animation-direction: reverse;
  }
  .reverse-marker {
    transform: scaleX(-1);
  }

  .motion-tail {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    opacity: 0.65;
  }

  .blue-tail {
    stroke: var(--prop-blue, #3d44b8);
  }
  .red-tail {
    stroke: var(--prop-red, #ed1c24);
  }
  .travel-chevron {
    fill: none;
    stroke: white;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
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

  @keyframes orbit-cycle {
    to {
      transform: rotate(360deg);
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
    .orbit {
      animation: none;
    }
    .phase-offset {
      transition: none;
    }
  }
</style>
