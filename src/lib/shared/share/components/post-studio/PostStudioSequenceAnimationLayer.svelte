<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    clampDisplayedBeatNumber,
    displayedBeatNumber,
  } from "$lib/shared/animation-engine/services/step-calculator";
  import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";

  let {
    sequence,
    sequencePosition,
    playing,
    bluePropType,
    redPropType,
  }: {
    sequence: SequenceData;
    sequencePosition: number;
    playing: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
  } = $props();

  const stateManager = new AnimationStateManager();
  const orchestrator = new SequenceAnimationOrchestrator(stateManager);
  // Create hands Post Studio a reactive sequence proxy. Ordinary `$state`
  // wraps that value again, so an identity check against the prop never
  // matches and the canvas stays at its empty grid. This value is only a
  // readiness marker; keeping the exact reference lets both Create and the
  // Sequence Viewer drive the same animation layer.
  let initializedSequence = $state.raw<SequenceData | null>(null);
  let blueProp = $state<PropState | null>(null);
  let redProp = $state<PropState | null>(null);

  const beatNumber = $derived(
    clampDisplayedBeatNumber(
      displayedBeatNumber(sequencePosition, false),
      sequence.steps.length
    )
  );
  const stepData = $derived.by(() => {
    if (beatNumber < 1) {
      return (
        sequence.startPosition ??
        sequence.startingPosition ??
        (sequence.steps[0]
          ? createStartPositionFromBeatStart(sequence.steps[0])
          : null)
      );
    }
    return (
      sequence.steps[Math.min(beatNumber - 1, sequence.steps.length - 1)] ??
      null
    );
  });

  $effect(() => {
    const target = sequence;
    initializedSequence = orchestrator.initializeWithDomainData(target)
      ? target
      : null;
  });

  $effect(() => {
    const position = sequencePosition;
    if (initializedSequence !== sequence) return;
    orchestrator.calculateState(position);
    blueProp = stateManager.getBluePropState();
    redProp = stateManager.getRedPropState();
  });
</script>

<div class="animation-layer">
  <AnimatorCanvas
    {blueProp}
    {redProp}
    gridVisible
    gridMode={sequence.gridMode ?? null}
    letter={stepData?.letter ?? null}
    {stepData}
    sequenceData={sequence}
    currentStep={sequencePosition}
    isPlaying={playing}
    {bluePropType}
    {redPropType}
    word={null}
    previewDarkMode
    hideProgressBar
    hideHeader
    fillContainer
  />
</div>

<style>
  .animation-layer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #08080c;
  }
</style>
