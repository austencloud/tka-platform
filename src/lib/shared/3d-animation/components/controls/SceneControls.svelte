<script lang="ts">
  /**
   * SceneControls - Scene mode toggle and status indicator
   *
   * Compact control bar for enabling scene mode and showing scene status.
   * When enabled, the scene orchestrator takes over playback control.
   */

  import type { SceneState } from "../../state/scene-state.svelte";

  interface Props {
    /** Scene state */
    sceneState: SceneState;
    /** Callback to open scene browser/editor */
    onOpenSceneBrowser?: () => void;
  }

  let {
    sceneState,
    onOpenSceneBrowser,
  }: Props = $props();

  const statusLabels: Record<string, string> = {
    idle: "No Scene",
    loading: "Loading...",
    ready: "Ready",
    playing: "Playing",
    paused: "Paused",
  };

  function formatBeatTime(beat: number, progress: number): string {
    return `${beat + 1}.${Math.floor(progress * 10)}`;
  }
</script>

<div class="scene-controls" class:has-scene={sceneState.hasScene}>
  <!-- Scene Mode Indicator -->
  <div class="scene-status">
    <i class="fas fa-film" aria-hidden="true"></i>
    <span class="status-text">{statusLabels[sceneState.playbackState] ?? "Unknown"}</span>
  </div>

  {#if sceneState.hasScene}
    <!-- Beat Counter -->
    <div class="beat-counter" title="Current beat / Total beats">
      <span class="current">{formatBeatTime(sceneState.currentBeat, sceneState.beatProgress)}</span>
      <span class="separator">/</span>
      <span class="total">{sceneState.totalBeats}</span>
    </div>

    <!-- Playback Controls -->
    <div class="playback-controls">
      <button
        class="control-btn"
        onclick={() => sceneState.stop()}
        title="Stop"
        disabled={sceneState.isLoading}
      >
        <i class="fas fa-stop" aria-hidden="true"></i>
      </button>

      <button
        class="control-btn play"
        onclick={() => sceneState.togglePlay()}
        title={sceneState.isPlaying ? "Pause" : "Play"}
        disabled={sceneState.isLoading}
      >
        <i class="fas" class:fa-pause={sceneState.isPlaying} class:fa-play={!sceneState.isPlaying} aria-hidden="true"></i>
      </button>

      <button
        class="control-btn"
        class:active={sceneState.loop}
        onclick={() => sceneState.setLoop(!sceneState.loop)}
        title={sceneState.loop ? "Disable loop" : "Enable loop"}
      >
        <i class="fas fa-repeat" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Formation Indicator -->
    <div class="formation-indicator" class:transitioning={sceneState.isFormationTransitioning}>
      <i class="fas fa-users" aria-hidden="true"></i>
      <span>{sceneState.activeFormation}</span>
    </div>
  {:else}
    <!-- Load Scene Button -->
    {#if onOpenSceneBrowser}
      <button
        class="load-scene-btn"
        onclick={onOpenSceneBrowser}
      >
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        <span>Load Scene</span>
      </button>
    {/if}
  {/if}
</div>

<style>
  .scene-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
  }

  .scene-controls.has-scene {
    border-color: var(--theme-accent, #8b5cf6);
  }

  .scene-status {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .scene-status i {
    font-size: 14px;
    color: var(--theme-accent, #8b5cf6);
  }

  .status-text {
    font-weight: 500;
  }

  .beat-counter {
    display: flex;
    align-items: baseline;
    gap: 2px;
    padding: 4px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: var(--font-size-compact, 12px);
  }

  .beat-counter .current {
    color: var(--theme-text, #ffffff);
    font-weight: 600;
  }

  .beat-counter .separator {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .beat-counter .total {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .playback-controls {
    display: flex;
    gap: 4px;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn:hover:not(:disabled) {
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.play {
    width: 36px;
    height: 36px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: 14px;
  }

  .control-btn.play:hover:not(:disabled) {
    background: var(--theme-accent-strong, #7c3aed);
  }

  .control-btn.active {
    color: var(--theme-accent, #8b5cf6);
  }

  .formation-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .formation-indicator.transitioning {
    color: var(--theme-accent, #8b5cf6);
    animation: pulse 0.5s ease-in-out infinite;
  }

  .formation-indicator i {
    font-size: 10px;
  }

  .load-scene-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s;
  }

  .load-scene-btn:hover {
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @media (prefers-reduced-motion: reduce) {
    .formation-indicator.transitioning {
      animation: none;
    }
  }
</style>
