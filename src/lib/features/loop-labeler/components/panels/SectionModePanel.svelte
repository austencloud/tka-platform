<script lang="ts">
  /**
   * Section Mode Builder Panel
   *
   * Select beat ranges and assign component transformations or base words.
   * Uses shared design tokens from app.css.
   */
  import type { SectionDesignation } from "../../domain/models/section-models";
  import type { ComponentId } from "../../domain/constants/loop-components";
  import SavedSectionsList from "../shared/SavedSectionsList.svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import { BASE_COMPONENTS } from "../../domain/constants/loop-components";
  import { BASE_WORDS } from "../../domain/constants/base-words";

  interface Props {
    selectedSteps: Set<number>;
    selectedComponents: Set<ComponentId>;
    savedSections: SectionDesignation[];
    selectedBaseWord: string | null;
    onBaseWordChange: (baseWord: string | null) => void;
    onAddSection: () => void;
    onRemoveSection: (index: number) => void;
    onMarkUnknown: () => void;
    onNext: () => void;
    canProceed: boolean;
  }

  let {
    selectedSteps,
    selectedComponents,
    savedSections,
    selectedBaseWord,
    onBaseWordChange,
    onAddSection,
    onRemoveSection,
    onMarkUnknown,
    onNext,
    canProceed,
  }: Props = $props();

  const selectionLabel = $derived(() => {
    if (selectedComponents.size === 0) return "None";
    return Array.from(selectedComponents)
      .map((c) => BASE_COMPONENTS.find((b) => b.id === c)?.label ?? c)
      .join(" + ");
  });
</script>

<div class="section-panel">
  <div class="section-hint">
    Click start beat, then end beat to select range. Pick components or base
    word, then "Add Section".
  </div>

  <!-- Current selection status -->
  {#if selectedSteps.size > 0}
    <div class="selection-status">
      <span class="step-count">{selectedSteps.size} steps selected</span>
      {#if selectedComponents.size > 0}
        <span class="arrow">→</span>
        <span class="components">{selectionLabel()}</span>
      {/if}
    </div>
  {/if}

  <!-- Base Word selector -->
  <div class="base-word-section">
    <div class="section-header">
      <span class="section-label">Base Word (optional)</span>
      {#if selectedBaseWord}
        <button class="clear-btn" onclick={() => onBaseWordChange(null)}>
          Clear
        </button>
      {/if}
    </div>
    <div class="chip-group">
      {#each BASE_WORDS as baseWord}
        <button
          class="base-chip"
          class:selected={selectedBaseWord === baseWord.id}
          onclick={() =>
            onBaseWordChange(
              selectedBaseWord === baseWord.id ? null : baseWord.id
            )}
        >
          {baseWord.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- Add Section button -->
  <button
    class="btn-add"
    onclick={onAddSection}
    disabled={selectedSteps.size === 0 ||
      (selectedComponents.size === 0 && !selectedBaseWord)}
  >
    <FontAwesomeIcon icon="plus" size="1em" />
    Add Section
  </button>

  <!-- Unknown button -->
  <button class="btn-unknown" onclick={onMarkUnknown}>
    Unknown - Review Later
  </button>

  <!-- Saved sections -->
  <SavedSectionsList sections={savedSections} onRemove={onRemoveSection} />

  <!-- Next button -->
  {#if savedSections.length > 0}
    <button
      class="btn-next"
      onclick={onNext}
      disabled={!canProceed}
      title={!canProceed
        ? "Save or clear your current selection first"
        : "Go to next sequence"}
    >
      Next
      <FontAwesomeIcon icon="arrow-right" size="0.9em" />
    </button>
  {/if}
</div>

<style>
  .section-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-hint {
    font-size: var(--font-size-sm);
    color: var(--muted-foreground);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-color);
    border-radius: 6px;
    border-left: 3px solid var(--primary-color);
  }

  .selection-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-warning) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    border-radius: 8px;
  }

  .step-count {
    font-weight: 600;
    color: var(--semantic-warning);
  }

  .arrow {
    color: var(--muted-foreground);
  }

  .components {
    color: var(--foreground);
  }

  .base-word-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-label {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .clear-btn {
    padding: 2px var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .clear-btn:hover {
    background: var(--surface-color);
    color: var(--foreground);
  }

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .base-chip {
    padding: 4px 8px;
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    font-family: monospace;
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .base-chip:hover {
    background: var(--surface-hover);
    color: var(--foreground);
  }

  .base-chip.selected {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 50%, transparent);
    color: color-mix(in srgb, var(--semantic-success) 65%, white);
  }

  .btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--gradient-primary);
    border: none;
    border-radius: 8px;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-add:hover:not(:disabled) {
    transform: translateY(var(--hover-lift-sm));
    box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 40%, transparent);
  }

  .btn-add:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-unknown {
    padding: var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-warning) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    border-radius: 8px;
    color: var(--semantic-warning);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-unknown:hover {
    background: color-mix(in srgb, var(--semantic-warning) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning) 60%, transparent);
  }

  .btn-next {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: linear-gradient(
      135deg,
      var(--semantic-success) 0%,
      color-mix(in srgb, var(--semantic-success) 60%, black) 100%
    );
    border: none;
    border-radius: 8px;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-next:hover:not(:disabled) {
    transform: translateY(var(--hover-lift-sm));
    box-shadow: 0 4px 12px color-mix(in srgb, var(--semantic-success) 40%, transparent);
  }

  .btn-next:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
</style>
