<!--
  DurationPreviewWorkspace.svelte

  Split workspace for live preview of duration patterns.

  Layout (desktop):
  - Top: Animation preview (props animating with current timing)
  - Bottom: Horizontal timeline strip (single row, duration-proportional widths)

  Features:
  - Auto-plays animation in a loop
  - Updates instantly when duration pattern changes
  - Horizontal scrollable timeline with duration-proportional cell widths
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { onMount, onDestroy } from "svelte";
  import { formatDurationCompact } from "../../domain/models/duration-pattern-data";

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
        accumulatedDuration += sequence.steps[i]?.duration ?? 1.0;
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
        const stepDuration = sequence.steps[stepIndex]?.duration ?? 1.0;
        if (remaining < stepDuration) {
          break;
        }
        remaining -= stepDuration;
        stepIndex++;
      }

      if (stepIndex < sequence.steps.length) {
        const stepDuration = sequence.steps[stepIndex]?.duration ?? 1.0;
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
  const gridMode = $derived.by(() => {
    if (sequence.gridMode) {
      return sequence.gridMode;
    }
    return GridMode.DIAMOND;
  });

  // Calculate base unit width (100px per 1.0 duration unit)
  const BASE_UNIT_WIDTH = 100;

  // Auto-scroll timeline to keep current step visible
  let timelineRef: HTMLElement | undefined = $state();

  $effect(() => {
    if (!timelineRef) return;

    // Calculate the position of the current step in the timeline
    let offsetX = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      offsetX += (sequence.steps[i]?.duration ?? 1.0) * BASE_UNIT_WIDTH;
    }

    // Get current step width
    const currentWidth = (sequence.steps[currentStepIndex]?.duration ?? 1.0) * BASE_UNIT_WIDTH;

    // Center the current step in view
    const containerWidth = timelineRef.clientWidth;
    const targetScroll = offsetX - (containerWidth / 2) + (currentWidth / 2);

    timelineRef.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
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
        gridMode={gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={sequence}
        currentStep={localCurrentStep}
        isPlaying={localIsPlaying}
        previewDarkMode={true}
      />
    </div>
  </div>

  <!-- Horizontal Timeline Strip -->
  <div class="timeline-section">
    <div class="timeline-header">
      <span class="timeline-label">Timeline</span>
      <span class="duration-hint">Width = duration</span>
    </div>
    <div class="timeline-strip" bind:this={timelineRef}>
      <div class="timeline-track">
        {#each sequence.steps as step, index}
          {@const duration = step.duration ?? 1.0}
          {@const isActive = index === currentStepIndex}
          {@const width = duration * BASE_UNIT_WIDTH}
          <div
            class="timeline-cell"
            class:active={isActive}
            style="width: {width}px; min-width: {width}px;"
          >
            <div class="cell-pictograph">
              <PictographContainer
                pictographData={step}
                showTKA={false}
                showTnD={false}
                showPositions={false}
                showReversals={false}
                showElemental={false}
                disableTransitions={true}
              />
            </div>
            <div class="cell-info">
              <span class="beat-number">{index + 1}</span>
              <span class="duration-badge">{formatDurationCompact(duration)}</span>
            </div>
            {#if step.letter}
              <span class="letter-badge">{step.letter}</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .duration-preview-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    gap: 12px;
    padding: 12px;
    background: var(--theme-panel-bg);
    overflow: hidden;
  }

  .animation-section {
    flex: 1;
    min-height: 200px;
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
    height: 140px;
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
    padding: 6px 12px;
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

  .timeline-strip {
    flex: 1;
    min-height: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .timeline-strip::-webkit-scrollbar {
    height: 8px;
  }

  .timeline-strip::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .timeline-strip::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .timeline-track {
    display: flex;
    gap: 4px;
    height: 100%;
    min-width: max-content;
  }

  .timeline-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    transition: all 150ms ease;
    overflow: hidden;
  }

  .timeline-cell.active {
    background: rgba(249, 115, 22, 0.15);
    border-color: rgba(249, 115, 22, 0.5);
    box-shadow: 0 0 12px rgba(249, 115, 22, 0.3);
  }

  .cell-pictograph {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
  }

  .cell-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.3);
    width: 100%;
    justify-content: center;
  }

  .beat-number {
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .duration-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
    border-radius: 4px;
    font-weight: 500;
  }

  .letter-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    background: rgba(0, 0, 0, 0.5);
    color: var(--theme-text);
    border-radius: 3px;
  }
</style>
