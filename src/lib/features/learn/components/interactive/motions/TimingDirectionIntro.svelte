<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
  import {
    createRenderActivityGate,
    renderGateTarget,
  } from "$lib/shared/render-gating/render-activity-gate";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import { downbeatPulse, type TimingMode } from "./timing-intro-phase";

  let { active = true } = $props<{ active?: boolean }>();
  // These are separate examples, not controls for one combined motion.
  let placement = $state("alpha");
  let timing = $state<TimingMode>("together");
  let direction = $state("same");
  let elapsed = $state(-0.15);
  let playing = $state(false);
  const loop = new AnimationLoop();
  const gate = createRenderActivityGate({
    name: "intro-downbeats",
    rootMargin: "0px",
  });
  const offset = $derived(
    timing === "split" ? 0.5 : timing === "quarter" ? 0.25 : 0
  );
  const pulses = $derived([
    downbeatPulse(elapsed, 0),
    downbeatPulse(elapsed, offset),
  ]);
  const placementAngle = $derived(
    placement === "alpha" ? 180 : placement === "gamma" ? 90 : 0
  );
  const placementCopy = $derived(
    placement === "alpha"
      ? "Opposite points."
      : placement === "beta"
        ? "The same point."
        : "A right angle apart."
  );
  const timingCopy = $derived(
    timing === "together"
      ? "At the same time."
      : timing === "split"
        ? "Taking turns, evenly spaced."
        : "A short gap, then a long gap."
  );
  const timingDescription = $derived(
    timing === "together"
      ? "Both downbeats happen together."
      : timing === "split"
        ? "Downbeats alternate, half a cycle apart."
        : "Downbeats happen a quarter cycle apart."
  );
  const placementOptions = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
    { value: "gamma", label: "Gamma" },
  ];
  const timingOptions = [
    { value: "together" as const, label: "Together" },
    { value: "split" as const, label: "Split" },
    { value: "quarter" as const, label: "Quarter" },
  ];
  const directionOptions = [
    { value: "same", label: "Same" },
    { value: "opposite", label: "Opposite" },
  ];

  onMount(() => {
    loop.setActivityGate(gate);
    playing = !reducedMotion();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopForPreference = () => {
      if (reducedMotion()) playing = false;
    };
    media.addEventListener("change", stopForPreference);
    const observer = new MutationObserver(stopForPreference);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-preference"],
    });
    return () => {
      media.removeEventListener("change", stopForPreference);
      observer.disconnect();
    };
  });
  onDestroy(() => {
    loop.dispose();
    gate.dispose();
  });
  $effect(() => {
    if (playing && active)
      loop.start((delta) => {
        elapsed += delta / 2400;
      }, 1);
    else loop.stop();
    return () => loop.stop();
  });
  function setTiming(value: TimingMode): void {
    timing = value;
    elapsed = -0.15;
  }
</script>

<div
  class="concepts"
  role="group"
  aria-label="Placement, timing, and direction"
>
  <section class="concept" aria-label="Placement">
    <header>
      <h3>Placement</h3>
      <p>Where things are right now.</p>
    </header>
    <div class="picture" role="img" aria-label={placementCopy}>
      <svg viewBox="0 0 320 300" aria-hidden="true">
        <circle class="placement-ring" cx="160" cy="150" r="88" />
        <circle class="center" cx="160" cy="150" r="3" />
        <g transform="translate(160 150)">
          <circle class="blue-dot" cx="-88" cy="0" r="19" />
          <g
            class="placement-turn"
            style:transform={`rotate(${placementAngle}deg)`}
          >
            <circle class="red-dot" cx="-88" cy="0" r="13" />
          </g>
        </g>
      </svg>
    </div>
    <div class="caption" aria-live="polite">
      <Crossfade key={placement}><p>{placementCopy}</p></Crossfade>
    </div>
    <div class="choices">
      <SegmentedControl
        options={placementOptions}
        value={placement}
        onchange={(value) => (placement = value)}
        semantics="radiogroup"
        ariaLabel="Placement example"
        color="accent"
        density="tight"
      />
    </div>
  </section>

  <section class="concept" aria-label="Timing" use:renderGateTarget={gate}>
    <header>
      <h3>Timing</h3>
      <p>A pulse marks each downbeat.</p>
    </header>
    <div class="picture pulse-picture">
      <svg viewBox="0 0 320 300" role="img" aria-label={timingDescription}>
        {#each pulses as strength, index}
          <g class:blue={index === 0} class:red={index === 1}>
            <circle
              class="pulse-halo"
              cx={index === 0 ? 92 : 228}
              cy="150"
              r={29 + 15 * (1 - strength)}
              opacity={strength * 0.75}
            />
            <circle
              class="pulse-dot"
              cx={index === 0 ? 92 : 228}
              cy="150"
              r={20 + 4 * strength}
              opacity={0.55 + 0.45 * strength}
            />
          </g>
        {/each}
      </svg>
      <div class="pulse-transport">
        <PanelButton
          onclick={() => (playing = !playing)}
          ariaLabel={playing ? "Pause downbeats" : "Play downbeats"}
        >
          <svg class="transport-icon" viewBox="0 0 20 20" aria-hidden="true"
            >{#if playing}<path
                d="M6 4v12M14 4v12"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              />{:else}<path
                d="M6 3L17 10L6 17Z"
                fill="currentColor"
              />{/if}</svg
          >
        </PanelButton>
      </div>
    </div>
    <div class="caption" aria-live="polite">
      <Crossfade key={timing}><p>{timingCopy}</p></Crossfade>
    </div>
    <div class="choices">
      <SegmentedControl
        options={timingOptions}
        value={timing}
        onchange={setTiming}
        semantics="radiogroup"
        ariaLabel="Timing example"
        color="accent"
        density="tight"
      />
    </div>
  </section>

  <section class="concept" aria-label="Direction">
    <header>
      <h3>Direction</h3>
      <p>Which way things rotate.</p>
    </header>
    <div
      class="picture"
      role="img"
      aria-label={direction === "same"
        ? "Both rotate clockwise."
        : "One rotates clockwise, the other counterclockwise."}
    >
      <svg viewBox="0 0 320 300" aria-hidden="true">
        {#each [1, direction === "same" ? 1 : -1] as rotation, index}
          <g
            class:blue={index === 0}
            class:red={index === 1}
            transform={`translate(${index === 0 ? 83 : 237} 150)`}
          >
            <g class="arrow-flip" style:transform={`scaleX(${rotation})`}>
              <path class="rotation-arc" d="M-35.35 35.35A50 50 0 1 1 50 0" />
              <path
                class="arrowhead"
                d="M35-8 Q31-8 34-4 L47 17 Q50 22 53 17 L66-4 Q69-8 65-8Z"
              />
            </g>
          </g>
        {/each}
      </svg>
    </div>
    <div class="caption" aria-live="polite">
      <Crossfade key={direction}
        ><p>
          {direction === "same"
            ? "Circling the same way."
            : "Circling opposite ways."}
        </p></Crossfade
      >
    </div>
    <div class="choices">
      <SegmentedControl
        options={directionOptions}
        value={direction}
        onchange={(value) => (direction = value)}
        semantics="radiogroup"
        ariaLabel="Direction example"
        color="accent"
        density="tight"
      />
    </div>
  </section>
</div>

<style>
  .concepts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-xl, 1rem);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    overflow: hidden;
  }
  .concept {
    min-width: 0;
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    justify-items: center;
    padding: clamp(1.25rem, 2cqw, 3rem);
    text-align: center;
  }
  .concept + .concept {
    border-inline-start: 1px solid var(--theme-stroke);
  }
  header {
    width: 100%;
  }
  h3 {
    margin: 0;
    font-size: clamp(1.5rem, 1.7cqw, 2.25rem);
    line-height: 1.2;
    letter-spacing: -0.025em;
  }
  p {
    margin: 0;
    line-height: 1.5;
    text-wrap: balance;
  }
  header p {
    margin-top: 0.65rem;
    color: var(--theme-text-dim);
    font-size: clamp(1rem, 0.9cqw, 1.25rem);
  }
  .picture {
    width: min(100%, 30rem);
    aspect-ratio: 320 / 300;
    align-self: center;
    position: relative;
    margin-block: clamp(0.75rem, 1.5cqw, 2rem);
  }
  .picture > svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .placement-ring {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-width: 1.5;
    opacity: 0.45;
  }
  .center {
    fill: var(--theme-text-dim);
    opacity: 0.5;
  }
  .blue {
    color: var(--prop-blue, #3d44b8);
  }
  .red {
    color: var(--prop-red, #ed1c24);
  }
  .blue-dot {
    fill: var(--prop-blue, #3d44b8);
  }
  .red-dot {
    fill: var(--prop-red, #ed1c24);
  }
  .placement-turn,
  .arrow-flip {
    transform-origin: 0 0;
    transition: transform var(--transition-emphasis);
  }
  .pulse-dot,
  .arrowhead {
    fill: currentColor;
  }
  .pulse-halo {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }
  .rotation-arc {
    fill: none;
    stroke: currentColor;
    stroke-width: 8;
    stroke-linecap: round;
  }
  .pulse-transport {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .pulse-transport :global(.panel-btn) {
    width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 50%;
  }
  .transport-icon {
    width: 16px;
    height: 16px;
  }
  .caption {
    width: 100%;
    min-height: 3em;
    display: grid;
    align-items: center;
    margin-bottom: 1rem;
    font-size: clamp(1rem, 1cqw, 1.35rem);
  }
  .choices {
    width: min(100%, 22rem);
  }
  .concept:last-child .choices {
    width: min(100%, 16rem);
  }
  @container (max-width: 850px) and (min-width: 501px) {
    .concepts {
      grid-template-columns: 1fr;
    }
    .concept {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: auto auto auto;
      column-gap: 1rem;
      padding: 1.5rem;
    }
    .concept + .concept {
      border-inline-start: 0;
      border-top: 1px solid var(--theme-stroke);
    }
    header {
      grid-column: 1;
      align-self: end;
    }
    .picture {
      grid-column: 2;
      grid-row: 1 / 4;
      width: min(100%, 15rem);
      margin-block: 0;
    }
    .caption {
      grid-column: 1;
      margin: 0.5rem 0;
    }
    .choices {
      grid-column: 1;
      align-self: start;
    }
  }
  @container (max-width: 500px) {
    .concepts {
      grid-template-columns: 1fr;
    }
    .concept {
      padding: 1.5rem 1rem;
    }
    .concept + .concept {
      border-inline-start: 0;
      border-top: 1px solid var(--theme-stroke);
    }
    .picture {
      width: 13rem;
      margin-block: 0.25rem;
    }
    .caption {
      min-height: 2em;
      margin-bottom: 0.75rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .placement-turn,
    .arrow-flip {
      transition: none;
    }
  }
  :global([data-motion-preference="reduce"]) .placement-turn,
  :global([data-motion-preference="reduce"]) .arrow-flip {
    transition: none;
  }
</style>
