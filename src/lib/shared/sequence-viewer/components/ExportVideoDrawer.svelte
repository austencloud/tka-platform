<!--
  ExportVideoDrawer.svelte

  Unified 5-pill Download Animation panel. Works identically on mobile and
  desktop, with a single shared template:

  - Mobile (layout="bottom"): pill row + download button at the bottom of
    the canvas. Tapping a pill opens a bento sheet over the canvas.
  - Desktop (layout="sidebar"): pill row at the top of the sidebar; the
    active pill's body renders inline below; download button in the footer.

  Effects / Effort / Playback / Display / Export — five pills cover the
  full surface. Loops + Timing live in Export (they describe the output
  video file), Playback pill covers in-canvas preview behavior only.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";
  // NOTE: VideoFps / VideoResolution are no longer imported — the new pill
  // body calls setVideoFps(30|60|120) and setVideoResolution(720|1080|2160|4320)
  // with literal arguments (widened automatically to the union at the call
  // site), so the types have no remaining consumer in this file. Keeping
  // them would surface as a `no-unused-vars` lint warning.
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import "./bento/rail-tile.css";
  import "./pill-nav/pill-nav.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import DownloadPillNav from "./pill-nav/DownloadPillNav.svelte";
  import PillBody from "./pill-nav/PillBody.svelte";
  import { type PillId, type PillSpec, buildPillSpecs } from "./pill-nav/pill-types";
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

  // Mobile: null = no sheet open. Desktop: always has one pill active.
  // A one-shot $state(layout === ...) initializer would only fire at
  // component init — if the parent flips layout without remounting,
  // desktop would render with no active pill, OR mobile would inherit an
  // already-open sheet from a previous desktop state. The $effect below
  // repairs both directions.
  let activePillId = $state<PillId | null>(layout === "sidebar" ? "effects" : null);
  $effect(() => {
    if (layout === "sidebar" && activePillId === null) {
      activePillId = "effects";
    } else if (layout === "bottom" && activePillId !== null) {
      // On a sidebar→bottom flip, close the sheet — otherwise a
      // desktop-selected pill would pop open as a modal on mobile.
      activePillId = null;
    }
  });

  // Track the nav root + the last-activated pill ID so we can restore
  // focus when the mobile sheet closes. We intentionally store the ID,
  // not the HTMLButtonElement — on layout flip DownloadPillNav remounts
  // with a fresh DOM root, and any cached element reference would point
  // at a detached node. Re-querying via the live pillNavEl each time
  // avoids that class of silent focus loss.
  let pillNavEl: HTMLDivElement | null = $state(null);
  function findPillButton(id: PillId | null): HTMLButtonElement | null {
    if (!id || !pillNavEl) return null;
    return pillNavEl.querySelector<HTMLButtonElement>(`[data-pill-id="${id}"]`);
  }
  let lastActivatedPillId: PillId | null = $state(null);

  // Honor prefers-reduced-motion for the panel's entrance/exit fade
  // transitions below. Initialize synchronously in the $state initializer
  // — transition:fade reads its options at mount time, BEFORE onMount
  // runs. An onMount-deferred read would let the first panel entrance
  // animate at full duration even for users who have reduced-motion on.
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

  function selectPill(id: PillId): void {
    if (layout === "bottom") {
      // Mobile toggles the sheet; tapping the active pill closes it.
      const wasOpen = activePillId === id;
      activePillId = wasOpen ? null : id;
      // Capture the activating pill id so the sheet can restore focus on
      // close. Do NOT null-out when closing — the sheet's unmount cleanup
      // reads this AFTER closePill runs, and we need the id to remain
      // valid across that gap. Overwritten on next selectPill.
      if (!wasOpen) lastActivatedPillId = id;
    } else {
      // Desktop is always-on; tapping the active pill is a no-op.
      activePillId = id;
    }
  }

  function closePill(): void {
    if (layout === "bottom") {
      activePillId = null;
      // Intentionally do NOT clear lastActivatedPillId here — the sheet's
      // unmount cleanup reads returnFocusTo AFTER this function returns,
      // and returnFocusTo is derived from lastActivatedPillId below.
    }
  }

  // Reactive bridge to the animation visibility manager — drives all the
  // pill summaries that depend on VM state.
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

  // ── Pill summaries — recomputed when vmVersion ticks or props change ──
  // Each helper is a pure function from pill-summaries.ts; the $derived
  // wrapper threads the reactive inputs through it. The legacy effectsCount
  // stat (count of non-none entries in tipEffectMap) is removed — the
  // default map is { "*": { effect: "trails" } } so a count of 1 vs 0 never
  // reflected any user action. Active-effect name is the truthful state.

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

  /** Export pill shows resolution + fps + loop count. Loops live in Export
   *  because they describe the OUTPUT video, not the preview playback
   *  (Playback pill controls in-canvas behavior only). */
  const exportSummary = $derived(
    computeExportSummary({
      resolution: exportOptions.videoResolution,
      fps: exportOptions.videoFps,
      loopCount: exportOptions.videoLoopCount,
      renderMode: renderMode === "3d" ? "3d" : "2d",
    }),
  );

  /** PillSpec map keyed by PillId. Compiler enforces every PillId has a
   *  spec — adding to PILL_ORDER without updating this object fails the
   *  type check, so no runtime drift guard is needed.
   *
   *  Note: "export" is quoted defensively. JS / TS allow reserved words as
   *  object literal keys, but some lint configs (e.g. strict
   *  no-restricted-syntax rules) flag unquoted reserved words in property
   *  positions. Quoting is unambiguous in every config. */
  const pills = $derived<PillSpec[]>(
    buildPillSpecs({
      effects:    { label: "EFFECTS",  icon: "fa-sparkles",   summary: effectsSummary },
      effort:     { label: "EFFORT",   summary: effortSummary, accentColor: effortAccent },
      playback:   { label: "PLAYBACK", icon: "fa-play",       summary: playbackSummary },
      display:    { label: "DISPLAY",  icon: "fa-eye",        summary: displaySummary },
      "export":   { label: "EXPORT",   icon: "fa-sliders",    summary: exportSummary },
    }),
  );

  /** Label used by the visually-hidden aria-live announcer below.
   *  Announces "<pill> settings" on pill change — a short, meaningful status
   *  message, NOT the full pill body subtree. */
  const activePillAnnouncement = $derived.by(() => {
    if (activePillId === null) return "";
    const spec = pills.find((p) => p.id === activePillId);
    if (!spec) {
      // activePillId should always be an element of PILL_ORDER (the $effect
      // above only assigns known ids), but an HMR-introduced drift between
      // PILL_ORDER and the local pills Record could produce this state.
      // Warn in dev so the drift surfaces instead of the SR announcer
      // silently going empty.
      console.warn("[ExportVideoDrawer] no pill spec for activePillId:", activePillId);
      return "";
    }
    return `${spec.label} settings`;
  });

  /**
   * Prevent Space-initiated page scroll when focus is on a non-interactive
   * descendant of the export panel. Critically, do NOT preventDefault when
   * the focused element is a button/input/textarea/select — Space on those
   * elements is meant to activate the control, and preventDefault on the
   * bubbled keydown blocks that activation.
   */
  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (target.isContentEditable) return;
    event.preventDefault();
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
</script>

{#snippet pillBody()}
  {#if activePillId === "effects"}
    <!-- EffectsPanel manages its own .sb-section padding/borders;
         render it flat without a wrapping .pill-inline-pad. -->
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
  {:else if activePillId === "effort"}
    <div class="pill-inline-pad">
      <EffortPanel />
    </div>
  {:else if activePillId === "playback"}
    <!-- Playback = how the canvas previews the sequence: tempo + mode.
         Loops and start/end hold belong in Export because they describe
         the OUTPUT video, not in-canvas playback. -->
    <div class="pill-inline-pad">
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
  {:else if activePillId === "display"}
    <!-- role="region" (not "group") — these are named content landmarks,
         not form-control groups. NVDA/JAWS announce "region" without the
         "grouping of form controls" connotation that "group" triggers. -->
    <div class="pill-inline-pad">
      <div class="rt-section" role="region" aria-labelledby="display-visibility-label">
        <span class="rt-section-label" id="display-visibility-label">Visibility</span>
        <DisplayPanel />
      </div>
      <div class="rt-section" role="region" aria-labelledby="display-paths-label">
        <span class="rt-section-label" id="display-paths-label">Motion paths</span>
        <PathShapePanel />
      </div>
    </div>
  {:else if activePillId === "export"}
    <div class="pill-inline-pad">
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

      <div class="rt-row">
        <span class="rt-row-label">Loops</span>
        <div class="rt-stepper">
          <button
            type="button"
            class="rt-step-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
          ><i class="fas fa-minus" aria-hidden="true"></i></button>
          <span class="rt-val">{exportOptions.videoLoopCount}×</span>
          <button
            type="button"
            class="rt-step-btn"
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
{/snippet}

<!-- Visually-hidden live-region announcer. Updates to a short "<pill>
     settings" string when the user switches pills, giving screen-reader
     users a meaningful status message without dumping the whole new panel
     subtree (which an aria-live on .pill-body-inline would). Mounted once
     above the layout branches so it persists across layout flips. -->
<span class="sr-only" aria-live="polite" aria-atomic="true">
  {activePillAnnouncement}
</span>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: pill row + download button at bottom; sheet pops up
       over the canvas when a pill is active.
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
      {#if activePillId !== null}
        <PillBody
          title={pills.find((p) => p.id === activePillId)?.label ?? ""}
          variant="mobile"
          onClose={closePill}
          returnFocusTo={findPillButton(lastActivatedPillId)}
        >
          {@render pillBody()}
        </PillBody>
      {/if}

      <!-- Interaction wrapper — no redundant role="group"/aria-label here;
           the enclosing .mobile-export already declares
           role="region" aria-label="Animation export", and nesting a second
           labelled landmark underneath produces duplicated SR announcements
           (NVDA/JAWS read "Animation export ... Animation export"). -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="rt-zone" onkeydown={preventSpaceActivation}>
        <DownloadPillNav
          {pills}
          activeId={activePillId}
          onSelect={selectPill}
          variant="mobile"
          onNavMount={(el) => (pillNavEl = el)}
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
       DESKTOP SIDEBAR: pill row at top, body inline, download in footer.
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: reduceMotion ? 0 : 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel-body" onkeydown={preventSpaceActivation}>
      <DownloadPillNav
        {pills}
        activeId={activePillId}
        onSelect={selectPill}
        variant="desktop"
        onNavMount={(el) => (pillNavEl = el)}
      />

      <PillBody
        title={pills.find((p) => p.id === activePillId)?.label ?? ""}
        variant="desktop"
      >
        {@render pillBody()}
      </PillBody>
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

  /* Desktop body becomes a vertical flex container: pill nav row at top,
     PillBody fills remaining space and scrolls internally. */
  .panel-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 12px;
    padding: 12px;
  }

  /* Wrapper used by inline pill bodies (everything except Effects).
     Effects renders its own .sb-section padding, so it skips this wrapper. */
  :global(.pill-body-inline .pill-inline-pad) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .video-duration-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    /* Fallback matches the dark-theme calculator's canonical textDim (0.75α
       — 7:1 on panel-bg). The earlier 0.5α fallback composited to ~5.2:1,
       below AAA for 12px body text when the theme variable is briefly
       unset (SSR first paint, a custom theme without textDim, test
       harnesses without the theme provider). */
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
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
    /* See .video-duration-line rationale — 0.75α matches the canonical
       dark-theme textDim so the fallback clears AAA (7:1) instead of the
       prior 5.2:1 when the theme variable is briefly unset. */
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

  /* Progress (shared between mobile + desktop) */
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
    /* 0.75α matches the dark-theme calculator's canonical textDim (7:1 on
       panel-bg). The prior 0.6α fallback composited to ~6.5:1 — above AA
       but below AAA for 12px body text. Raising for consistency with the
       .video-duration-line / .time-estimate hygiene from Round 4 item 37. */
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
    /* See .progress-stage — 0.75α keeps the fallback lane at AAA for
       consistency across the panel's dimmed-text roles. */
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
