<!--
  ExportVideoDrawer.svelte

  Video export settings panel.
  Desktop (sidebar): all settings visible in side panel.
  Mobile (bottom): compact bottom bar with [Play] [Export] [Settings gear].
    Settings open in a slide-up overlay. Animation gets full screen space.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type {
    ExportOptionsStateManager,
    VideoFps,
    VideoResolution,
  } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
  import "./bento/rail-tile.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import { onDestroy } from "svelte";

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
    playbackMode?: PlaybackMode;
    onPlaybackToggle?: () => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
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
    playbackMode = "continuous",
    onPlaybackToggle,
    onPlaybackModeChange,
    onBpmChange,
    onExport,
    onCancel,
  }: Props = $props();

  const exportButtonLabel = $derived(renderMode === '3d' ? 'Record Scene' : 'Download Animation');

  // Which sub-sheet is currently open in the mobile bento layout. Null = none.
  type SheetId = "effects" | "effort" | "playback" | "export";
  let openSheet = $state<SheetId | null>(null);
  function toggleSheet(id: SheetId) {
    openSheet = openSheet === id ? null : id;
  }
  function closeSheet() {
    openSheet = null;
  }

  // Reactive bridge to the animation visibility manager — drives the Effort
  // tile label/color and the Effects tile count badge.
  const vm = getAnimationVisibilityManager();
  let vmVersion = $state(0);
  function onVmChanged(): void { vmVersion++; }
  vm.registerObserver(onVmChanged);
  onDestroy(() => vm.unregisterObserver(onVmChanged));

  const activeEffort = $derived.by(() => {
    void vmVersion;
    const id = vm.getEffortPreset();
    const match = EFFORTS.find((e) => e.id === id);
    // EFFORTS is a non-empty readonly array; fall back to "linear" as a safety net.
    return match ?? EFFORTS[0] ?? { id: "linear", label: "Linear", subtitle: "", color: "#94a3b8", params: [] };
  });

  const effectsCount = $derived.by(() => {
    void vmVersion;
    const map = vm.getTipEffectMap();
    return Object.values(map).filter((a) => a?.effect && a.effect !== "none").length;
  });

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

  /** Total video duration: one beat for each enabled hold + motion × loops. Matches the
   *  timeline in VideoExportOrchestrator so the label agrees with the exported file. */
  const totalVideoDuration = $derived.by(() => {
    if (singlePlayDuration <= 0) return "";
    const unitSeconds = bpm > 0 ? 60 / bpm : 0;
    const startHold = exportOptions.videoIncludeStartPosition ? unitSeconds : 0;
    const endHold = exportOptions.videoIncludeEndHold ? unitSeconds : 0;
    const total = startHold + singlePlayDuration * exportOptions.videoLoopCount + endHold;
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
       MOBILE: Bento grid. Canvas stays visible. Sub-sheets open
       over the bottom of the canvas when a primary tile is tapped.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
      <!-- Progress replaces the bento during export -->
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
      {#if openSheet === "effects"}
        <RailBentoSheet title="Effects" onClose={closeSheet}>
          <MobileEffectsPanel />
        </RailBentoSheet>
      {:else if openSheet === "effort"}
        <RailBentoSheet title="Effort" onClose={closeSheet}>
          <EffortPanel />
        </RailBentoSheet>
      {:else if openSheet === "playback"}
        <RailBentoSheet title="Playback" onClose={closeSheet}>
          <div class="rt-section">
            <span class="rt-section-label">Tempo</span>
            <TempoControl
              {bpm}
              onBpmChange={onBpmChange ?? (() => {})}
              showPresets={false}
              showPractice={false}
              presetsMode="popover"
            />
          </div>

          {#if onPlaybackModeChange}
            <div class="rt-section">
              <span class="rt-section-label">Mode</span>
              <PlaybackModeToggle
                {playbackMode}
                {isPlaying}
                {onPlaybackModeChange}
                onPlaybackToggle={onPlaybackToggle ?? (() => {})}
              />
            </div>
          {/if}

          <div class="rt-section">
            <span class="rt-section-label">Timing</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoIncludeStartPosition}
                onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
              >
                <i class="fas fa-step-backward" aria-hidden="true"></i> Start Hold
              </button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoIncludeEndHold}
                onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
              >
                <i class="fas fa-step-forward" aria-hidden="true"></i> End Hold
              </button>
            </div>
          </div>
        </RailBentoSheet>
      {:else if openSheet === "export"}
        <RailBentoSheet title="Export" onClose={closeSheet}>
          <div class="rt-section">
            <span class="rt-section-label">Frame rate</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoFps === 30}
                onclick={() => exportOptions.setVideoFps(30)}
              >30 fps</button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoFps === 60}
                onclick={() => exportOptions.setVideoFps(60)}
              >60 fps</button>
            </div>
          </div>

          <div class="rt-section">
            <span class="rt-section-label">Resolution</span>
            <div class="rt-chip-row">
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoResolution === 720}
                onclick={() => exportOptions.setVideoResolution(720)}
              >{renderMode === '3d' ? '720×720' : '720p'}</button>
              <button
                type="button"
                class="rt-chip"
                aria-pressed={exportOptions.videoResolution === 1080}
                onclick={() => exportOptions.setVideoResolution(1080)}
              >{renderMode === '3d' ? '1080×1080' : '1080p'}</button>
            </div>
          </div>

          {#if renderMode === '3d'}
            <div class="rt-section">
              <span class="rt-section-label">Quality</span>
              <div class="rt-chip-row">
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={exportOptions.videoQuality === 'standard'}
                  onclick={() => exportOptions.setVideoQuality('standard')}
                >Standard</button>
                <button
                  type="button"
                  class="rt-chip"
                  aria-pressed={exportOptions.videoQuality === 'cinema'}
                  onclick={() => exportOptions.setVideoQuality('cinema')}
                >
                  <i class="fas fa-film" aria-hidden="true"></i> Cinema
                </button>
              </div>
            </div>
          {/if}

          <div class="rt-row">
            <span class="rt-row-label">Loops</span>
            <div class="rt-stepper">
              <button
                type="button"
                class="rt-step-btn"
                onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
                disabled={exportOptions.videoLoopCount <= 1}
                aria-label="Decrease loop count"
              >
                <i class="fas fa-minus" aria-hidden="true"></i>
              </button>
              <span class="rt-val">{exportOptions.videoLoopCount}×</span>
              <button
                type="button"
                class="rt-step-btn"
                onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
                disabled={exportOptions.videoLoopCount >= 10}
                aria-label="Increase loop count"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {#if timeEstimateLabel}
            <div class="video-duration-line">
              <i class="fas fa-clock" aria-hidden="true"></i>
              {timeEstimateLabel}
            </div>
          {/if}
          {#if totalVideoDuration}
            <div class="video-duration-line">
              <i class="fas fa-film" aria-hidden="true"></i>
              Video length: {totalVideoDuration}
            </div>
          {/if}
        </RailBentoSheet>
      {/if}

      <!-- Primary bento grid -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="rt-zone"
        onkeydown={preventSpaceActivation}
        role="group"
        aria-label="Animation export settings"
      >
        <div class="rt-grid-2x2">
          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "effects"}
            onclick={() => toggleSheet("effects")}
          >
            <i class="fas fa-sparkles rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Effects</span>
            {#if effectsCount > 0}
              <span class="rt-count">{effectsCount}</span>
            {/if}
          </button>

          <button
            type="button"
            class="rt-tile rt-effort"
            style:--effort-color={activeEffort.color}
            aria-pressed={openSheet === "effort"}
            onclick={() => toggleSheet("effort")}
          >
            <span class="rt-val">{activeEffort.label}</span>
            <span class="rt-lbl">Effort</span>
          </button>

          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "playback"}
            onclick={() => toggleSheet("playback")}
          >
            <i class="fas fa-play rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Playback</span>
          </button>

          <button
            type="button"
            class="rt-tile"
            aria-pressed={openSheet === "export"}
            onclick={() => toggleSheet("export")}
          >
            <i class="fas fa-sliders rt-icon" aria-hidden="true"></i>
            <span class="rt-lbl">Export</span>
          </button>
        </div>

        <button
          type="button"
          class="rt-download"
          onclick={onExport}
          disabled={exportDisabled}
          aria-label={exportButtonLabel}
        >
          {#if !canvasReady}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Preparing export...
          {:else}
            <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
            {exportButtonLabel}
          {/if}
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

      {#if onPlaybackModeChange}
        <div class="setting-row">
          <span class="setting-label">Playback</span>
          <PlaybackModeToggle
            {playbackMode}
            {isPlaying}
            onPlaybackModeChange={onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          />
        </div>
      {/if}

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

      {#if renderMode === '3d'}
        <div class="setting-row">
          <span class="setting-label">Quality</span>
          <div class="chip-group">
            <button
              type="button"
              class="chip"
              class:active={exportOptions.videoQuality === 'standard'}
              onclick={() => exportOptions.setVideoQuality('standard')}
              aria-pressed={exportOptions.videoQuality === 'standard'}
              title="One render per frame. Fastest export."
            >
              Standard
            </button>
            <button
              type="button"
              class="chip"
              class:active={exportOptions.videoQuality === 'cinema'}
              onclick={() => exportOptions.setVideoQuality('cinema')}
              aria-pressed={exportOptions.videoQuality === 'cinema'}
              title="2× supersampling + 4× motion blur. ~4-8× slower, noticeably smoother and sharper."
            >
              <i class="fas fa-film" aria-hidden="true" style="margin-right: 0.35em;"></i>
              Cinema
            </button>
          </div>
        </div>
      {/if}

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
              Preparing export...
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
    z-index: 10;
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
    .chip,
    .export-btn,
    .cancel-btn,
    .progress-fill {
      transition: none !important;
      animation: none !important;
    }

    .chip:active,
    .export-btn:active {
      transform: none !important;
    }
  }

</style>
