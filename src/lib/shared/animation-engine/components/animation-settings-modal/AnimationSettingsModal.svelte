<!--
  AnimationSettingsModal.svelte - Full-screen animation settings experience

  Layout: Canvas preview on left, controls on right.
  Controls: Effect picker (mutually exclusive: None/Fire/LED/Trails) with detail
  controls for the active effect, plus display toggles (grid mode, element visibility).

  Architecture:
  - Own AnimatorCanvas instance with independent RAF playback
  - Effects are mutually exclusive (fire/LED already enforced in visibility manager)
  - All changes go through global AnimationVisibilityStateManager
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
  import { slide } from "svelte/transition";
  import { onDestroy } from "svelte";
  import PlaybackCategory from "./categories/PlaybackCategory.svelte";
  import EffortCategory from "./categories/EffortCategory.svelte";
  import PathShapeCategory from "./categories/PathShapeCategory.svelte";
  import DisplayCategory from "./categories/DisplayCategory.svelte";
  import EffectsPanel from "../effects-panel/EffectsPanel.svelte";
  import EffectMatrixDrawer from "../../../../features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectMatrixDrawer.svelte";

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

  // Collapsible section state
  let motionOpen = $state(false);
  let displayOpen = $state(false);
  let tipMatrixOpen = $state(false);

  // Playback state
  let isPlaying = $state(true);
  let playbackStep = $state(0);
  let rafId: number | null = null;
  let lastFrameTime = 0;

  const vm = getAnimationVisibilityManager();

  // ── Auto-select initial effect when modal opens ──
  $effect(() => {
    if (open && initialCategory) {
      if (initialCategory === "fire" && !vm.hasEffect("fire")) vm.setActiveEffect("fire");
      else if (initialCategory === "led" && !vm.hasEffect("led")) vm.setActiveEffect("led");
    }
  });

  // ── Playback ──
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
        Animation Settings
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
    <!-- Canvas preview -->
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
          disableContextMenu
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

    <!-- Controls panel -->
    <div class="controls-section">
      <!-- Effects: always visible -->
      <div class="control-group" data-animate="3">
        <EffectsPanel
          bpm={vm.getBpm()}
          onBpmChange={(bpm) => vm.setBpm(bpm)}
          {isPlaying}
          onPlaybackToggle={togglePlayback}
          showPlayback={false}
        />
      </div>

      <!-- Per-tip customization button -->
      <button
        class="customize-tip-btn"
        onclick={() => { tipMatrixOpen = true; }}
        type="button"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
        Customize per tip
      </button>

      {#if tipMatrixOpen}
        <div class="tip-matrix-overlay">
          <EffectMatrixDrawer
            currentMap={vm.getTipEffectMap()}
            bluePropType="staff"
            redPropType="staff"
            onUpdateMap={(map) => vm.setTipEffectMap(map)}
            onClose={() => { tipMatrixOpen = false; }}
          />
        </div>
      {/if}

      <!-- Motion: collapsed by default -->
      <button
        class="section-toggle"
        type="button"
        aria-expanded={motionOpen}
        onclick={() => (motionOpen = !motionOpen)}
        data-animate="5"
      >
        <span class="section-toggle-label">Motion</span>
        <i class="fas {motionOpen ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
      </button>
      {#if motionOpen}
        <div class="collapsible-section" transition:slide={{ duration: 150 }}>
          <div class="control-group">
            <span class="group-label">Playback</span>
            <PlaybackCategory />
          </div>
          <div class="control-group">
            <span class="group-label">Effort</span>
            <EffortCategory />
          </div>
          <div class="control-group">
            <span class="group-label">Path Shape</span>
            <PathShapeCategory />
          </div>
        </div>
      {/if}

      <!-- Display: collapsed by default -->
      <button
        class="section-toggle"
        type="button"
        aria-expanded={displayOpen}
        onclick={() => (displayOpen = !displayOpen)}
        data-animate="6"
      >
        <span class="section-toggle-label">Display</span>
        <i class="fas {displayOpen ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
      </button>
      {#if displayOpen}
        <div class="collapsible-section" transition:slide={{ duration: 150 }}>
          <DisplayCategory />
        </div>
      {/if}
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

  /* ── Layout ── */
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
    max-width: 500px;
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

  /* ── Controls panel ── */
  .controls-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Collapsible section toggle */
  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    min-height: 44px;
  }

  .section-toggle:hover {
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .section-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .section-toggle-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .section-toggle i {
    font-size: 10px;
    opacity: 0.6;
  }

  .collapsible-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 0;
  }

  /* ── Desktop: side-by-side ── */
  @media (min-width: 800px) {
    .settings-layout {
      flex-direction: row;
      align-items: flex-start;
    }

    .preview-section {
      flex: 1 1 50%;
      position: sticky;
      top: 0;
    }

    .preview-canvas-container {
      max-width: 600px;
    }

    .controls-section {
      flex: 1 1 50%;
      min-width: 280px;
    }
  }

  @media (min-width: 1400px) {
    .preview-canvas-container {
      max-width: 700px;
    }
  }

  /* ── Customize per-tip button ── */
  .customize-tip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .customize-tip-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, white);
  }

  .customize-tip-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .customize-tip-btn i {
    font-size: 13px;
  }

  /* The matrix drawer needs to fill the controls section */
  .tip-matrix-overlay {
    position: relative;
    min-height: 300px;
  }

  .tip-matrix-overlay :global(.matrix-overlay) {
    position: relative;
    inset: unset;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .play-btn,
    .section-toggle,
    .customize-tip-btn {
      transition: none;
    }
  }
</style>
