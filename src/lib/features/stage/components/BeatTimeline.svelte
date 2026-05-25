<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import type { FormationPresetId } from "../domain/stage-types";

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const activeFormationIndex = $derived(stageState.activeFormationIndex);
  const isPlaying = $derived(stageState.isPlaying);
  const playProgress = $derived(stageState.playProgress);

  const totalBeats = $derived(
    Math.max(16, (choreography.formations.at(-1)?.beat ?? 0) + 8)
  );

  function beatToPercent(beat: number): number {
    return (beat / totalBeats) * 100;
  }

  let isDragging = $state(false);

  function handleScrub(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const beat = Math.round(pct * totalBeats);

    const closest = choreography.formations.reduce((best, f, i) => {
      const dist = Math.abs(f.beat - beat);
      return dist < best.dist ? { dist, index: i } : best;
    }, { dist: Infinity, index: 0 });

    if (closest.dist <= 2) {
      stageState.activeFormationIndex = closest.index;
    } else {
      const existing = choreography.formations.findIndex((f) => f.beat === beat);
      if (existing === -1) {
        stageState.addFormation(beat, "line" as FormationPresetId);
      }
      stageState.activeFormationIndex = choreography.formations.findIndex(
        (f) => f.beat === beat
      );
    }
  }

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleScrub(e as unknown as MouseEvent);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    handleScrub(e as unknown as MouseEvent);
  }

  function handlePointerUp() {
    isDragging = false;
  }
</script>

<div class="beat-timeline">
  <div
    class="timeline-track"
    role="slider"
    tabindex="0"
    aria-label="Beat timeline"
    aria-valuemin={0}
    aria-valuemax={totalBeats}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  >
    {#each Array.from({ length: totalBeats + 1 }, (_, i) => i) as beat}
      <div
        class="beat-tick"
        class:major={beat % 4 === 0}
        style="left: {beatToPercent(beat)}%"
      />
    {/each}

    {#each choreography.formations as formation, i}
      <button
        class="formation-chip"
        class:active={i === activeFormationIndex}
        style="left: {beatToPercent(formation.beat)}%"
        onclick={(e) => { e.stopPropagation(); stageState.activeFormationIndex = i; }}
      >
        F{i + 1}
      </button>
    {/each}

    {#if isPlaying}
      {@const current = choreography.formations[activeFormationIndex]}
      {@const next = choreography.formations[activeFormationIndex + 1]}
      {#if current && next}
        {@const playBeat = current.beat + (next.beat - current.beat) * playProgress}
        <div class="playhead" style="left: {beatToPercent(playBeat)}%" />
      {/if}
    {/if}

    <div class="beat-numbers">
      {#each Array.from({ length: Math.floor(totalBeats / 4) + 1 }, (_, i) => i * 4) as beat}
        <span style="left: {beatToPercent(beat)}%">{beat}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .beat-timeline {
    flex-shrink: 0;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%, black);
  }

  .timeline-track {
    position: relative;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    touch-action: none;
  }

  .beat-tick {
    position: absolute;
    top: 10px;
    width: 1px;
    height: 10px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    pointer-events: none;
  }

  .beat-tick.major {
    height: 16px;
    top: 7px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .formation-chip {
    position: absolute;
    top: 4px;
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 25%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
    color: var(--theme-text, white);
    border-radius: 6px;
    padding: 2px 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    z-index: 2;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .formation-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
  }

  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--semantic-error, #ef4444);
    box-shadow: 0 0 6px var(--semantic-error, #ef4444);
    z-index: 3;
    pointer-events: none;
    border-radius: 1px;
  }

  .beat-numbers {
    position: absolute;
    bottom: 4px;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  .beat-numbers span {
    position: absolute;
    transform: translateX(-50%);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  @media (prefers-reduced-motion: reduce) {
    .formation-chip {
      transition: none;
    }
  }
</style>
