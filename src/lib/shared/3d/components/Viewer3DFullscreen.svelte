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
  import MobileSceneControls from "./MobileSceneControls.svelte";
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
    /** Immersive toggle. Receives the overlay root for native fullscreen. */
    immersive?: boolean;
    onToggleImmersive?: (host: HTMLElement | null) => void;
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
    immersive = false,
    onToggleImmersive,
  }: Props = $props();

  let hostEl = $state<HTMLElement | null>(null);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- Backdrop tap-to-exit is a redundant convenience; the immersive toggle button (below) is keyboard-accessible. -->
<div
  class="viewer-3d-fullscreen"
  class:immersive
  bind:this={hostEl}
  onclick={immersive ? () => onToggleImmersive?.(hostEl) : undefined}
>
  <!-- Top bar: word label + immersive + close -->
  <div class="top-bar" class:hidden={immersive}>
    {#if word}
      <span class="word-label"><TKAWordGlyph {word} height={14} darkMode /></span>
    {/if}
    <div class="top-actions">
      <button
        class="icon-button"
        onclick={(e) => { e.stopPropagation(); onToggleImmersive?.(hostEl); }}
        aria-label={immersive ? "Exit immersive" : "Immersive fullscreen"}
        aria-pressed={immersive}
      >
        <i class="fas {immersive ? 'fa-compress' : 'fa-expand'}"></i>
      </button>
      <button class="icon-button" onclick={onClose} aria-label="Exit 3D view">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
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
      hideOverlays={true}
    />
  </div>

  <!-- Bottom bar: consolidated controls -->
  <div class="bottom-bar" class:hidden={immersive}>
    <MobileSceneControls
      {isPlaying}
      {onPlaybackToggle}
      {onStepForward}
      {onStepBackward}
    />
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

  .top-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; }
  .icon-button {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; padding: 0; font-size: 15px;
  }
  .icon-button:active { background: rgba(255, 255, 255, 0.22); }
  .top-bar.hidden, .bottom-bar.hidden {
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
  }
  .bottom-bar { gap: 14px; }
</style>
