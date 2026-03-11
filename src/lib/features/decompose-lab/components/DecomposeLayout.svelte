<!--
  DecomposeLayout.svelte

  Seamless three-canvas layout forming one tall rectangle:
  - Hero canvas (full width) on top
  - Two small canvases (each half width) directly below, flush
  - Single progress bar at the very bottom

  No gaps, no borders — one cohesive visual unit.
  Tapping a small canvas swaps it with the hero.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { HandView } from "../state/decompose-state.svelte";
  import { getDecomposeContext } from "../context/decompose-context";
  import SegmentedSequenceProgressBar from "$lib/shared/animation-engine/components/layers/SegmentedSequenceProgressBar.svelte";

  interface Props {
    heroCanvas: Snippet;
    smallLeftCanvas: Snippet;
    smallRightCanvas: Snippet;
    steps: readonly StepData[];
    currentStep: number;
    onSeek?: ((targetStep: number) => void) | null;
  }

  let {
    heroCanvas,
    smallLeftCanvas,
    smallRightCanvas,
    steps = [],
    currentStep = 0,
    onSeek = null,
  }: Props = $props();

  const { slotState } = getDecomposeContext();

  function handleSmallClick(slot: "left" | "right") {
    slotState.swapWithHero(slot);
  }

  function viewLabel(view: HandView): string {
    if (view === "both") return "Both";
    if (view === "blue") return "Blue";
    return "Red";
  }
</script>

<div class="decompose-layout">
  <div class="hero-slot">
    {@render heroCanvas()}
  </div>

  <div class="small-slots">
    <button
      class="small-slot"
      onclick={() => handleSmallClick("left")}
      aria-label="Swap {viewLabel(slotState.smallLeftView)} to hero"
    >
      {@render smallLeftCanvas()}
    </button>

    <button
      class="small-slot"
      onclick={() => handleSmallClick("right")}
      aria-label="Swap {viewLabel(slotState.smallRightView)} to hero"
    >
      {@render smallRightCanvas()}
    </button>
  </div>

  {#if steps.length > 0}
    <div class="progress-slot">
      <SegmentedSequenceProgressBar
        {steps}
        {currentStep}
        visible={true}
        variant="gradient"
        {onSeek}
      />
    </div>
  {/if}
</div>

<style>
  .decompose-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .hero-slot {
    position: relative;
    flex: 2;
    min-height: 0;
    overflow: hidden;
  }

  .small-slots {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .small-slot {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: opacity 300ms ease;
  }

  .small-slot:hover {
    opacity: 0.85;
  }

  .small-slot:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: -2px;
  }

  .progress-slot {
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .small-slot {
      transition: none;
    }
  }
</style>
