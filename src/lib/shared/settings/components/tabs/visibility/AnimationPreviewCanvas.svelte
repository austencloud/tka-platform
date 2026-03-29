<!--
  AnimationPreviewCanvas.svelte

  Pure rendering component for animation preview.
  No observer pattern - just renders based on props.
  This separation prevents infinite reactive loops.
-->
<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  interface Props {
    animationState: AnimationPanelState;
    gridVisible: boolean;
  }

  let { animationState, gridVisible }: Props = $props();

  const visibilityManager = getAnimationVisibilityManager();

  // Resolve the effective grid mode for the canvas:
  // - "8point" → always show all 8 points
  // - "auto" → use the sequence's own gridMode (diamond or box)
  // - "none" → grid hidden (handled by gridVisible=false)
  let effectiveGridMode = $derived.by(() => {
    const visGridMode = visibilityManager.getGridMode();
    if (visGridMode === "8point") return GridMode.EIGHT_POINT;
    // "auto" or fallback: use whatever the sequence says
    const seqMode = animationState.sequenceData?.gridMode ?? null;
    return seqMode;
  });

  // Derived: Current step data for AnimatorCanvas
  let currentStepData = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    const currentStep = animationState.currentStep;
    if (
      currentStep === 0 &&
      !animationState.isPlaying &&
      animationState.sequenceData.startPosition
    ) {
      return animationState.sequenceData.startPosition;
    }
    if (
      animationState.sequenceData.steps &&
      animationState.sequenceData.steps.length > 0
    ) {
      const stepIndex = Math.max(0, Math.floor(currentStep) - 1);
      const clampedIndex = Math.min(
        stepIndex,
        animationState.sequenceData.steps.length - 1
      );
      return animationState.sequenceData.steps[clampedIndex] || null;
    }
    return null;
  });

  // Derived: Current letter
  let currentLetter = $derived(currentStepData?.letter || null);
</script>

<AnimatorCanvas
  blueProp={animationState.bluePropState}
  redProp={animationState.redPropState}
  {gridVisible}
  gridMode={effectiveGridMode}
  letter={currentLetter}
  stepData={currentStepData}
  currentStep={animationState.currentStep}
  sequenceData={animationState.sequenceData}
  isPlaying={animationState.isPlaying}
  trailSettings={animationSettings.trail}
/>
