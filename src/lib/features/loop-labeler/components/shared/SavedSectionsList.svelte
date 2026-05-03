<script lang="ts">
  /**
   * Saved Sections List
   *
   * Displays saved section designations with color-coded borders.
   * Uses shared design tokens from app.css.
   */
  import type { SectionDesignation } from "../../domain/models/section-models";
  import { SECTION_COLORS } from "../../domain/constants/section-colors";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import { getLabelFormatter } from "$lib/features/loop-labeler/getLabelFormatter";
  import type { LabelFormatter } from "../../services/implementations/LabelFormatter";
  const labelFormatter = getLabelFormatter() as LabelFormatter;

  interface Props {
    sections: SectionDesignation[];
    onRemove: (index: number) => void;
  }

  let { sections, onRemove }: Props = $props();
</script>

{#if sections.length > 0}
  <div class="saved-sections">
    <span class="saved-label">Saved sections</span>
    {#each sections as section, i}
      <div
        class="saved-section-tag"
        style="--section-color: {SECTION_COLORS[i % SECTION_COLORS.length]
          ?.border}"
      >
        <div class="section-info">
          <span class="section-steps">{labelFormatter.formatSectionSteps(section.steps)}</span>
          <span class="section-components">{labelFormatter.formatDesignation(section)}</span>
        </div>
        <button
          class="remove-btn"
          onclick={() => onRemove(i)}
          title="Remove section"
          aria-label="Remove section {i + 1}"
        >
          <FontAwesomeIcon icon="xmark" size="0.85em" />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .saved-sections {
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

  .saved-section-tag {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-inset);
    border-radius: 8px;
    border-left: 4px solid var(--section-color, color-mix(in srgb, var(--semantic-info) 80%, transparent));
  }

  .section-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .section-steps {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--foreground);
  }

  .section-components {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
