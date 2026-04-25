<!--
  ExportVideoDrawer.svelte

  Unified Download Animation panel with collapsible sections. Works on
  mobile and desktop with a single shared section stack:

  - Mobile (layout="bottom"): gear trigger + download button at bottom.
    Tapping gear opens a RailBentoSheet with the full scrollable stack.
  - Desktop (layout="sidebar"): scrollable stack fills the sidebar;
    download button pinned in the footer.

  Sections: Effects (expanded default) → Effort → Playback → Display → Export.
  Collapsible headers show summary badges when collapsed.
-->
<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import "./bento/rail-tile.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import RailBentoSheet from "./bento/RailBentoSheet.svelte";
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

  // ── Section expansion state ──
  type SectionId = "effects" | "effort" | "playback" | "display" | "export";
  let expandedSections = $state<Set<SectionId>>(new Set(["effects"]));

  function toggleSection(id: SectionId): void {
    const next = new Set(expandedSections);
    next.has(id) ? next.delete(id) : next.add(id);
    expandedSections = next;
  }

  // Mobile sheet state
  let mobileSheetOpen = $state(false);
  let settingsButtonEl: HTMLButtonElement | undefined = $state();

  function openMobileSheet(): void {
    mobileSheetOpen = true;
  }

  function closeMobileSheet(): void {
    mobileSheetOpen = false;
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

  const slideDuration = $derived(reduceMotion ? 0 : 200);

  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (target.isContentEditable) return;
    event.preventDefault();
  }

  // ── Keyboard nav between section headers ──
  function onSectionKeydown(event: KeyboardEvent): void {
    const headers = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(".section-header"),
    );
    const idx = headers.indexOf(event.target as HTMLButtonElement);
    if (idx < 0) return;

    let next: number | null = null;
    if (event.key === "ArrowDown") next = (idx + 1) % headers.length;
    else if (event.key === "ArrowUp") next = (idx - 1 + headers.length) % headers.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = headers.length - 1;

    if (next !== null) {
      event.preventDefault();
      headers[next]?.focus();
    }
  }

  // ── Reactive bridge to animation visibility manager ──
  const vm = getAnimationVisibilityManager();
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

  // ── Section summaries (reuse pure functions from pill-summaries.ts) ──
  const effectsSummary = $derived.by(() => {
    void vmVersion;
    return computeEffectsSummary(vm.getActiveEffect(), EFFECT_LABELS);
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

  // ── Section definitions ──
  interface SectionDef {
    id: SectionId;
    icon: string;
    label: string;
    summary: string;
    accentColor?: string;
  }

  const sections = $derived<SectionDef[]>([
    { id: "effects",  icon: "fa-sparkles",      label: "Effects",  summary: effectsSummary },
    { id: "effort",   icon: "fa-gauge",          label: "Effort",   summary: effortSummary, accentColor: effortAccent },
    { id: "playback", icon: "fa-play",           label: "Playback", summary: playbackSummary },
    { id: "display",  icon: "fa-eye",            label: "Display",  summary: displaySummary },
    { id: "export",   icon: "fa-sliders",        label: "Export",   summary: exportSummary },
  ]);

  // ── SR announcer ──
  let lastToggledSection = $state("");
  function announceSectionToggle(id: SectionId, expanded: boolean): void {
    const sec = sections.find((s) => s.id === id);
    lastToggledSection = sec
      ? `${sec.label} ${expanded ? "expanded" : "collapsed"}`
      : "";
  }
</script>

{#snippet sectionStack()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="section-stack" onkeydown={onSectionKeydown}>
    {#each sections as sec (sec.id)}
      <section class="collapsible-section">
        <button
          class="section-header"
          aria-expanded={expandedSections.has(sec.id)}
          aria-label={expandedSections.has(sec.id) ? `Collapse ${sec.label}` : `Expand ${sec.label}`}
          onclick={() => {
            toggleSection(sec.id);
            announceSectionToggle(sec.id, expandedSections.has(sec.id));
          }}
        >
          <i
            class="fas {sec.icon} section-icon"
            aria-hidden="true"
            style={sec.accentColor ? `color: ${sec.accentColor}` : ""}
          ></i>
          <span class="section-label">{sec.label}</span>
          <span
            class="section-badge"
            style={sec.accentColor ? `color: ${sec.accentColor}` : ""}
          >{sec.summary}</span>
          <i
            class="fas fa-chevron-down section-chevron"
            class:rotated={!expandedSections.has(sec.id)}
            aria-hidden="true"
          ></i>
        </button>

        {#if expandedSections.has(sec.id)}
          <div
            class="section-body"
            transition:slide={{ duration: slideDuration }}
          >
            {#if sec.id === "effects"}
              {#if layout === "bottom"}
                <MobileEffectsPanel />
              {:else}
                <EffectsPanel
                  {bpm}
                  onBpmChange={onBpmChange ?? (() => {})}
                  {isPlaying}
                  onPlaybackToggle={onPlaybackToggle ?? (() => {})}
                  showPlayback={!!(onPlaybackToggle && onBpmChange)}
                />
              {/if}
            {:else if sec.id === "effort"}
              <div class="section-pad">
                <EffortPanel />
              </div>
            {:else if sec.id === "playback"}
              <div class="section-pad">
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
              </div>
            {:else if sec.id === "display"}
              <div class="section-pad">
                <div class="rt-section" role="region" aria-labelledby="display-visibility-label">
                  <span class="rt-section-label" id="display-visibility-label">Visibility</span>
                  <DisplayPanel />
                </div>
                <div class="rt-section" role="region" aria-labelledby="display-paths-label">
                  <span class="rt-section-label" id="display-paths-label">Motion paths</span>
                  <PathShapePanel />
                </div>
              </div>
            {:else if sec.id === "export"}
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
                  <div class="rt-chip-row">
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
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  </div>
{/snippet}

<!-- SR announcer -->
<span class="sr-only" aria-live="polite" aria-atomic="true">
  {lastToggledSection}
</span>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: settings trigger + download button at bottom;
       sheet opens with the full section stack.
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
      {#if mobileSheetOpen}
        <RailBentoSheet
          title="Settings"
          onClose={closeMobileSheet}
          returnFocusTo={settingsButtonEl}
        >
          {@render sectionStack()}
        </RailBentoSheet>
      {/if}

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="mobile-bar" onkeydown={preventSpaceActivation}>
        <button
          type="button"
          class="mobile-settings-btn"
          onclick={openMobileSheet}
          bind:this={settingsButtonEl}
          aria-label="Open animation settings"
        >
          <i class="fas fa-sliders" aria-hidden="true"></i>
          Settings
        </button>

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
       DESKTOP SIDEBAR: scrollable section stack + pinned footer.
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: reduceMotion ? 0 : 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel-scroll" onkeydown={preventSpaceActivation}>
      {@render sectionStack()}
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
{/if}

<style>
  /* ============================================================
   * COLLAPSIBLE SECTION STACK
   * ============================================================ */

  .section-stack {
    display: flex;
    flex-direction: column;
  }

  .collapsible-section {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text, white);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    transition: background 120ms ease;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .section-header:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    border-radius: 2px;
  }

  .section-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
  }

  .section-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .section-badge {
    flex: 1;
    text-align: right;
    font-size: 11px;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 8px;
  }

  .section-chevron {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    flex-shrink: 0;
    transition: transform 200ms ease;
  }

  .section-chevron.rotated {
    transform: rotate(-90deg);
  }

  .section-body {
    overflow: hidden;
  }

  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 16px 16px;
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
    gap: 8px;
    padding: 8px 10px 10px;
  }

  .mobile-settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    padding: 10px 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .mobile-settings-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .mobile-settings-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
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
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
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

  .video-duration-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    padding: 4px 0;
  }

  .video-duration-line i {
    font-size: 11px;
    opacity: 0.6;
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
    .section-header,
    .section-chevron,
    .export-btn,
    .cancel-btn,
    .progress-fill,
    .mobile-settings-btn {
      transition: none !important;
      animation: none !important;
    }

    .export-btn:active {
      transform: none !important;
    }

    .section-chevron.rotated {
      transform: rotate(-90deg);
    }
  }

  @media (forced-colors: active) {
    .section-header:focus-visible {
      outline: 2px solid Highlight;
    }
  }

  @media (prefers-contrast: more) {
    .collapsible-section {
      border-bottom-width: 2px;
    }

    .section-badge {
      color: var(--theme-text, white);
    }
  }
</style>
