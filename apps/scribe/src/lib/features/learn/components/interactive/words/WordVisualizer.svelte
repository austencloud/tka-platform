<!--
WordVisualizer - Shows a TKA word as an animated letter sequence
Displays letters transitioning smoothly on the grid with motion arrows
-->
<script lang="ts">
  import { untrack } from "svelte";
  import {
    GRID_POINTS_8,
    LEFT_HAND_COLOR,
    RIGHT_HAND_COLOR,
    interpolatePosition,
    type LetterDefinition,
    type HandPosition8,
  } from "../../../domain/constants/word-visualizer-data";
  import WordLetterLabel from "./word-visualizer/WordLetterLabel.svelte";
  import WordStepNavigation from "./word-visualizer/WordStepNavigation.svelte";
  import WordHandPositions from "./word-visualizer/WordHandPositions.svelte";
  import WordMotionArrow from "./word-visualizer/WordMotionArrow.svelte";

  let {
    letters = [],
    currentStepIndex = 0,
    isAnimating = false,
    animationSpeed = 1000,
    showLetterLabel = true,
    showStepNumber = true,
    compact = false,
    onStepChange,
  } = $props<{
    letters: LetterDefinition[];
    currentStepIndex?: number;
    isAnimating?: boolean;
    animationSpeed?: number;
    showLetterLabel?: boolean;
    showStepNumber?: boolean;
    compact?: boolean;
    onStepChange?: (index: number) => void;
  }>();

  let animationProgress = $state(0);
  let animationInterval: number | undefined;

  const currentLetter = $derived(() => {
    if (letters.length === 0) return null;
    return letters[Math.min(currentStepIndex, letters.length - 1)] ?? null;
  });

  const leftHandPos = $derived((): { x: number; y: number } => {
    const letter = currentLetter();
    if (!letter) return GRID_POINTS_8.N;
    if (animationProgress > 0 && animationProgress < 1) {
      return interpolatePosition(
        letter.startLeft,
        letter.endLeft,
        animationProgress
      );
    }
    return GRID_POINTS_8[letter.endLeft as HandPosition8];
  });

  const rightHandPos = $derived((): { x: number; y: number } => {
    const letter = currentLetter();
    if (!letter) return GRID_POINTS_8.S;
    if (animationProgress > 0 && animationProgress < 1) {
      return interpolatePosition(
        letter.startRight,
        letter.endRight,
        animationProgress
      );
    }
    return GRID_POINTS_8[letter.endRight as HandPosition8];
  });

  function startAnimation() {
    if (animationInterval) return;

    const frameInterval = 50;
    const totalFrames = animationSpeed / frameInterval;
    let frame = 0;
    const lettersLength = letters.length;
    const stepChangeCallback = onStepChange;

    animationInterval = setInterval(() => {
      frame++;
      animationProgress = frame / totalFrames;

      if (frame >= totalFrames) {
        animationProgress = 0;
        frame = 0;
        const currentIdx = untrack(() => currentStepIndex);
        const nextIndex = (currentIdx + 1) % lettersLength;
        stepChangeCallback?.(nextIndex);
      }
    }, frameInterval) as unknown as number;
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = undefined;
    }
    animationProgress = 0;
  }

  let prevIsAnimating = false;

  $effect(() => {
    const shouldAnimate = isAnimating;
    if (shouldAnimate !== prevIsAnimating) {
      prevIsAnimating = shouldAnimate;
      if (shouldAnimate) {
        startAnimation();
      } else {
        stopAnimation();
      }
    }

    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = undefined;
      }
    };
  });

  function handleStepChange(index: number) {
    onStepChange?.(index);
    animationProgress = 0;
  }
</script>

<div class="word-visualizer" class:compact>
  <!-- Letter label -->
  {#if showLetterLabel && currentLetter()}
    <WordLetterLabel letter={currentLetter()!} {compact} />
  {/if}

  <!-- Grid SVG -->
  <svg viewBox="0 0 100 100" class="word-grid" class:compact>
    <!-- Grid lines -->
    <g class="grid-lines" opacity="0.12">
      <line x1="50" y1="12" x2="50" y2="88" stroke="white" stroke-width="0.5" />
      <line x1="8" y1="50" x2="92" y2="50" stroke="white" stroke-width="0.5" />
      <line x1="18" y1="22" x2="82" y2="78" stroke="white" stroke-width="0.5" />
      <line x1="82" y1="22" x2="18" y2="78" stroke="white" stroke-width="0.5" />
    </g>

    <!-- Grid point markers -->
    {#each Object.values(GRID_POINTS_8) as point}
      <circle
        cx={point.x}
        cy={point.y}
        r="2.5"
        fill="rgba(255, 255, 255, 0.2)"
      />
    {/each}

    <!-- Motion arrows -->
    {#if currentLetter()}
      {@const letter = currentLetter()!}
      <WordMotionArrow
        startPos={letter.startLeft}
        endPos={letter.endLeft}
        motionType={letter.leftMotion}
        color={LEFT_HAND_COLOR}
      />
      <WordMotionArrow
        startPos={letter.startRight}
        endPos={letter.endRight}
        motionType={letter.rightMotion}
        color={RIGHT_HAND_COLOR}
      />
    {/if}

    <!-- Hand positions -->
    <WordHandPositions leftPos={leftHandPos()} rightPos={rightHandPos()} />

    <!-- Center point -->
    <circle cx="50" cy="50" r="2" fill="var(--theme-stroke-strong)" />
  </svg>

  <!-- Beat navigation -->
  {#if letters.length > 1}
    <WordStepNavigation
      {letters}
      {currentStepIndex}
      {showStepNumber}
      {compact}
      onStepChange={handleStepChange}
    />
  {/if}
</div>

<style>
  .word-visualizer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .word-visualizer.compact {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .word-grid {
    width: 100%;
    max-width: 240px;
    height: auto;
    aspect-ratio: 1;
  }

  .word-grid.compact {
    max-width: 160px;
  }
</style>
