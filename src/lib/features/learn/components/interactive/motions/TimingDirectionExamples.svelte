<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
  import {
    createRenderActivityGate,
    renderGateTarget,
  } from "$lib/shared/render-gating/render-activity-gate";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import {
    downbeatPulse,
    placementFromPositions,
    type TimingMode,
  } from "./timing-intro-phase";
  import type { TimingLessonTopic } from "./timing-lesson-stage";

  let { topic, active = true }: { topic: TimingLessonTopic; active?: boolean } =
    $props();
  let positions = $state([180, 0, 90]);
  let rotations = $state([
    [1, 1],
    [1, -1],
  ]);
  let timing = $state<TimingMode>("together");
  let elapsed = $state(-0.15);
  let quiet = $state(true);
  const loop = new AnimationLoop();
  const gate = createRenderActivityGate({
    name: "timing-examples",
    rootMargin: "0px",
  });
  const points = [
    { angle: 0, x: 22.5, y: 50, name: "left" },
    { angle: 90, x: 50, y: 62 / 3, name: "top" },
    { angle: 180, x: 77.5, y: 50, name: "right" },
    { angle: 270, x: 50, y: 238 / 3, name: "bottom" },
  ];
  const placementLabels = {
    alpha: "Alpha",
    beta: "Beta",
    gamma: "Gamma",
    between: "Between",
  };
  const placementCopy = {
    alpha: "Opposite points.",
    beta: "The same point.",
    gamma: "A right angle apart.",
    between: "Between positions.",
  };
  const timingOptions = [
    { value: "together" as const, label: "Together" },
    { value: "split" as const, label: "Split" },
    { value: "quarter" as const, label: "Quarter" },
  ];
  const timingCopy = {
    together: "At the same time.",
    split: "Taking turns, evenly spaced.",
    quarter: "A short gap, then a long gap.",
  };

  onMount(() => {
    loop.setActivityGate(gate);
    const updatePreference = () => {
      quiet = reducedMotion();
    };
    updatePreference();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", updatePreference);
    const observer = new MutationObserver(updatePreference);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-preference"],
    });
    return () => {
      media.removeEventListener("change", updatePreference);
      observer.disconnect();
    };
  });
  onDestroy(() => {
    loop.dispose();
    gate.dispose();
  });
  $effect(() => {
    if (active && topic === "timing" && !quiet)
      loop.start((delta) => {
        elapsed += delta / 2400;
      }, 1);
    else loop.stop();
    return () => loop.stop();
  });
  function selectTiming(value: TimingMode): void {
    timing = value;
    elapsed = -0.15;
  }
</script>

<div class="examples-board" use:renderGateTarget={gate}>
  <Crossfade key={topic} fill>
    <div class="examples-scroll">
      {#if topic === "placement"}
        <div class="examples" role="group" aria-label="Placement examples">
          {#each positions as angle, index}
            {@const placement = placementFromPositions(0, angle / 360)}
            <section
              class="example"
              aria-label={`Placement example ${index + 1}`}
            >
              <div
                class="picture"
                role="group"
                aria-label="Tap a point to change placement"
              >
                <svg viewBox="0 0 320 300" aria-hidden="true">
                  <circle class="ring" cx="160" cy="150" r="88" />
                  <circle class="point" cx="160" cy="150" r="3" />
                  {#each points as point}<circle
                      class="point"
                      cx={point.x * 3.2}
                      cy={point.y * 3}
                      r="3"
                    />{/each}
                  <g transform="translate(160 150)">
                    <circle class="blue-dot" cx="-88" cy="0" r="19" />
                    <g class="turn" style:transform={`rotate(${angle}deg)`}
                      ><circle class="red-dot" cx="-88" cy="0" r="13" /></g
                    >
                  </g>
                </svg>
                {#each points as point}
                  <button
                    class="point-button"
                    style:left={`${point.x}%`}
                    style:top={`${point.y}%`}
                    onclick={() => (positions[index] = point.angle)}
                    aria-pressed={angle === point.angle}
                    aria-label={`Example ${index + 1}: place the second dot at the ${point.name}`}
                  ></button>
                {/each}
              </div>
              <div class="example-copy" aria-live="polite">
                <Crossfade key={placement}
                  ><h2>{placementLabels[placement]}</h2>
                  <p>{placementCopy[placement]}</p></Crossfade
                >
              </div>
            </section>
          {/each}
        </div>
      {:else if topic === "timing"}
        <div class="timing-options">
          <SegmentedControl
            options={timingOptions}
            value={timing}
            onchange={selectTiming}
            semantics="radiogroup"
            ariaLabel="Timing examples"
            color="accent"
          >
            {#snippet optionContent(value)}
              {@const selected = timing === value}
              {@const offset =
                value === "split" ? 0.5 : value === "quarter" ? 0.25 : 0}
              <span class="timing-example">
                <span class="picture">
                  <svg viewBox="0 0 320 300" aria-hidden="true">
                    {#each [0, offset] as phase, index}
                      {@const strength =
                        selected && !quiet ? downbeatPulse(elapsed, phase) : 0}
                      <g class:blue={index === 0} class:red={index === 1}>
                        <circle
                          class="halo"
                          cx={index === 0 ? 92 : 228}
                          cy="150"
                          r={29 + 15 * (1 - strength)}
                          opacity={strength * 0.75}
                        />
                        <circle
                          fill="currentColor"
                          cx={index === 0 ? 92 : 228}
                          cy="150"
                          r={20 + 4 * strength}
                          opacity={selected ? 0.55 + 0.45 * strength : 0.35}
                        />
                      </g>
                    {/each}
                  </svg>
                </span>
                <span class="example-copy"
                  ><strong
                    >{timingOptions.find((option) => option.value === value)
                      ?.label}</strong
                  ><span class="explanation">{timingCopy[value]}</span></span
                >
              </span>
            {/snippet}
          </SegmentedControl>
        </div>
      {:else}
        <div
          class="examples direction-examples"
          role="group"
          aria-label="Direction examples"
        >
          {#each rotations as pair, example}
            {@const same = pair[0] === pair[1]}
            <section
              class="example"
              aria-label={`Direction example ${example + 1}`}
            >
              <div
                class="picture"
                role="group"
                aria-label="Tap either arrow to flip it"
              >
                <svg viewBox="0 0 320 300" aria-hidden="true">
                  {#each pair as rotation, index}
                    <g
                      class:blue={index === 0}
                      class:red={index === 1}
                      transform={`translate(${index === 0 ? 83 : 237} 150)`}
                    >
                      <g class="turn" style:transform={`scaleX(${rotation})`}>
                        <path class="arc" d="M-35.35 35.35A50 50 0 1 1 50 0" />
                        <path
                          fill="currentColor"
                          d="M35-8 Q31-8 34-4 L47 17 Q50 22 53 17 L66-4 Q69-8 65-8Z"
                        />
                      </g>
                    </g>
                  {/each}
                </svg>
                {#each pair as rotation, index}
                  <button
                    class="arrow-button"
                    style:left={`${(index === 0 ? 83 : 237) / 3.2}%`}
                    onclick={() => (pair[index] = -rotation)}
                    aria-label={`Example ${example + 1}: flip ${index === 0 ? "left" : "right"} arrow. Currently ${rotation === 1 ? "clockwise" : "counterclockwise"}.`}
                  ></button>
                {/each}
              </div>
              <div class="example-copy" aria-live="polite">
                <Crossfade key={same}
                  ><h2>{same ? "Same" : "Opposite"}</h2>
                  <p>
                    {same
                      ? "Circling the same way."
                      : "Circling opposite ways."}
                  </p></Crossfade
                >
              </div>
            </section>
          {/each}
        </div>
      {/if}
    </div>
  </Crossfade>
</div>

<style>
  .examples-board {
    width: 100%;
    height: 100%;
    container: examples / size;
    border: 1px solid var(--theme-stroke);
    border-radius: 1rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    overflow: hidden;
  }
  .examples-scroll {
    height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .examples {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    height: 100%;
    min-height: 22rem;
  }
  .direction-examples {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .example,
  .timing-example {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: clamp(1rem, 2cqw, 3rem);
  }
  .example + .example {
    border-inline-start: 1px solid var(--theme-stroke);
  }
  .picture {
    display: block;
    position: relative;
    width: min(100%, 80rem, calc((100cqh - 10rem) * 320 / 300));
    min-width: 0;
    aspect-ratio: 320 / 300;
    flex-shrink: 0;
  }
  .picture svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
  .example-copy {
    display: block;
    width: 100%;
    text-align: center;
    min-height: 6rem;
  }
  h2,
  .example-copy strong {
    display: block;
    font-size: clamp(1.5rem, 2cqw, 3rem);
    line-height: 1.2;
    margin: 0;
    font-weight: 750;
  }
  p,
  .explanation {
    display: block;
    margin: 0.6rem 0 0;
    font-size: clamp(1rem, 1.1cqw, 1.5rem);
    font-weight: 400;
    line-height: 1.5;
    text-wrap: balance;
    color: var(--theme-text-dim);
  }
  .ring {
    fill: none;
    stroke: var(--theme-text-dim);
    stroke-width: 1.5;
    opacity: 0.45;
  }
  .point {
    fill: var(--theme-text-dim);
    opacity: 0.65;
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
  .arc {
    fill: none;
    stroke: currentColor;
    stroke-width: 8;
    stroke-linecap: round;
  }
  .halo {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }
  .turn {
    transform-origin: 0 0;
    transition: transform var(--transition-emphasis);
  }
  .point-button,
  .arrow-button {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 1px solid transparent;
    border-radius: 50%;
    padding: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
  }
  .point-button {
    width: 44px;
    height: 44px;
  }
  .arrow-button {
    top: 50%;
    width: 46.875%;
    height: 50%;
    min-width: 44px;
    min-height: 44px;
  }
  .point-button:hover,
  .arrow-button:hover {
    border-color: var(--theme-stroke-strong, var(--theme-text-dim));
  }
  .point-button:focus-visible,
  .arrow-button:focus-visible {
    outline: 2px solid var(--theme-text);
    outline-offset: 3px;
  }
  .timing-options {
    height: 100%;
    min-height: 22rem;
  }
  .timing-options :global(.segmented-control) {
    height: 100%;
    padding: 0;
    gap: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .timing-options :global(.indicator) {
    display: none;
  }
  .timing-options :global(.segment) {
    padding: 0;
    border: 2px solid transparent;
    border-radius: 0.9rem;
    white-space: normal;
  }
  .timing-options :global(.segment.selected) {
    border-color: var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  }
  .timing-options :global(.segment-label) {
    width: 100%;
    height: 100%;
  }
  .timing-example {
    height: 100%;
  }
  @container examples (min-width: 851px) and (max-height: 359px) {
    .examples,
    .timing-options {
      min-height: 12rem;
    }
    .example,
    .timing-example {
      padding: 0.5rem;
    }
    .picture {
      width: min(100%, max(7rem, calc((100cqh - 5rem) * 320 / 300)));
    }
    .example-copy {
      min-height: 0;
    }
    h2,
    .example-copy strong {
      font-size: 1.25rem;
    }
    p,
    .explanation {
      margin-top: 0.25rem;
    }
  }
  @container examples (max-width: 850px) or (max-aspect-ratio: 3/2) {
    .examples {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(3, minmax(12rem, 1fr));
      min-height: 36rem;
    }
    .direction-examples {
      grid-template-rows: repeat(2, minmax(12rem, 1fr));
      min-height: 24rem;
    }
    .example,
    .timing-example {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      padding: 0.75rem;
      gap: 0.5rem;
    }
    .example + .example {
      border-inline-start: 0;
      border-top: 1px solid var(--theme-stroke);
    }
    .picture {
      width: min(
        100%,
        max(9rem, calc((100cqh / 3 - 1.5rem) * 320 / 300)),
        28rem
      );
      justify-self: center;
    }
    .example-copy {
      min-height: 0;
    }
    .timing-options {
      min-height: 36rem;
    }
    .timing-options :global(.segmented-control) {
      flex-direction: column;
    }
    .timing-options :global(.segment) {
      flex: 1;
      min-height: 12rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .turn {
      transition: none;
    }
  }
  :global([data-motion-preference="reduce"]) .turn {
    transition: none;
  }
</style>
