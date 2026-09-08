<script lang="ts">
  import type {
    PropRenderingProps,
    ViewerPlaybackState,
  } from "../domain/viewer-prop-groups";
  import PracticeLanePane from "./PracticeLanePane.svelte";

  let {
    playback,
    propRendering,
    bpm,
    cellSize,
    running,
    countdown,
    onSeek,
  }: {
    playback: ViewerPlaybackState;
    propRendering: PropRenderingProps;
    bpm: number;
    cellSize: number;
    running: boolean;
    countdown: number;
    onSeek?: (targetStep: number) => void;
  } = $props();

  // The lane stays on the start tile until the canvas actually reaches beat 1.
  // It deliberately does not reset on a loop wrap, where start and end coincide.
  let laneAtStart = $state(true);
  $effect(() => {
    if (countdown > 0) {
      laneAtStart = true;
    } else if (running && playback.currentStep >= 1) {
      laneAtStart = false;
    }
  });
</script>

<div class="practice-deck lane" class:lane-in={running}>
  <PracticeLanePane
    sequence={playback.animationState.sequenceData}
    currentStep={playback.currentStep}
    {bpm}
    {cellSize}
    leftPropType={propRendering.leftPropType}
    rightPropType={propRendering.rightPropType}
    onSeek={onSeek ?? null}
    showStartCell={laneAtStart}
  />
</div>
