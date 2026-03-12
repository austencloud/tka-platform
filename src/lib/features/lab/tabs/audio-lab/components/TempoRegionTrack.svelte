<!--
  TempoRegionTrack.svelte

  Visual track for managing tempo regions (variable BPM).
  Shows colored regions representing different tempos across the timeline.
  Allows adding, editing, and removing tempo regions.
-->
<script lang="ts">
  
  import type { TempoRegion } from "$lib/features/compose/compose/state/composition-types";

  let {
    duration,
    currentTime = 0,
    baseBpm,
    tempoRegions = [],
    onAddRegion,
    onRemoveRegion,
    onUpdateRegion,
  }: {
    duration: number;
    currentTime?: number;
    baseBpm: number | null;
    tempoRegions?: TempoRegion[];
    onAddRegion?: (region: TempoRegion) => void;
    onRemoveRegion?: (id: string) => void;
    onUpdateRegion?: (id: string, updates: Partial<TempoRegion>) => void;
  } = $props();

  let isAddingRegion = $state(false);
  let newRegionStart = $state(0);
  let newRegionEnd = $state(0);
  let newRegionBpm = $state(120);
  let editingRegionId = $state<string | null>(null);

  // Get position percentage for a timestamp
  function getPositionPercent(time: number): number {
    return duration > 0 ? (time / duration) * 100 : 0;
  }

  // Get width percentage for a region
  function getWidthPercent(start: number, end: number): number {
    return duration > 0 ? ((end - start) / duration) * 100 : 0;
  }

  // Get current BPM at playhead position
  const currentBpm = $derived(() => {
    for (const region of tempoRegions) {
      if (currentTime >= region.startTime && currentTime < region.endTime) {
        return region.bpm;
      }
    }
    return baseBpm ?? 120;
  });

  // Start adding a new region at current playhead
  function startAddingRegion() {
    newRegionStart = currentTime;
    newRegionEnd = Math.min(duration, currentTime + 10); // Default 10 second region
    newRegionBpm = baseBpm ?? 120;
    isAddingRegion = true;
  }

  // Confirm adding the new region
  function confirmAddRegion() {
    if (newRegionStart >= newRegionEnd) return;

    const newRegion: TempoRegion = {
      id: `tempo-${Date.now()}`,
      startTime: newRegionStart,
      endTime: newRegionEnd,
      bpm: newRegionBpm,
    };

    onAddRegion?.(newRegion);
    isAddingRegion = false;
  }

  // Cancel adding
  function cancelAddRegion() {
    isAddingRegion = false;
  }

  // Start editing a region
  function startEditing(region: TempoRegion) {
    editingRegionId = region.id;
    newRegionStart = region.startTime;
    newRegionEnd = region.endTime;
    newRegionBpm = region.bpm;
  }

  // Save region edit
  function saveEdit() {
    if (!editingRegionId || newRegionStart >= newRegionEnd) return;

    onUpdateRegion?.(editingRegionId, {
      startTime: newRegionStart,
      endTime: newRegionEnd,
      bpm: newRegionBpm,
    });
    editingRegionId = null;
  }

  // Cancel editing
  function cancelEdit() {
    editingRegionId = null;
  }

  // Get color for a BPM (warmer = faster)
  function getBpmColor(bpm: number): string {
    const base = baseBpm ?? 120;
    const diff = bpm - base;
    if (diff > 20) return "rgba(239, 68, 68, 0.4)"; // Red - much faster
    if (diff > 0) return "rgba(251, 191, 36, 0.4)"; // Yellow - faster
    if (diff < -20) return "rgba(59, 130, 246, 0.4)"; // Blue - much slower
    if (diff < 0) return "rgba(34, 197, 94, 0.4)"; // Green - slower
    return "rgba(139, 92, 246, 0.4)"; // Purple - same as base
  }
</script>

<div class="tempo-region-track">
  <div class="track-header">
    <span class="track-label">
      <i class="fas fa-tachometer-alt" aria-hidden="true"></i>
      Tempo Regions
    </span>
    <span class="current-bpm">
      {currentBpm()} BPM
    </span>
    {#if !isAddingRegion && !editingRegionId}
      <button
        class="add-btn"
        onclick={startAddingRegion}
        disabled={duration <= 0}
        title="Add tempo region at playhead"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Region
      </button>
    {/if}
  </div>

  <!-- Region visualization -->
  <div class="track-body">
    <!-- Base BPM indicator -->
    <div class="base-bpm-line" title="Base BPM: {baseBpm ?? 'Not set'}">
      <span class="base-label">{baseBpm ?? "?"}</span>
    </div>

    <!-- Tempo regions -->
    {#each tempoRegions as region}
      {@const isEditing = editingRegionId === region.id}
      <div
        class="tempo-region"
        class:editing={isEditing}
        style="
          left: {getPositionPercent(region.startTime)}%;
          width: {getWidthPercent(region.startTime, region.endTime)}%;
          background: {getBpmColor(region.bpm)};
        "
        onclick={() => startEditing(region)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing(region);
          }
        }}
        role="button"
        tabindex="0"
        aria-label="Edit tempo region: {region.bpm} BPM"
        title="{region.bpm} BPM ({region.startTime.toFixed(
          1
        )}s - {region.endTime.toFixed(1)}s)"
      >
        <span class="region-bpm">{region.bpm}</span>
        {#if !isEditing}
          <button
            class="region-delete"
            onclick={(e) => {
              e.stopPropagation();
              onRemoveRegion?.(region.id);
            }}
            title="Remove region"
            aria-label="Remove region"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/each}

    <!-- Playhead -->
    <div
      class="playhead"
      style="left: {getPositionPercent(currentTime)}%"
    ></div>

    <!-- Empty state -->
    {#if tempoRegions.length === 0 && !isAddingRegion}
      <div class="empty-state">
        <span>No tempo regions. Add one to define variable BPM sections.</span>
      </div>
    {/if}
  </div>

  <!-- Add/Edit Form -->
  {#if isAddingRegion || editingRegionId}
    <div class="region-form">
      <div class="form-row">
        <label>
          Start (s)
          <input
            type="number"
            bind:value={newRegionStart}
            min={0}
            max={duration}
            step={0.1}
          />
        </label>
        <label>
          End (s)
          <input
            type="number"
            bind:value={newRegionEnd}
            min={newRegionStart}
            max={duration}
            step={0.1}
          />
        </label>
        <label>
          BPM
          <input
            type="number"
            bind:value={newRegionBpm}
            min={30}
            max={300}
            step={1}
          />
        </label>
      </div>
      <div class="form-actions">
        {#if isAddingRegion}
          <button class="confirm-btn" onclick={confirmAddRegion}>
            <i class="fas fa-check" aria-hidden="true"></i>
            Add
          </button>
          <button class="cancel-btn" onclick={cancelAddRegion}> Cancel </button>
        {:else}
          <button class="confirm-btn" onclick={saveEdit}>
            <i class="fas fa-check" aria-hidden="true"></i>
            Save
          </button>
          <button class="cancel-btn" onclick={cancelEdit}> Cancel </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .tempo-region-track {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    overflow: hidden;
  }

  .track-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .track-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .track-label i {
    color: rgba(139, 92, 246, 0.7);
  }

  .current-bpm {
    padding: 0.2rem 0.45rem;
    background: rgba(139, 92, 246, 0.25);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(167, 139, 250, 0.95);
  }

  .add-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 5px;
    color: rgba(167, 139, 250, 0.95);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .add-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .add-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Track body */
  .track-body {
    position: relative;
    height: 50px;
    background: rgba(0, 0, 0, 0.2);
  }

  .base-bpm-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-50%);
  }

  .base-label {
    position: absolute;
    left: 4px;
    top: -8px;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  /* Tempo regions */
  .tempo-region {
    position: absolute;
    top: 4px;
    bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-width: 30px;
  }

  .tempo-region:hover {
    border-color: rgba(255, 255, 255, 0.4);
    z-index: 2;
  }

  .tempo-region.editing {
    border-color: rgba(139, 92, 246, 0.8);
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
    z-index: 3;
  }

  .region-bpm {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .region-delete {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.3);
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.55rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .tempo-region:hover .region-delete {
    opacity: 1;
  }

  .region-delete:hover {
    background: rgba(239, 68, 68, 0.5);
  }

  /* Playhead */
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.8);
    pointer-events: none;
    z-index: 4;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.4);
  }

  /* Empty state */
  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    pointer-events: none;
  }

  /* Form */
  .region-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .form-row label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .form-row input {
    padding: 0.35rem 0.5rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: var(--theme-text);
    font-size: 0.85rem;
  }

  .form-row input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .confirm-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 6px;
    color: rgba(34, 197, 94, 0.9);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .confirm-btn:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .cancel-btn {
    padding: 0.4rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }
</style>
