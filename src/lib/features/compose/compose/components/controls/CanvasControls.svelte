<script lang="ts">
  /**
   * CanvasControls - Bottom control bar for composition canvas
   *
   * Provides:
   * - Play/Pause/Stop playback controls
   * - Preview mode toggle (static/live)
   * - BPM control (+/- buttons)
   * - Layout picker
   * - Templates button
   */

  import { getCompositionState } from "../../state/composition-state.svelte";
  import { LAYOUT_PRESETS, type LayoutPresetKey, type GridLayout } from "$lib/shared/animation-engine/domain/compose-types";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";

  // Renamed to avoid conflict with $state rune
  const compState = getCompositionState();

  // Reactive bindings
  const isPlaying = $derived(compState.isPlaying);
  const isPreviewing = $derived(compState.isPreviewing);
  const bpm = $derived(compState.bpm);
  const canPlay = $derived(compState.canPlay);
  const layout = $derived(compState.composition.layout);
  const isSaving = $derived(compState.isSaving);
  const compositionName = $derived(compState.composition.name);

  // Current layout key
  const currentLayoutKey = $derived(
    ((Object.entries(LAYOUT_PRESETS) as [LayoutPresetKey, GridLayout][]).find(
      ([_, preset]) =>
        preset.rows === layout.rows && preset.cols === layout.cols
    )?.[0] ?? "custom") as LayoutPresetKey | "custom"
  );

  // Layout dropdown state
  let showLayoutDropdown = $state(false);

  function handlePlayPause() {
    compState.togglePlayPause();
  }

  function handleStop() {
    compState.stop();
  }

  function handlePreviewToggle() {
    compState.togglePreview();
  }

  function handleBpmChange(newBpm: number) {
    compState.setBpm(newBpm);
  }

  function handleLayoutChange(key: LayoutPresetKey) {
    const preset = LAYOUT_PRESETS[key];
    compState.setLayout(preset);
    showLayoutDropdown = false;
  }

  function handleOpenTemplates() {
    compState.openTemplates();
  }

  function handleFullscreen() {
    compState.enterFullscreen();
  }

  async function handleSave() {
    try {
      await compState.saveComposition();
    } catch (error) {
      console.error("Failed to save composition:", error);
    }
  }

  function handlePointerDownOutside(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".layout-picker")) {
      showLayoutDropdown = false;
    }
  }
</script>

<svelte:window onpointerdown={handlePointerDownOutside} />

<div class="canvas-controls">
  <!-- Row 1: Playback + Preview + Layout/Templates -->
  <div class="control-row top-row">
    <!-- Playback Controls -->
    <div class="control-group playback-controls">
      <button
        class="control-btn play-btn"
        class:playing={isPlaying}
        onclick={handlePlayPause}
        disabled={!canPlay}
        title={isPlaying ? "Pause" : "Play"}
        aria-label={isPlaying ? "Pause playback" : "Start playback"}
      >
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
        ></i>
      </button>

      <button
        class="control-btn stop-btn"
        onclick={handleStop}
        disabled={!isPlaying}
        title="Stop"
        aria-label="Stop playback"
      >
        <i class="fas fa-stop" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Preview Toggle -->
    <div class="control-group preview-group">
      <button
        class="control-btn preview-toggle"
        class:active={isPreviewing}
        onclick={handlePreviewToggle}
        title={isPreviewing ? "Switch to static" : "Switch to live preview"}
        aria-label="Toggle preview mode"
        aria-pressed={isPreviewing}
      >
        <i
          class="fas {isPreviewing ? 'fa-eye' : 'fa-eye-slash'}"
          aria-hidden="true"
        ></i>
        <span class="preview-label">{isPreviewing ? "Live" : "Static"}</span>
      </button>
    </div>

    <!-- Layout & Templates -->
    <div class="control-group config-controls">
      <!-- Layout Picker -->
      <div class="layout-picker">
        <button
          class="control-btn layout-btn"
          onclick={() => (showLayoutDropdown = !showLayoutDropdown)}
          title="Change grid layout"
          aria-label="Change grid layout"
          aria-expanded={showLayoutDropdown}
          aria-controls="layout-dropdown-menu"
        >
          <i class="fas fa-th" aria-hidden="true"></i>
          <span>{layout.rows}×{layout.cols}</span>
          <i class="fas fa-chevron-down" aria-hidden="true"></i>
        </button>

        {#if showLayoutDropdown}
          <div class="dropdown layout-dropdown" id="layout-dropdown-menu">
            {#each Object.entries(LAYOUT_PRESETS) as [key, preset] (key)}
              {@const p = preset as GridLayout}
              <button
                class="dropdown-item"
                class:active={currentLayoutKey === key}
                onclick={() => handleLayoutChange(key as LayoutPresetKey)}
              >
                <span class="layout-preview">
                  {#each Array(p.rows) as _, row}
                    <span class="layout-row">
                      {#each Array(p.cols) as _, col}
                        <span class="layout-cell"></span>
                      {/each}
                    </span>
                  {/each}
                </span>
                <span>{p.rows}×{p.cols}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Templates Button -->
      <button
        type="button"
        class="control-btn templates-btn"
        onclick={handleOpenTemplates}
        title="Browse templates"
        aria-label="Open templates"
      >
        <i class="fas fa-magic" aria-hidden="true"></i>
        <span class="templates-label">Templates</span>
      </button>

      <!-- Save Button -->
      <button
        type="button"
        class="control-btn save-btn"
        onclick={handleSave}
        disabled={isSaving || !canPlay}
        title={isSaving ? "Saving..." : `Save "${compositionName}"`}
        aria-label={isSaving ? "Saving composition" : "Save composition"}
      >
        {#if isSaving}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-save" aria-hidden="true"></i>
        {/if}
        <span class="save-label">{isSaving ? "Saving" : "Save"}</span>
      </button>

      <!-- Fullscreen Button -->
      <button
        class="control-btn fullscreen-btn"
        onclick={handleFullscreen}
        title="Enter fullscreen"
        aria-label="Enter fullscreen mode"
      >
        <i class="fas fa-expand" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <!-- Row 2: BPM Control -->
  <div class="control-row bpm-row">
    <BpmChips {bpm} onBpmChange={handleBpmChange} />
  </div>
</div>

<style>
  .canvas-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
    padding: clamp(6px, 1.5cqi, 12px) clamp(10px, 2cqi, 20px);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(6px, 2cqi, 14px);
    container-type: inline-size;
    container-name: controls;
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(8px, 2cqi, 20px);
  }

  .bpm-row {
    width: 100%;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: clamp(2px, 1cqi, 8px);
  }

  /* Control buttons - 48px minimum touch target */
  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    min-height: var(--min-touch-target);
    padding: clamp(8px, 2cqi, 14px) clamp(10px, 2.5cqi, 18px);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: clamp(4px, 1.5cqi, 10px);
    color: rgba(255, 255, 255, 0.85);
    font-size: clamp(0.75rem, 2.5cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .control-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn i {
    font-size: 1em;
  }

  /* Play button - 48px minimum */
  .play-btn {
    background: rgba(16, 185, 129, 0.3);
    border-color: rgba(16, 185, 129, 0.5);
    min-width: var(--min-touch-target);
  }

  .play-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.5);
    border-color: rgba(16, 185, 129, 0.7);
  }

  .play-btn.playing {
    background: rgba(245, 158, 11, 0.3);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .play-btn.playing:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.5);
    border-color: rgba(245, 158, 11, 0.7);
  }

  /* Preview toggle */
  .preview-toggle.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .preview-toggle.active:hover {
    background: rgba(59, 130, 246, 0.5);
    border-color: rgba(59, 130, 246, 0.7);
  }

  /* Templates button */
  .templates-btn {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .templates-btn:hover {
    background: rgba(139, 92, 246, 0.4);
    border-color: rgba(139, 92, 246, 0.6);
  }

  /* Fullscreen button */
  .fullscreen-btn {
    min-width: var(--min-touch-target);
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke-strong);
  }

  .fullscreen-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
  }

  /* Layout Dropdown */
  .layout-picker {
    position: relative;
  }

  .layout-dropdown {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: clamp(6px, 1.5cqi, 12px);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: clamp(6px, 1.5cqi, 10px);
    padding: clamp(3px, 1cqi, 6px);
    box-shadow: var(
      --theme-shadow,
      0 clamp(6px, 1.5cqi, 12px) clamp(24px, 6cqi, 40px) rgba(0, 0, 0, 0.5)
    );
    z-index: 100;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(3px, 1cqi, 6px);
    min-width: clamp(140px, 35cqi, 200px);
  }

  /* Dropdown items - 48px minimum touch target */
  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px);
    background: transparent;
    border: 1px solid transparent;
    border-radius: clamp(4px, 1cqi, 8px);
    color: rgba(255, 255, 255, 0.8);
    font-size: clamp(0.8rem, 2.5cqi, 0.9rem);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .dropdown-item.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
  }

  /* Layout preview in dropdown */
  .layout-preview {
    display: flex;
    flex-direction: column;
    gap: clamp(1px, 0.5cqi, 3px);
  }

  .layout-row {
    display: flex;
    gap: clamp(1px, 0.5cqi, 3px);
  }

  .layout-cell {
    width: clamp(6px, 2cqi, 10px);
    height: clamp(6px, 2cqi, 10px);
    background: rgba(255, 255, 255, 0.4);
    border-radius: clamp(1px, 0.3cqi, 3px);
  }

  /* Save button */
  .save-btn {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .save-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.4);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .save-btn:disabled {
    opacity: 0.5;
  }

  /* Labels hidden on small containers */
  .preview-label,
  .templates-label,
  .save-label {
    display: none;
  }

  @container controls (min-width: 500px) {
    .preview-label,
    .templates-label,
    .save-label {
      display: inline;
    }
  }

  /* Focus indicators */
  .control-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(59, 130, 246, 0.8));
    outline-offset: 2px;
  }

  .dropdown-item:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(59, 130, 246, 0.8));
    outline-offset: -2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-btn,
    .dropdown-item {
      transition: none;
    }

    .control-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
