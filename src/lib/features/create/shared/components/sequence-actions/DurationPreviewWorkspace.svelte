<!--
  The Create workspace's AnimatorCanvas preview surface for duration editing.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { onMount, onDestroy, untrack } from "svelte";
  import { formatDurationCompact } from "../../domain/models/duration-pattern-data";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { shouldAutoplayMotion } from "$lib/shared/animation-engine/services/motion-autoplay-policy";

  interface Props {
    sequence: SequenceData;
    currentStep?: number;
    isPlaying?: boolean;
  }

  let { sequence, currentStep = 0, isPlaying = true }: Props = $props();

  const animationState = createAnimationPanelState();
  let animationFrameId: number | null = null;
  let lastTime = 0;
  let localCurrentStep = $state(currentStep);
  let localIsPlaying = $state(false);
  let mounted = false;
  let canvasReady = $state(false);
  let systemPrefersReducedMotion = $state(false);
  let blueProp = $state(animationState.bluePropState);
  let redProp = $state(animationState.redPropState);

  $effect(() => {
    animationState.setSequenceData(sequence);
    animationState.setTotalSteps(sequence.steps.length);
  });

  const reducedMotionSetting = $derived(
    settingsService.currentSettings.reducedMotion ?? false
  );
  const autoplayAllowed = $derived(
    shouldAutoplayMotion({
      reducedMotionSetting,
      systemPrefersReducedMotion,
    })
  );
  // This workspace keeps a zero-based cursor so it can index sequence.steps
  // directly. AnimatorCanvas uses 1 for motion 1, 2 for motion 2, and so on;
  // 0 is the sequence's held start pose.
  const animatorCurrentStep = $derived(localCurrentStep + 1);
  const totalDuration = $derived.by(() => {
    return sequence.steps.reduce((sum, step) => sum + (step.duration ?? 1), 0);
  });

  $effect(() => {
    if (mounted && reducedMotionSetting) {
      untrack(() => {
        stopPreview();
        localCurrentStep = 0;
        animationState.setCurrentStep(animatorCurrentStep);
      });
    }
  });

  function startAnimationLoop() {
    if (!mounted || animationFrameId !== null || !localIsPlaying) return;

    lastTime = performance.now();

    function animate(timestamp: number) {
      if (!localIsPlaying) {
        animationFrameId = null;
        return;
      }

      const deltaMs = timestamp - lastTime;
      lastTime = timestamp;
      const speed = animationState.speed;
      const baseMs = 1000 / speed;
      let accumulatedDuration = 0;
      let stepIndex = 0;

      for (
        let i = 0;
        i < sequence.steps.length && i < Math.floor(localCurrentStep);
        i++
      ) {
        accumulatedDuration += sequence.steps[i]?.duration ?? 1.0;
      }

      if (Math.floor(localCurrentStep) < sequence.steps.length) {
        const currentStepDuration =
          sequence.steps[Math.floor(localCurrentStep)]?.duration ?? 1.0;
        accumulatedDuration += (localCurrentStep % 1) * currentStepDuration;
      }

      accumulatedDuration += deltaMs / baseMs;

      const total = totalDuration;
      if (total <= 0) {
        stopPreview();
        return;
      }
      if (accumulatedDuration >= total) {
        accumulatedDuration %= total;
      }

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
        localCurrentStep = stepIndex + remaining / stepDuration;
      } else {
        localCurrentStep = 0;
      }

      animationState.setCurrentStep(animatorCurrentStep);
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

  function playPreview() {
    localCurrentStep = 0;
    animationState.setCurrentStep(animatorCurrentStep);
    localIsPlaying = true;
    animationState.setIsPlaying(true);
    startAnimationLoop();
  }

  function stopPreview() {
    localIsPlaying = false;
    animationState.setIsPlaying(false);
    stopAnimationLoop();
  }

  function startAutoplayWhenReady() {
    if (
      !mounted ||
      !canvasReady ||
      localIsPlaying ||
      !isPlaying ||
      !autoplayAllowed
    ) {
      return;
    }

    playPreview();
  }

  function handleCanvasReady() {
    canvasReady = true;
    startAutoplayWhenReady();
  }

  onMount(() => {
    mounted = true;
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    systemPrefersReducedMotion = reducedMotionQuery.matches;
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      systemPrefersReducedMotion = event.matches;
      if (event.matches) {
        stopPreview();
        localCurrentStep = 0;
        animationState.setCurrentStep(animatorCurrentStep);
      } else {
        startAutoplayWhenReady();
      }
    };
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    localCurrentStep = 0;
    animationState.setCurrentStep(animatorCurrentStep);
    startAutoplayWhenReady();

    return () => {
      mounted = false;
      reducedMotionQuery.removeEventListener(
        "change",
        handleReducedMotionChange
      );
    };
  });

  onDestroy(() => {
    stopAnimationLoop();
    animationState.dispose();
  });

  const currentStepIndex = $derived(
    Math.max(
      0,
      Math.min(sequence.steps.length - 1, Math.floor(localCurrentStep))
    )
  );
  const currentStepData = $derived(sequence.steps[currentStepIndex] ?? null);
  const currentLetter = $derived(currentStepData?.letter ?? null);

  // Grid mode from sequence
  const gridMode = $derived.by(() => {
    if (sequence.gridMode) {
      return sequence.gridMode;
    }
    return GridMode.DIAMOND;
  });

  const BASE_UNIT_WIDTH = 100;
  let timelineRef: HTMLElement | undefined = $state();

  $effect(() => {
    if (!timelineRef) return;

    let offsetX = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      offsetX += (sequence.steps[i]?.duration ?? 1.0) * BASE_UNIT_WIDTH;
    }

    const currentWidth =
      (sequence.steps[currentStepIndex]?.duration ?? 1.0) * BASE_UNIT_WIDTH;
    const containerWidth = timelineRef.clientWidth;
    const targetScroll = offsetX - containerWidth / 2 + currentWidth / 2;

    timelineRef.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  });
</script>

<div class="duration-preview-workspace">
  <div class="animation-section">
    <div class="animation-container">
      <AnimatorCanvas
        {blueProp}
        {redProp}
        gridVisible={true}
        {gridMode}
        letter={currentLetter}
        stepData={currentStepData}
        sequenceData={sequence}
        currentStep={animatorCurrentStep}
        isPlaying={localIsPlaying}
        previewDarkMode={true}
        onInitialized={handleCanvasReady}
      />
      {#if !canvasReady}
        <div class="preview-loading" role="status">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Preparing preview</span>
        </div>
      {/if}
    </div>
  </div>

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
                propRenderContext="editor"
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
              <span class="duration-badge"
                >{formatDurationCompact(duration)}</span
              >
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
    container: workspace-preview / inline-size;
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
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    background: color-mix(in srgb, var(--theme-card-bg) 82%, transparent);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    pointer-events: none;
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
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

  @container workspace-preview (max-width: 440px) {
    .context-status {
      align-items: center;
      text-align: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .duration-preview-workspace.audition .animation-section {
      animation: none;
    }

    .preview-loading i {
      animation: none;
    }

    .timeline-cell {
      transition: none;
    }
  }
</style>
