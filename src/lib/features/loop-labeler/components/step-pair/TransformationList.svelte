<script lang="ts">
  /**
   * Transformation List
   *
   * Displays detected transformations as selectable options.
   * Uses shared design tokens from app.css.
   */
  interface Props {
    transformations: string[];
    selectedTransformation?: string;
    onConfirm: (transformation: string) => void;
  }

  let { transformations, selectedTransformation, onConfirm }: Props = $props();
</script>

{#if transformations.length > 0}
  <div class="detected-transformations">
    <span class="transformations-label">Detected Transformations</span>
    <div class="transformations-list">
      {#each transformations as transformation}
        <button
          class="transformation-option"
          class:selected={selectedTransformation === transformation}
          onclick={() => onConfirm(transformation)}
        >
          {transformation}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .detected-transformations {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .transformations-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .transformations-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .transformation-option {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-inset);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 8px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .transformation-option:hover {
    background: var(--surface-color);
    border-color: var(--theme-stroke-strong);
    color: var(--foreground);
  }

  .transformation-option.selected {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--feature-edit) 30%, transparent) 0%,
      color-mix(in srgb, var(--primary-color) 30%, transparent) 100%
    );
    border-color: var(--theme-accent-strong);
    color: var(--foreground);
    font-weight: 600;
  }
</style>
