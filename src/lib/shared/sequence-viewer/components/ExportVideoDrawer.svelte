<!--
  ExportVideoDrawer.svelte

  Unified Download Animation panel with pill-nav section switcher.

  - Mobile (layout="bottom"): pill bar + download button at bottom.
    Tapping a pill opens a RailBentoSheet with that section's body.
  - Desktop (layout="sidebar"): pill bar at top, active section body
    in scrollable area, download button pinned in footer.

  Sections: Effects → Effort → Playback → Display → Export.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import "./bento/rail-tile.css";
  import "./pill-nav/pill-nav.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { EFFORTS } from "$lib/shared/effort/domain/effort-types";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
  import DownloadPillNav from "./pill-nav/DownloadPillNav.svelte";
  import IconRailNav from "./pill-nav/IconRailNav.svelte";
  import PillBody from "./pill-nav/PillBody.svelte";
  import { buildPillSpecs, type PillId } from "./pill-nav/pill-types";
  import {
    computeDisplaySummary,
    computeEffectsSummary,
    computePlaybackSummary,
    computeExportSummary,
  } from "./pill-nav/pill-summaries";
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

  // ── Active pill state ──
  let activePill = $state<PillId | null>("effects");
  let panelDirection = $state(1);

  function handlePillSelect(id: PillId): void {
    if (layout === "bottom") {
      activePill = activePill === id ? null : id;
    } else {
      const prevIdx = pillSpecs.findIndex((p) => p.id === activePill);
      const nextIdx = pillSpecs.findIndex((p) => p.id === id);
      if (prevIdx !== -1 && nextIdx !== -1) {
        panelDirection = nextIdx > prevIdx ? 1 : -1;
      }
      activePill = id;
    }
  }

  let pillNavEl = $state<HTMLElement | null>(null);
  let panelScrollEl = $state<HTMLElement | null>(null);
  let mobileBarEl = $state<HTMLElement | null>(null);

  function findPillButton(id: PillId): HTMLElement | null {
    return pillNavEl?.querySelector<HTMLElement>(`[data-pill-id="${id}"]`) ?? null;
  }

  // Honor prefers-reduced-motion
  let reduceMotion = $state(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  $effect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => { reduceMotion = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  function attachSpaceGuard(el: HTMLElement | null) {
    if (!el) return;
    el.addEventListener("keydown", preventSpaceActivation);
    return () => el.removeEventListener("keydown", preventSpaceActivation);
  }
  $effect(() => attachSpaceGuard(panelScrollEl));
  $effect(() => attachSpaceGuard(mobileBarEl));

  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (target.isContentEditable) return;
    event.preventDefault();
  }

  // ── Reactive bridge to animation visibility manager ──
  const vm = getAnimationVisibilityManager();
  let effectsConfigState: ReturnType<typeof getEffectsConfigContext> | null = null;
  try {
    effectsConfigState = getEffectsConfigContext();
  } catch {
    // Context may not be available in all host environments
  }
  let vmVersion = $state(0);
  function onVmChanged(): void { vmVersion++; }
  vm.registerObserver(onVmChanged);
  onDestroy(() => vm.unregisterObserver(onVmChanged));

  const activeEffort = $derived.by(() => {
    void vmVersion;
    const id = vm.getEffortPreset();
    const match = EFFORTS.find((e) => e.id === id);
    return match ?? EFFORTS[0] ?? { id: "linear", label: "Linear", subtitle: "", color: "#94a3b8", params: [] };
  });

  // ── Section summaries ──
  const effectsSummary = $derived.by(() => {
    void vmVersion;
    const activeEffect = effectsConfigState?.activeEffect ?? "none";
    return computeEffectsSummary(activeEffect, EFFECT_LABELS);
  });

  const effortSummary = $derived(activeEffort.label);
  const effortAccent = $derived(activeEffort.color);

  const playbackSummary = $derived.by(() => {
    void vmVersion;
    return computePlaybackSummary(bpm, vm.getPlaybackMode());
  });

  const displaySummary = $derived.by(() => {
    void vmVersion;
    const s = vm.getSettings();
    return computeDisplaySummary(
      {
        tkaGlyph: s.tkaGlyph,
        stepNumbers: s.stepNumbers,
        beatPosition: s.beatPosition,
        props: s.props,
        wordHeader: s.wordHeader,
        progressBar: s.progressBar,
        grid: vm.isGridVisible(),
      },
      vm.getPathShape(),
    );
  });

  const exportSummary = $derived(
    computeExportSummary({
      resolution: exportOptions.videoResolution,
      fps: exportOptions.videoFps,
      loopCount: exportOptions.videoLoopCount,
      renderMode: renderMode === "3d" ? "3d" : "2d",
    }),
  );

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

  const totalVideoDuration = $derived.by(() => {
    if (singlePlayDuration <= 0) return "";
    const unitSeconds = bpm > 0 ? 60 / bpm : 0;
    const startHold = exportOptions.videoIncludeStartPosition ? unitSeconds : 0;
    const endHold = exportOptions.videoIncludeEndHold ? unitSeconds : 0;
    const total = startHold + singlePlayDuration * exportOptions.videoLoopCount + endHold;
    return formatDuration(total);
  });

  // ── Pill specs ──
  const pillSpecs = $derived(
    buildPillSpecs({
      effects:  { icon: "fa-wand-magic-sparkles",  label: "Effects",  summary: effectsSummary },
      effort:   { label: "Effort",   summary: effortSummary, accentColor: effortAccent },
      playback: { icon: "fa-play",      label: "Playback", summary: playbackSummary },
      display:  { icon: "fa-eye",       label: "Display",  summary: displaySummary },
      export:   { icon: "fa-sliders",   label: "Export",   summary: exportSummary },
    }),
  );

  const activePillLabel = $derived(
    pillSpecs.find((p) => p.id === activePill)?.label ?? "",
  );

  // ── SR announcer ──
  let lastAnnouncement = $state("");
  $effect(() => {
    if (activePillLabel) {
      lastAnnouncement = `${activePillLabel} settings`;
    }
  });
</script>

{#snippet pillBody()}
  {#if activePill === "effects"}
    <EffectsPanel
      layout={layout === "bottom" ? "strip" : "sidebar"}
      {bpm}
      onBpmChange={onBpmChange ?? (() => {})}
      {isPlaying}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      showPlayback={!!(onPlaybackToggle && onBpmChange)}
    />
  {:else if activePill === "effort"}
    <div class="section-pad">
      {#if layout === "sidebar"}
        <p class="section-hint">How each beat speeds up and slows down.</p>
      {/if}
      <EffortPanel columns={layout === "sidebar" ? 2 : 4} showSubtitles={layout === "sidebar"} />
    </div>
  {:else if activePill === "playback"}
    <div class="section-pad">
      <div class="rt-section">
        <span class="rt-section-label">Tempo</span>
        <TempoControl
          {bpm}
          onBpmChange={onBpmChange ?? (() => {})}
          showPresets={layout === "sidebar"}
          showPractice={false}
          presetsMode={layout === "sidebar" ? "inline" : "popover"}
          vertical={layout === "sidebar"}
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
            showDescriptions={layout === "sidebar"}
          />
        </div>
      {/if}
    </div>
  {:else if activePill === "display"}
    <div class="section-pad">
      <div class="rt-section" role="region" aria-labelledby="display-visibility-label">
        <span class="rt-section-label" id="display-visibility-label">Visibility</span>
        <DisplayPanel variant={layout === "sidebar" ? "rows" : "chips"} />
      </div>
      <div class="rt-section" role="region" aria-labelledby="display-paths-label">
        <span class="rt-section-label" id="display-paths-label">Motion paths</span>
        <PathShapePanel />
      </div>
    </div>
  {:else if activePill === "export"}
    <div class="section-pad">
      <div class="rt-section">
        <span class="rt-section-label">Frame rate</span>
        <div class="rt-chip-row">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 30}
            onclick={() => exportOptions.setVideoFps(30)}
          >30 fps</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 60}
            onclick={() => exportOptions.setVideoFps(60)}
          >60 fps</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 120}
            onclick={() => exportOptions.setVideoFps(120)}
          >120 fps</button>
        </div>
      </div>

      <div class="rt-section">
        <span class="rt-section-label">Resolution</span>
        <div class="rt-chip-row resolution-grid">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 720}
            onclick={() => exportOptions.setVideoResolution(720)}
          >{renderMode === '3d' ? '720×720' : '720p'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 1080}
            onclick={() => exportOptions.setVideoResolution(1080)}
          >{renderMode === '3d' ? '1080×1080' : '1080p'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 2160}
            onclick={() => exportOptions.setVideoResolution(2160)}
          >{renderMode === '3d' ? '2160×2160' : '4K'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 4320}
            onclick={() => exportOptions.setVideoResolution(4320)}
          >{renderMode === '3d' ? '4320×4320' : '8K'}</button>
        </div>
      </div>

      {#if renderMode === '3d'}
        <div class="rt-section">
          <span class="rt-section-label">Quality</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={exportOptions.videoQuality === 'standard'}
              onclick={() => exportOptions.setVideoQuality('standard')}
            >Standard</button>
            <button type="button" class="rt-chip"
              aria-pressed={exportOptions.videoQuality === 'cinema'}
              onclick={() => exportOptions.setVideoQuality('cinema')}
            ><i class="fas fa-film" aria-hidden="true"></i> Cinema</button>
          </div>
        </div>
      {/if}

      <div class="rt-section">
        <span class="rt-section-label">Timing</span>
        <div class="rt-chip-row">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoIncludeStartPosition}
            onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
          >
            <i class="fas fa-step-backward" aria-hidden="true"></i> Start Hold
          </button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoIncludeEndHold}
            onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
          >
            <i class="fas fa-step-forward" aria-hidden="true"></i> End Hold
          </button>
        </div>
      </div>

      <div class="rt-row">
        <span class="rt-row-label">Loops</span>
        <div class="rt-stepper">
          <button type="button" class="rt-step-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
          ><i class="fas fa-minus" aria-hidden="true"></i></button>
          <span class="rt-val">{exportOptions.videoLoopCount}×</span>
          <button type="button" class="rt-step-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase loop count"
          ><i class="fas fa-plus" aria-hidden="true"></i></button>
        </div>
      </div>

      {#if timeEstimateLabel || totalVideoDuration}
        <div class="export-summary-card">
          {#if totalVideoDuration}
            <div class="video-duration-line">
              <i class="fas fa-film" aria-hidden="true"></i>
              Video length: {totalVideoDuration}
            </div>
          {/if}
          {#if timeEstimateLabel}
            <div class="video-duration-line">
              <i class="fas fa-clock" aria-hidden="true"></i>
              Export time: {timeEstimateLabel}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<!-- SR announcer -->
<span class="sr-only" aria-live="polite" aria-atomic="true">
  {lastAnnouncement}
</span>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: pill bar + download button at bottom;
       tapping a pill opens a sheet with that section's body.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: reduceMotion ? 0 : 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
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
          <button type="button" class="cancel-btn" onclick={onCancel} aria-label="Cancel export">
            <i class="fas fa-times" aria-hidden="true"></i>
            Cancel
          </button>
        {/if}
      </div>
    {:else}
      {#if activePill}
        <PillBody
          title="{activePillLabel} Settings"
          variant="mobile"
          onClose={() => { activePill = null; }}
          returnFocusTo={findPillButton(activePill)}
        >
          {@render pillBody()}
        </PillBody>
      {/if}

      <div class="mobile-bar" bind:this={mobileBarEl}>
        <DownloadPillNav
          pills={pillSpecs}
          activeId={activePill}
          onSelect={handlePillSelect}
          variant="mobile"
          onNavMount={(el) => { pillNavEl = el; }}
        />

        <button
          type="button"
          class="rt-download"
          onclick={onExport}
          disabled={exportDisabled}
          aria-label={exportButtonLabel}
        >
          {#if !canvasReady}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Preparing...
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
       DESKTOP SIDEBAR: pill bar at top, active body scrollable,
       download button pinned in footer.
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: reduceMotion ? 0 : 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <div class="sidebar-rail-layout">
      <IconRailNav
        pills={pillSpecs}
        activeId={activePill}
        onSelect={handlePillSelect}
        onNavMount={(el) => { pillNavEl = el; }}
      />

      <div class="sidebar-main">
        <div
          class="panel-scroll"
          bind:this={panelScrollEl}
        >
          <div class="panel-content-center">
            {#if activePill}
              {#key activePill}
                <div
                  class="panel-transition"
                  in:fly={{ y: reduceMotion ? 0 : panelDirection * 24, duration: reduceMotion ? 0 : 200, delay: 60 }}
                  out:fly={{ y: reduceMotion ? 0 : panelDirection * -12, duration: reduceMotion ? 0 : 120 }}
                >
                  <h2 class="panel-title">{activePillLabel}</h2>
                  {@render pillBody()}
                </div>
              {/key}
            {/if}
          </div>
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
                <button type="button" class="cancel-btn" onclick={onCancel} aria-label="Cancel export">
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
    </div>
  </div>
{/if}

<style>
  /* ============================================================
   * PILL BAR CONTAINER (desktop top area)
   * ============================================================ */

  .sidebar-rail-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .sidebar-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 16px 16px;
  }

  .sidebar .section-pad {
    gap: 16px;
    padding: 8px 16px 20px;
  }

  .sidebar .resolution-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  /* ============================================================
   * MOBILE BOTTOM CONTAINER
   * ============================================================ */

  .mobile-export {
    position: relative;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 10;
  }

  .mobile-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 16px 12px;
  }

  .mobile-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px 10px;
  }

  /* ============================================================
   * DESKTOP SIDEBAR
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
    height: 100%;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }

  .panel-content-center {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  .panel-transition {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }

  .section-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    line-height: 1.4;
    margin: 0;
    padding: 0 8px;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    padding: 12px 16px 4px;
  }

  .panel-scroll::-webkit-scrollbar { width: 5px; }
  .panel-scroll::-webkit-scrollbar-track { background: transparent; }
  .panel-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  /* ============================================================
   * Shared: duration lines, footer, export button, progress
   * ============================================================ */

  .export-summary-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .video-duration-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    padding: 2px 0;
  }

  .video-duration-line i {
    font-size: 11px;
    opacity: 0.6;
    width: 14px;
    text-align: center;
  }

  .panel-footer {
    padding: 12px 16px 16px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
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

  @media (prefers-reduced-motion: reduce) {
    .export-btn,
    .cancel-btn,
    .progress-fill {
      transition: none !important;
      animation: none !important;
    }

    .export-btn:active {
      transform: none !important;
    }
  }
</style>
