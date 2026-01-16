<script lang="ts">
  /**
   * Beat Pair Selection Status
   *
   * Shows the current beat pair selection state with clear indicators.
   * Uses shared design tokens from app.css.
   */
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    firstStep: number | null;
    secondStep: number | null;
    onClear: () => void;
  }

  let { firstStep, secondStep, onClear }: Props = $props();
</script>

{#if firstStep !== null || secondStep !== null}
  <div class="steppair-selection-status">
    <div class="steppair-selection-info">
      {#if firstStep !== null}
        <span class="steppair-key">
          <span class="steppair-indicator key"></span>
          Key Beat: {firstStep}
        </span>
      {/if}
      {#if secondStep !== null}
        <span class="steppair-arrow">→</span>
        <span class="steppair-corresponding">
          <span class="steppair-indicator corresponding"></span>
          Corresponding: {secondStep}
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
  .steppair-selection-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 8px;
  }

  .steppair-selection-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex: 1;
    flex-wrap: wrap;
  }

  .steppair-key,
  .steppair-corresponding {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--foreground);
  }

  .steppair-indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  .steppair-indicator.key {
    background: rgba(34, 197, 94, 0.35);
    border: 2px solid rgba(34, 197, 94, 0.9);
  }

  .steppair-indicator.corresponding {
    background: rgba(168, 85, 247, 0.35);
    border: 2px solid rgba(168, 85, 247, 0.9);
  }

  .steppair-arrow {
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
