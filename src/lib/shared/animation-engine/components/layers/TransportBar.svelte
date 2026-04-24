<!--
TransportBar.svelte

Thin wrapper around SegmentedSequenceProgressBar. The play/pause button
has been moved to the canvas overlay (AnimatorCanvas) so the scrubber
track runs full width with zero obstruction.
-->
<script lang="ts">
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import SegmentedSequenceProgressBar from "./SegmentedSequenceProgressBar.svelte";

  let {
    steps = [],
    currentStep = 0,
    visible = true,
    darkMode = false,
    onSeek = null,
    onScrubStart = null,
    onScrubEnd = null,
    variant = "gradient",
    showLabels = false,
    isPlaying = false,
    onPlaybackToggle = null,
  }: {
    steps?: readonly StepData[];
    currentStep?: number;
    visible?: boolean;
    darkMode?: boolean;
    onSeek?: ((targetStep: number) => void) | null;
    onScrubStart?: (() => void) | null;
    onScrubEnd?: (() => void) | null;
    variant?:
      | "minimal"
      | "raised"
      | "rounded"
      | "neon"
      | "gradient"
      | "labeled"
      | "gradient-labeled";
    showLabels?: boolean;
    isPlaying?: boolean;
    onPlaybackToggle?: (() => void) | null;
  } = $props();
</script>

{#if visible && steps.length > 0}
  <div class="transport-bar-wrapper" class:dark-mode={darkMode}>
    <SegmentedSequenceProgressBar
      {steps}
      {currentStep}
      visible={true}
      {darkMode}
      {onSeek}
      {onScrubStart}
      {onScrubEnd}
      {variant}
      {showLabels}
    />
  </div>
{/if}

<style>
  .transport-bar-wrapper {
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }
</style>
