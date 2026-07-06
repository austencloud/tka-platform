<!--
  ArtSettingsPanel.svelte

  Right-edge settings rail for Art mode, structured like the 2D Download-Animation
  panel (AnimationPanel desktop sidebar): a pinned header, then an
  [IconRailNav | section body] row with a pinned footer.

    - Pinned header (always): the Mandala|Tunnel SegmentedControl (labels).
    - Tunnel: vertical IconRailNav (Tunnel / Effects / Effort / Playback / Visual)
      drives the SAME global state as the 2D view. Footer = Export Video.
    - Mandala: vertical IconRailNav (Speed / Shape / Spin / Colors / Weight /
      Depth / Download) — same categories + icons as the bottom dock, rendered
      via the shared MandalaCategoryControl and driven by the mandala `ctrl`.
      Footer = Export MP4 (ctrl.startExport()).

  Mirrors AnimationPanel's IconRailNav + section body + pinned footer so Art mode
  reads consistently with the 2D download panel.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import IconRailNav from "$lib/shared/animation-panel/pill-nav/IconRailNav.svelte";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import MandalaCategoryControl, {
    type MandalaCategory,
  } from "./mandala/MandalaCategoryControl.svelte";
  import ControlDock, {
    type ControlDockTab,
    type ControlDockAction,
  } from "./ControlDock.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import { LOOKS, propCount } from "../tunnel/tunnel-looks";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  type ArtType = "mandala" | "tunnel";
  // Tunnel rail sections (own id union — not the Download panel's PillId).
  type TunnelRailId = "tunnel" | "effects" | "effort" | "playback";
  // Mandala rail sections — same ids + order as the bottom dock's category bar.
  type MandalaRailId = MandalaCategory;

  let {
    sequence,
    playback,
    controller,
    mandalaController,
    artType,
    layout = "sidebar",
    onExport,
    bpm = $bindable(60),
    playbackMode = "continuous",
    stepSize = 1,
    isPlaying = false,
    onBpmChange = () => {},
    onPlaybackModeChange = () => {},
    onStepSizeChange = () => {},
    onPlaybackToggle = () => {},
    bluePropType = null,
    redPropType = null,
    exporting = false,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
    artType: ArtType;
    /** "bottom" swaps the desktop sidebar for a mobile ControlDock (pill-tab bar
     *  + slide-up tray) floating over the art. Default "sidebar". */
    layout?: "sidebar" | "bottom";
    onExport: () => void;
    bpm?: number;
    playbackMode?: PlaybackMode;
    stepSize?: StepPlaybackStepSize;
    isPlaying?: boolean;
    onBpmChange?: (bpm: number) => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onStepSizeChange?: (size: StepPlaybackStepSize) => void;
    onPlaybackToggle?: () => void;
    bluePropType?: string | null;
    redPropType?: string | null;
    /** Freeze the rail while a tunnel export runs — changing look/spectrum
     *  mid-export would desync the live config from the offscreen engine's
     *  pre-loaded layer textures. Cancel lives on the canvas overlay, not here. */
    exporting?: boolean;
  } = $props();

  // ── Tunnel rail ──
  const tunnelRail: { id: TunnelRailId; icon?: string; label: string; accentColor?: string }[] = [
    { id: "tunnel", icon: "fa-fan", label: "Tunnel" },
    { id: "effects", icon: "fa-wand-magic-sparkles", label: "Effects" },
    // Effort uses an accent dot (no icon), matching the Download panel's Effort pill.
    { id: "effort", label: "Effort", accentColor: "#94a3b8" },
    { id: "playback", icon: "fa-play", label: "Playback" },
  ];
  // Active section lives on the controller so it persists with the rest of the
  // tunnel view state (load/save in TunnelViewController).
  const tunnelSection = $derived<TunnelRailId>(controller.section);
  const tunnelSectionLabel = $derived(
    tunnelRail.find((p) => p.id === tunnelSection)?.label ?? "",
  );

  // Density stepper options for the tuner (SegmentedControl is string-generic,
  // so map the arm counts to string values).
  const densitySegOptions = $derived(
    controller.densityOptions.map((a) => ({ value: String(a), label: `${a}×` })),
  );

  // ── Mandala rail (same icons + order the bottom dock uses) ──
  const mandalaRail: { id: MandalaRailId; icon?: string; label: string }[] = [
    { id: "speed", icon: "fa-gauge-high", label: "Speed" },
    { id: "shape", icon: "fa-bezier-curve", label: "Shape" },
    { id: "spin", icon: "fa-arrows-rotate", label: "Spin" },
    { id: "colors", icon: "fa-palette", label: "Colors" },
    { id: "weight", icon: "fa-grip-lines", label: "Weight" },
    { id: "depth", icon: "fa-wave-square", label: "Depth" },
    { id: "download", icon: "fa-download", label: "Download" },
  ];

  // Mandala shows ALL its controls stacked (each is a single compact row, so a
  // per-section rail would leave the tall panel mostly empty). The rail is kept
  // for the tunnel, whose sections carry real content.
  const mandalaStack: { id: MandalaRailId; label: string }[] = mandalaRail.map(
    ({ id, label }) => ({ id, label }),
  );

  // Reduced-motion gate for the section transitions.
  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  // Track switch direction so sections fly in from the side the rail moved.
  const tunnelOrder = tunnelRail.map((p) => p.id);
  let flyDir = $state(1);
  function selectTunnel(id: TunnelRailId): void {
    const prev = tunnelOrder.indexOf(tunnelSection);
    const next = tunnelOrder.indexOf(id);
    flyDir = next >= prev ? 1 : -1;
    controller.section = id;
  }

  // ── Mobile bottom-dock (layout="bottom") ──
  // The shared ControlDock shell (same one AnimationPanel + the native mandala
  // dock use): a pill-tab bar with a slide-up tray, floating over the art. A tab
  // toggles its tray open/closed (null = collapsed); the persisted desktop
  // `section` stays synced for the tunnel so both presentations agree.
  let openTunnelTab = $state<TunnelRailId | null>(null);
  let openMandalaCat = $state<MandalaRailId | null>(null);

  function selectTunnelDock(id: string): void {
    if (exporting) return;
    const tid = id as TunnelRailId;
    openTunnelTab = openTunnelTab === tid ? null : tid;
    if (openTunnelTab) controller.section = tid;
  }
  function selectMandalaDock(id: string): void {
    const cid = id as MandalaRailId;
    openMandalaCat = openMandalaCat === cid ? null : cid;
  }

  const tunnelDockTabs = $derived<ControlDockTab[]>(
    tunnelRail.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
      accentColor: p.accentColor,
    })),
  );
  // Colors gets the live accent-pair dots (matching the native mandala dock);
  // "download" is excluded — it's the trailing Export action, not a tray tab.
  const mandalaDockTabs = $derived<ControlDockTab[]>(
    mandalaRail
      .filter((c) => c.id !== "download")
      .map((c) =>
        c.id === "colors"
          ? { id: c.id, label: c.label, dots: mandalaController.accentPair }
          : { id: c.id, label: c.label, icon: c.icon },
      ),
  );
  const tunnelDockExport = $derived<ControlDockAction>({
    icon: "fa-film",
    label: "Export Video",
    onClick: onExport,
    disabled: exporting,
    busy: exporting,
  });
  const mandalaDockExport: ControlDockAction = {
    icon: "fa-download",
    label: "Export MP4",
    onClick: () => mandalaController.startExport(),
  };
</script>

<!-- Tunnel section body — one source feeds the desktop sidebar and the mobile
     dock tray. `dense` tightens the shared sub-panels for the tray. -->
{#snippet tunnelSectionBody(id: TunnelRailId, dense: boolean)}
  {#if id === "tunnel"}
    <div class="section-pad">
      <!-- Look catalog: each tile is a curated kaleidoscope (base + an explicit
           copy list, so the prop count is exactly what you see — no hidden
           doubling). Single-select icon grid, same vocabulary as the Effects
           picker. -->
      <div class="look-grid">
        {#each LOOKS as look (look.id)}
          <button
            class="look-tile"
            class:active={controller.lookId === look.id}
            type="button"
            aria-pressed={controller.lookId === look.id}
            onclick={() => controller.setLook(look.id)}
            title={`${look.name} · ${propCount(look, look.density ? controller.density : undefined, look.density ? controller.radialMirror : undefined)} props`}
          >
            <i class={look.icon} aria-hidden="true"></i>
            <span>{look.name}</span>
          </button>
        {/each}
      </div>

      <!-- Density (arm count) for the tunable Radial look, plus a compact Grid
           icon toggle instead of a full row. -->
      <div class="tuner">
        {#if controller.hasDensity}
          <div class="slider-row">
            <span class="row-lbl">Density</span>
            <div class="seg-wrap">
              <SegmentedControl
                options={densitySegOptions}
                value={String(controller.density)}
                onchange={(v) => controller.setDensity(Number(v))}
                color="accent"
                size="sm"
              />
            </div>
            <button
              class="grid-toggle"
              class:active={controller.gridVisible}
              type="button"
              aria-pressed={controller.gridVisible}
              aria-label="Toggle grid"
              title="Grid"
              onclick={() => (controller.gridVisible = !controller.gridVisible)}
            >
              <i class="fas fa-border-all" aria-hidden="true"></i>
            </button>
          </div>
          {#if controller.hasMirror}
            <!-- Explicit, opt-in dihedral reflection (rotational → Mandala-style).
                 NOT the old hidden always-on multiplier; capped to 4 arms. -->
            <div class="group">
              <button
                class:active={controller.radialMirror}
                type="button"
                aria-pressed={controller.radialMirror}
                onclick={() => controller.setRadialMirror(!controller.radialMirror)}
              >
                <i class="fas fa-arrows-left-right" aria-hidden="true"></i> Mirror
              </button>
            </div>
          {/if}
        {:else}
          <div class="tuner-head">
            <span class="row-lbl">Grid</span>
            <button
              class="grid-toggle"
              class:active={controller.gridVisible}
              type="button"
              aria-pressed={controller.gridVisible}
              aria-label="Toggle grid"
              title="Grid"
              onclick={() => (controller.gridVisible = !controller.gridVisible)}
            >
              <i class="fas fa-border-all" aria-hidden="true"></i>
            </button>
          </div>
        {/if}
      </div>

      {#if controller.heavyLoad}
        <p class="warn">Dense look (16 props): a heavy effect may drop frames on weaker devices.</p>
      {/if}
    </div>
  {:else if id === "effects"}
    <div class="section-pad">
      <div class="group">
        <button
          class:active={controller.spectrum}
          aria-pressed={controller.spectrum}
          onclick={() => (controller.spectrum = !controller.spectrum)}
        >
          <i class="fas fa-rainbow" aria-hidden="true"></i> Rainbow spectrum
        </button>
      </div>
      {#if !dense}
        <p class="section-hint">
          {controller.spectrum
            ? "Every kaleidoscope copy fans across the spectrum."
            : "Props follow the colors you choose below."}
        </p>
      {/if}
      <EffectsPanel
        layout={dense ? "strip" : "sidebar"}
        showPlayback={false}
        {bpm}
        {onBpmChange}
        {isPlaying}
        {onPlaybackToggle}
      />
    </div>
  {:else if id === "effort"}
    <div class="section-pad">
      {#if !dense}<p class="section-hint">How each beat speeds up and slows down.</p>{/if}
      <EffortPanel columns={dense ? 4 : 2} showSubtitles={!dense} />
    </div>
  {:else}
    <div class="section-pad playback-rows">
      <div class="rt-section">
        <span class="rt-section-label">Tempo</span>
        <TempoControl
          {bpm}
          {onBpmChange}
          showPresets={!dense}
          showPractice={false}
          presetsMode={dense ? "popover" : "inline"}
          vertical={!dense}
        />
      </div>
      <div class="rt-section">
        <span class="rt-section-label">Mode</span>
        <PlaybackModeToggle
          {playbackMode}
          {isPlaying}
          {onPlaybackModeChange}
          {onPlaybackToggle}
          showDescriptions={!dense}
        />
      </div>
      <!-- Motion paths are playback behavior (they change how the props
           travel), so the tunnel gets them here too — same placement as the
           2D animation dock. The panel brings its own header row. -->
      <PathShapePanel />
    </div>
  {/if}
{/snippet}

{#if layout === "bottom"}
  <!-- Mobile: the shared ControlDock is a flow child at the bottom (NOT overlay)
       so ArtPane's column shrinks the art above it — the art lifts like the card
       export instead of the dock covering it. A pill-tab bar opens a slide-up
       tray; the trailing action is Export. Same chrome as the 2D
       Download-Animation panel and the card dock. -->
  {#if artType === "tunnel"}
    <ControlDock
      tabs={tunnelDockTabs}
      activeTab={openTunnelTab}
      onTabSelect={selectTunnelDock}
      trailingAction={tunnelDockExport}
      trayMaxHeight={openTunnelTab === "effects" ? "min(72vh, 480px)" : "min(33vh, 250px)"}
    >
      {#snippet tray()}
        <div class="dock-dense">
          {#if openTunnelTab}{@render tunnelSectionBody(openTunnelTab, true)}{/if}
        </div>
      {/snippet}
    </ControlDock>
  {:else}
    <ControlDock
      tabs={mandalaDockTabs}
      activeTab={openMandalaCat}
      onTabSelect={selectMandalaDock}
      trailingAction={mandalaDockExport}
      trayMaxHeight="min(33vh, 250px)"
    >
      {#snippet tray()}
        <div class="dock-dense">
          {#if openMandalaCat}
            <MandalaCategoryControl
              ctrl={mandalaController}
              category={openMandalaCat}
              showExportButton={false}
            />
          {/if}
        </div>
      {/snippet}
    </ControlDock>
  {/if}
{:else}
<div class="art-settings-panel" class:exporting inert={exporting || undefined}>
  <!-- Pinned header: the current art type (the mode rail switches between
       Mandala and Tunnel now — no in-panel toggle). -->
  <div class="panel-header">
    <span class="section-label">{artType === "tunnel" ? "Tunnel" : "Mandala"}</span>
  </div>

  {#if artType === "tunnel"}
    <!-- Tunnel: vertical rail + centered, animated section body (mirrors AnimationPanel). -->
    <div class="sidebar-rail-layout">
      <IconRailNav
        pills={tunnelRail}
        activeId={tunnelSection}
        onSelect={selectTunnel}
      />

      <div class="sidebar-main">
        <div class="panel-scroll">
          <div class="panel-content-center">
            {#key tunnelSection}
              <div
                class="panel-transition"
                in:fly={{ x: reduceMotion ? 0 : flyDir * 28, duration: reduceMotion ? 0 : 240, delay: reduceMotion ? 0 : 60, opacity: 0 }}
                out:fly={{ x: reduceMotion ? 0 : flyDir * -20, duration: reduceMotion ? 0 : 130, opacity: 0 }}
              >
                <div class="panel-center-inner">
                  <h2 class="panel-title">{tunnelSectionLabel}</h2>

                  {@render tunnelSectionBody(tunnelSection, false)}
                </div>
              </div>
            {/key}
          </div>
        </div>

        <div class="panel-footer">
          <button type="button" class="export-btn" onclick={onExport}>
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Export Video</span>
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Mandala: every control stacked (no rail). Each control is one compact
         row, so a per-section rail would leave the tall panel mostly empty. -->
    <div class="sidebar-main">
      <div class="panel-scroll mandala-stack" in:fade={{ duration: reduceMotion ? 0 : 180 }}>
        {#each mandalaStack as cat (cat.id)}
          <div class="section-pad mandala-cat">
            <span class="rt-section-label">{cat.label}</span>
            <MandalaCategoryControl
              ctrl={mandalaController}
              category={cat.id}
              showExportButton={false}
            />
          </div>
        {/each}
      </div>

      <div class="panel-footer">
        <button type="button" class="export-btn" onclick={() => mandalaController.startExport()}>
          <i class="fas fa-film" aria-hidden="true"></i>
          <span>Export MP4</span>
        </button>
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
  /* Card chrome mirrors `.horizontal-sidebar` (the 2D animation rail). */
  .art-settings-panel {
    display: flex;
    flex-direction: column;
    width: clamp(300px, 38%, 420px);
    min-width: 300px;
    height: 100%;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    overflow: hidden;
    container-type: size;
    container-name: art-sidebar;
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  /* Frozen while a tunnel export bakes — `inert` blocks interaction; the dim is
     the visual signal. Changing fold/mirror/spectrum now would desync from the
     offscreen engine's pre-loaded layer textures. */
  .art-settings-panel.exporting {
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .art-settings-panel {
      transition: none;
    }
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    padding: clamp(12px, 3cqh, 18px) clamp(14px, 3cqh, 18px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .section-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
    font-weight: 600;
  }

  /* [ rail | section body ] — mirrors AnimationPanel's .sidebar-rail-layout. */
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

  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }
  .panel-scroll::-webkit-scrollbar { width: 5px; }
  .panel-scroll::-webkit-scrollbar-track { background: transparent; }
  .panel-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  /* Tunnel: vertically center the active section in the tall body, and host the
     keyed in/out fly transition (mirrors AnimationPanel's centered swap). */
  .panel-content-center {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .panel-transition {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }
  /* auto block margins center the content but collapse to 0 when it overflows,
     so long sections (Effects) still scroll from the top — no clipping. */
  .panel-center-inner {
    margin: auto 0;
    width: 100%;
  }

  /* Mandala: stacked categories, each separated by a hairline. */
  .mandala-stack { padding-bottom: 8px; }
  .mandala-cat { gap: 10px; }
  .mandala-cat + .mandala-cat {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-top: 4px;
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

  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 16px 20px;
  }

  .section-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    line-height: 1.4;
    margin: 0;
    padding: 0 8px;
  }

  .rt-section { display: flex; flex-direction: column; gap: 8px; }
  .rt-section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  /* Look catalog: single-select icon tiles (icon over name), same visual family
     as the Effects picker. auto-fit fills the width and wraps cleanly. */
  .look-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
    gap: 6px;
  }
  .look-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: var(--min-touch-target, 44px);
    padding: 7px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    color: inherit;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .look-tile i { font-size: 15px; opacity: 0.85; }
  .look-tile > span { font-size: 0.7rem; white-space: nowrap; }
  .look-tile.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: transparent;
    color: #fff;
  }
  .look-tile.active i { opacity: 1; }

  /* Tuner: the Density stepper (Radial) + a compact Grid icon toggle. */
  .tuner { display: flex; flex-direction: column; gap: 4px; }
  .tuner-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  /* Compact icon toggle for the grid — a small square instead of a full row,
     keeping the 44px touch floor. */
  .grid-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .grid-toggle.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: transparent;
    color: #fff;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }
  .slider-row .row-lbl,
  .tuner-head .row-lbl {
    flex: 0 0 52px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .seg-wrap { flex: 1; min-width: 0; }

  /* Tunnel View/Grid row. Label-left + button shares the full row width
     (mirrors the Playback tab's Tempo/Mode rows) — no trailing dead space. */
  .group { display: flex; align-items: center; gap: 6px; }
  .group > button { flex: 1; min-width: 0; }
  .lbl {
    flex: 0 0 52px;
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5;
  }
  .group button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; cursor: pointer;
    min-height: var(--min-touch-target);
  }
  .group button.active {
    background: var(--theme-accent, #8b5cf6); border-color: transparent; color: #fff;
  }
  .warn { margin: 0; font-size: 0.72rem; color: var(--semantic-warning, #fbbf24); }

  /* Pinned export footer. */
  .panel-footer {
    padding: 12px 16px 16px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: var(--theme-accent);
    border: 1.5px solid var(--theme-accent);
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .export-btn:hover {
      filter: brightness(1.1);
    }
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .export-btn {
      transition: none;
    }
  }

  /* Mobile dock tray: tighten the shared section bodies. Buttons/inputs keep
     their var(--min-touch-target) floor — only gaps and outer paddings collapse
     so the tray stays compact floating over the art. */
  .dock-dense .section-pad { gap: 8px; padding: 2px 2px 6px; }
  .dock-dense .group { gap: 6px; }
  /* Look grid in the dock tray: fixed 5-col so the catalog stays 2 tight rows
     at the 44px touch floor (mirrors the 6-col Effects picker compression). */
  .dock-dense .look-grid { grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .dock-dense .look-tile { min-height: 44px; padding: 4px 2px; gap: 1px; }
  .dock-dense .look-tile i { font-size: 13px; }
  .dock-dense .look-tile > span { font-size: 9px; letter-spacing: 0.01em; }
  /* EffectsPanel lives in a child component — mirror AnimationPanel's dock-dense
     compression (:global): 6-column picker puts all 16 effects (3 rows at the
     44px touch floor) inside the capped tray with no scrolling. */
  .dock-dense :global(.mep) { gap: 6px; }
  .dock-dense :global(.drill-view) { gap: 6px; }
  .dock-dense :global(.fx-picker) { grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .dock-dense :global(.fx-tile) { height: 44px; }
  .dock-dense :global(.fx-picker .fx-tile) { gap: 1px; padding: 0 2px; }
  .dock-dense :global(.fx-picker .fx-tile i) { font-size: 12px; }
  .dock-dense :global(.fx-picker .fx-tile > span) { font-size: 9px; letter-spacing: 0.01em; }
  .dock-dense :global(.slider-row) { padding: 6px 10px; gap: 8px; }
  /* Playback: label-left rows + side-by-side mode buttons (mirrors
     AnimationPanel). Dock only — the sidebar keeps the vertical stack. */
  .dock-dense .playback-rows {
    gap: 6px;
    padding-bottom: 4px;
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
</style>
