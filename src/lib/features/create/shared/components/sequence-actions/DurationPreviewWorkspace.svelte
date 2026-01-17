<!--
  DurationPreviewWorkspace.svelte

  Split workspace for live preview of duration patterns.

  Layout (desktop):
  - Top half: Animation preview (props animating with current timing)
  - Bottom half: Timeline beat grid (showing duration-proportional widths)

  Features:
  - Auto-plays animation in a loop
  - Updates instantly when duration pattern changes
  - Timeline mode shows duration-proportional cell widths
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import StepGrid from "../../workspace-panel/sequence-display/components/StepGrid.svelte";
  import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import { container } from "$lib/shared/di";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Sequence to preview with duration pattern applied */
    sequence: SequenceData;
    /** Current step being animated (0-based, fractional) */
    currentStep?: number;
    /** Whether animation is playing */
    isPlaying?: boolean;
  }

  let {
    sequence,
    currentStep = 0,
    isPlaying = true,
  }: Props = $props();

  // Create local animation state for preview
  const animationState = createAnimationPanelState();

  // Animation loop management
  let animationFrameId: number | null = null;
  let lastTime = 0;
  let localCurrentStep = $state(0);
  let localIsPlaying = $state(true);

  // Prop states for animation
  let blueProp = $state(animationState.bluePropState);
  let redProp = $state(animationState.redPropState);

  // Update animation state when sequence changes
  $effect(() => {
    animationState.setSequenceData(sequence);
    animationState.setTotalSteps(sequence.steps.length);
  });

  // Sync external props
  $effect(() => {
    localCurrentStep = currentStep;
  });

  $effect(() => {
    localIsPlaying = isPlaying;
  });

  // Calculate total duration of sequence (accounting for duration multipliers)
  const totalDuration = $derived.by(() => {
    return sequence.steps.reduce((sum, step) => {
      return sum + (step.duration ?? 1.0);
    }, 0);
  });

  // Animation loop - plays through sequence with duration-aware timing
  function startAnimationLoop() {
    if (animationFrameId !== null) return;

    lastTime = performance.now();

    function animate(timestamp: number) {
      if (!localIsPlaying) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaMs = timestamp - lastTime;
      lastTime = timestamp;

      // Calculate step progress based on durations
      // Base duration is 1000ms per unit duration at speed 1.0
      const speed = animationState.speed;
      const baseMs = 1000 / speed;

      // Find current step and progress within it
      let accumulatedDuration = 0;
      let stepIndex = 0;

      // Convert localCurrentStep to accumulated time
      for (let i = 0; i < sequence.steps.length && i < Math.floor(localCurrentStep); i++) {
        accumulatedDuration += sequence.steps[i].duration ?? 1.0;
      }

      // Add fractional part of current step
      if (Math.floor(localCurrentStep) < sequence.steps.length) {
        const currentStepDuration = sequence.steps[Math.floor(localCurrentStep)]?.duration ?? 1.0;
        accumulatedDuration += (localCurrentStep % 1) * currentStepDuration;
      }

      // Advance time
      accumulatedDuration += deltaMs / baseMs;

      // Wrap around if needed (loop)
      const total = totalDuration;
      if (accumulatedDuration >= total) {
        accumulatedDuration = accumulatedDuration % total;
      }

      // Convert back to step number
      let remaining = accumulatedDuration;
      stepIndex = 0;
      while (stepIndex < sequence.steps.length) {
        const stepDuration = sequence.steps[stepIndex].duration ?? 1.0;
        if (remaining < stepDuration) {
          break;
        }
        remaining -= stepDuration;
        stepIndex++;
      }

      if (stepIndex < sequence.steps.length) {
        const stepDuration = sequence.steps[stepIndex].duration ?? 1.0;
        localCurrentStep = stepIndex + (remaining / stepDuration);
      } else {
        localCurrentStep = 0; // Wrap to start
      }

      animationState.setCurrentStep(localCurrentStep);
      animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function stopAnimationLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  onMount(() => {
    startAnimationLoop();
  });

  onDestroy(() => {
    stopAnimationLoop();
    animationState.dispose();
  });

  // Get the current step data for display
  const currentStepIndex = $derived(Math.floor(localCurrentStep));
  const currentStepData = $derived(sequence.steps[currentStepIndex] ?? null);
  const currentLetter = $derived(currentStepData?.letter ?? null);

  // Grid mode from sequence
  const gridMode = $derived(() => {
    if (sequence.startPosition?.gridMode) {
      return sequence.startPosition.gridMode;
    }
    return GridMode.DIAMOND;
  });
</script>

<div class="duration-preview-workspace">
  <!-- Animation Preview -->
  <div class="animation-section">
    <div class="animation-container">
      <AnimatorCanvas
        blueProp={blueProp}
        redProp={redProp}
        gridVisible={true}
        gridMode={gridMode()}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={sequence}
        currentStep={localCurrentStep}
        isPlaying={localIsPlaying}
        previewDarkMode={true}
      />
    </div>
  </div>

  <!-- Timeline Beat Grid -->
  <div class="timeline-section">
    <div class="timeline-header">
      <span class="timeline-label">Timeline</span>
      <span class="duration-hint">Cell width = beat duration</span>
    </div>
    <div class="timeline-grid">
      <StepGrid
        steps={sequence.steps}
        startPosition={sequence.startPosition ?? sequence.startingPosition ?? null}
        selectedStepNumber={currentStepIndex + 1}
        isTimelineMode={true}
        isSideBySideLayout={true}
      />
    </div>
  </div>
</div>

<style>
  .duration-preview-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    gap: 8px;
    padding: 12px;
    background: var(--theme-panel-bg);
    overflow: hidden;
  }

  .animation-section {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    overflow: hidden;
  }

  .animation-container {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .timeline-section {
    flex: 0 0 auto;
    min-height: 120px;
    max-height: 200px;
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    overflow: hidden;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .timeline-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .duration-hint {
    font-size: var(--font-size-xs, 12px);
    color: var(--theme-text-dim);
  }

  .timeline-grid {
    flex: 1;
    min-height: 0;
    padding: 8px;
    overflow-x: auto;
    overflow-y: hidden;
  }
</style>
