<script lang="ts">
  /**
   * BeatPlaneStrip
   *
   * Horizontal timeline of small colored cells, one per beat.
   * Each cell is split top/bottom for blue/red hand plane assignments.
   * Color = plane (purple=Wall, blue=Wheel, green=Floor).
   * Clicking a cell navigates to that beat.
   */

  import { Plane, PLANE_COLORS } from "../../domain/enums/Plane";

  interface Props {
    totalBeats: number;
    currentBeatIndex: number;
    beatPlaneOverrides: Map<number, { blue?: Plane; red?: Plane }>;
    onBeatClick: (index: number) => void;
  }

  let { totalBeats, currentBeatIndex, beatPlaneOverrides, onBeatClick }: Props = $props();

  function getColor(beatIndex: number, hand: "blue" | "red"): string {
    const override = beatPlaneOverrides.get(beatIndex);
    const plane = hand === "blue" ? override?.blue : override?.red;
    // Default (WALL or no override) shows as a subtle base color
    if (!plane || plane === Plane.WALL) return PLANE_COLORS[Plane.WALL];
    return PLANE_COLORS[plane] ?? PLANE_COLORS[Plane.WALL];
  }

  function hasOverride(beatIndex: number): boolean {
    return beatPlaneOverrides.has(beatIndex);
  }

  // Build beat indices as a stable array
  const beatIndices = $derived(Array.from({ length: totalBeats }, (_, i) => i));
</script>

{#if totalBeats > 1}
  <div class="beat-plane-strip" role="group" aria-label="Per-beat plane assignments">
    {#each beatIndices as i (i)}
      <button
        class="beat-cell"
        class:current={i === currentBeatIndex}
        class:has-override={hasOverride(i)}
        onclick={() => onBeatClick(i)}
        title="Beat {i + 1}{hasOverride(i) ? ' (custom planes)' : ''}"
        aria-label="Beat {i + 1}"
        aria-current={i === currentBeatIndex ? "step" : undefined}
      >
        <div class="hand-half blue-half" style="background: {getColor(i, 'blue')};"></div>
        <div class="hand-half red-half" style="background: {getColor(i, 'red')};"></div>
      </button>
    {/each}
  </div>
{/if}

<style>
  .beat-plane-strip {
    display: flex;
    gap: 2px;
    padding: 4px 8px;
    overflow-x: auto;
    scrollbar-width: none;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .beat-plane-strip::-webkit-scrollbar {
    display: none;
  }

  .beat-cell {
    display: flex;
    flex-direction: column;
    width: 16px;
    min-width: 16px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .beat-cell:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .beat-cell.current {
    border-color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
  }

  .beat-cell.has-override {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .hand-half {
    flex: 1;
  }

  .blue-half {
    border-radius: 2px 2px 0 0;
  }

  .red-half {
    border-radius: 0 0 2px 2px;
  }
</style>
