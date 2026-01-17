<!--
LOOPComponentButton.svelte - Individual LOOP component selection button
Displays a selectable button for a single LOOP transformation type
Shows description in Quick Apply mode, compact in Build Combo mode
-->
<script lang="ts">
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import type { LOOPComponentInfo } from "$lib/features/create/generate/shared/domain/constants/loop-components";

  let {
    componentInfo,
    isMultiSelectMode = false,
    isSelected = false,
    showDescription = false,
    onClick,
  } = $props<{
    componentInfo: LOOPComponentInfo;
    isMultiSelectMode?: boolean;
    isSelected?: boolean;
    showDescription?: boolean;
    onClick: () => void;
  }>();

  // Reactive destructure - updates when componentInfo changes
  const label = $derived(componentInfo.label);
  const description = $derived(componentInfo.description);
  const icon = $derived(componentInfo.icon);
  const color = $derived(componentInfo.color);
</script>

<button
  class="loop-component-button"
  class:selected={isSelected}
  class:multi-select={isMultiSelectMode}
  class:with-description={showDescription}
  onclick={onClick}
  style="--component-color: {color};"
  aria-label="{label} - {description} - {isSelected ? 'selected' : 'not selected'}"
>
  <div class="button-content">
    <div class="loop-component-icon">
      <FontAwesomeIcon {icon} size="1em" />
    </div>
    <div class="text-content">
      <span class="loop-component-label">{label}</span>
      {#if showDescription}
        <span class="loop-component-description">{description}</span>
      {/if}
    </div>
  </div>

  {#if isMultiSelectMode && isSelected}
    <div class="check-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="6,12 10,16 18,8"></polyline>
      </svg>
    </div>
  {/if}
</button>

<style>
  .loop-component-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;

    background: color-mix(in srgb, var(--component-color) 15%, rgba(30, 30, 50, 0.9));
    border: 2px solid color-mix(in srgb, var(--component-color) 50%, transparent);
    border-radius: 12px;
    cursor: pointer;
    color: var(--theme-text, white);
    transition: all var(--duration-normal) ease;
    width: 100%;
    height: 100%;
  }

  .loop-component-button:hover {
    background: color-mix(in srgb, var(--component-color) 25%, rgba(30, 30, 50, 0.95));
    border-color: var(--component-color);
    transform: translateY(-1px);
  }

  .loop-component-button:active {
    transform: translateY(0) scale(0.98);
  }

  .loop-component-button.selected {
    background: color-mix(in srgb, var(--component-color) 35%, rgba(30, 30, 50, 0.95));
    border-color: var(--component-color);
    border-width: 2px;
    box-shadow: 0 0 12px color-mix(in srgb, var(--component-color) 40%, transparent);
  }

  /* Vertical layout (Build Combo mode - no description) */
  .button-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
  }

  .text-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  /* Horizontal layout (Quick Apply mode - with description) */
  .loop-component-button.with-description .button-content {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
  }

  .loop-component-button.with-description .text-content {
    align-items: flex-start;
    flex: 1;
  }

  .loop-component-icon {
    font-size: 1.5rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .loop-component-button.with-description .loop-component-icon {
    font-size: 1.75rem;
    width: 48px;
    height: 48px;
    background: color-mix(in srgb, var(--component-color) 25%, transparent);
    border-radius: 10px;
  }

  .loop-component-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .loop-component-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.3;
  }

  .check-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    background: var(--component-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .check-badge svg {
    width: 14px;
    height: 14px;
    color: white;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .loop-component-button {
      transition: none;
    }
    .loop-component-button:hover,
    .loop-component-button:active {
      transform: none;
    }
  }
</style>
