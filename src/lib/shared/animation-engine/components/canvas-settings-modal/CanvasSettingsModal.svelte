<!--
  CanvasSettingsModal.svelte - Full-screen settings experience

  Full-screen modal with animation preview and effect controls.
  Uses BaseModal with pop animation and staggered entry via data-animate.

  Architecture:
  - Own AnimatorCanvas instance with focused prop for full chrome
  - Independent RAF playback loop (not shared with parent)
  - Categories section is a placeholder until Task 5 wires in cards
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AnimatorCanvas from "../AnimatorCanvas.svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { PropState } from "../../domain/PropState";
  import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
  import { onDestroy } from "svelte";

  interface Props {
    open: boolean;
    initialCategory?: string;
    sequenceData?: SequenceData | null;
    blueProp: PropState | null;
    redProp: PropState | null;
    letter?: Letter | null;
    stepData?: StartPositionData | StepData | null;
    word?: string | null;
  }

  let {
    open = $bindable(),
    initialCategory = undefined,
    sequenceData = null,
    blueProp,
    redProp,
    letter = null,
    stepData = null,
    word = null,
  }: Props = $props();

  // Playback state
  let isPlaying = $state(true);
  let playbackStep = $state(0);
  let rafId: number | null = null;
  let lastFrameTime = 0;

  const vm = getAnimationVisibilityManager();

  function startPlayback() {
    lastFrameTime = performance.now();
    function tick(now: number) {
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const bpm = vm.getBpm();
      const beatsPerSecond = bpm / 60;
      const totalSteps = (sequenceData?.steps?.length ?? 0) + 1;
      if (totalSteps > 0) {
        playbackStep = (playbackStep + beatsPerSecond * dt) % totalSteps;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function togglePlayback() {
    isPlaying = !isPlaying;
  }

  $effect(() => {
    if (open && isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }
    return () => stopPlayback();
  });

  onDestroy(() => stopPlayback());
</script>

<BaseModal bind:open size="xl" animation="pop" onclose={() => (open = false)}>
  {#snippet header()}
    <div class="settings-header" data-animate="1">
      <h2>
        <i class="fas fa-sliders" aria-hidden="true"></i>
        Canvas Settings
      </h2>
      <button
        class="close-btn"
        onclick={() => (open = false)}
        type="button"
        aria-label="Close settings"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="settings-layout">
    <div class="preview-section" data-animate="2">
      <div class="preview-canvas-container">
        <AnimatorCanvas
          {sequenceData}
          {blueProp}
          {redProp}
          {letter}
          {stepData}
          {word}
          currentStep={playbackStep}
          {isPlaying}
          focused
        />
      </div>
      <div class="playback-controls">
        <button
          class="play-btn"
          onclick={togglePlayback}
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <i
            class="fas"
            class:fa-play={!isPlaying}
            class:fa-pause={isPlaying}
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>

    <div class="categories-section" data-animate="3">
      <!-- Category cards will be wired in Task 5 -->
      <p style="color: var(--theme-text-dim); text-align: center;">Categories loading...</p>
    </div>
  </div>
</BaseModal>

<style>
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .settings-header h2 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .settings-header h2 i {
    color: var(--theme-accent, #8b5cf6);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition:
      background var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .settings-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    overflow-y: auto;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .preview-canvas-container {
    width: 100%;
    max-width: 350px;
    aspect-ratio: 1;
  }

  .playback-controls {
    display: flex;
    justify-content: center;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .play-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .categories-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Desktop wide: side-by-side layout */
  @media (min-width: 800px) {
    .settings-layout {
      flex-direction: row;
      align-items: flex-start;
    }

    .preview-section {
      flex: 0 0 350px;
      position: sticky;
      top: 0;
    }

    .categories-section {
      flex: 1;
      min-width: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .play-btn {
      transition: none;
    }
  }
</style>
