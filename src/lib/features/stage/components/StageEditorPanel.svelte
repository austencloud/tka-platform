<script lang="ts">
  import StageCanvas from "./StageCanvas.svelte";
  import BeatTimeline from "./BeatTimeline.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);
  const activeFormationIndex = $derived(stageState.activeFormationIndex);

  let bpm = $state(120);

  $effect(() => {
    bpm = choreography.bpm;
  });

  function handleBpmChange(newBpm: number) {
    stageState.setBpm(newBpm);
  }

  const presets: { id: FormationPresetId; label: string; icon: string }[] = [
    { id: "line", label: "Line", icon: "fa-grip-lines" },
    { id: "triangle", label: "Triangle", icon: "fa-caret-up" },
    { id: "diamond", label: "Diamond", icon: "fa-diamond" },
    { id: "circle", label: "Circle", icon: "fa-circle" },
    { id: "v-shape", label: "V-Shape", icon: "fa-chevron-down" },
    { id: "grid", label: "Grid", icon: "fa-border-all" },
    { id: "stagger", label: "Stagger", icon: "fa-bars-staggered" },
    { id: "cluster", label: "Cluster", icon: "fa-braille" },
  ];

  function initDefault() {
    if (choreography.formations.length === 0) {
      stageState.addFormation(0, "line");
      stageState.addFormation(4, "triangle");
    }
  }

  function handleStepForward() {
    const next = activeFormationIndex + 1;
    if (next < choreography.formations.length) {
      stageState.activeFormationIndex = next;
    }
  }

  function handleStepBackward() {
    const prev = activeFormationIndex - 1;
    if (prev >= 0) {
      stageState.activeFormationIndex = prev;
    }
  }

  function handleRestartToStart() {
    stageState.activeFormationIndex = 0;
  }

  $effect(() => { initDefault(); });
</script>

<div class="stage-editor">
  <div class="canvas-area">
    <StageCanvas />
    <BeatTimeline />
  </div>

  <aside class="stage-sidebar">
    <section class="sidebar-section transport-section">
      <h3 class="section-label">Playback</h3>
      <TransportControls
        {isPlaying}
        onPlaybackToggle={() => isPlaying ? stageState.stop() : stageState.play()}
        onStepFullBeatForward={handleStepForward}
        onStepFullBeatBackward={handleStepBackward}
        onRestartToStart={handleRestartToStart}
      />
    </section>

    <section class="sidebar-section">
      <h3 class="section-label">Tempo</h3>
      <BpmChips bind:bpm variant="compact" onBpmChange={handleBpmChange} />
    </section>

    <section class="sidebar-section">
      <h3 class="section-label">Performers</h3>
      <div class="performer-count">
        <span class="count-value">{choreography.performers.length}</span>
        <input
          type="range"
          min="2"
          max="8"
          value={choreography.performers.length}
          oninput={(e) => stageState.setPerformerCount(+(e.target as HTMLInputElement).value)}
        />
      </div>
    </section>

    <section class="sidebar-section">
      <h3 class="section-label">Formation Presets</h3>
      <div class="preset-grid">
        {#each presets as preset}
          <button
            class="preset-btn"
            onclick={() => stageState.applyPreset(preset.id)}
          >
            <i class="fas {preset.icon}" aria-hidden="true"></i>
            <span>{preset.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <section class="sidebar-section">
      <h3 class="section-label">Formations</h3>
      <div class="formation-info">
        <span>{choreography.formations.length} keyframe{choreography.formations.length === 1 ? "" : "s"}</span>
        <span class="formation-active">
          F{activeFormationIndex + 1} &middot; beat {stageState.activeFormation?.beat ?? 0}
        </span>
      </div>
    </section>
  </aside>
</div>

<style>
  .stage-editor {
    display: grid;
    grid-template-columns: 1fr clamp(280px, 20vw, 340px);
    gap: var(--spacing-lg, 16px);
    height: 100%;
    padding: var(--spacing-lg, 16px);
    overflow: hidden;
  }

  .canvas-area {
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    min-height: 0;
  }

  /* ===== RIGHT SIDEBAR ===== */

  .stage-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    overflow-y: auto;
  }

  .sidebar-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    padding: var(--spacing-md, 12px);
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0 0 var(--spacing-sm, 8px);
    font-weight: 600;
  }

  .transport-section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ===== PERFORMER COUNT ===== */

  .performer-count {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .count-value {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    font-variant-numeric: tabular-nums;
    min-width: 1.5ch;
    text-align: center;
  }

  .performer-count input[type="range"] {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    outline: none;
  }

  .performer-count input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    cursor: pointer;
    border: 2px solid var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-shadow: 0 0 6px color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
  }

  .performer-count input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    cursor: pointer;
    border: 2px solid var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-shadow: 0 0 6px color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
  }

  /* ===== PRESET GRID ===== */

  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
  }

  .preset-btn i {
    font-size: var(--font-size-sm, 13px);
    opacity: 0.7;
  }

  @media (hover: hover) and (pointer: fine) {
    .preset-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .preset-btn:active {
    transform: scale(0.97);
  }

  /* ===== FORMATION INFO ===== */

  .formation-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .formation-active {
    color: var(--theme-text, white);
    font-weight: 600;
  }

  /* ===== RESPONSIVE ===== */

  @media (min-width: 1200px) {
    .stage-editor {
      grid-template-columns: 1fr clamp(300px, 20vw, 360px);
    }
  }

  @media (max-width: 1024px) and (min-width: 768px) {
    .stage-editor {
      grid-template-columns: 1fr clamp(260px, 18vw, 320px);
      gap: var(--spacing-md, 12px);
      padding: var(--spacing-md, 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-btn {
      transition: none;
    }
  }
</style>
