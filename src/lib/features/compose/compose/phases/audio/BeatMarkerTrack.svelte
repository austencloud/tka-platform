<!--
  BeatMarkerTrack.svelte

  Beat marker component showing measure markers on timeline.
  Shows only downbeats (measure starts) by default for clarity.
-->
<script lang="ts">
  import type { BeatMarker } from "../../state/composition-state.svelte";
  import { generateStepTimestamps } from "./bpm-analyzer";

  let {
    duration,
    bpm,
    currentTime = 0,
    beatMarkers = [],
    onAddMarker,
    onRemoveMarker,
  }: {
    duration: number;
    bpm: number | null;
    currentTime?: number;
    beatMarkers?: BeatMarker[];
    onAddMarker?: (marker: BeatMarker) => void;
    onRemoveMarker?: (id: string) => void;
  } = $props();

  // Toggle to show all beats vs just downbeats
  let showAllSteps = $state(false);

  // Generate beat positions based on BPM
  const generatedSteps = $derived(
    bpm && duration > 0 ? generateStepTimestamps(bpm, duration) : []
  );

  // Filter to only downbeats (every 4th beat) unless showing all
  const visibleSteps = $derived(() => {
    if (showAllSteps) return generatedSteps;
    return generatedSteps.filter((_, index) => index % 4 === 0);
  });

  // Get position percentage for a timestamp
  function getPositionPercent(time: number): number {
    return duration > 0 ? (time / duration) * 100 : 0;
  }

  // Find current measure index
  const currentMeasure = $derived(() => {
    if (!bpm || duration <= 0) return -1;
    const beatInterval = 60 / bpm;
    return Math.floor(currentTime / stepInterval / 4);
  });

  // Add a custom marker at current playhead position
  function addMarkerAtPlayhead() {
    if (duration <= 0) return;

    const newMarker: BeatMarker = {
      id: `marker-${Date.now()}`,
      beat: Math.floor((currentTime / duration) * (generatedSteps.length || 1)),
      time: currentTime,
    };

    onAddMarker?.(newMarker);
  }
</script>

<div class="beat-marker-track">
  <!-- Header with label and controls -->
  <div class="track-header">
    <div class="header-left">
      <i class="fas fa-drum" aria-hidden="true"></i>
      <span class="track-label">Beat Markers</span>
      {#if bpm}
        <span class="bpm-badge">{bpm} BPM</span>
      {/if}
    </div>
    <div class="header-controls">
      <label class="toggle-label">
        <input
          type="checkbox"
          bind:checked={showAllSteps}
          aria-label="Show all beats instead of just downbeats"
        />
        <span>Show all steps</span>
      </label>
      <button
        class="add-marker-btn"
        onclick={addMarkerAtPlayhead}
        disabled={duration <= 0}
        title="Add custom marker at playhead"
      >
        <i class="fas fa-flag" aria-hidden="true"></i>
        Add Marker
      </button>
    </div>
  </div>

  <!-- Beat visualization track -->
  <div class="track-body">
    {#if generatedSteps.length > 0}
      <div class="steps-container">
        {#each visibleSteps() as stepTime, index}
          {@const position = getPositionPercent(stepTime)}
          {@const measureNum = showAllSteps
            ? Math.floor(index / 4) + 1
            : index + 1}
          {@const isCurrentMeasure =
            currentMeasure() === (showAllSteps ? Math.floor(index / 4) : index)}
          {@const isDownbeat = !showAllBeats || index % 4 === 0}
          <div
            class="beat-marker"
            class:current={isCurrentMeasure && isDownbeat}
            class:downbeat={isDownbeat}
            style="left: {position}%"
            title="Measure {measureNum} at {stepTime.toFixed(1)}s"
          >
            {#if isDownbeat}
              <span class="measure-number">{measureNum}</span>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="no-steps">
        <i class="fas fa-music" aria-hidden="true"></i>
        <span>Set BPM to see beat markers</span>
      </div>
    {/if}

    <!-- Custom markers (user-added) -->
    {#if beatMarkers.length > 0}
      <div class="custom-markers">
        {#each beatMarkers as marker}
          <button
            class="custom-marker"
            style="left: {getPositionPercent(marker.time)}%"
            onclick={() => onRemoveMarker?.(marker.id)}
            title="Custom marker at {marker.time.toFixed(1)}s - click to remove"
            aria-label="Remove custom marker"
          >
            <i class="fas fa-flag" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Playhead indicator -->
    <div
      class="playhead"
      style="left: {getPositionPercent(currentTime)}%"
    ></div>
  </div>

  <!-- Footer info -->
  {#if beatMarkers.length > 0}
    <div class="track-footer">
      <span class="marker-count">
        <i class="fas fa-flag" aria-hidden="true"></i>
        {beatMarkers.length} custom marker{beatMarkers.length !== 1 ? "s" : ""}
      </span>
    </div>
  {/if}
</div>

<style>
  .beat-marker-track {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Header */
  .track-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-left i {
    color: rgba(139, 92, 246, 0.7);
    font-size: 0.85rem;
  }

  .track-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .bpm-badge {
    padding: 0.15rem 0.4rem;
    background: rgba(139, 92, 246, 0.25);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(167, 139, 250, 0.95);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: rgba(139, 92, 246, 0.8);
    cursor: pointer;
  }

  .add-marker-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    background: rgba(251, 191, 36, 0.5);
    border: 1px solid rgba(251, 191, 36, 0.6);
    border-radius: 5px;
    color: white;
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .add-marker-btn:hover:not(:disabled) {
    background: rgba(251, 191, 36, 0.6);
    border-color: rgba(251, 191, 36, 0.7);
  }

  .add-marker-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Track body - beat visualization */
  .track-body {
    position: relative;
    height: 50px;
    background: rgba(0, 0, 0, 0.2);
  }

  .steps-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .beat-marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(139, 92, 246, 0.4);
    transition: background var(--duration-instant) ease;
  }

  .beat-marker.downbeat {
    width: 3px;
    background: rgba(139, 92, 246, 0.6);
  }

  .beat-marker.current {
    background: rgba(167, 139, 250, 1);
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
  }

  .measure-number {
    position: absolute;
    top: 4px;
    left: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--theme-text-dim);
    user-select: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .no-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-min);
  }

  .no-steps i {
    font-size: 1rem;
    opacity: 0.6;
  }

  /* Custom markers */
  .custom-markers {
    position: absolute;
    inset: 0;
    z-index: 2;
  }

  .custom-marker {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(251, 191, 36, 0.5);
    border: 1px solid rgba(251, 191, 36, 0.7);
    border-radius: 50%;
    color: white;
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .custom-marker:hover {
    background: rgba(251, 191, 36, 0.6);
    border-color: rgba(251, 191, 36, 0.9);
    transform: translate(-50%, -50%) scale(1.15);
  }

  /* Playhead */
  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(255, 255, 255, 0.95);
    z-index: 3;
    pointer-events: none;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
  }

  /* Footer */
  .track-footer {
    padding: 0.35rem 0.75rem;
    background: rgba(0, 0, 0, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .marker-count {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--font-size-compact);
    color: white;
  }

  .marker-count i {
    font-size: var(--font-size-compact);
    color: rgba(251, 191, 36, 0.9);
  }
</style>
