<!--
  AnimationBeatGrid.svelte

  Beat grid for animation panels (Create and Compose modules).
  Shows sequence beats with playback sync highlighting (golden glow on current beat).
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import TKAGlyph from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";

  let {
    sequenceData = null,
    currentBeat = 0,
    isPlaying = false,
  }: {
    sequenceData: SequenceData | null;
    currentBeat: number;
    isPlaying: boolean;
  } = $props();

  // Get beats from sequence (excluding metadata beat at index 0 if present)
  const beats = $derived(() => {
    if (!sequenceData?.beats) return [];
    // beats[0] is usually start position data embedded, actual beats start at 1
    return sequenceData.beats.slice(1);
  });

  // Calculate grid columns based on beat count
  const gridColumns = $derived(() => {
    const count = beats().length;
    if (count <= 4) return count || 1;
    if (count <= 8) return 4;
    if (count <= 12) return 4;
    return 5;
  });

  // Calculate which beat index is current (accounting for animation timing)
  const currentBeatIndex = $derived(() => {
    // currentBeat is 0-indexed from animation, but our display is 1-indexed
    return Math.floor(currentBeat);
  });
</script>

<div class="animation-beat-grid">
  {#if beats().length === 0}
    <div class="empty-state">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <span>No sequence loaded</span>
    </div>
  {:else}
    <div class="beat-grid" style:--grid-cols={gridColumns()}>
      {#each beats() as beat, index}
        {@const beatNumber = index + 1}
        {@const isCurrentBeat = isPlaying && currentBeatIndex() === index}
        {@const wasPlayed = isPlaying && currentBeatIndex() > index}
        <div
          class="beat-cell"
          class:current={isCurrentBeat}
          class:played={wasPlayed}
        >
          <div class="beat-content">
            <TKAGlyph pictographData={beat} letter={beat?.letter} />
          </div>
          <span class="beat-number">{beatNumber}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .animation-beat-grid {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    overflow: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: 0.85rem;
  }

  .empty-state i {
    font-size: 1.5rem;
    opacity: 0.6;
  }

  .beat-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols), 1fr);
    gap: 4px;
    width: 100%;
    max-width: 360px;
  }

  .beat-cell {
    position: relative;
    aspect-ratio: 1;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    overflow: hidden;
  }

  .beat-cell.current {
    border-color: rgba(251, 191, 36, 0.8);
    box-shadow:
      0 0 12px rgba(251, 191, 36, 0.4),
      0 0 24px rgba(251, 191, 36, 0.2),
      inset 0 0 8px rgba(251, 191, 36, 0.1);
    background: rgba(251, 191, 36, 0.08);
  }

  .beat-cell.played {
    opacity: 0.5;
  }

  .beat-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }

  .beat-number {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    font-variant-numeric: tabular-nums;
  }

  .beat-cell.current .beat-number {
    color: white;
  }

  /* Responsive sizing */
  @media (max-width: 400px) {
    .beat-grid {
      max-width: 300px;
      gap: 3px;
    }
  }
</style>
