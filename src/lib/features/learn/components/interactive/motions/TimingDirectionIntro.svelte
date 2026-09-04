<!--
  Two direct instruments introduce the independent Timing and Direction axes.
  Timing uses a phase dial instead of simulated physics; Direction uses paths
  with explicit arrowheads. Only the selected relationship animates in each
  instrument, so the learner never has to reconcile five competing clocks.
-->
<script lang="ts">
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

  const timingDetails: Record<
    TimingMode,
    { value: string; unit: string; ariaLabel: string }
  > = {
    together: {
      value: "0",
      unit: "same point",
      ariaLabel:
        "Together timing. The blue and red hands stay at the same point in the cycle.",
    },
    split: {
      value: "½",
      unit: "cycle apart",
      ariaLabel:
        "Split timing. The blue and red hands stay half a cycle apart.",
    },
    quarter: {
      value: "¼",
      unit: "cycle apart",
      ariaLabel:
        "Quarter timing. The blue and red hands stay one quarter of a cycle apart.",
    },
  };

  const directionDetails: Record<
    DirectionMode,
    { label: string; ariaLabel: string }
  > = {
    same: {
      label: "same way",
      ariaLabel: "Same direction. The blue and red hands travel the same way.",
    },
    opposite: {
      label: "opposite ways",
      ariaLabel:
        "Opposite direction. The blue and red hands travel opposite ways.",
    },
  };

  let timingMode = $state<TimingMode>("together");
  let directionMode = $state<DirectionMode>("same");

  const timingDetail = $derived(timingDetails[timingMode]);
  const directionDetail = $derived(directionDetails[directionMode]);
</script>

<div
  class="concept-model"
  role="group"
  aria-label="Interactive timing and direction examples"
>
  <section class="concept-panel timing-panel" aria-labelledby="timing-heading">
    <h3 id="timing-heading">Timing</h3>

    <div
      class="selector timing-selector"
      onkeydown={(event) => event.stopPropagation()}
    >
      <SegmentedControl
        options={timingOptions}
        value={timingMode}
        onchange={(value) => (timingMode = value)}
        color="accent"
        density="compact"
        semantics="radiogroup"
        ariaLabel="Timing relationship"
      />
    </div>

    <div
      class="instrument phase-instrument"
      data-timing={timingMode}
      role="img"
      aria-label={timingDetail.ariaLabel}
    >
      <svg class="phase-dial" viewBox="0 0 220 220" aria-hidden="true">
        <circle class="phase-ring outer-ring" cx="110" cy="110" r="78"></circle>
        <circle class="phase-ring inner-ring" cx="110" cy="110" r="53"></circle>

        <path class="phase-ticks" d="M110 20v8 M110 192v8 M20 110h8 M192 110h8"
        ></path>

        <g class="phase-orbit blue-orbit">
          <circle class="phase-dot blue-dot" cx="110" cy="32" r="9"></circle>
        </g>
        <g class="phase-orbit red-orbit">
          <circle class="phase-dot red-dot" cx="110" cy="57" r="9"></circle>
        </g>

        <text class="phase-value" x="110" y="107">{timingDetail.value}</text>
        <text class="phase-unit" x="110" y="129">{timingDetail.unit}</text>
      </svg>
    </div>
  </section>

  <section
    class="concept-panel direction-panel"
    aria-labelledby="direction-heading"
  >
    <h3 id="direction-heading">Direction</h3>

    <div
      class="selector direction-selector"
      onkeydown={(event) => event.stopPropagation()}
    >
      <SegmentedControl
        options={directionOptions}
        value={directionMode}
        onchange={(value) => (directionMode = value)}
        color="accent"
        density="compact"
        semantics="radiogroup"
        ariaLabel="Direction relationship"
      />
    </div>

    <div
      class="instrument direction-instrument"
      data-direction={directionMode}
      role="img"
      aria-label={directionDetail.ariaLabel}
    >
      <svg class="direction-diagram" viewBox="0 0 280 150" aria-hidden="true">
        <path class="travel-track" d="M30 42H250"></path>
        <path class="travel-track" d="M30 98H250"></path>

        <path class="travel-arrow blue-arrow" d="M239 33l11 9-11 9"></path>
        <path class="travel-arrow red-arrow same-arrow" d="M239 89l11 9-11 9"
        ></path>
        <path
          class="travel-arrow red-arrow opposite-arrow"
          d="M41 89l-11 9 11 9"
        ></path>

        <circle class="runner blue-runner" cx="39" cy="42" r="9"></circle>
        <circle class="runner red-runner" cx="39" cy="98" r="9"></circle>

        <text class="direction-value" x="140" y="139">
          {directionDetail.label}
        </text>
      </svg>
    </div>
  </section>
</div>

<style>
  .concept-model {
    --phase-cycle: calc(
      var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic)
    );
    --travel-cycle: calc(
      var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic)
    );
    --scene-delay: calc(0ms - var(--duration-emphasis));
    --quarter-delay: calc(
      0ms - var(--duration-dramatic) - var(--duration-dramatic)
    );
    --half-delay: calc(
      0ms - var(--duration-dramatic) - var(--duration-dramatic) -
        var(--duration-dramatic) - var(--duration-dramatic)
    );

    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    width: min(100%, 72rem);
    height: min(100%, 18rem);
    min-height: min(100%, 15rem);
    margin-inline: auto;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }

  .concept-panel {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: clamp(0.5rem, 1.4cqh, 0.8rem);
    min-width: 0;
    min-height: 0;
    padding: clamp(0.85rem, 1.8cqw, 1.35rem);
  }

  .direction-panel {
    border-inline-start: 1px solid var(--theme-stroke);
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.35rem, 2.1cqw, 2rem);
    line-height: 1.1;
    text-align: center;
  }

  .selector {
    width: 100%;
    margin-inline: auto;
  }

  .timing-selector {
    max-width: 24rem;
  }

  .direction-selector {
    max-width: 16rem;
  }

  .instrument {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .phase-dial {
    display: block;
    width: auto;
    max-width: 100%;
    height: min(100%, 11.5rem);
    overflow: visible;
  }

  .phase-ring {
    fill: none;
    stroke: var(--theme-stroke-strong);
    stroke-width: 2;
  }

  .inner-ring {
    stroke: var(--theme-stroke);
  }

  .phase-ticks {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-linecap: round;
    stroke-width: 3;
  }

  .phase-orbit {
    transform-box: view-box;
    transform-origin: center;
    animation: phase-rotation var(--phase-cycle) linear infinite both;
    animation-delay: var(--scene-delay);
  }

  .phase-instrument[data-timing="split"] .red-orbit {
    animation-delay: calc(var(--scene-delay) + var(--half-delay));
  }

  .phase-instrument[data-timing="quarter"] .red-orbit {
    animation-delay: calc(var(--scene-delay) + var(--quarter-delay));
  }

  .phase-dot {
    stroke: color-mix(in srgb, var(--theme-text) 18%, transparent);
    stroke-width: 2;
  }

  .blue-dot,
  .blue-runner {
    fill: var(--prop-blue, #3d44b8);
  }

  .red-dot,
  .red-runner {
    fill: var(--prop-red, #ed1c24);
  }

  .phase-value,
  .phase-unit,
  .direction-value {
    text-anchor: middle;
  }

  .phase-value {
    fill: var(--theme-text);
    font-size: 1.55rem;
    font-weight: 800;
  }

  .phase-unit,
  .direction-value {
    fill: var(--theme-text-dim);
    font-size: 0.78rem;
    font-weight: 650;
  }

  .direction-diagram {
    display: block;
    width: min(100%, 18rem);
    max-height: 100%;
    height: auto;
    overflow: visible;
  }

  .travel-track {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-stroke-strong) 72%, transparent);
    stroke-linecap: round;
    stroke-width: 17;
  }

  .travel-arrow {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 3;
  }

  .opposite-arrow {
    display: none;
  }

  .direction-instrument[data-direction="opposite"] .same-arrow {
    display: none;
  }

  .direction-instrument[data-direction="opposite"] .opposite-arrow {
    display: inline;
  }

  .runner {
    transform-box: view-box;
    animation: direction-travel-forward var(--travel-cycle) linear infinite both;
    animation-delay: var(--scene-delay);
  }

  .direction-instrument[data-direction="opposite"] .red-runner {
    animation-name: direction-travel-reverse;
  }

  @keyframes phase-rotation {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes direction-travel-forward {
    0%,
    8% {
      opacity: 1;
      transform: translateX(0);
    }
    82% {
      opacity: 1;
      transform: translateX(202px);
    }
    88% {
      opacity: 0;
      transform: translateX(202px);
    }
    89% {
      opacity: 0;
      transform: translateX(0);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes direction-travel-reverse {
    0%,
    8% {
      opacity: 1;
      transform: translateX(202px);
    }
    82% {
      opacity: 1;
      transform: translateX(0);
    }
    88% {
      opacity: 0;
      transform: translateX(0);
    }
    89% {
      opacity: 0;
      transform: translateX(202px);
    }
    100% {
      opacity: 1;
      transform: translateX(202px);
    }
  }

  @media (max-width: 640px) {
    .concept-model {
      height: min(100%, 17.5rem);
      min-height: min(100%, 16rem);
    }

    .concept-panel {
      gap: 0.45rem;
      padding: 0.7rem 0.45rem;
    }

    h3 {
      font-size: 1.25rem;
    }

    .phase-dial {
      height: min(100%, 9.5rem);
    }

    .phase-value {
      font-size: 1.35rem;
    }
  }

  @media (max-height: 540px) and (min-width: 641px) {
    .concept-model {
      height: 9.5rem;
      min-height: 9.5rem;
    }

    .concept-panel {
      gap: 0.18rem;
      padding: 0.35rem 0.6rem;
    }

    h3 {
      font-size: 1.05rem;
    }

    .phase-dial {
      height: min(100%, 4.2rem);
    }

    .direction-diagram {
      width: min(100%, 11rem);
    }
  }

  @media (min-width: 1680px) {
    .concept-model {
      width: min(100%, 82rem);
    }
  }

  @media (min-width: 2600px) {
    .concept-model {
      width: min(100%, 96rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .phase-orbit,
    .runner {
      animation: none;
    }

    .phase-instrument[data-timing="split"] .red-orbit {
      transform: rotate(180deg);
    }

    .phase-instrument[data-timing="quarter"] .red-orbit {
      transform: rotate(90deg);
    }

    .direction-instrument[data-direction="same"] .runner {
      transform: translateX(72px);
    }

    .direction-instrument[data-direction="opposite"] .blue-runner {
      transform: translateX(72px);
    }

    .direction-instrument[data-direction="opposite"] .red-runner {
      transform: translateX(130px);
    }
  }
</style>
