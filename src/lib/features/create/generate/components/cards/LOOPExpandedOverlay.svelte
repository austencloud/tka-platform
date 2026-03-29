<!--
LOOPExpandedOverlay.svelte - Expanded LOOP selection that covers the card grid
Animates forward in z-axis and expands to fill the container space
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { onMount } from "svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { LOOPExplanationTextGenerator } from "$lib/features/create/generate/shared/services/implementations/LOOPExplanationTextGenerator";
  import { LOOPType, SliceSize } from "../../circular/domain/models/circular-models";
  import LOOPComponentGrid from "../modals/LOOPComponentGrid.svelte";
  import LOOPModeSelector from "../modals/LOOPModeSelector.svelte";

  let {
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    sliceSize = SliceSize.HALVED,
    onSliceSizeChange,
  } = $props<{
    currentType: LOOPType;
    selectedComponents: Set<LOOPComponent>;
    onChange: (loopType: LOOPType) => void;
    onClose: () => void;
    onLoopDisable?: () => void;
    sliceSize?: SliceSize;
    onSliceSizeChange?: (size: SliceSize) => void;
  }>();

  // Determine if current selection allows slice choice (rotated variants)
  const ROTATED_TYPES = new Set([
    LOOPType.ROTATED,
    LOOPType.ROTATED_INVERTED,
    LOOPType.ROTATED_SWAPPED,
    LOOPType.MIRRORED_ROTATED,
    LOOPType.MIRRORED_INVERTED_ROTATED,
    LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
  ]);

  // Resolve the LOOP type from current local selection to check slice eligibility
  const resolvedType = $derived.by(() => {
    if (localSelectedComponents.size === 0) return currentType;
    return loopTypeResolver.generateLOOPType(localSelectedComponents);
  });

  const showSliceSize = $derived(
    onSliceSizeChange && ROTATED_TYPES.has(resolvedType)
  );

  let hapticService: IHapticFeedback | null = null;
  let isMultiSelectMode = $state(false);
  let localSelectedComponents = $state(new Set<LOOPComponent>());
  const explanationGenerator = new LOOPExplanationTextGenerator();

  // Sync local state with prop changes
  $effect(() => {
    localSelectedComponents = new Set<LOOPComponent>(selectedComponents);
  });

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Generate explanation text based on selected components
  const explanationText = $derived(
    explanationGenerator.generateExplanationText(localSelectedComponents)
  );

  // Check if the current combination is implemented
  const isImplemented = $derived.by(() => {
    if (selectionCount === 0) return true;
    return loopTypeResolver.isImplemented(localSelectedComponents);
  });

  // Derive selection count
  const selectionCount = $derived(localSelectedComponents.size);

  // Button text for combo mode
  const buttonText = $derived.by(() => {
    if (selectionCount === 0) return "Select Components";
    if (!isImplemented) return "Coming Soon!";
    if (selectionCount === 1) {
      const component = Array.from(localSelectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });

  function handleToggle(component: LOOPComponent) {
    hapticService?.trigger("selection");

    // Single-select mode: Apply immediately
    if (!isMultiSelectMode) {
      localSelectedComponents = new Set([component]);
      applyAndClose();
      return;
    }

    // Multi-select mode: Toggle selection
    const newSet = new Set(localSelectedComponents);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    localSelectedComponents = newSet;
  }

  function handleModeChange(isMulti: boolean) {
    hapticService?.trigger("selection");
    isMultiSelectMode = isMulti;
  }

  function applyAndClose() {
    if (selectionCount === 0) return;

    const newLoopType = loopTypeResolver.generateLOOPType(localSelectedComponents);
    onChange(newLoopType);
    onClose();
  }

  function handleConfirm() {
    if (selectionCount === 0) return;
    hapticService?.trigger("selection");
    applyAndClose();
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  function handleDisableLoop() {
    hapticService?.trigger("selection");
    onLoopDisable?.();
  }

  function handleSliceToggle(size: SliceSize) {
    hapticService?.trigger("selection");
    onSliceSizeChange?.(size);
  }
</script>

<div
  class="loop-expanded-overlay"
  transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
>
  <!-- Header with title, disable toggle, and close button -->
  <div class="overlay-header">
    <h3 class="overlay-title">Select LOOP Type</h3>
    <div class="header-actions">
      {#if onLoopDisable}
        <button
          class="disable-button"
          onclick={handleDisableLoop}
          aria-label="Turn off LOOP"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Off</span>
        </button>
      {/if}
      <button
        class="close-button"
        onclick={handleClose}
        aria-label="Close LOOP selection"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <!-- Mode selector -->
  <LOOPModeSelector
    {isMultiSelectMode}
    onModeChange={handleModeChange}
  />

  <!-- Component grid -->
  <div class="grid-container">
    <LOOPComponentGrid
      selectedComponents={localSelectedComponents}
      {isMultiSelectMode}
      onToggleComponent={handleToggle}
    />
  </div>

  <!-- Slice size toggle (rotated variants only) -->
  {#if showSliceSize}
    <div class="slice-section">
      <span class="slice-label">Slice</span>
      <div class="slice-toggle">
        <button
          class="slice-option"
          class:selected={sliceSize === SliceSize.HALVED}
          onclick={() => handleSliceToggle(SliceSize.HALVED)}
        >Halved</button>
        <button
          class="slice-option"
          class:selected={sliceSize === SliceSize.QUARTERED}
          onclick={() => handleSliceToggle(SliceSize.QUARTERED)}
        >Quartered</button>
      </div>
    </div>
  {/if}

  <!-- Explanation panel (combo mode only) -->
  {#if isMultiSelectMode}
    <div class="explanation-section">
      <p class="explanation-text">{explanationText}</p>
      {#if !isImplemented && selectionCount > 0}
        <div class="coming-soon-badge">
          This combination is under development
        </div>
      {/if}
    </div>

    <!-- Apply button -->
    <button
      class="apply-button"
      class:disabled={selectionCount === 0}
      onclick={handleConfirm}
      disabled={selectionCount === 0}
    >
      {buttonText}
    </button>
  {/if}
</div>

<style>
  .loop-expanded-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;

    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;

    /* Solid background matching the card theme */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%
    );
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--theme-accent) 30%, transparent);

    overflow: hidden;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .disable-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    padding: 8px 12px;
    height: var(--min-touch-target);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-family: inherit;
    transition: all var(--duration-normal) ease;
  }

  .disable-button:hover {
    background: rgba(255, 100, 100, 0.15);
    border-color: rgba(255, 100, 100, 0.3);
    color: var(--theme-text, white);
  }

  .disable-button svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .overlay-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .grid-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .explanation-section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .explanation-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .coming-soon-badge {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 50%, transparent);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--semantic-warning);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
  }

  .slice-section {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .slice-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    flex-shrink: 0;
  }

  .slice-toggle {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .slice-option {
    flex: 1;
    padding: 8px 12px;
    min-height: 40px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .slice-option.selected {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-text, white);
  }

  .slice-option:hover:not(.selected) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .apply-button {
    flex-shrink: 0;
    width: 100%;
    padding: 12px 20px;
    min-height: var(--min-touch-target);

    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border: 2px solid var(--theme-accent);
    border-radius: 10px;
    color: var(--theme-text, white);

    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .apply-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    transform: translateY(-1px);
  }

  .apply-button:disabled,
  .apply-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .apply-button,
    .close-button,
    .disable-button,
    .slice-option {
      transition: none;
    }
  }
</style>
