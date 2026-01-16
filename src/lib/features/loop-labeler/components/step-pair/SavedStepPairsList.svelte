<script lang="ts">
  /**
   * Saved Beat Pairs List
   *
   * Displays saved beat pair relationships with transformation info.
   * Uses shared design tokens from app.css.
   */
  import type { BeatPairRelationship } from "../../domain/models/beatpair-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    beatPairs: BeatPairRelationship[];
    onRemove: (index: number) => void;
  }

  let { beatPairs, onRemove }: Props = $props();
</script>

{#if beatPairs.length > 0}
  <div class="saved-beatpairs">
    <span class="saved-label">Saved beat pairs</span>
    {#each beatPairs as pair, i}
      <div class="saved-beatpair-tag">
        <span class="beatpair-beats"
          >{pair.keyBeat} ↔ {pair.correspondingBeat}</span
        >
        <span class="beatpair-transformation">
          {pair.confirmedTransformation || pair.detectedTransformations[0]}
        </span>
        <button
          class="remove-btn"
          onclick={() => onRemove(i)}
          title="Remove beat pair"
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

  .saved-beatpair-tag {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border-left: 4px solid rgba(168, 85, 247, 0.8);
  }

  .beatpair-beats {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--foreground);
    min-width: 70px;
  }

  .beatpair-transformation {
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
    background: rgba(239, 68, 68, 0.2);
    color: var(--semantic-error);
  }
</style>
