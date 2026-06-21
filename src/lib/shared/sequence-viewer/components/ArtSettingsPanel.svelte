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
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import IconRailNav from "$lib/shared/animation-panel/pill-nav/IconRailNav.svelte";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import MandalaCategoryControl, {
    type MandalaCategory,
  } from "./mandala/MandalaCategoryControl.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import type { Fold } from "../tunnel/tunnel-fold-math";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  type ArtType = "mandala" | "tunnel";
  // Tunnel rail sections (own id union — not the Download panel's PillId).
  type TunnelRailId = "tunnel" | "effects" | "effort" | "playback" | "visual";
  // Mandala rail sections — same ids + order as the bottom dock's category bar.
  type MandalaRailId = MandalaCategory;

  let {
    sequence,
    playback,
    controller,
    mandalaController,
    artType,
    onArtTypeChange,
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
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
    artType: ArtType;
    onArtTypeChange: (value: ArtType) => void;
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
  } = $props();

  // Type toggle: labels, not icons (a bare glyph reads as "no info").
  const artOptions = [
    { value: "mandala" as const, label: "Mandala" },
    { value: "tunnel" as const, label: "Tunnel" },
  ];

  // ── Tunnel rail ──
  const tunnelRail: { id: TunnelRailId; icon?: string; label: string; accentColor?: string }[] = [
    { id: "tunnel", icon: "fa-fan", label: "Tunnel" },
    { id: "effects", icon: "fa-wand-magic-sparkles", label: "Effects" },
    // Effort uses an accent dot (no icon), matching the Download panel's Effort pill.
    { id: "effort", label: "Effort", accentColor: "#94a3b8" },
    { id: "playback", icon: "fa-play", label: "Playback" },
    { id: "visual", icon: "fa-eye", label: "Visual" },
  ];
  let tunnelSection = $state<TunnelRailId>("tunnel");
  const tunnelSectionLabel = $derived(
    tunnelRail.find((p) => p.id === tunnelSection)?.label ?? "",
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
  let mandalaSection = $state<MandalaRailId>("speed");
  const mandalaSectionLabel = $derived(
    mandalaRail.find((p) => p.id === mandalaSection)?.label ?? "",
  );

  const folds: Fold[] = [2, 4, 8];
  let newName = $state("");
</script>

<div class="art-settings-panel">
  <!-- Pinned header: type toggle — always -->
  <div class="panel-header">
    <span class="section-label">Art</span>
    <SegmentedControl
      options={artOptions}
      value={artType}
      onchange={onArtTypeChange}
      color="accent"
      size="sm"
    />
  </div>

  <!-- [ rail | section body ] mirroring AnimationPanel's .sidebar-rail-layout -->
  <div class="sidebar-rail-layout">
    {#if artType === "tunnel"}
      <IconRailNav
        pills={tunnelRail}
        activeId={tunnelSection}
        onSelect={(id) => (tunnelSection = id)}
      />
    {:else}
      <IconRailNav
        pills={mandalaRail}
        activeId={mandalaSection}
        onSelect={(id) => (mandalaSection = id)}
      />
    {/if}

    <div class="sidebar-main">
      <div class="panel-scroll">
        {#if artType === "tunnel"}
          <h2 class="panel-title">{tunnelSectionLabel}</h2>

          {#if tunnelSection === "tunnel"}
            <div class="section-pad">
              <div class="group">
                <span class="lbl">Fold</span>
                {#each folds as f (f)}
                  <button class:active={controller.fold === f} onclick={() => controller.setFold(f)}>{f}×</button>
                {/each}
                <button class:active={controller.mirror} onclick={() => (controller.mirror = !controller.mirror)}>Mirror</button>
              </div>

              {#if controller.heavyLoad}
                <p class="warn">Heavy effect on a large stack — may drop frames on weaker devices.</p>
              {/if}

              <div class="presets">
                <input
                  class="name-input"
                  type="text"
                  placeholder="name this look…"
                  bind:value={newName}
                  onkeydown={(e) => { if (e.key === "Enter") { controller.saveCurrentAs(newName); newName = ""; } }}
                />
                <button onclick={() => { controller.saveCurrentAs(newName); newName = ""; }}>Save</button>
                {#each controller.presets as p (p.id)}
                  <div class="chip">
                    <button class="chip-apply" onclick={() => controller.applyPreset(p)}>{p.name}</button>
                    <button class="chip-del" aria-label={`Delete ${p.name}`} onclick={() => controller.deletePreset(p.id)}>×</button>
                  </div>
                {/each}
              </div>
            </div>
          {:else if tunnelSection === "effects"}
            <div class="section-pad">
              <EffectsPanel
                layout="sidebar"
                showPlayback={false}
                {bpm}
                {onBpmChange}
                {isPlaying}
                {onPlaybackToggle}
              />
            </div>
          {:else if tunnelSection === "effort"}
            <div class="section-pad">
              <p class="section-hint">How each beat speeds up and slows down.</p>
              <EffortPanel columns={2} showSubtitles />
            </div>
          {:else if tunnelSection === "playback"}
            <div class="section-pad">
              <div class="rt-section">
                <span class="rt-section-label">Tempo</span>
                <TempoControl
                  {bpm}
                  {onBpmChange}
                  showPresets
                  showPractice={false}
                  presetsMode="inline"
                  vertical
                />
              </div>
              <div class="rt-section">
                <span class="rt-section-label">Mode</span>
                <PlaybackModeToggle
                  {playbackMode}
                  {isPlaying}
                  {onPlaybackModeChange}
                  {onPlaybackToggle}
                  showDescriptions
                />
              </div>
            </div>
          {:else}
            <div class="section-pad">
              <DisplayPanel />
            </div>
          {/if}
        {:else}
          <h2 class="panel-title">{mandalaSectionLabel}</h2>
          <div class="section-pad">
            <MandalaCategoryControl ctrl={mandalaController} category={mandalaSection} />
          </div>
        {/if}
      </div>

      <!-- Pinned footer: export -->
      <div class="panel-footer">
        {#if artType === "tunnel"}
          <button type="button" class="export-btn" onclick={onExport}>
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Export Video</span>
          </button>
        {:else}
          <button type="button" class="export-btn" onclick={() => mandalaController.startExport()}>
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Export MP4</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* Card chrome mirrors `.horizontal-sidebar` (the 2D animation rail). */
  .art-settings-panel {
    display: flex;
    flex-direction: column;
    width: clamp(280px, 36%, 360px);
    min-width: 280px;
    height: 100%;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    overflow: hidden;
    container-type: size;
    container-name: art-sidebar;
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

  /* Tunnel fold/mirror row + presets (moved here from the old tunnel block). */
  .group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .lbl { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; }
  .group button,
  .presets button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; cursor: pointer;
    min-height: var(--min-touch-target);
  }
  .group button.active {
    background: var(--theme-accent, #8b5cf6); border-color: transparent; color: #fff;
  }
  .warn { margin: 0; font-size: 0.72rem; color: var(--semantic-warning, #fbbf24); }
  .presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .name-input {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem;
    min-height: var(--min-touch-target); flex: 1 1 120px; min-width: 0;
  }
  .chip { display: inline-flex; border: 1px solid var(--theme-accent, rgba(150,120,240,0.4)); border-radius: 999px; overflow: hidden; }
  .chip-apply { border: none; border-radius: 0; }
  .chip-del { border: none; border-radius: 0; padding: 6px 9px; }

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
</style>
