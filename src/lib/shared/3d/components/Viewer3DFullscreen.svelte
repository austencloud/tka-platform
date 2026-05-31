<script lang="ts">
  /**
   * Viewer3DFullscreen
   *
   * Mobile full-screen overlay for the 3D viewer. Takes over the entire
   * viewport so the 3D canvas has maximum real estate while the user is
   * watching a sequence in 3D.
   *
   * Floating top and bottom bars keep the UI out of the canvas until the
   * user needs the controls. The bottom bar holds playback controls and
   * the effect pills row.
   *
   * The parent must have called setViewer3DContext() before mounting this.
   */

  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import Viewer3DCanvas from "./Viewer3DCanvas.svelte";
  import Viewer3DEffectPills from "./Viewer3DEffectPills.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";

  // Canonical effects config - single source of truth for both 2D canvas
  // and 3D viewer effect parameters. One-time migration from the old VM
  // localStorage key happens inside createEffectsConfigState.
  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);

  // Scene-wide 3D render modifiers (motion blur + speed lines).
  // Separate from per-tip EffectsConfig because these are whole-scene passes.
  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    bpm: number;
    word: string | null;
    bluePropType?: string | null;
    redPropType?: string | null;
    onClose: () => void;
    onPlaybackToggle: () => void;
    onBpmChange: (bpm: number) => void;
    onStepForward: () => void;
    onStepBackward: () => void;
  }

  let {
    sequenceData,
    currentStep,
    isPlaying,
    bpm,
    word,
    bluePropType = null,
    redPropType = null,
    onClose,
    onPlaybackToggle,
    onBpmChange,
    onStepForward,
    onStepBackward,
  }: Props = $props();
</script>

<div class="viewer-3d-fullscreen">
  <!-- Top bar: word label + close button -->
  <div class="top-bar">
    {#if word}
      <span class="word-label"><TKAWordGlyph {word} height={14} darkMode /></span>
    {/if}
    <button class="close-button" onclick={onClose} aria-label="Exit 3D view">
      ✕
    </button>
  </div>

  <!-- 3D canvas fills remaining space -->
  <div class="canvas-area">
    <Viewer3DCanvas
      {sequenceData}
      {currentStep}
      {isPlaying}
      {bpm}
      {onBpmChange}
      {bluePropType}
      {redPropType}
    />
  </div>

  <!-- Bottom bar: playback controls + effect pills -->
  <div class="bottom-bar">
    <div class="playback-controls">
      <button
        class="control-button"
        onclick={onStepBackward}
        aria-label="Previous beat"
      >
        ⏮
      </button>
      <button
        class="control-button play-button"
        onclick={onPlaybackToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <button
        class="control-button"
        onclick={onStepForward}
        aria-label="Next beat"
      >
        ⏭
      </button>
    </div>
    <Viewer3DEffectPills />
  </div>
</div>

<style>
  .viewer-3d-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #0a0a14;
    display: flex;
    flex-direction: column;
  }

  /* Top bar floats above the canvas with a gradient fade */
  .top-bar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    padding: 16px;
    z-index: 1;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .word-label {
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .close-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
    padding: 0;
    margin-left: auto;
  }

  .close-button:hover,
  .close-button:active {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Canvas fills all remaining space */
  .canvas-area {
    flex: 1;
    position: relative;
  }

  /* Bottom bar floats above the canvas with a gradient fade */
  .bottom-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 16px;
    z-index: 1;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Playback controls row */
  .playback-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Touch targets meet WCAG AAA (44px) */
  .control-button {
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
    padding: 0;
  }

  /* Play/pause button is slightly larger to signal primary action */
  .play-button {
    min-width: 48px;
    min-height: 48px;
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    font-size: 18px;
  }

  .control-button:hover,
  .control-button:active {
    background: rgba(255, 255, 255, 0.22);
  }
</style>
