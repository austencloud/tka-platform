<!--
  AnimationPanel.svelte

  Unified animation export panel with pill-nav section switcher.

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
  import {
    estimateExportTime,
    hasDeviceMetrics,
  } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import "../bento/rail-tile.css";
  import "../pill-nav/pill-nav.css";
  import TempoControl from "./TempoControl.svelte";
  import PanelSpinner from "$lib/shared/components/panel/PanelSpinner.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { EFFORTS } from "$lib/shared/effort/domain/effort-types";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import IconRailNav from "../pill-nav/IconRailNav.svelte";
  import ControlDock, {
    type ControlDockTab,
    type ControlDockAction,
    type ControlDockLink,
  } from "$lib/shared/sequence-viewer/components/ControlDock.svelte";
  import {
    animationPillOrder,
    buildPillSpecs,
    resolveActivePill,
    type PillId,
  } from "../pill-nav/pill-types";
  import {
    loadActivePill,
    saveActivePill,
  } from "../state/active-pill-persistence";
  import {
    computeDisplaySummary,
    computeEffectsSummary,
    computePlaybackSummary,
    computeExportSummary,
    computePropsSummary,
  } from "../pill-nav/pill-summaries";
  import { onDestroy } from "svelte";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
    type ViewerControlValue,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    /** Export state. Omit (with onExport) for hosts without an export pipeline
     *  (e.g. the landing demo) — the Export pill and footer button disappear. */
    exportOptions?: ExportOptionsStateManager;
    isExporting: boolean;
    exportProgress?: VideoExportProgress | null;
    canvasReady?: boolean;
    layout?: PanelLayout;
    singlePlayDuration?: number;
    isPlaying?: boolean;
    bpm?: number;
    renderMode?: "2d" | "3d";
    playbackMode?: PlaybackMode;
    onPlaybackToggle?: () => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onBpmChange?: (bpm: number) => void;
    /** Hide tempo controls when the host follows a source duration instead of
     *  a sequence tempo. Path-shape controls remain available. */
    showTempoControls?: boolean;
    /** Hide the Effects section's inline playback row when the host already
     *  provides persistent playback controls beside the canvas. */
    showEffectsPlayback?: boolean;
    selectedPropType?: PropType;
    onPropChange?: (propType: PropType) => void;
    onExport?: () => void;
    onCancel?: () => void;
    secondaryActions?: (ControlDockLink | ControlDockAction)[];
    /** Render the panel's own inline export progress bar while exporting. Set
     *  false when the parent shows a full ExportTakeover over the canvas — the
     *  panel sits outside the takeover scrim, so its inline bar would be a second,
     *  redundant progress UI. Default true preserves standalone consumers. */
    showInlineExportProgress?: boolean;
    /** Show per-color prop visibility (Left/Right) chips in the Display section.
     *  Only surfaces WITHOUT a header motion-visibility control should set this
     *  (the landing spinner). Viewer/export already own Left/Right in their
     *  header, so they leave it false to avoid a duplicate. */
    showMotionVisibility?: boolean;
    /** Optional semantic sink. Existing hosts keep the same behavior when absent. */
    onSettingChange?: ViewerControlSink;
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
    renderMode = "2d",
    playbackMode = "continuous",
    onPlaybackToggle,
    onPlaybackModeChange,
    onBpmChange,
    showTempoControls = true,
    showEffectsPlayback = true,
    selectedPropType,
    onPropChange,
    onExport,
    onCancel,
    secondaryActions = [],
    showInlineExportProgress = true,
    showMotionVisibility = false,
    onSettingChange,
  }: Props = $props();

  const exportButtonLabel = $derived(
    renderMode === "3d" ? "Record Scene" : "Export Animation"
  );

  // Export is host-optional: both the state manager and the handler must be
  // wired for the Export pill, footer button, and dock trailing icon to render.
  const exportEnabled = $derived(!!exportOptions && !!onExport);

  // ── Active pill state ──
  // Desktop sidebar reopens to the last section (default Effects) for proper
  // persistence; mobile bottom sheet stays closed on mount.
  let activePill = $state<PillId | null>(
    layout === "sidebar" ? loadActivePill() : null
  );
  let panelDirection = $state(1);

  function handlePillSelect(id: PillId): void {
    const previous = resolvedPill;
    if (layout === "bottom") {
      activePill = previous === id ? null : id;
    } else {
      const prevIdx = pillSpecs.findIndex((p) => p.id === previous);
      const nextIdx = pillSpecs.findIndex((p) => p.id === id);
      if (prevIdx !== -1 && nextIdx !== -1) {
        panelDirection = nextIdx > prevIdx ? 1 : -1;
      }
      activePill = id;
    }
    reportViewerControlChange(
      onSettingChange,
      "animation_panel",
      "section",
      previous,
      activePill
    );
  }

  function reportSetting(
    group: string,
    setting: string,
    previousValue: ViewerControlValue,
    value: ViewerControlValue,
    coalesce = false
  ): void {
    reportViewerControlChange(
      onSettingChange,
      group,
      setting,
      previousValue,
      value,
      { coalesce }
    );
  }

  function setExportFps(value: 30 | 60 | 120): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoFps;
    exportOptions.setVideoFps(value);
    reportSetting("video_export", "fps", previous, value);
  }

  function setExportResolution(value: 720 | 1080 | 2160 | 4320): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoResolution;
    exportOptions.setVideoResolution(value);
    reportSetting("video_export", "resolution", previous, value);
  }

  function setExportQuality(value: "standard" | "cinema"): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoQuality;
    exportOptions.setVideoQuality(value);
    reportSetting("video_export", "quality", previous, value);
  }

  function setStartHold(value: boolean): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoIncludeStartPosition;
    exportOptions.setVideoIncludeStartPosition(value);
    reportSetting("video_export", "include_start_position", previous, value);
  }

  function setEndHold(value: boolean): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoIncludeEndHold;
    exportOptions.setVideoIncludeEndHold(value);
    reportSetting("video_export", "include_end_hold", previous, value);
  }

  function setLoopCount(value: number): void {
    if (!exportOptions) return;
    const previous = exportOptions.videoLoopCount;
    exportOptions.setVideoLoopCount(value);
    reportSetting("video_export", "loop_count", previous, value);
  }

  let pillNavEl = $state<HTMLElement | null>(null);
  let panelScrollEl = $state<HTMLElement | null>(null);

  // Honor prefers-reduced-motion
  let reduceMotion = $state(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  $effect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  function attachSpaceGuard(el: HTMLElement | null) {
    if (!el) return;
    el.addEventListener("keydown", preventSpaceActivation);
    return () => el.removeEventListener("keydown", preventSpaceActivation);
  }
  $effect(() => attachSpaceGuard(panelScrollEl));

  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (
      tag === "BUTTON" ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    )
      return;
    if (target.isContentEditable) return;
    event.preventDefault();
  }

  // ── Reactive bridge to animation visibility manager ──
  // Context-first so hosts with an ephemeral per-canvas manager (landing demo)
  // drive THAT instance; everywhere else falls through to the global singleton.
  const vm = getAnimationVisibilityContext() ?? getAnimationVisibilityManager();
  let effectsConfigState: ReturnType<typeof getEffectsConfigContext> | null =
    null;
  try {
    effectsConfigState = getEffectsConfigContext();
  } catch {
    // Context may not be available in all host environments
  }
  let vmVersion = $state(0);
  function onVmChanged(): void {
    vmVersion++;
  }
  vm.registerObserver(onVmChanged);
  onDestroy(() => vm.unregisterObserver(onVmChanged));

  const activeEffort = $derived.by(() => {
    void vmVersion;
    const id = vm.getEffortPreset();
    const match = EFFORTS.find((e) => e.id === id);
    return (
      match ??
      EFFORTS[0] ?? {
        id: "linear",
        label: "Linear",
        subtitle: "",
        color: "#94a3b8",
        params: [],
      }
    );
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
    return showTempoControls
      ? computePlaybackSummary(bpm, vm.getPlaybackMode())
      : "Path shape";
  });

  const displaySummary = $derived.by(() => {
    void vmVersion;
    const s = vm.getSettings();
    return computeDisplaySummary(
      {
        tkaGlyph: s.tkaGlyph,
        elementalGlyph: s.elementalGlyph,
        stepNumbers: s.stepNumbers,
        props: s.props,
        wordHeader: s.wordHeader,
        progressBar: s.progressBar,
        grid: vm.isGridVisible(),
      },
      vm.getPathShape()
    );
  });

  const propsSummary = $derived(
    computePropsSummary(
      selectedPropType ? getPropTypeDisplayInfo(selectedPropType).label : ""
    )
  );

  const exportSummary = $derived(
    exportOptions
      ? computeExportSummary({
          resolution: exportOptions.videoResolution,
          fps: exportOptions.videoFps,
          loopCount: exportOptions.videoLoopCount,
          renderMode: renderMode === "3d" ? "3d" : "2d",
        })
      : ""
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
    if (singlePlayDuration <= 0 || !exportOptions) return null;
    return estimateExportTime(
      exportOptions.videoResolution,
      exportOptions.videoFps,
      singlePlayDuration,
      exportOptions.videoLoopCount
    );
  });

  const timeEstimateLabel = $derived.by(() => {
    if (estimatedTime === null || !exportOptions) return "";
    const label = formatDuration(estimatedTime);
    if (!label) return "";
    const isEstimate = !hasDeviceMetrics(exportOptions.videoResolution);
    return isEstimate ? `~${label} est.` : `~${label}`;
  });

  const totalVideoDuration = $derived.by(() => {
    if (singlePlayDuration <= 0 || !exportOptions) return "";
    const unitSeconds = bpm > 0 ? 60 / bpm : 0;
    const startHold = exportOptions.videoIncludeStartPosition ? unitSeconds : 0;
    const endHold = exportOptions.videoIncludeEndHold ? unitSeconds : 0;
    const total =
      startHold + singlePlayDuration * exportOptions.videoLoopCount + endHold;
    return formatDuration(total);
  });

  // ── Pill specs ──
  // Effects leads the rail — it's the section users reach for most.
  // The sidebar collapses effort/playback/display into one Motion page; the
  // mobile dock keeps them as three trays. Membership still comes from
  // PILL_ORDER via buildPillSpecs, so the two orders cannot drift.
  // Merging is a property of the layout, not of the width. A width gate here
  // meant Post Studio's 419px inspector showed three pills while the sequence
  // viewer's 663px rail showed one Motion page in the same window — the two
  // surfaces disagreeing about what the panel even contains, which is the
  // drift this panel exists to prevent. Every sidebar merges; the @container
  // query below decides one column or two, which is a layout adaptation rather
  // than a different set of pages. A narrow rail scrolls the merged page
  // (`.panel-transition` is `overflow-y: auto`).
  const motionMerged = $derived(layout === "sidebar");

  const ANIMATION_PILL_ORDER = $derived(animationPillOrder(motionMerged));

  const pillSpecs = $derived(
    buildPillSpecs(
      {
        ...(onPropChange
          ? {
              props: {
                icon: "fa-paintbrush",
                label: "Props",
                summary: propsSummary,
              },
            }
          : {}),
        effects: {
          icon: "fa-wand-magic-sparkles",
          label: "Effects",
          summary: effectsSummary,
        },
        effort: {
          label: "Effort",
          summary: effortSummary,
          accentColor: effortAccent,
        },
        playback: {
          icon: "fa-play",
          label: "Playback",
          summary: playbackSummary,
        },
        display: { icon: "fa-eye", label: "Display", summary: displaySummary },
        // Effort alone, not effort + playback: the summary contract is ≤24
        // chars (pill-types.ts) and concatenating two live values blew past it
        // and changed width on every BPM tick, which is a shifting rail.
        // Effort is the one of the three whose value a user tracks, and it
        // carries the accent the rail glows with.
        motion: {
          icon: "fa-gauge-high",
          label: "Motion",
          summary: effortSummary,
          accentColor: effortAccent,
        },
        ...(exportEnabled
          ? {
              export: {
                icon: "fa-sliders",
                label: "Export",
                summary: exportSummary,
              },
            }
          : {}),
      },
      ANIMATION_PILL_ORDER
    )
  );

  // Persist the active section and keep it pointed at a section this host
  // actually exposes (e.g. a remembered "props" falls back to Effects where
  // there's no Props pill). Sidebar-only — see active-pill-persistence.
  // Resolving in a derived rather than an effect matters: the rail's membership
  // changes with layout and width at runtime (a shell that flips sidebar↔bottom
  // on resize, a remembered pill from before the Motion page existed), and an
  // effect corrects only after a frame has already rendered the missing
  // section. That frame put two copies of Visibility's label id in the document
  // during the crossfade, and left the mobile dock holding a tray with no tab.
  const availableIds = $derived(pillSpecs.map((p) => p.id));
  const resolvedPill = $derived(resolveActivePill(activePill, availableIds));

  // The effect reads pillSpecs (through resolvedPill), which recomputes on
  // every BPM tick and effect change, so an unguarded save wrote the same
  // string to localStorage on every control tweak.
  let savedPill: PillId | null = null;
  $effect(() => {
    if (!resolvedPill) return;
    // Write back so the rail, the dock and persistence agree on one id.
    if (activePill !== resolvedPill) activePill = resolvedPill;
    if (layout === "sidebar" && savedPill !== resolvedPill) {
      savedPill = resolvedPill;
      saveActivePill(resolvedPill);
    }
  });

  const activePillLabel = $derived(
    pillSpecs.find((p) => p.id === resolvedPill)?.label ?? ""
  );

  // ── Mobile ControlDock wiring ──
  // The pill specs become dock tabs; Export's trigger is the compact trailing
  // download icon, mirroring the mandala dock.
  const dockTabs = $derived<ControlDockTab[]>(
    pillSpecs.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
      accentColor: p.accentColor,
    }))
  );
  const dockTrailing = $derived<ControlDockAction | undefined>(
    exportEnabled && onExport
      ? {
          icon: renderMode === "3d" ? "fa-circle" : "fa-download",
          label: exportButtonLabel,
          onClick: onExport,
          disabled: exportDisabled,
          busy: !canvasReady,
        }
      : undefined
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
  {#if resolvedPill === "props" && onPropChange && selectedPropType !== undefined}
    {#await import("$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte")}
      <!-- Reserve space while the chunk loads so the body doesn't render
           as a blank slot and then jump when the grid arrives. -->
      <div class="pill-pending">
        <PanelSpinner />
      </div>
    {:then mod}
      <mod.default
        {selectedPropType}
        onSelect={onPropChange}
        variant="inline"
        flat={layout === "bottom"}
      />
    {/await}
  {:else if resolvedPill === "effects"}
    <EffectsPanel
      layout={layout === "bottom" ? "strip" : "sidebar"}
      {bpm}
      onBpmChange={onBpmChange ?? (() => {})}
      {isPlaying}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      showPlayback={!!(
        showEffectsPlayback &&
        showTempoControls &&
        onPlaybackToggle &&
        onBpmChange
      )}
      onSettingChange={(setting, previous, value, coalesce) =>
        reportSetting("effects", setting, previous, value, coalesce)}
    />
  {:else if resolvedPill === "effort"}
    {@render effortBody()}
  {:else if resolvedPill === "playback"}
    {@render playbackBody()}
  {:else if resolvedPill === "display"}
    {@render displayBody()}
  {:else if resolvedPill === "motion"}
    <!-- Effort, Playback and Display measured at 44% / 36% / 24% of the rail
         on their own, so the sidebar spent three pages to show three mostly
         empty columns. Stacked they fill it, and they read as one idea: how
         the motion behaves and what of it you can see. Effects and Props keep
         their own pages — those two fill the rail and Props overflows it.
         Sidebar only; the mobile dock still gets three separate tabs, where
         one tall merged tray would not fit. -->
    <div class="motion-scope">
      <!-- A host with its own transport bar owns tempo there and passes
           showTempoControls={false}; with no playback mode either, the left
           column has nothing to hold and the page runs as one column. -->
      <div
        class="motion-stack"
        class:single-col={!showTempoControls && !onPlaybackModeChange}
      >
        <!-- Paths goes to whichever column is short. Hosts that wire a
             playback mode give the left column Tempo + Mode, so Paths belongs
             under Visibility; hosts that don't (Post Studio, the /composer
             showcase) leave Tempo alone against Visibility's nine chips, and
             Paths evens them up instead. -->
        {#if showTempoControls || onPlaybackModeChange}
          <div class="motion-col">
            {@render tempoModeBody()}
            {#if !onPlaybackModeChange}
              {@render pathsBody()}
            {/if}
          </div>
        {/if}
        <div class="motion-col">
          {@render displayBody()}
          {#if onPlaybackModeChange || !showTempoControls}
            {@render pathsBody()}
          {/if}
        </div>
        {@render effortBody(true)}
      </div>
    </div>
  {:else if resolvedPill === "export" && exportOptions}
    {@render exportBody()}
  {/if}
{/snippet}

<!-- `labelled` is set only by the merged Motion page. On its own page the h2
     names the section and a label under it would say the same word twice; on
     the merged page Tempo, Mode and Visibility all carry one, and the effort
     tiles were the single unlabelled block under a heading named for something
     else. -->
{#snippet effortBody(labelled = false)}
  <div class="section-pad">
    {#if labelled}
      <span class="rt-section-label">Effort</span>
    {/if}
    {#if layout === "sidebar"}
      <p class="section-hint">How each beat speeds up and slows down.</p>
    {/if}
    <EffortPanel
      columns={layout === "sidebar" ? 2 : 4}
      showSubtitles={layout === "sidebar"}
      onSettingChange={(previous, value) =>
        reportSetting("effort", "preset", previous, value)}
    />
  </div>
{/snippet}

{#snippet playbackBody()}
  {@render tempoModeBody()}
  {@render pathsBody()}
{/snippet}

<!-- Split out of playbackBody so the merged Motion page can put Paths in the
     right-hand column under Visibility. Stacked all three in the left column,
     Tempo + Mode + Paths ran ~440px against Visibility's ~230px and left a
     column-height hole under it. On its own Playback page the two render back
     to back and read as one section, as before. -->
{#snippet tempoModeBody()}
  {#if showTempoControls || onPlaybackModeChange}
    <div class="section-pad playback-rows">
      {#if showTempoControls}
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
      {/if}
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
  {/if}
{/snippet}

<!-- Motion paths live with Playback, not Display: the shape changes how the
     props TRAVEL (prop-interpolator physics), a playback behavior — only the
     "Paths" chip in Display is visibility. PathShapePanel brings its own
     header row (label + live caption). -->
{#snippet pathsBody()}
  <div class="section-pad">
    <PathShapePanel
      onSettingChange={(previous, value) =>
        reportSetting("playback", "path_shape", previous, value)}
    />
  </div>
{/snippet}

{#snippet displayBody()}
  <div class="section-pad display-rows">
    <div
      class="rt-section"
      role="region"
      aria-labelledby="display-visibility-label"
    >
      <span class="rt-section-label" id="display-visibility-label"
        >Visibility</span
      >
      <DisplayPanel {showMotionVisibility} {onSettingChange} />
    </div>
  </div>
{/snippet}

{#snippet exportBody()}
  {#if exportOptions}
    <div class="section-pad export-fields">
      <div class="field">
        <span class="field-label">FPS</span>
        <div class="rt-chip-row">
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoFps === 30}
            onclick={() => setExportFps(30)}>30 fps</button
          >
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoFps === 60}
            onclick={() => setExportFps(60)}>60 fps</button
          >
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoFps === 120}
            onclick={() => setExportFps(120)}>120 fps</button
          >
        </div>
      </div>

      <div class="field">
        <span class="field-label">Res</span>
        <div class="rt-chip-row res-row">
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 720}
            onclick={() => setExportResolution(720)}
            >{renderMode === "3d" ? "720×720" : "720p"}</button
          >
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 1080}
            onclick={() => setExportResolution(1080)}
            >{renderMode === "3d" ? "1080×1080" : "1080p"}</button
          >
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 2160}
            onclick={() => setExportResolution(2160)}
            >{renderMode === "3d" ? "2160×2160" : "4K"}</button
          >
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 4320}
            onclick={() => setExportResolution(4320)}
            >{renderMode === "3d" ? "4320×4320" : "8K"}</button
          >
        </div>
      </div>

      {#if renderMode === "3d"}
        <div class="field">
          <span class="field-label">Quality</span>
          <div class="rt-chip-row">
            <button
              type="button"
              class="rt-chip"
              aria-pressed={exportOptions.videoQuality === "standard"}
              onclick={() => setExportQuality("standard")}>Standard</button
            >
            <button
              type="button"
              class="rt-chip"
              aria-pressed={exportOptions.videoQuality === "cinema"}
              onclick={() => setExportQuality("cinema")}
              ><i class="fas fa-film" aria-hidden="true"></i> Cinema</button
            >
          </div>
        </div>
      {/if}

      <div class="field">
        <span class="field-label">Timing</span>
        <div class="rt-chip-row">
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoIncludeStartPosition}
            onclick={() =>
              setStartHold(!exportOptions.videoIncludeStartPosition)}
          >
            <i class="fas fa-step-backward" aria-hidden="true"></i> Start Hold
          </button>
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoIncludeEndHold}
            onclick={() => setEndHold(!exportOptions.videoIncludeEndHold)}
          >
            <i class="fas fa-step-forward" aria-hidden="true"></i> End Hold
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Loops</span>
        <div class="rt-stepper">
          <button
            type="button"
            class="rt-step-btn"
            onclick={() => setLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
            ><i class="fas fa-minus" aria-hidden="true"></i></button
          >
          <span class="rt-val">{exportOptions.videoLoopCount}×</span>
          <button
            type="button"
            class="rt-step-btn"
            onclick={() => setLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase loop count"
            ><i class="fas fa-plus" aria-hidden="true"></i></button
          >
        </div>
      </div>

      {#if timeEstimateLabel || totalVideoDuration}
        <div class="export-meta">
          {#if totalVideoDuration}<span
              ><i class="fas fa-film" aria-hidden="true"></i>
              {totalVideoDuration}</span
            >{/if}
          {#if timeEstimateLabel}<span
              ><i class="fas fa-clock" aria-hidden="true"></i>
              {timeEstimateLabel}</span
            >{/if}
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
    {#if isExporting && showInlineExportProgress}
      <div class="mobile-progress" role="status" aria-live="polite">
        <div class="progress-info">
          <span class="progress-stage">
            {#if !exportProgress}Starting...{:else}Exporting{/if}
          </span>
          <span class="progress-pct"
            >{exportProgress
              ? Math.round(exportProgress.progress * 100)
              : 0}%</span
          >
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={exportProgress
            ? Math.round(exportProgress.progress * 100)
            : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div
            class="progress-fill"
            style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"
          ></div>
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
      <ControlDock
        tabs={dockTabs}
        activeTab={resolvedPill}
        onTabSelect={(id) => handlePillSelect(id as PillId)}
        trailingAction={dockTrailing}
        {secondaryActions}
        trayMaxHeight={resolvedPill === "effects"
          ? "min(54vh, 360px)"
          : "min(35vh, 250px)"}
      >
        {#snippet tray()}
          <div class="dock-dense">
            {@render pillBody()}
          </div>
        {/snippet}
      </ControlDock>
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
        activeId={resolvedPill}
        onSelect={handlePillSelect}
        onNavMount={(el) => {
          pillNavEl = el;
        }}
      />

      <div class="sidebar-main">
        <div class="panel-scroll" bind:this={panelScrollEl}>
          <div class="panel-content-center">
            {#if resolvedPill}
              {#key resolvedPill}
                <div
                  class="panel-transition"
                  in:fly={{
                    y: reduceMotion ? 0 : panelDirection * 24,
                    duration: reduceMotion ? 0 : 200,
                    delay: 60,
                  }}
                  out:fly={{
                    y: reduceMotion ? 0 : panelDirection * -12,
                    duration: reduceMotion ? 0 : 120,
                  }}
                >
                  <div class="panel-center-inner">
                    <h2 class="panel-title">{activePillLabel}</h2>
                    {@render pillBody()}
                  </div>
                </div>
              {/key}
            {/if}
          </div>
        </div>

        {#if exportEnabled}
          <div class="panel-footer">
            {#if isExporting && showInlineExportProgress}
              <div class="export-progress-row" role="status" aria-live="polite">
                <div class="progress-info">
                  <span class="progress-stage">
                    {#if !exportProgress}Starting...{:else}Exporting{/if}
                  </span>
                  <span class="progress-pct"
                    >{exportProgress
                      ? Math.round(exportProgress.progress * 100)
                      : 0}%</span
                  >
                </div>
                <div
                  class="progress-bar"
                  role="progressbar"
                  aria-valuenow={exportProgress
                    ? Math.round(exportProgress.progress * 100)
                    : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Export progress"
                >
                  <div
                    class="progress-fill"
                    style="width: {exportProgress
                      ? exportProgress.progress * 100
                      : 0}%"
                  ></div>
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
                    <i
                      class="fas {renderMode === '3d'
                        ? 'fa-circle'
                        : 'fa-download'}"
                      aria-hidden="true"
                    ></i>
                    {exportButtonLabel}
                  {/if}
                </button>
                {#if timeEstimateLabel && !exportDisabled}
                  <span class="time-estimate">{timeEstimateLabel}</span>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
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

  /* A container query cannot style its own container, so the stack gets a
     scope wrapper to measure and the grid rules land on the stack itself. */
  .motion-scope {
    container-name: motion-stack;
    container-type: inline-size;
  }

  /* The merged sections keep their own internal padding; the stack only
     supplies the rules between them, and opens the gap a little past the
     sections' own 20px so a rule reads as a divider rather than a boundary the
     content is crowding.

     One column below 528px, two above. The two `.motion-col` wrappers are the
     columns and in single-column mode they simply stack; Effort spans the
     stack under them either way. Wrappers rather than four grid items, because
     grid rows are shared: with Tempo, Mode, Visibility and Paths placed
     individually, the row holding Visibility stretched to Tempo + Mode's
     height and left a hole under it.

     Effort is last because it is the least self-explanatory thing here. Tempo
     and Visibility are controls anyone recognises on sight; Effort and Motion
     Paths are TKA concepts. Effort held the top slot at full width and was the
     tallest block on the page, so a rail that had to scroll spent its visible
     half on the one section a first-time viewer cannot read. */
  .motion-stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    column-gap: var(--spacing-md, 12px);
  }

  .motion-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .motion-stack > :global(.section-pad) {
    grid-column: 1 / -1;
    margin-top: 4px;
    padding-top: 20px;
    border-top: 1px solid var(--theme-stroke);
  }

  .motion-col > :global(.section-pad + .section-pad) {
    margin-top: 4px;
    padding-top: 20px;
    border-top: 1px solid var(--theme-stroke);
  }

  /* Stacked into one column, the second column follows the first rather than
     sitting beside it, so it needs the same rule its own siblings get. */
  @container motion-stack (max-width: 527.98px) {
    .motion-col + .motion-col > :global(.section-pad:first-child) {
      margin-top: 4px;
      padding-top: 20px;
      border-top: 1px solid var(--theme-stroke);
    }

    /* One column has no room to spend 8 subtitled tiles on the section a
       first-time viewer understands last. Four across in two rows instead of
       two across in four, without the descriptions: 386px down to ~150px,
       which is what keeps a 315px rail from scrolling. Both come back with the
       second column, where the room exists. */
    .motion-stack :global(.effort-sub) {
      display: none;
    }

    .motion-stack :global(.effort-btn.with-sub) {
      padding: 8px 4px;
      min-height: 40px;
    }

    .motion-stack :global(.effort-grid) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @container motion-stack (min-width: 528px) {
    .motion-stack:not(.single-col) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* Pending state for the lazy-loaded BentoPropGrid chunk. Fills the
     available body height (fixed in the dock tray) and reserves roughly a
     label + tile row otherwise, so the loaded grid doesn't shove siblings. */
  .pill-pending {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 140px;
  }

  /* Compact Export body: label-left rows instead of stacked sections. */
  .export-fields .field {
    display: grid;
    /* 64px fits the widest label ("QUALITY") at the 12px floor. */
    grid-template-columns: 64px 1fr;
    align-items: center;
    gap: 10px;
  }
  .export-fields .field-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .export-fields .rt-chip-row {
    display: flex;
    flex: 1;
    gap: 6px;
  }
  .export-fields .rt-chip-row.res-row {
    flex-wrap: wrap;
  }
  .export-fields .export-meta {
    display: flex;
    gap: 16px;
    /* Label column (64px) + grid gap (10px) keeps the meta row aligned
       with the chip column above it. */
    padding-left: 74px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }
  .export-fields .export-meta i {
    opacity: 0.6;
    margin-right: 2px;
  }

  /* ============================================================
   * Dock-tray densification (mobile). Scoped to .dock-dense so these
   * shared panels stay full-size in their other usages. Touch targets
   * stay >=44px — we only collapse gaps, paddings, and >44px tiles.
   * ============================================================ */
  .dock-dense :global(.section-pad) {
    gap: 8px;
    padding: 4px 12px 10px;
  }
  /* Visibility: icons add no meaning at chip size and force 96px columns
     (3 ragged rows). Label-only chips pack the 8 toggles into a clean 4×2.
     Dock only — the sidebar keeps the roomier iconed grid. */
  .dock-dense :global(.vis-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .dock-dense :global(.vis-grid .rt-chip i) {
    display: none;
  }
  .dock-dense :global(.vis-grid .rt-chip) {
    padding: 0 4px;
  }
  /* Squeeze the last ~15px so Visibility + Motion paths land inside the capped
     tray with NO scroll (the whole tab on one screen). */
  .dock-dense .display-rows {
    gap: 5px;
    padding: 2px 12px 4px;
  }
  .dock-dense .display-rows .rt-section {
    gap: 4px;
  }
  /* Playback: 5 controls don't need four stacked bands. Label-left rows, and
     the two mode buttons sit side-by-side. Dock only — the sidebar keeps the
     descriptive vertical stack. */
  .dock-dense .playback-rows {
    padding-bottom: 6px;
  }
  .dock-dense .playback-rows .rt-section {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .dock-dense .playback-rows .rt-section-label {
    flex: 0 0 52px;
  }
  .dock-dense .playback-rows :global(.tempo-wrapper) {
    flex: 1;
    min-width: 0;
  }
  .dock-dense .playback-rows :global(.mode-toggle) {
    flex-direction: row;
    flex: 1;
    min-width: 0;
  }
  .dock-dense .playback-rows :global(.mode-toggle .mode-btn) {
    flex: 1;
    min-width: 0;
  }
  /* BentoPropGrid */
  .dock-dense :global(.grid-scroll) {
    padding: 6px 12px;
  }
  .dock-dense :global(.section-label) {
    padding: 4px 4px 2px;
  }
  .dock-dense :global(.section-buttons) {
    gap: 4px;
  }
  .dock-dense :global(.grid-content) {
    gap: 2px;
  }
  /* Shrink prop tiles ~79->60px (square) so more fit per row + shorter rows.
     Higher specificity than BentoPropGrid's own width + container-query rules. */
  .dock-dense :global(.section-buttons .prop-button),
  .dock-dense :global(.popover-trigger-wrap .prop-button),
  .dock-dense :global(.popover-trigger-wrap) {
    width: 60px;
  }
  .dock-dense :global(.prop-button) {
    aspect-ratio: 1 / 1;
    padding: 5px 3px 4px;
    gap: 2px;
  }
  /* .prop-label keeps its base var(--font-size-compact, 12px); it ellipsizes
     (nowrap + hidden overflow) inside the 60px tile, so no sub-floor override. */
  /* EffortPanel (56px tile -> 48, still >=44) */
  .dock-dense :global(.effort-btn) {
    min-height: 48px;
    padding: 10px 6px;
  }
  .dock-dense :global(.effort-grid) {
    gap: 4px;
  }
  /* PathShapePanel */
  .dock-dense :global(.path-shape-grid) {
    gap: 4px;
  }
  .dock-dense :global(.path-btn) {
    padding: 6px;
  }
  .dock-dense :global(.hybrid-btn) {
    padding: 6px 10px;
    margin-top: 4px;
  }
  .dock-dense :global(.motion-hint) {
    margin-top: 2px;
  }
  /* DisplayPanel */
  .dock-dense :global(.display-chips) {
    gap: 4px;
  }
  /* TempoControl popover */
  .dock-dense :global(.bpm-popover) {
    padding: 10px;
    gap: 8px;
  }
  .dock-dense :global(.bpm-popover-presets) {
    gap: 6px;
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
    container: animation-sidebar / inline-size;
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
    display: flex;
    flex-direction: column;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }

  /* Vertically center the section content within the tall panel.
     auto block margins collapse to 0 when content overflows, so it
     still scrolls from the top — no clipping on long sections. */
  .panel-center-inner {
    margin: auto 0;
    width: 100%;
    max-width: 560px;
    align-self: center;
  }

  /* Tracks the viewer's settings column, which widens at the same seams. A cap
     left at 560px would keep the panel a narrow strip in a wide column and
     strand the extra room as dead rail. */
  @media (min-width: 1680px) {
    .panel-center-inner {
      max-width: 800px;
    }
  }

  @media (min-width: 2600px) {
    .panel-center-inner {
      max-width: 1000px;
    }
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

  .panel-scroll::-webkit-scrollbar {
    width: 5px;
  }
  .panel-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .panel-scroll::-webkit-scrollbar-thumb {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.12));
    border-radius: 3px;
  }

  /* ============================================================
   * Shared: duration lines, footer, export button, progress
   * ============================================================ */

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
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
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
    background: color-mix(
      in srgb,
      var(--semantic-error, #f87171) 15%,
      transparent
    );
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
