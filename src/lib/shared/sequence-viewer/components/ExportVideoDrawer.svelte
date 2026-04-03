<!--
  ExportVideoDrawer.svelte

  Video export settings panel.
  Desktop (sidebar): all settings visible in side panel.
  Mobile (bottom): compact bottom bar with [Play] [Export] [Settings gear].
    Settings open in a slide-up overlay. Animation gets full screen space.
-->
<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type {
    ExportOptionsStateManager,
    VideoFps,
    VideoResolution,
  } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    isExporting: boolean;
    exportProgress?: VideoExportProgress | null;
    canvasReady?: boolean;
    layout?: PanelLayout;
    singlePlayDuration?: number;
    isPlaying?: boolean;
    bpm?: number;
    renderMode?: '2d' | '3d';
    onPlaybackToggle?: () => void;
    onBpmChange?: (bpm: number) => void;
    onExport: () => void;
    onCancel?: () => void;
  }

  let {
    exportOptions,
    isExporting,
    exportProgress = null,
    canvasReady = true,
    layout = "bottom",
    singlePlayDuration = 0,
    isPlaying = false,
    bpm = 60,
    renderMode = '2d',
    onPlaybackToggle,
    onBpmChange,
    onExport,
    onCancel,
  }: Props = $props();

  const exportButtonLabel = $derived(renderMode === '3d' ? 'Record Scene' : 'Download Animation');

  // Mobile settings drawer state
  let settingsOpen = $state(false);

  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
    }
  }

  const exportDisabled = $derived(isExporting || !canvasReady);

  function formatDuration(seconds: number): string {
    if (seconds <= 0) return "";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const estimatedTime = $derived.by(() => {
    if (singlePlayDuration <= 0) return null;
    return estimateExportTime(
      exportOptions.videoResolution,
      exportOptions.videoFps,
      singlePlayDuration,
      exportOptions.videoLoopCount
    );
  });

  const timeEstimateLabel = $derived.by(() => {
    if (estimatedTime === null) return "";
    const label = formatDuration(estimatedTime);
    if (!label) return "";
    const isEstimate = !hasDeviceMetrics(exportOptions.videoResolution);
    return isEstimate ? `~${label} est.` : `~${label}`;
  });

  const fpsOptions: { value: VideoFps; label: string; badge?: string }[] = [
    { value: 30, label: "30" },
    { value: 60, label: "60" },
    { value: 120, label: "120" },
  ];

  const resOptions: { value: VideoResolution; label: string }[] = [
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
    { value: 2160, label: "4K" },
    { value: 4320, label: "8K" },
  ];

  /** Total video duration at current BPM and loop count */
  const totalVideoDuration = $derived.by(() => {
    if (singlePlayDuration <= 0) return "";
    const total = singlePlayDuration * exportOptions.videoLoopCount;
    return formatDuration(total);
  });

  /** Resolution label with pixel dimensions for square (3D) exports */
  const resOptionsWithDims = $derived(
    resOptions.map((opt) => ({
      ...opt,
      label: renderMode === '3d' ? `${opt.value}x${opt.value}` : opt.label,
    }))
  );

  /** Summary of current settings for the bottom bar chip */
  const settingsSummary = $derived(
    `${exportOptions.videoResolution >= 2160 ? (exportOptions.videoResolution >= 4320 ? "8K" : "4K") : exportOptions.videoResolution + "p"} · ${exportOptions.videoFps}fps`
  );
</script>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Compact bottom bar + settings overlay
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
      <!-- Progress replaces the bar during export -->
      <div class="mobile-progress" role="status" aria-live="polite">
        <div class="progress-info">
          <span class="progress-stage">
            {#if !exportProgress}Starting...{:else}Exporting{/if}
          </span>
          <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
        </div>
        {#if onCancel}
          <button
            type="button"
            class="cancel-btn"
            onclick={onCancel}
            aria-label="Cancel export"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
            Cancel
          </button>
        {/if}
      </div>
    {:else}
      <!-- Inline settings (collapsible, no overlay) -->
      {#if settingsOpen}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="inline-settings"
          role="region"
          aria-label="Animation export settings"
          onkeydown={preventSpaceActivation}
          transition:slide={{ duration: 250, easing: cubicOut }}
        >
          <div class="inline-settings-header">
            <span class="inline-settings-title">Animation Settings</span>
            <button
              type="button"
              class="inline-settings-close"
              onclick={() => (settingsOpen = false)}
              aria-label="Close settings"
            >
              <i class="fas fa-chevron-down" aria-hidden="true"></i>
            </button>
          </div>

          <div class="inline-settings-body">
            <EffectsPanel
              bpm={bpm}
              onBpmChange={onBpmChange ?? (() => {})}
              {isPlaying}
              onPlaybackToggle={onPlaybackToggle ?? (() => {})}
              showPlayback={!!(onPlaybackToggle && onBpmChange)}
            />

            <!-- FPS -->
            <div class="setting-row">
              <span class="setting-label">FPS</span>
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
                    {#if opt.badge}
                      <span class="chip-badge">{opt.badge}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Resolution -->
            <div class="setting-row">
              <span class="setting-label">Resolution</span>
              <div class="chip-group">
                {#each resOptionsWithDims as opt}
                  <button
                    type="button"
                    class="chip"
                    class:active={exportOptions.videoResolution === opt.value}
                    onclick={() => exportOptions.setVideoResolution(opt.value)}
                    aria-pressed={exportOptions.videoResolution === opt.value}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Timing -->
            <div class="setting-row">
              <span class="setting-label">Timing</span>
              <div class="chip-group">
                <button
                  type="button"
                  class="chip"
                  class:active={exportOptions.videoIncludeStartPosition}
                  onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
                  aria-pressed={exportOptions.videoIncludeStartPosition}
                >
                  Start Pos
                </button>
                <button
                  type="button"
                  class="chip"
                  class:active={exportOptions.videoIncludeEndHold}
                  onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
                  aria-pressed={exportOptions.videoIncludeEndHold}
                >
                  End Hold
                </button>
              </div>
            </div>

            <!-- Loops -->
            <div class="setting-row">
              <span class="setting-label">Loops</span>
              <div class="loop-count-row">
                <button
                  type="button"
                  class="loop-btn"
                  onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
                  disabled={exportOptions.videoLoopCount <= 1}
                  aria-label="Decrease loop count"
                >
                  <i class="fas fa-minus" aria-hidden="true"></i>
                </button>
                <span class="loop-count-value">{exportOptions.videoLoopCount}x</span>
                <button
                  type="button"
                  class="loop-btn"
                  onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
                  disabled={exportOptions.videoLoopCount >= 10}
                  aria-label="Increase loop count"
                >
                  <i class="fas fa-plus" aria-hidden="true"></i>
                </button>
              </div>
            </div>

            {#if totalVideoDuration}
              <div class="video-duration-line">
                <i class="fas fa-film" aria-hidden="true"></i>
                Video length: {totalVideoDuration}
              </div>
            {/if}
          </div>

          {#if timeEstimateLabel}
            <div class="inline-settings-footer">
              <span class="time-estimate">{timeEstimateLabel}</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Bottom bar: [Play] [Download Animation] [Settings] -->
      <div class="mobile-bar">
        {#if onPlaybackToggle}
          <button
            type="button"
            class="bar-play-btn"
            class:playing={isPlaying}
            onclick={onPlaybackToggle}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
          </button>
        {/if}

        <button
          type="button"
          class="bar-export-btn"
          onclick={onExport}
          disabled={exportDisabled}
          aria-label={exportButtonLabel}
        >
          {#if !canvasReady}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Loading...
          {:else}
            <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
            {exportButtonLabel}
          {/if}
        </button>

        <button
          type="button"
          class="bar-settings-btn"
          class:active={settingsOpen}
          onclick={() => (settingsOpen = !settingsOpen)}
          aria-label="Export settings"
          aria-expanded={settingsOpen}
        >
          <i class="fas fa-cog {settingsOpen ? 'spin-active' : ''}" aria-hidden="true"></i>
          <span class="settings-summary">{settingsSummary}</span>
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: All settings visible (unchanged)
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel-body" onkeydown={preventSpaceActivation}>
      <EffectsPanel
        bpm={bpm}
        onBpmChange={onBpmChange ?? (() => {})}
        {isPlaying}
        onPlaybackToggle={onPlaybackToggle ?? (() => {})}
        showPlayback={!!(onPlaybackToggle && onBpmChange)}
      />

      <div class="setting-row">
        <span class="setting-label">FPS</span>
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
              {#if opt.badge}
                <span class="chip-badge">{opt.badge}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Resolution</span>
        <div class="chip-group">
          {#each resOptionsWithDims as opt}
            <button
              type="button"
              class="chip"
              class:active={exportOptions.videoResolution === opt.value}
              onclick={() => exportOptions.setVideoResolution(opt.value)}
              aria-pressed={exportOptions.videoResolution === opt.value}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Timing</span>
        <div class="chip-group">
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoIncludeStartPosition}
            onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
            aria-pressed={exportOptions.videoIncludeStartPosition}
          >
            Start Pos
          </button>
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoIncludeEndHold}
            onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
            aria-pressed={exportOptions.videoIncludeEndHold}
          >
            End Hold
          </button>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Loops</span>
        <div class="loop-count-row">
          <button
            type="button"
            class="loop-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="loop-count-value">{exportOptions.videoLoopCount}x</span>
          <button
            type="button"
            class="loop-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase loop count"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {#if totalVideoDuration}
        <div class="video-duration-line">
          <i class="fas fa-film" aria-hidden="true"></i>
          Video length: {totalVideoDuration}
        </div>
      {/if}
    </div>

    <div class="panel-footer">
      {#if isExporting}
        <div class="export-progress-row" role="status" aria-live="polite">
          <div class="progress-info">
            <span class="progress-stage">
              {#if !exportProgress}Starting...{:else}Exporting{/if}
            </span>
            <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
          </div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Export progress"
          >
            <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
          </div>
          {#if onCancel}
            <button
              type="button"
              class="cancel-btn"
              onclick={onCancel}
              aria-label="Cancel export"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
              Cancel
            </button>
          {/if}
        </div>
      {:else}
        <div class="export-row">
          <button
            type="button"
            class="export-btn"
            onclick={onExport}
            disabled={exportDisabled}
            aria-label={exportButtonLabel}
          >
            {#if !canvasReady}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Loading...
            {:else}
              <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
              {exportButtonLabel}
            {/if}
          </button>
          {#if timeEstimateLabel && !exportDisabled}
            <span class="time-estimate">{timeEstimateLabel}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ============================================================
   * MOBILE BOTTOM BAR
   * ============================================================ */

  .mobile-export {
    position: relative;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .mobile-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .bar-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    flex-shrink: 0;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    color: var(--theme-text, white);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-play-btn.playing {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
  }

  .bar-play-btn i {
    margin-left: 2px;
  }

  .bar-play-btn.playing i {
    margin-left: 0;
  }

  .bar-export-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .bar-export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .bar-export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .bar-settings-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 8px 12px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-settings-btn.active {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, white);
  }

  .bar-settings-btn i {
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .bar-settings-btn i.spin-active {
    transform: rotate(90deg);
  }

  .settings-summary {
    white-space: nowrap;
  }

  /* ============================================================
   * MOBILE INLINE SETTINGS (collapsible, no overlay)
   * ============================================================ */

  .inline-settings {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    overflow-y: auto;
    max-height: 35vh;
  }

  .inline-settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 4px;
  }

  .inline-settings-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .inline-settings-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .inline-settings-close:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .inline-settings-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 12px 8px;
  }

  .inline-settings-footer {
    padding: 0 12px 6px;
    text-align: center;
  }

  /* Compact shared controls within mobile inline settings */
  .inline-settings .setting-row {
    gap: 8px;
  }
  .inline-settings .setting-label {
    min-width: 56px;
  }
  .inline-settings .chip-group {
    gap: 6px;
  }
  .inline-settings .chip {
    min-height: 34px;
    padding: 4px 10px;
  }

  /* ============================================================
   * MOBILE PROGRESS
   * ============================================================ */

  .mobile-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 16px 12px;
  }

  /* ============================================================
   * DESKTOP SIDEBAR (unchanged)
   * ============================================================ */

  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  .export-panel.sidebar {
    position: relative;
    width: 100%;
    max-width: 100%;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
  }

  /* ============================================================
   * SHARED: Settings rows, chips, controls
   * ============================================================ */

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 16px;
    overflow-y: auto;
  }

  .sidebar .panel-body {
    gap: 20px;
    padding: 16px 16px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-label {
    min-width: 72px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  /* Loop count */
  .loop-count-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .loop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .loop-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .loop-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .loop-count-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    min-width: 28px;
    text-align: center;
    white-space: nowrap;
  }

  .video-duration-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 4px 0;
  }

  .video-duration-line i {
    font-size: 11px;
    opacity: 0.6;
  }

  /* ============================================================
   * Footer (desktop sidebar)
   * ============================================================ */

  .panel-footer {
    padding: 12px 20px 16px;
    flex-shrink: 0;
  }

  .export-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .time-estimate {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Progress (shared) */
  .export-progress-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-stage {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .progress-pct {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #f87171) 15%, transparent);
    border-color: var(--semantic-error, #f87171);
    color: var(--semantic-error, #f87171);
  }

  /* ============================================================
   * Reduced motion
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip, .bar-play-btn,
    .export-btn, .bar-export-btn, .bar-settings-btn,
    .cancel-btn, .progress-fill, .inline-settings-close {
      transition: none !important;
      animation: none !important;
    }

    .chip:active, .export-btn:active, .bar-export-btn:active {
      transform: none !important;
    }
  }

  .premium-nudge-wrapper {
    padding: 0.5rem 0;
  }
</style>
