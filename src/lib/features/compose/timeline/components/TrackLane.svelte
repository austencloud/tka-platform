<script lang="ts">
  /**
   * TrackLane - A horizontal lane containing clips
   *
   * Renders clips positioned along the timeline.
   * Handles clip interactions (click to select, drag to move).
   */

  import type { TimelineTrack } from "../domain/timeline-types";
  import { getTimelineState } from "../state/timeline-state.svelte";
  import TimelineClip from "./TimelineClip.svelte";
  import { timeToPixels } from "../domain/timeline-types";
  import { container } from "$lib/shared/di";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";

  interface Props {
    track: TimelineTrack;
    pixelsPerSecond: number;
  }

  let { track, pixelsPerSecond }: Props = $props();

  function getState() {
    return getTimelineState();
  }

  // Deduplicate clips by ID to prevent Svelte each_key_duplicate errors
  const deduplicatedClips = $derived.by(() => {
    const seenIds = new Set<string>();
    return track.clips.filter((clip) => {
      if (seenIds.has(clip.id)) {
        console.warn(`[TrackLane] Filtered duplicate clip ID: ${clip.id}`);
        return false;
      }
      seenIds.add(clip.id);
      return true;
    });
  });

  // Track is empty if no clips
  const isEmpty = $derived(track.clips.length === 0);

  // Dynamic height: collapsed when empty, full when has clips
  const COLLAPSED_HEIGHT = 40;
  const effectiveHeight = $derived(isEmpty ? COLLAPSED_HEIGHT : track.height);

  // Local reactive state
  let isDimmed = $state(false);
  let selectedClipIds = $state<string[]>([]);
  let isDragOver = $state(false);

  // Sync local state from timeline state
  $effect(() => {
    const state = getState();
    const hasSoloedTrack = state.project.tracks.some((t) => t.solo);
    isDimmed = track.muted || (hasSoloedTrack && !track.solo);
    selectedClipIds = state.selection.selectedClipIds;
  });

  // Handle drop of sequence onto track
  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/json");
    if (!data) return;

    try {
      const sequenceData = JSON.parse(data);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      // getBoundingClientRect already accounts for scroll (returns screen coords)
      // so x is the correct pixel position within the timeline's coordinate space
      const time = x / pixelsPerSecond;

      // If sequence needs full load, fetch it first
      let sequence = sequenceData;
      if (sequenceData._needsFullLoad) {
        try {
          const loader = container.items.discoverLoader as IDiscoverLoader;
          if (loader) {
            const fullSequence = await loader.loadFullSequenceData(
              sequenceData.word || sequenceData.name || sequenceData.id
            );
            if (fullSequence) {
              sequence = fullSequence;
            }
          }
        } catch (loadErr) {
          console.warn(
            "[TrackLane] Could not load full sequence, using metadata:",
            loadErr
          );
        }
      }

      getState().addClip(sequence, track.id, time);
    } catch (err) {
      console.error("Failed to parse dropped sequence:", err);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
  }
</script>

<div
  class="track-lane"
  class:muted={track.muted}
  class:dimmed={isDimmed}
  class:locked={track.locked}
  class:empty={isEmpty}
  class:drag-over={isDragOver}
  style="height: {effectiveHeight}px"
  ondrop={(e) => {
    isDragOver = false;
    handleDrop(e);
  }}
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  role="list"
  aria-label="Track {track.name}"
>
  <!-- Grid lines (beat markers would go here) -->
  <div class="grid-lines"></div>

  <!-- Clips -->
  {#each deduplicatedClips as clip (clip.id)}
    <TimelineClip
      {clip}
      {pixelsPerSecond}
      selected={selectedClipIds.includes(clip.id)}
    />
  {/each}

  <!-- Lock overlay -->
  {#if track.locked}
    <div class="lock-overlay">
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .track-lane {
    position: relative;
    background: var(--theme-panel-bg);
    border-bottom: 1px solid var(--theme-stroke);
    transition:
      height 0.2s ease,
      opacity 0.2s ease,
      background 0.2s ease;
  }

  /* Alternating track colors for visual distinction */
  .track-lane:nth-child(odd) {
    background: var(--theme-card-bg);
  }

  .track-lane.dimmed {
    opacity: 0.35;
  }

  .track-lane.locked {
    pointer-events: none;
  }

  /* Empty track - collapsed but still a valid drop target */
  .track-lane.empty {
    border-style: dashed;
    border-color: var(--theme-stroke-strong);
    background: color-mix(in srgb, var(--theme-panel-bg) 50%, transparent);
  }

  .track-lane.empty:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: var(--theme-accent);
  }

  /* Drag over state - show drop target highlight */
  .track-lane.drag-over {
    background: color-mix(
      in srgb,
      var(--theme-accent) 15%,
      transparent
    ) !important;
    border-color: var(--theme-accent);
    box-shadow: inset 0 0 20px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .grid-lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* Subtle vertical grid lines using theme */
    background-image: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(100% - 1px),
      var(--theme-stroke, var(--theme-card-bg)) calc(100% - 1px),
      var(--theme-stroke, var(--theme-card-bg)) 100%
    );
    background-size: 50px 100%; /* Adjusts with zoom via parent */
  }

  .lock-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-2xl);
    pointer-events: none;
  }
</style>
