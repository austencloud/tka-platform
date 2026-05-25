<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const state = getStageChoreographyState();
  const { choreography, activeFormationIndex, isPlaying, playProgress } = $derived(state);

  const totalBeats = $derived(
    Math.max(
      16,
      (choreography.formations.at(-1)?.beat ?? 0) + 8
    )
  );

  function beatToPercent(beat: number): number {
    return (beat / totalBeats) * 100;
  }

  function handleBarClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const beat = Math.round(pct * totalBeats);
    const existing = choreography.formations.findIndex((f) => f.beat === beat);
    if (existing === -1) {
      state.addFormation(beat, "line" as FormationPresetId);
    }
    state.activeFormationIndex = choreography.formations.findIndex(
      (f) => f.beat === beat
    );
  }
</script>

<div class="beat-timeline">
  <div class="controls">
    <button class="play-btn" onclick={() => isPlaying ? state.stop() : state.play()}>
      {isPlaying ? "Stop" : "Play"}
    </button>
    <span class="bpm-display">{choreography.bpm} BPM</span>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="timeline-bar" onclick={handleBarClick}>
    <!-- Beat markers -->
    {#each Array.from({ length: totalBeats + 1 }, (_, i) => i) as beat}
      <div
        class="beat-marker"
        class:major={beat % 4 === 0}
        style="left: {beatToPercent(beat)}%"
      />
    {/each}

    <!-- Formation markers -->
    {#each choreography.formations as formation, i}
      <button
        class="formation-marker"
        class:active={i === activeFormationIndex}
        style="left: {beatToPercent(formation.beat)}%"
        onclick={(e) => { e.stopPropagation(); state.activeFormationIndex = i; }}
      >
        F{i + 1}
      </button>
    {/each}

    <!-- Playhead -->
    {#if isPlaying}
      {@const current = choreography.formations[activeFormationIndex]}
      {@const next = choreography.formations[activeFormationIndex + 1]}
      {#if current && next}
        {@const playBeat = current.beat + (next.beat - current.beat) * playProgress}
        <div class="playhead" style="left: {beatToPercent(playBeat)}%" />
      {/if}
    {/if}

    <!-- Beat numbers -->
    <div class="beat-labels">
      {#each Array.from({ length: Math.floor(totalBeats / 4) + 1 }, (_, i) => i * 4) as beat}
        <span style="left: {beatToPercent(beat)}%">{beat}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .beat-timeline {
    padding: 12px 16px;
    background: #0f0f1f;
    border-top: 1px solid #2a2a4a;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .play-btn {
    background: #2a4a7a;
    color: #fff;
    border: none;
    padding: 4px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .play-btn:hover { background: #3a5a9a; }
  .bpm-display {
    font-size: 11px;
    color: #6a8aaa;
  }
  .timeline-bar {
    position: relative;
    height: 40px;
    background: #1a1a2e;
    border-radius: 4px;
    cursor: pointer;
  }
  .beat-marker {
    position: absolute;
    top: 8px;
    width: 1px;
    height: 12px;
    background: #3a3a5a;
  }
  .beat-marker.major {
    height: 16px;
    background: #4a5a7a;
    top: 6px;
  }
  .formation-marker {
    position: absolute;
    top: 4px;
    transform: translateX(-50%);
    background: #2a7a4a;
    color: #fff;
    border: none;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    z-index: 2;
  }
  .formation-marker.active {
    background: #3aaa6a;
    box-shadow: 0 0 6px #3aaa6a88;
  }
  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: #ff4444;
    z-index: 3;
  }
  .beat-labels {
    position: absolute;
    bottom: 2px;
    left: 0;
    right: 0;
  }
  .beat-labels span {
    position: absolute;
    transform: translateX(-50%);
    font-size: 9px;
    color: #5a5a7a;
  }
</style>
