<script lang="ts">
  /**
   * Beat Pair Selection Status
   *
   * Shows the current beat pair selection state with clear indicators.
   * Uses shared design tokens from app.css.
   */
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    firstBeat: number | null;
    secondBeat: number | null;
    onClear: () => void;
  }

  let { firstBeat, secondBeat, onClear }: Props = $props();
</script>

{#if firstBeat !== null || secondBeat !== null}
  <div class="beatpair-selection-status">
    <div class="beatpair-selection-info">
      {#if firstBeat !== null}
        <span class="beatpair-key">
          <span class="beatpair-indicator key"></span>
          Key Beat: {firstBeat}
        </span>
      {/if}
      {#if secondBeat !== null}
        <span class="beatpair-arrow">→</span>
        <span class="beatpair-corresponding">
          <span class="beatpair-indicator corresponding"></span>
          Corresponding: {secondBeat}
        </span>
      {/if}
    </div>
    <button
      class="clear-selection-btn"
      onclick={onClear}
      title="Clear selection and start over"
    >
      <FontAwesomeIcon icon="xmark" size="0.9em" />
      Clear
    </button>
  </div>
{/if}

<style>
  .beatpair-selection-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 8px;
  }

  .beatpair-selection-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex: 1;
    flex-wrap: wrap;
  }

  .beatpair-key,
  .beatpair-corresponding {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--foreground);
  }

  .beatpair-indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  .beatpair-indicator.key {
    background: rgba(34, 197, 94, 0.35);
    border: 2px solid rgba(34, 197, 94, 0.9);
  }

  .beatpair-indicator.corresponding {
    background: rgba(168, 85, 247, 0.35);
    border: 2px solid rgba(168, 85, 247, 0.9);
  }

  .beatpair-arrow {
    color: var(--muted);
    font-size: var(--font-size-sm);
  }

  .clear-selection-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
    min-height: var(--min-touch-target);
  }

  .clear-selection-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }
</style>
