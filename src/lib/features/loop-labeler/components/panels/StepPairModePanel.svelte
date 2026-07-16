<script lang="ts">
  /**
   * Beat Pair Mode Builder Panel
   *
   * Select two steps and specify their transformation relationship.
   * Uses shared design tokens from app.css.
   */
  import type { ComponentId } from "../../domain/constants/loop-components";
  import type {
    TransformationIntervals,
    TransformationInterval,
  } from "../../domain/models/label-models";
  import { BASE_COMPONENTS } from "../../domain/constants/loop-components";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    firstStep: number | null;
    secondStep: number | null;
    selectedComponents: Set<ComponentId>;
    transformationIntervals: TransformationIntervals;
    onClearSelection: () => void;
    onToggleComponent: (component: ComponentId) => void;
    onSetInterval: (
      key: keyof TransformationIntervals,
      value: TransformationInterval
    ) => void;
    onAddBeatPair: () => void;
  }

  let {
    firstStep,
    secondStep,
    selectedComponents,
    transformationIntervals,
    onClearSelection,
    onToggleComponent,
    onSetInterval,
    onAddBeatPair,
  }: Props = $props();

  // Components that support intervals
  const intervalComponents: {
    id: ComponentId;
    key: keyof TransformationIntervals;
    color: string;
  }[] = [
    { id: "rotated", key: "rotation", color: "var(--accent-rotation)" },
    { id: "swapped", key: "swap", color: "var(--accent-swap)" },
    { id: "mirrored", key: "mirror", color: "var(--feature-edit)" },
    { id: "flipped", key: "flip", color: "var(--accent-teal)" },
    { id: "inverted", key: "invert", color: "var(--accent-inversion)" },
  ];

  function getIntervalConfig(id: ComponentId) {
    return intervalComponents.find((c) => c.id === id);
  }

  function hasInterval(id: ComponentId): boolean {
    const config = getIntervalConfig(id);
    if (!config) return false;
    return !!transformationIntervals[config.key];
  }

  function getIntervalDisplay(id: ComponentId): string {
    const config = getIntervalConfig(id);
    if (!config) return "";
    const val = transformationIntervals[config.key];
    if (val === 2) return "½";
    if (val === 4) return "¼";
    return "";
  }

  const canAdd = $derived(
    firstStep !== null && secondStep !== null && selectedComponents.size > 0
  );

  const selectionStatus = $derived.by(() => {
    if (firstStep === null) return "Click first step (key step)";
    if (secondStep === null)
      return `Step ${firstStep} selected → Click second step`;
    return `Step ${firstStep} ↔ Step ${secondStep}`;
  });

  const hasBothBeats = $derived(firstStep !== null && secondStep !== null);
</script>

<div class="builder-panel">
  <p class="builder-hint">
    Select two steps, then choose the transformation that relates them
  </p>

  <!-- Beat Selection Status -->
  <div class="beat-selection" class:complete={hasBothBeats}>
    <span class="selection-text">{selectionStatus}</span>
    {#if firstStep !== null}
      <button
        class="clear-btn"
        onclick={onClearSelection}
        title="Clear selection"
        aria-label="Clear selection"
      >
        <FontAwesomeIcon icon="xmark" size="0.85em" />
      </button>
    {/if}
  </div>

  <!-- Component Grid (shown when both steps selected) -->
  {#if hasBothBeats}
    <div class="component-grid">
      {#each BASE_COMPONENTS as component}
        {@const intervalConfig = getIntervalConfig(component.id)}
        {@const isSelected = selectedComponents.has(component.id)}
        <div class="component-cell">
          <button
            class="component-btn"
            class:selected={isSelected}
            style="--component-color: {component.color}"
            onclick={() => onToggleComponent(component.id)}
            aria-pressed={isSelected}
          >
            <FontAwesomeIcon
              icon={component.icon}
              size="1.2em"
              color={component.color}
            />
            <span class="component-name">{component.label}</span>
            {#if isSelected && hasInterval(component.id)}
              <span class="interval-badge"
                >{getIntervalDisplay(component.id)}</span
              >
            {/if}
          </button>

          {#if isSelected && intervalConfig}
            <div class="interval-row">
              <button
                class="interval-chip"
                class:active={transformationIntervals[intervalConfig.key] === 2}
                style="--chip-color: {intervalConfig.color}"
                onclick={() => onSetInterval(intervalConfig.key, 2)}
                aria-label="Set {component.label} interval to halved"
                aria-pressed={transformationIntervals[intervalConfig.key] === 2}
                >½</button
              >
              <button
                class="interval-chip"
                class:active={transformationIntervals[intervalConfig.key] === 4}
                style="--chip-color: {intervalConfig.color}"
                onclick={() => onSetInterval(intervalConfig.key, 4)}
                aria-label="Set {component.label} interval to quartered"
                aria-pressed={transformationIntervals[intervalConfig.key] === 4}
                >¼</button
              >
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <button class="btn-add" disabled={!canAdd} onclick={onAddBeatPair}>
      <FontAwesomeIcon icon="plus" size="0.9em" />
      Add beat pair
    </button>
  {/if}
</div>

<style>
  .builder-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--surface-dark);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .builder-hint {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    text-align: center;
  }

  /* Beat Selection */
  .beat-selection {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--feature-edit) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--feature-edit) 20%, transparent);
    border-radius: 8px;
  }

  .beat-selection.complete {
    background: color-mix(in srgb, var(--feature-edit) 15%, transparent);
    border-color: color-mix(in srgb, var(--feature-edit) 40%, transparent);
  }

  .selection-text {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .beat-selection.complete .selection-text {
    color: var(--foreground);
    font-weight: 600;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .clear-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  /* Component Grid */
  .component-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }

  .component-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .component-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--spacing-sm);
    background: var(--surface-color);
    border: 2px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: var(--transition-fast);
    position: relative;
  }

  .component-btn:hover {
    background: var(--surface-hover);
    border-color: color-mix(in srgb, var(--component-color) 40%, transparent);
  }

  .component-btn.selected {
    background: color-mix(in srgb, var(--component-color) 20%, transparent);
    border-color: var(--component-color);
    color: var(--foreground);
  }

  .component-name {
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .interval-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--component-color);
    border-radius: 50%;
    font-size: var(--font-size-compact);
    font-weight: 700;
    color: var(--text-on-accent);
  }

  /* Interval Row */
  .interval-row {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .interval-chip {
    flex: 1;
    padding: 4px;
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .interval-chip:hover {
    background: var(--surface-hover);
  }

  .interval-chip.active {
    background: color-mix(in srgb, var(--chip-color) 30%, transparent);
    border-color: var(--chip-color);
    color: var(--foreground);
  }

  /* Add Button */
  .btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--feature-edit) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--feature-edit) 30%, transparent);
    border-radius: 8px;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-add:hover:not(:disabled) {
    background: color-mix(in srgb, var(--feature-edit) 25%, transparent);
    border-color: color-mix(in srgb, var(--feature-edit) 50%, transparent);
  }

  .btn-add:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
