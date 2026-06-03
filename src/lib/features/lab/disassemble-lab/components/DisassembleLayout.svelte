<!--
  DisassembleLayout.svelte

  Seamless three-canvas layout forming one tall portrait rectangle:
  - Hero canvas (full width, square) on top
  - Two small canvases (each half width, square) directly below, flush
  - Single progress bar at the very bottom

  The whole unit maintains a 2:3 aspect ratio and centers in its container.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
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
</script>

<div class="disassemble-layout">
  <div class="disassemble-unit">
    <div class="hero-slot">
      {@render heroCanvas()}
    </div>

    <div class="small-slots">
      <div class="small-slot">
        {@render smallLeftCanvas()}
      </div>

      <div class="small-slot">
        {@render smallRightCanvas()}
      </div>
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
</div>

<style>
  .disassemble-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    container-type: size;
  }

  /* The canvas portion is 2:3 (hero square + half-height small row).
     Chrome (word header + progress bar) sits outside the 2:3 ratio.
     Subtract chrome estimate so canvases + chrome fit in container. */
  .disassemble-unit {
    --chrome: 50px;
    width: min(100cqw, calc((100cqh - var(--chrome)) * 2 / 3));
    display: flex;
    flex-direction: column;
  }

  .hero-slot {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .small-slots {
    display: flex;
    width: 100%;
  }

  .small-slot {
    position: relative;
    width: 50%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .progress-slot {
    width: 100%;
  }

  /* Make progress bar thicker with minimal padding in disassemble context */
  .progress-slot :global(.segmented-progress-container) {
    padding: 2px 0;
  }

  .progress-slot :global(.segments-track) {
    height: 12px;
  }

  .progress-slot :global(.segment-divider) {
    border-right-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.8)) !important;
  }
</style>
