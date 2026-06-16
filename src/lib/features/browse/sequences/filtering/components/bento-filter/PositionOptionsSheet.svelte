<!--
PositionOptionsSheet.svelte - Sheet for configuring start/end position filters
Uses shared PositionSection components for consistent UX with Generate module
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import PositionSection from "$lib/shared/components/position-picker/PositionSection.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

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
        {t('browse_clear_all_positions')}
      </button>
    </div>
  {/if}

  <div class="sections-container">
    <PositionSection
      title={t('browse_start_position')}
      description={t('browse_start_position_desc')}
      currentPosition={startPosition}
      onPositionChange={onStartPositionChange}
    />

    <PositionSection
      title={t('browse_end_position')}
      description={t('browse_end_position_desc')}
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
    background: var(--semantic-error-dim);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
    border-radius: 12px;
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-all-button:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 50%, transparent);
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
