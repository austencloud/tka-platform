<!--
  ArtSettingsPanel.svelte

  Right-edge settings rail for Art mode (Mandala + Tunnel). Mirrors the 2D
  animation sidebar (`.horizontal-sidebar`) and composes the same GLOBAL panes
  so every effect / effort / playback / visual control drives the same state as
  the 2D view — no per-mode state. The Mandala/Tunnel type toggle and the
  tunnel's fold/mirror/preset controls live here (moved off the canvas).

  Composition (top → bottom):
    1. Art section  — Mandala|Tunnel SegmentedControl + (tunnel) fold/mirror/presets
    2. EffectSelector — global effects-config
    3. EffortPanel    — self-wires to the global visibility manager
    4. PlaybackPane + VisualPane — same props the 2D HorizontalSidebar passes
    5. Export button  — calls the `onExport` prop
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import EffectSelector from "$lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import PlaybackPane from "$lib/shared/animation-engine/components/controls/settings-panel/PlaybackPane.svelte";
  import VisualPane from "$lib/shared/animation-engine/components/controls/settings-panel/VisualPane.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { isEffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import type { Fold } from "../tunnel/tunnel-fold-math";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  type ArtType = "mandala" | "tunnel";

  let {
    sequence,
    playback,
    controller,
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

  // Effects drive the GLOBAL config (shared with the 2D view + 3D viewer).
  const effectsConfig = getEffectsConfigContext();

  // Labels, not icons: SegmentedControl renders icon OR label (never both), so a
  // bare glyph reads as "no info". The word is the description.
  const artOptions = [
    { value: "mandala" as const, label: "Mandala" },
    { value: "tunnel" as const, label: "Tunnel" },
  ];

  const folds: Fold[] = [2, 4, 8];

  // Tunnel preset naming (moved verbatim out of TunnelArtView's controls block).
  let newName = $state("");
</script>

<div class="art-settings-panel">
  <!-- Art section -->
  <div class="panel-section">
    <span class="section-label">Art</span>
    <SegmentedControl
      options={artOptions}
      value={artType}
      onchange={onArtTypeChange}
      color="accent"
      size="sm"
    />

    {#if artType === "tunnel"}
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
    {/if}
  </div>

  <!-- Effects -->
  {#if effectsConfig}
    <div class="panel-section">
      <span class="section-label">Effect</span>
      <EffectSelector
        activeEffect={effectsConfig.activeEffect}
        onSelect={(e) => { if (isEffectId(e)) effectsConfig.setActiveEffect(e); }}
      />
    </div>
  {/if}

  <!-- Effort -->
  <div class="panel-section">
    <span class="section-label">Effort</span>
    <EffortPanel columns={2} />
  </div>

  <!-- Playback -->
  <div class="panel-section">
    <span class="section-label">Playback</span>
    <PlaybackPane
      bind:bpm
      {playbackMode}
      stepPlaybackStepSize={stepSize}
      {isPlaying}
      {onBpmChange}
      {onPlaybackModeChange}
      onStepPlaybackStepSizeChange={onStepSizeChange}
      {onPlaybackToggle}
    />
  </div>

  <!-- Visual -->
  <div class="panel-section">
    <span class="section-label">Visual</span>
    <VisualPane propType={null} {bluePropType} {redPropType} />
  </div>

  <!-- Export -->
  <div class="panel-section">
    <button type="button" class="export-btn" onclick={onExport}>
      <i class="fas fa-film" aria-hidden="true"></i>
      <span>Export Video</span>
    </button>
  </div>
</div>

<style>
  /* Card chrome mirrors `.horizontal-sidebar` (the 2D animation rail). */
  .art-settings-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqh, 24px);
    width: clamp(240px, 32%, 300px);
    min-width: 240px;
    height: 100%;
    flex-shrink: 0;
    padding: clamp(14px, 3cqh, 24px);
    box-sizing: border-box;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    overflow-y: auto;
    container-type: size;
    container-name: art-sidebar;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    flex-shrink: 0;
  }

  .panel-section + .panel-section {
    padding-top: clamp(12px, 3cqh, 20px);
    border-top: 1px solid var(--theme-stroke);
  }

  .section-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
    font-weight: 600;
  }

  /* Tunnel fold/mirror row + presets — styles moved verbatim from TunnelArtView. */
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

  /* Export button */
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
