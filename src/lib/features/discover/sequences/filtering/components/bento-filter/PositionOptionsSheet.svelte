<!--
PositionOptionsSheet.svelte - Sheet for configuring start/end position filters
Uses shared PositionSection components for consistent UX with Generate module
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import PositionSection from "$lib/shared/components/position-picker/PositionSection.svelte";

  let {
    startPosition = null,
    endPosition = null,
    onStartPositionChange,
    onEndPositionChange,
    onClearAll,
  } = $props<{
    startPosition: PictographData | null;
    endPosition: PictographData | null;
    onStartPositionChange: (position: PictographData | null) => void;
    onEndPositionChange: (position: PictographData | null) => void;
    onClearAll: () => void;
  }>();

  const hasAnySelection = $derived(
    startPosition !== null || endPosition !== null
  );
</script>

<div class="position-options-content">
  {#if hasAnySelection}
    <div class="clear-section">
      <button class="clear-all-button" onclick={onClearAll} type="button">
        Clear All Positions
      </button>
    </div>
  {/if}

  <div class="sections-container">
    <PositionSection
      title="Start Position"
      description="Filter by where sequences begin"
      currentPosition={startPosition}
      onPositionChange={onStartPositionChange}
    />

    <PositionSection
      title="End Position"
      description="Filter by where sequences end"
      currentPosition={endPosition}
      onPositionChange={onEndPositionChange}
    />
  </div>
</div>

<style>
  .position-options-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: rgba(0, 0, 0, 0.08);
  }

  .clear-section {
    padding: 16px 24px;
    background: var(--theme-card-bg);
  }

  .clear-all-button {
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    color: rgba(239, 68, 68, 0.9);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-all-button:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .clear-all-button:active {
    transform: scale(0.98);
  }

  .sections-container {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  /* Mobile responsiveness */
  @media (max-width: 380px) {
    .clear-section {
      padding: 12px 20px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .clear-all-button {
      transition: none;
    }
  }
</style>
