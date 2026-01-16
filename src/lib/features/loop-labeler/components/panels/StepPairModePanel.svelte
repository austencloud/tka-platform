<script lang="ts">
  /**
   * Beat Pair Mode Builder Panel
   *
   * Select two beats and specify their transformation relationship.
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
    firstBeat: number | null;
    secondBeat: number | null;
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
    firstBeat,
    secondBeat,
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
    { id: "rotated", key: "rotation", color: "#36c3ff" },
    { id: "swapped", key: "swap", color: "#26e600" },
    { id: "mirrored", key: "mirror", color: "#6F2DA8" },
    { id: "flipped", key: "flip", color: "#14b8a6" },
    { id: "inverted", key: "invert", color: "#eb7d00" },
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
    if (val === "halved") return "½";
    if (val === "quartered") return "¼";
    return "";
  }

  const canAdd = $derived(
    firstBeat !== null && secondBeat !== null && selectedComponents.size > 0
  );

  const selectionStatus = $derived.by(() => {
    if (firstBeat === null) return "Click first beat (key beat)";
    if (secondBeat === null)
      return `Beat ${firstBeat} selected → Click second beat`;
    return `Beat ${firstBeat} ↔ Beat ${secondBeat}`;
  });

  const hasBothBeats = $derived(firstBeat !== null && secondBeat !== null);
</script>

<div class="builder-panel">
  <p class="builder-hint">
    Select two beats, then choose the transformation that relates them
  </p>

  <!-- Beat Selection Status -->
  <div class="beat-selection" class:complete={hasBothBeats}>
    <span class="selection-text">{selectionStatus}</span>
    {#if firstBeat !== null}
      <button
        class="clear-btn"
        onclick={onClearSelection}
        title="Clear selection"
      >
        <FontAwesomeIcon icon="xmark" size="0.85em" />
      </button>
    {/if}
  </div>

  <!-- Component Grid (shown when both beats selected) -->
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
                class:active={transformationIntervals[intervalConfig.key] ===
                  "halved"}
                style="--chip-color: {intervalConfig.color}"
                onclick={() => onSetInterval(intervalConfig.key, "halved")}
                >½</button
              >
              <button
                class="interval-chip"
                class:active={transformationIntervals[intervalConfig.key] ===
                  "quartered"}
                style="--chip-color: {intervalConfig.color}"
                onclick={() => onSetInterval(intervalConfig.key, "quartered")}
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
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 8px;
  }

  .beat-selection.complete {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
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
    background: rgba(239, 68, 68, 0.2);
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
    color: #000;
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
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 8px;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-add:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.5);
  }

  .btn-add:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
