<script lang="ts">
  /**
   * RecordScenePlaybackPopover
   *
   * Playback-domain settings for the 3D Record Scene chrome.
   * Opens from a play-triangle button in the top-right overlay bar.
   *
   * Dividing question: "Does this change what I can see or hear right now?"
   * Yes = lives here. So BPM, playback mode, FPS (which determines preview
   * smoothness as well as capture cadence).
   */

  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type {
    ExportOptionsStateManager,
    VideoFps,
  } from "../../state/export-options-state.svelte";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    bpm: number;
    isPlaying: boolean;
    playbackMode: PlaybackMode;
    onBpmChange: (bpm: number) => void;
    onPlaybackToggle: () => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
  }

  let {
    exportOptions,
    bpm,
    isPlaying,
    playbackMode,
    onBpmChange,
    onPlaybackToggle,
    onPlaybackModeChange,
  }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const fpsOptions: { value: VideoFps; label: string }[] = [
    { value: 30, label: "30" },
    { value: 60, label: "60" },
    { value: 120, label: "120" },
  ];

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }

  function handleBpmInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const next = Number(el.value);
    if (!Number.isFinite(next)) return;
    onBpmChange(Math.max(20, Math.min(240, Math.round(next))));
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="popover-root" bind:this={rootEl}>
  <button
    type="button"
    class="trigger"
    class:active={open}
    onclick={toggleOpen}
    aria-label="Playback settings"
    aria-expanded={open}
    aria-haspopup="true"
    title="Playback"
  >
    <i class="fas fa-play" aria-hidden="true"></i>
    <span class="trigger-label">Playback</span>
  </button>

  {#if open}
    <div
      class="popover"
      role="dialog"
      aria-label="Playback settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") open = false;
      }}
      in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
      out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <div class="row">
        <span class="row-label">BPM</span>
        <div class="bpm-control">
          <button
            type="button"
            class="stepper-btn"
            onclick={() => onBpmChange(Math.max(20, bpm - 5))}
            aria-label="Decrease BPM"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <input
            type="number"
            class="bpm-input"
            min="20"
            max="240"
            value={bpm}
            onchange={handleBpmInput}
            aria-label="BPM"
          />
          <button
            type="button"
            class="stepper-btn"
            onclick={() => onBpmChange(Math.min(240, bpm + 5))}
            aria-label="Increase BPM"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="row">
        <span class="row-label">Mode</span>
        <PlaybackModeToggle
          {playbackMode}
          {isPlaying}
          {onPlaybackModeChange}
          {onPlaybackToggle}
        />
      </div>

      <div class="row">
        <span class="row-label">FPS</span>
        <div class="chip-group">
          {#each fpsOptions as opt}
            <button
              type="button"
              class="chip"
              class:active={exportOptions.videoFps === opt.value}
              onclick={() => exportOptions.setVideoFps(opt.value)}
              aria-pressed={exportOptions.videoFps === opt.value}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .popover-root {
    position: relative;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-min, 13px);
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .trigger:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.95);
  }

  .trigger.active {
    background: rgba(139, 139, 255, 0.2);
    border-color: rgba(139, 139, 255, 0.35);
    color: #fff;
  }

  .trigger i {
    font-size: 11px;
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    width: 280px;
    padding: 12px;
    border-radius: 12px;
    transform-origin: top right;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 36px;
  }

  .row-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .bpm-control {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: background 150ms ease;
  }

  .stepper-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .stepper-btn i {
    font-size: 10px;
  }

  .bpm-input {
    width: 52px;
    height: 28px;
    padding: 0 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    font-size: var(--font-size-min, 13px);
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .bpm-input::-webkit-inner-spin-button,
  .bpm-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .chip-group {
    display: inline-flex;
    gap: 4px;
  }

  .chip {
    min-height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chip:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .chip.active {
    background: rgba(139, 139, 255, 0.25);
    border-color: rgba(139, 139, 255, 0.45);
    color: #fff;
  }
</style>
