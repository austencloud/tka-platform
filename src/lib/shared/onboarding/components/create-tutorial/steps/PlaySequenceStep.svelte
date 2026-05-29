<!--
  PlaySequenceStep - Step 3 of the create tutorial

  Shows the real ChoreoCard built from the user's chosen start position + beats.
  A big green play button triggers playback via AnimatorCanvas.
  Tapping "Continue" advances to the final step.
-->
<script lang="ts">

import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from "svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/SequenceData";
  import { pictographDataToStepData } from "$lib/shared/pictograph/shared/domain/utils/step-pictograph-conversion";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import {
    createAnimationPanelState,
    type AnimationStateKey,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  const isDarkMode = $derived(getSettings().darkMode ?? false);

  // Haptic
  let hapticService: HapticFeedback | null = null;
  try {
    hapticService = getHapticFeedback();
  } catch {
    // Optional service
  }

  // Playback state
  let showAnimation = $state(false);
  let isPlaying = $state(false);
  let hasPlayed = $state(false);
  let currentStep = $state(0);
  let playbackController: AnimationPlaybackController | null = null;
  const animationState = createAnimationPanelState();
  let stateUnsubscribe: (() => void) | undefined;

  // Build a real SequenceData from the tutorial selections
  function buildTutorialSequence(): SequenceData | null {
    const startPicto = createTutorialState.startPosition;
    const beats = createTutorialState.beats;
    if (!startPicto || beats.length === 0) return null;

    const startPosition: StartPositionData = {
      ...startPicto,
      isStartPosition: true as const,
    };

    const steps = beats.map((step, i) =>
      pictographDataToStepData(step, step.id ?? `tutorial-beat-${i}`),
    );

    const word = beats.map((b) => b.letter ?? "").join("");

    return createSequenceData({
      name: "Tutorial",
      word,
      startPosition,
      steps,
      gridMode: createTutorialState.gridMode,
    });
  }

  const tutorialSequence = $derived(buildTutorialSequence());

  // Derive current step data and letter for glyph overlay
  const currentStepData = $derived.by(() => {
    const seq = animationState.sequenceData;
    if (!seq) return null;
    if (currentStep < 1 && seq.startPosition) return seq.startPosition;
    if (seq.steps?.length > 0) {
      const idx = Math.min(
        Math.max(0, Math.floor(currentStep) - 1),
        seq.steps.length - 1,
      );
      return seq.steps[idx] || null;
    }
    return null;
  });

  const currentLetter = $derived(currentStepData?.letter || null);

  function handlePlay() {
    hapticService?.trigger("selection");
    if (!tutorialSequence || !playbackController) return;
    showAnimation = true;
    hasPlayed = true;

    // Initialize and start playback
    animationState.setShouldLoop(true);
    const success = playbackController.initialize(
      tutorialSequence,
      animationState,
    );
    if (success) {
      animationState.setSequenceData(tutorialSequence);
      playbackController.togglePlayback();
    }
  }

  function handleStop() {
    hapticService?.trigger("selection");
    if (playbackController && isPlaying) {
      playbackController.stop();
    }
    showAnimation = false;
    isPlaying = false;
    currentStep = 0;
  }

  onMount(() => {
    try {
      playbackController = getAnimationPlaybackController();
    } catch {
      console.warn("Animation playback controller not available");
    }

    // Subscribe to animation state changes
    stateUnsubscribe = animationState.subscribe(
      (key: AnimationStateKey, value: unknown) => {
        if (key === "isPlaying") {
          isPlaying = value as boolean;
        } else if (key === "currentStep") {
          currentStep = value as number;
        }
      },
    );
  });

  onDestroy(() => {
    stateUnsubscribe?.();
    playbackController?.dispose();
    animationState.dispose();
  });
</script>

<div class="tutorial-step">
  <h1 class="title">Your sequence</h1>
  <p class="subtitle">
    {#if showAnimation}
      Watch your sequence come to life.
    {:else}
      Here's what you built. Hit play to see it animated.
    {/if}
  </p>

  <div class="viewer-container">
    {#if showAnimation && tutorialSequence}
      <div class="animation-pane">
        <AnimatorCanvas
          sequenceData={animationState.sequenceData}
          currentStep={currentStep}
          isPlaying={true}
          blueProp={animationState.bluePropState}
          redProp={animationState.redPropState}
          gridMode={tutorialSequence.gridMode}
          letter={currentLetter}
          stepData={currentStepData}
          word={tutorialSequence.word}
          focused={true}
        />
      </div>
    {:else if tutorialSequence}
      <div class="card-pane">
        <ChoreoCard
          sequence={tutorialSequence}
          darkMode={isDarkMode}
        />
      </div>
    {:else}
      <p class="loading">Building sequence...</p>
    {/if}
  </div>

  <div class="button-row">
    {#if showAnimation}
      <button class="stop-button" onclick={handleStop}>
        <i class="fas fa-stop" aria-hidden="true"></i> Back to card
      </button>
    {:else}
      <button class="play-button" onclick={handlePlay} aria-label="Play sequence">
        <i class="fas fa-play" aria-hidden="true"></i>
      </button>
    {/if}

    {#if hasPlayed}
      <button class="continue-button" onclick={onAdvance}>
        Continue <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
</div>

<style>
  .tutorial-step {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 780px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    line-height: 1.5;
  }

  .viewer-container {
    width: 100%;
    height: clamp(300px, 45vh, 550px);
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }

  .card-pane,
  .animation-pane {
    width: 100%;
    height: 100%;
  }

  .animation-pane {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
  }

  .loading {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    padding: 40px 0;
  }

  .button-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 4px;
  }

  /* Big green play button */
  .play-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(
      135deg,
      var(--semantic-success, #22c55e),
      color-mix(in srgb, var(--semantic-success, #22c55e) 85%, #000)
    );
    border: none;
    border-radius: 50%;
    color: var(--theme-text, #fff);
    font-size: 1.5rem;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
  }

  .play-button:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 24px color-mix(in srgb, var(--semantic-success, #22c55e) 50%, transparent);
  }

  .play-button:active {
    transform: scale(0.95);
  }

  .play-button i {
    /* Optical center - play icon needs slight right offset */
    margin-left: 3px;
  }

  .stop-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out);
  }

  .stop-button:hover {
    background: var(--theme-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .continue-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 32px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out);
  }

  .continue-button:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .continue-button:active {
    transform: scale(0.97);
  }

  .continue-button:focus-visible,
  .play-button:focus-visible,
  .stop-button:focus-visible {
    outline: 2px solid var(--theme-accent-strong, #8b5cf6);
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 16px;
      gap: 10px;
    }
    .title {
      font-size: 1.25rem;
    }
    .play-button {
      width: 56px;
      height: 56px;
      font-size: 1.3rem;
    }
    .continue-button {
      padding: 12px 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step,
    .play-button,
    .stop-button,
    .continue-button {
      transition: none;
    }
    .play-button:hover,
    .play-button:active,
    .continue-button:active {
      transform: none;
    }
  }
</style>
