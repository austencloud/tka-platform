<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
  import {
    createRenderActivityGate,
    renderGateTarget,
  } from "$lib/shared/render-gating/render-activity-gate";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import {
    cycle,
    cycleSeparation,
    downbeatEvents,
    nextDownbeat,
    placementFromPositions,
    spatialPhase,
    timePhase,
    timingFromPhases,
    type Rotation,
    type TimingMode,
    type Placement,
  } from "./timing-intro-phase";

  let { active = true } = $props<{ active?: boolean }>();
  // East/west is alpha placement, but these opposite rotations arrive together.
  let offsets = $state([0.25, 0.25]);
  let rotations = $state<Rotation[]>([1, -1]);
  let elapsed = $state(0);
  let playing = $state(false);
  let selected = $state("left");
  const loop = new AnimationLoop();
  const gate = createRenderActivityGate({
    name: "placement-timing-direction",
    rootMargin: "0px",
  });
  const phases = $derived(offsets.map((offset) => cycle(elapsed + offset)));
  const positions = $derived(
    phases.map((phase, i) => spatialPhase(phase, rotations[i]!))
  );
  const placement = $derived(
    placementFromPositions(positions[0]!, positions[1]!)
  );
  const timing = $derived(timingFromPhases(offsets[0]!, offsets[1]!));
  const direction = $derived(
    rotations[0] === rotations[1] ? "same" : "opposite"
  );
  const timeline = $derived(cycle(elapsed / 2) * 2);
  const selectedIndex = $derived(selected === "left" ? 0 : 1);
  const timingOptions: { value: TimingMode; label: string }[] = [
    { value: "together", label: "Together" },
    { value: "split", label: "Split" },
    { value: "quarter", label: "Quarter" },
  ];
  const directionOptions = [
    { value: "same", label: "Same" },
    { value: "opposite", label: "Opposite" },
  ];
  const placementOptions = [
    { value: "alpha", label: "α Alpha" },
    { value: "beta", label: "β Beta" },
    { value: "gamma", label: "γ Gamma" },
  ];
  const pointOptions = [
    { value: "left", label: "Left dot" },
    { value: "right", label: "Right dot" },
  ];
  const gridPoints = [
    { phase: 0, x: 50, y: 83, name: "South" },
    { phase: 0.25, x: 17, y: 50, name: "West" },
    { phase: 0.5, x: 50, y: 17, name: "North" },
    { phase: 0.75, x: 83, y: 50, name: "East" },
  ];
  const placementNames: Record<Placement, string> = {
    alpha: "Alpha · opposite points",
    beta: "Beta · same point",
    gamma: "Gamma · a right angle",
    between: "Between named placements",
  };
  const timingCopy = $derived(
    timing === "together"
      ? "The downbeats arrive together."
      : timing === "split"
        ? "The downbeats alternate, half a cycle apart."
        : timing === "quarter"
          ? "The downbeats arrive a quarter cycle apart."
          : `The downbeats are ${Math.round(cycleSeparation(offsets[0]!, offsets[1]!) * 100)}% of a cycle apart.`
  );
  const counterexample = $derived(
    placement === "alpha" && timing === "together"
  );

  onMount(() => {
    loop.setActivityGate(gate);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopForPreference = () => {
      if (reducedMotion()) playing = false;
    };
    media.addEventListener("change", stopForPreference);
    const preferenceObserver = new MutationObserver(stopForPreference);
    preferenceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-preference"],
    });
    return () => {
      media.removeEventListener("change", stopForPreference);
      preferenceObserver.disconnect();
    };
  });
  onDestroy(() => {
    loop.dispose();
    gate.dispose();
  });
  $effect(() => {
    if (playing && active)
      loop.start((delta) => {
        elapsed += delta / 3200;
      }, 1);
    else loop.stop();
    return () => loop.stop();
  });

  function hold(): void {
    playing = false;
    offsets = [...phases];
    elapsed = 0;
  }
  function placePoint(position: number): void {
    hold();
    offsets[selectedIndex] = timePhase(position, rotations[selectedIndex]!);
  }
  function setPlacement(value: string): void {
    hold();
    const anchor = spatialPhase(offsets[0]!, rotations[0]!);
    offsets[1] = timePhase(
      anchor + (value === "alpha" ? 0.5 : value === "gamma" ? 0.25 : 0),
      rotations[1]!
    );
  }
  function setTiming(value: TimingMode): void {
    hold();
    offsets[1] = cycle(
      offsets[0]! + (value === "split" ? 0.5 : value === "quarter" ? 0.25 : 0)
    );
  }
  function flip(index: number): void {
    hold();
    // Keep placement fixed. Reversing travel can change the next downbeat.
    const position = spatialPhase(offsets[index]!, rotations[index]!);
    rotations[index] = rotations[index] === 1 ? -1 : 1;
    offsets[index] = timePhase(position, rotations[index]!);
  }
  function setDirection(value: string): void {
    if (value !== direction) flip(1);
  }
  function advance(): void {
    playing = false;
    elapsed = nextDownbeat(elapsed, offsets);
  }
  function atDownbeat(index: number): boolean {
    return playing
      ? phases[index]! < 0.065
      : cycleSeparation(phases[index]!, 0) < 0.000001;
  }
</script>

{#snippet downbeats()}
  <div
    class="beat-chart"
    role="img"
    aria-label={`Downbeat schedule over two cycles. ${timingCopy}`}
  >
    {#each offsets as offset, index}
      <div class="beat-row" class:blue={index === 0} class:red={index === 1}>
        <span class:beat-active={atDownbeat(index)}
          >{index === 0 ? "Left" : "Right"}</span
        >
        <div class="beat-track">
          {#each downbeatEvents(offset) as event}<span
              class="beat-event"
              style:left={`${event * 50}%`}
            ></span>{/each}
          <span class="playhead" style:left={`${timeline * 50}%`}></span>
        </div>
      </div>
    {/each}
    <div class="chart-scale">
      <span>Downbeat events →</span><span>Two cycles</span>
    </div>
  </div>
{/snippet}

<div
  class="relationship-lab"
  use:renderGateTarget={gate}
  role="group"
  aria-label="Placement, timing, and direction explorer"
>
  <section class="motion-stage" aria-label="Moving example">
    <div class="stage-topline">
      <span class="playback-status">{playing ? "In motion" : "Paused"}</span
      ><span>One cycle every 3.2 seconds</span>
    </div>
    <div class="orbit" class:playing>
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <circle class="orbit-line" cx="150" cy="150" r="99" />
        <circle class="center-point" cx="150" cy="150" r="2" />
        {#each positions as position, index}
          <g class:blue={index === 0} class:red={index === 1}>
            <line
              class="radius-line"
              x1="150"
              y1="150"
              x2={150 - 99 * Math.sin(position * Math.PI * 2)}
              y2={150 + 99 * Math.cos(position * Math.PI * 2)}
            />
            <circle
              class="beat-halo"
              class:beat-lit={atDownbeat(index)}
              cx="150"
              cy="249"
              r={index === 0 ? 18 : 24}
            />
          </g>
        {/each}
      </svg>
      {#each gridPoints as point}
        <button
          class="grid-point"
          style:left={`${point.x}%`}
          style:top={`${point.y}%`}
          onclick={() => placePoint(point.phase)}
          aria-label={`Place ${selected} dot at ${point.name}`}
          ><span></span></button
        >
      {/each}
      {#each positions as position, index}
        <div
          class="dot-orbit"
          style:transform={`rotate(${position * 360}deg)`}
          aria-hidden="true"
        >
          <span
            class="moving-dot"
            class:blue={index === 0}
            class:red={index === 1}
            class:selected={selectedIndex === index}><span></span></span
          >
        </div>
      {/each}
      <span class="downbeat-label">Downbeat</span>
    </div>
    {@render downbeats()}
    <div class="transport">
      <PanelButton
        variant="primary"
        onclick={() => (playing = !playing)}
        ariaLabel={playing ? "Pause motion" : "Play motion"}
        >{playing ? "Pause" : "Play"}</PanelButton
      >
      <PanelButton onclick={advance}>Next downbeat</PanelButton>
    </div>
    <p class="stage-note">
      {counterexample && !playing
        ? "Opposite positions. Together timing. Press Play to see why."
        : "Pause to inspect placement. Select a dot, then click a grid point to move it."}
    </p>
  </section>

  <div class="relationship-controls">
    <section
      aria-labelledby="placement-heading"
      class="property placement-property"
    >
      <div class="property-heading">
        <h3 id="placement-heading">Placement</h3>
        <span>Where, right now</span>
      </div>
      <p class="placement-reading" aria-live={playing ? "off" : "polite"}>
        {placementNames[placement]}
      </p>
      <SegmentedControl
        options={placementOptions}
        value={placement}
        onchange={setPlacement}
        semantics="radiogroup"
        ariaLabel="Placement relationship"
        color="accent"
        density="tight"
      />
      <div class="dot-choice">
        <span>Move</span><SegmentedControl
          options={pointOptions}
          value={selected}
          onchange={(value) => {
            playing = false;
            selected = value;
          }}
          semantics="radiogroup"
          ariaLabel="Dot to place"
          color="accent"
          density="tight"
        />
      </div>
    </section>
    <section aria-labelledby="timing-heading" class="property timing-property">
      <div class="property-heading">
        <h3 id="timing-heading">Timing</h3>
        <span>When the downbeats arrive</span>
      </div>
      <p class="timing-reading" aria-live="polite">{timingCopy}</p>
      <SegmentedControl
        options={timingOptions}
        value={timing}
        onchange={setTiming}
        semantics="radiogroup"
        ariaLabel="Timing relationship"
        color="accent"
        density="tight"
      />
    </section>
    <section
      aria-labelledby="direction-heading"
      class="property direction-property"
    >
      <div class="property-heading">
        <h3 id="direction-heading">Direction</h3>
        <span>Which way they rotate</span>
      </div>
      <div class="rotation-controls">
        <div class="arrows">
          {#each rotations as rotation, index}
            <button
              class="arrow-control"
              class:blue={index === 0}
              class:red={index === 1}
              onclick={() => flip(index)}
              aria-label={`Flip ${index === 0 ? "left" : "right"} rotation. Currently ${rotation === 1 ? "clockwise" : "counterclockwise"}.`}
            >
              <svg viewBox="0 0 160 160" aria-hidden="true"
                ><g transform="translate(80 80)"
                  ><g class="arrow-flip" style:transform={`scaleX(${rotation})`}
                    ><path
                      class="rotation-arc"
                      d="M-38.184 38.184A54 54 0 1 1 54 0"
                    /><path
                      class="arrowhead"
                      d="M40-7 Q37-7 39-4 L52 17 Q54 20 56 17 L69-4 Q71-7 68-7 Z"
                    /></g
                  ></g
                ></svg
              >
              <span>{index === 0 ? "Left" : "Right"}</span>
            </button>
          {/each}
        </div>
        <SegmentedControl
          options={directionOptions}
          value={direction}
          onchange={setDirection}
          semantics="radiogroup"
          ariaLabel="Direction relationship"
          color="accent"
          density="tight"
        />
      </div>
      <p class="direction-note">
        Flipping a rotation keeps the placement. Its next downbeat may arrive at
        a different time.
      </p>
    </section>
  </div>
</div>

<style>
  .relationship-lab {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(24rem, 1fr);
    width: 100%;
    min-width: 0;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-xl, 1rem);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: clamp(1rem, 0.85cqw, 1.3rem);
    overflow: hidden;
  }
  .motion-stage {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(1rem, 2.4cqw, 2.5rem);
  }
  .stage-topline {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .playback-status {
    color: var(--theme-text);
    min-width: 5rem;
  }
  .orbit {
    position: relative;
    width: min(
      100%,
      clamp(34rem, 30cqw, 50rem),
      max(16rem, calc(100svh - 35rem))
    );
    aspect-ratio: 1;
    margin: auto;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .orbit-line {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-width: 1;
    opacity: 0.4;
  }
  .center-point {
    fill: var(--theme-text-dim);
  }
  .radius-line {
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.25;
  }
  .beat-halo {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    opacity: 0;
  }
  .beat-lit {
    opacity: 0.8;
  }
  .blue {
    color: var(--prop-blue, #3d44b8);
  }
  .red {
    color: var(--prop-red, #ed1c24);
  }
  .grid-point,
  .moving-dot {
    position: absolute;
    width: 44px;
    height: 44px;
    padding: 0;
    transform: translate(-50%, -50%);
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    border-radius: 50%;
    cursor: pointer;
  }
  .grid-point span {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--theme-text-dim);
  }
  .grid-point:hover {
    outline: 1px solid var(--theme-text-dim);
  }
  .dot-orbit {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .orbit:not(.playing) .dot-orbit {
    transition: transform var(--transition-emphasis);
  }
  .moving-dot {
    left: 50%;
    top: 83%;
    z-index: 1;
  }
  .moving-dot span {
    width: clamp(18px, 2.3cqw, 32px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: currentColor;
  }
  .moving-dot.red span {
    width: clamp(12px, 1.5cqw, 22px);
  }
  .moving-dot.selected span {
    outline: 2px solid var(--theme-text);
    outline-offset: 4px;
  }
  .grid-point:focus-visible,
  .moving-dot:focus-visible,
  .arrow-control:focus-visible {
    outline: 2px solid var(--theme-text);
    outline-offset: 3px;
  }
  .downbeat-label {
    position: absolute;
    top: 92%;
    left: 50%;
    transform: translateX(-50%);
    color: var(--theme-text-dim);
    font-size: 1rem;
  }
  .transport {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .transport :global(.panel-btn) {
    min-width: 6rem;
  }
  .stage-note {
    min-height: 3em;
    max-width: 45ch;
    margin: 1rem auto 0;
    text-align: center;
    text-wrap: balance;
    color: var(--theme-text-dim);
    line-height: 1.5;
  }
  .relationship-controls {
    border-inline-start: 1px solid var(--theme-stroke);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    padding: clamp(1rem, 2.2cqw, 2rem);
  }
  .property {
    min-width: 0;
    padding-block: 1.2rem;
  }
  .property:first-child {
    padding-top: 0;
  }
  .property:last-child {
    padding-bottom: 0;
  }
  .property + .property {
    border-top: 1px solid var(--theme-stroke);
  }
  .property-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }
  h3 {
    font-size: clamp(1.25rem, 1.6cqw, 1.8rem);
    margin: 0;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .property-heading > span {
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .placement-reading,
  .timing-reading {
    margin: 0.65rem 0 1rem;
    line-height: 1.5;
    min-height: 1.5em;
  }
  .timing-reading {
    min-height: 3em;
  }
  .dot-choice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .dot-choice :global(.segmented-control) {
    width: 15rem;
    max-width: 100%;
  }
  .rotation-controls :global(.segmented-control) {
    width: 13rem;
    max-width: 100%;
  }
  .beat-chart {
    width: min(100%, 34rem);
    margin: 1rem auto 0;
    padding-inline: 0 0.5rem;
  }
  .beat-row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    height: 2rem;
  }
  .beat-row > span {
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .beat-row > span.beat-active {
    color: var(--theme-text);
    font-weight: 700;
  }
  .beat-track {
    position: relative;
    height: 2px;
    background: var(--theme-stroke-strong, var(--theme-stroke));
  }
  .beat-event {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: currentColor;
  }
  .playhead {
    position: absolute;
    top: -13px;
    height: 28px;
    width: 2px;
    background: var(--theme-text);
    opacity: 0.85;
  }
  .chart-scale {
    display: flex;
    justify-content: space-between;
    margin-left: 3.75rem;
    padding-top: 0.5rem;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .rotation-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  .arrows {
    display: flex;
    gap: 0.5rem;
  }
  .arrow-control {
    width: 4.25rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    padding: 0.2rem 0.2rem 0.5rem;
    cursor: pointer;
    background: transparent;
  }
  .arrow-control:hover {
    background: var(--theme-hover-bg);
  }
  .arrow-control svg {
    height: auto;
    aspect-ratio: 1;
  }
  .arrow-control span {
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }
  .arrow-flip {
    transform-origin: 0 0;
    transition: transform var(--transition-emphasis);
  }
  .rotation-arc {
    fill: none;
    stroke: currentColor;
    stroke-width: 7.5;
    stroke-linecap: round;
  }
  .arrowhead {
    fill: currentColor;
  }
  .direction-note {
    color: var(--theme-text-dim);
    line-height: 1.5;
    font-size: 0.875rem;
    margin: 0.75rem 0 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .arrow-flip,
    .orbit:not(.playing) .dot-orbit {
      transition: none;
    }
  }
  :global([data-motion-preference="reduce"]) .arrow-flip,
  :global([data-motion-preference="reduce"]) .orbit:not(.playing) .dot-orbit {
    transition: none;
  }
  @container (max-width:720px) {
    .relationship-lab {
      grid-template-columns: minmax(0, 1fr);
    }
    .motion-stage {
      padding: 1rem;
    }
    .orbit {
      width: min(100%, 26rem);
    }
    .relationship-controls {
      border-inline-start: 0;
      border-top: 1px solid var(--theme-stroke);
      padding: 1rem;
    }
  }
</style>
