<!--
  DurationPreviewGrid.svelte

  Displays a grid of beat numbers with their duration values.
  Used in the save mode to show the current sequence's duration pattern.
-->
<script lang="ts">
  import { formatDurationCompact } from "../../domain/models/duration-pattern-data";

  interface Props {
    /** Array of duration values (one per step) */
    durations: number[];
    /** Optional title to display above the grid */
    title?: string;
  }

  let { durations, title }: Props = $props();
</script>

<div class="duration-preview">
  {#if title}
    <h3>{title}</h3>
  {/if}
  <div class="preview-grid">
    {#each durations as duration, i}
      <div class="preview-beat">
        <span class="beat-num">{i + 1}</span>
        <span class="duration-value">
          {formatDurationCompact(duration)}
        </span>
      </div>
    {/each}
  </div>
</div>

<style>
  .duration-preview {
    margin-bottom: 16px;
  }

  .duration-preview h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0 0 12px;
    color: var(--theme-text-dim);
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 6px;
  }

  .preview-beat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px;
    background: var(--theme-card-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    gap: 4px;
  }

  .beat-num {
    font-weight: 600;
    color: var(--theme-text-dim);
  }

  .duration-value {
    font-family: monospace;
    font-size: 0.9rem;
    font-weight: 600;
    color: #f97316;
  }
</style>
