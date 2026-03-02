<script lang="ts">
  /**
   * Saved Beat Pairs List
   *
   * Displays saved beat pair relationships with transformation info.
   * Uses shared design tokens from app.css.
   */
  import type { StepPairRelationship } from "../../domain/models/steppair-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    stepPairs: StepPairRelationship[];
    onRemove: (index: number) => void;
  }

  let { stepPairs, onRemove }: Props = $props();
</script>

{#if stepPairs.length > 0}
  <div class="saved-beatpairs">
    <span class="saved-label">Saved beat pairs</span>
    {#each stepPairs as pair, i}
      <div class="saved-steppair-tag">
        <span class="steppair-steps"
          >{pair.keyStep} ↔ {pair.correspondingStep}</span
        >
        <span class="steppair-transformation">
          {pair.confirmedTransformation || pair.detectedTransformations[0]}
        </span>
        <button
          class="remove-btn"
          onclick={() => onRemove(i)}
          title="Remove beat pair"
          aria-label="Remove beat pair {i + 1}"
        >
          <FontAwesomeIcon icon="xmark" size="0.85em" />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .saved-beatpairs {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--surface-glass);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .saved-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
    margin-bottom: var(--spacing-xs);
  }

  .saved-steppair-tag {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-inset);
    border-radius: 8px;
    border-left: 4px solid color-mix(in srgb, var(--feature-edit) 80%, transparent);
  }

  .steppair-steps {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--foreground);
    min-width: 70px;
  }

  .steppair-transformation {
    flex: 1;
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
    transition: var(--transition-micro);
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }
</style>
