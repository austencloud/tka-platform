<!--
  MobileControlsBar.svelte

  Mobile recording controls bar with settings, record, pause, snapshot, and stop buttons.
-->
<script lang="ts">
  import type { PropType } from "../../domain/models";

  interface Props {
    isRecording: boolean;
    isPaused: boolean;
    isInitialized: boolean;
    propType: PropType;
    onOpenSettings: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onTogglePause: () => void;
    onTakeSnapshot: () => void;
  }

  let {
    isRecording,
    isPaused,
    isInitialized,
    propType,
    onOpenSettings,
    onStartRecording,
    onStopRecording,
    onTogglePause,
    onTakeSnapshot,
  }: Props = $props();

  const canStartRecording = $derived(isInitialized && !isRecording);
  const canStopRecording = $derived(isRecording);
</script>

<div class="controls-bar">
  <!-- Settings button -->
  {#if !isRecording}
    <button class="btn-settings" onclick={onOpenSettings} aria-label="Settings">
      <i class="fa fa-cog" aria-hidden="true"></i>
    </button>
  {/if}

  <!-- Main recording controls -->
  <div class="main-controls">
    {#if canStartRecording}
      <button
        class="btn-record"
        onclick={onStartRecording}
        disabled={!isInitialized}
        aria-label="Start Recording"
      >
        <i class="fa fa-circle" aria-hidden="true"></i>
      </button>
    {:else if canStopRecording}
      <button
        class="btn-pause"
        onclick={onTogglePause}
        aria-label={isPaused ? "Resume" : "Pause"}
      >
        <i class="fa {isPaused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"
        ></i>
      </button>

      <button
        class="btn-snapshot"
        onclick={onTakeSnapshot}
        aria-label="Take Snapshot"
      >
        <i class="fa fa-camera" aria-hidden="true"></i>
      </button>

      <button
        class="btn-stop"
        onclick={onStopRecording}
        aria-label="Stop Recording"
      >
        <i class="fa fa-stop" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Current prop indicator -->
  <div class="prop-indicator">
    <span class="prop-badge">{propType}</span>
  </div>
</div>

<style>
  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
    background: var(--theme-panel-elevated-bg);
    box-shadow: var(--theme-panel-shadow, 0 12px 28px rgba(0, 0, 0, 0.35));
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-top: 1px solid var(--theme-stroke);
  }

  .main-controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .main-controls button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .main-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-record {
    width: 72px !important;
    height: 72px !important;
    background: linear-gradient(
      135deg,
      var(--semantic-error),
      var(--semantic-error)
    );
    color: white;
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
  }

  .btn-record:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
  }

  .btn-pause {
    background: linear-gradient(135deg, var(--semantic-warning), #d97706);
    color: white;
  }

  .btn-snapshot {
    background: linear-gradient(135deg, var(--semantic-info), #2563eb);
    color: white;
  }

  .btn-stop {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 22%,
      var(--theme-panel-elevated-bg)
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 35%,
        var(--theme-stroke, var(--theme-card-bg))
      );
    color: var(--theme-text);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  .btn-settings {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text-dim);
    font-size: 1.1rem;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .btn-settings:hover {
    background: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .prop-indicator {
    display: flex;
    align-items: center;
  }

  .prop-badge {
    padding: 0.4rem 0.875rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 20%,
      transparent
    );
    border-radius: 20px;
    font-size: 0.85rem;
    color: var(--theme-accent);
    text-transform: capitalize;
  }

  @media (min-width: 1024px) {
    .controls-bar {
      display: none;
    }
  }
</style>
