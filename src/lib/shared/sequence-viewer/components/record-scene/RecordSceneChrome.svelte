<script lang="ts">
  import type { CameraChoreographyState } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "../../domain/viewer-control-analytics";

  interface Props {
    isExporting: boolean;
    canvasReady: boolean;
    onExport: () => void;
    choreography: CameraChoreographyState;
    onSettingChange?: ViewerControlSink;
  }

  let {
    isExporting,
    canvasReady,
    onExport,
    choreography,
    onSettingChange,
  }: Props = $props();

  const currentMode = $derived(
    choreography?.activePresetId === "auto-orbit" ? "auto-orbit" as const : "free" as const
  );

  const disabled = $derived(isExporting || !canvasReady);

  let showSettings = $state(false);
  let settingsEl: HTMLDivElement | null = $state(null);
  let gearBtnEl: HTMLButtonElement | null = $state(null);

  function handleModeSelect(mode: "free" | "auto-orbit") {
    const previous = currentMode;
    choreography?.setPresetId(mode);
    reportViewerControlChange(
      onSettingChange,
      "record_scene",
      "camera_mode",
      previous,
      mode
    );
    reportViewerControlChange(
      onSettingChange,
      "record_scene",
      "camera_settings_open",
      true,
      false,
      { count: false }
    );
    showSettings = false;
  }

  function toggleSettings(e: MouseEvent) {
    e.stopPropagation();
    const previous = showSettings;
    showSettings = !showSettings;
    reportViewerControlChange(
      onSettingChange,
      "record_scene",
      "camera_settings_open",
      previous,
      showSettings
    );
  }

  function handleOutsideClick(event: MouseEvent) {
    if (!showSettings) return;
    const target = event.target as HTMLElement;
    if (settingsEl && gearBtnEl && !settingsEl.contains(target) && !gearBtnEl.contains(target)) {
      showSettings = false;
      reportViewerControlChange(
        onSettingChange,
        "record_scene",
        "camera_settings_open",
        true,
        false,
        { count: false }
      );
    }
  }

  $effect(() => {
    if (showSettings) {
      const timer = setTimeout(() => {
        document.addEventListener("click", handleOutsideClick);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleOutsideClick);
      };
    }
    return undefined;
  });
</script>

<div class="chrome-root">
  <div class="bottom-right">
    <div class="record-pill">
      <button
        type="button"
        class="pill-record"
        class:disabled
        {disabled}
        onclick={onExport}
        aria-label={isExporting ? "Recording in progress" : !canvasReady ? "Preparing" : "Record scene"}
      >
        {#if !canvasReady}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>Preparing...</span>
        {:else if isExporting}
          <i class="fas fa-circle pulse" aria-hidden="true"></i>
          <span>Recording</span>
        {:else}
          <span class="dot" aria-hidden="true"></span>
          <span>Record Scene</span>
        {/if}
      </button>

      <div class="pill-divider"></div>

      <button
        bind:this={gearBtnEl}
        type="button"
        class="pill-settings"
        onclick={toggleSettings}
        aria-haspopup="true"
        aria-expanded={showSettings}
        aria-label="Recording camera mode: {currentMode === 'free' ? 'Free' : 'Orbit'}"
      >
        <i class="fas fa-gear" aria-hidden="true"></i>
      </button>

      {#if showSettings}
        <div bind:this={settingsEl} class="settings-popover" role="menu" aria-label="Camera mode">
          <button
            type="button"
            role="menuitem"
            class="settings-item"
            class:active={currentMode === "free"}
            onclick={() => handleModeSelect("free")}
          >
            <i class="fas fa-hand-paper" aria-hidden="true"></i>
            <span>Free Camera</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="settings-item"
            class:active={currentMode === "auto-orbit"}
            onclick={() => handleModeSelect("auto-orbit")}
          >
            <i class="fas fa-sync-alt" aria-hidden="true"></i>
            <span>Auto Orbit</span>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .chrome-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .bottom-right {
    position: absolute;
    display: flex;
    align-items: center;
    pointer-events: auto;
    bottom: 80px;
    right: 12px;
  }

  .record-pill {
    display: flex;
    align-items: stretch;
    position: relative;
    border-radius: 999px;
    background: linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.95) 0%,
      rgba(220, 38, 38, 0.95) 100%
    );
    border: 1px solid rgba(239, 68, 68, 0.55);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    overflow: visible;
  }

  .pill-settings {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    border-radius: 0 999px 999px 0;
    transition: color 150ms ease, background 150ms ease;
  }

  .pill-settings:hover {
    color: white;
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .pill-divider {
    width: 1px;
    margin: 10px 0;
    background: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .pill-record {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 20px;
    background: none;
    border: none;
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    border-radius: 999px 0 0 999px;
    transition: background 150ms ease;
  }

  .pill-record:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .pill-record:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .settings-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    min-width: 160px;
    background: rgba(18, 18, 28, 0.96);
    backdrop-filter: blur(20px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 10;
    animation: popoverUp 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes popoverUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .settings-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: var(--min-touch-target, 44px);
    padding: 0 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease;
    white-space: nowrap;
  }

  .settings-item i {
    width: 20px;
    text-align: center;
    font-size: 13px;
  }

  .settings-item:hover,
  .settings-item:focus {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: white;
    outline: none;
  }

  .settings-item.active {
    background: rgba(99, 102, 241, 0.18);
    color: white;
  }

  @media (max-width: 600px) {
    .bottom-right {
      bottom: 80px;
      right: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill-settings,
    .pill-record {
      transition: none;
    }
    .settings-popover {
      animation: none;
    }
    .pulse {
      animation: none;
    }
  }
</style>
