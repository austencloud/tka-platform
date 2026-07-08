<!--
LOOPExpandedOverlay.svelte - Expanded LOOP selection that covers the card grid
Animates forward in z-axis and expands to fill the container space
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { generateLOOPType } from "$lib/shared/create/services/loop-type-utils";
  import { onMount } from "svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { generateExplanationText } from "$lib/features/create/generate/shared/services/loop-explanation-text-generator";
  import { LOOPType } from "../../circular/domain/models/circular-models";
  import LOOPComponentGrid from "../modals/LOOPComponentGrid.svelte";
  import LOOPQuickCombosStrip from "../modals/LOOPQuickCombosStrip.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { LOOPPreset } from "../../shared/domain/constants/loop-presets";

  let {
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    layout = "grid",
  } = $props<{
    currentType: LOOPType;
    selectedComponents: Set<LOOPComponent>;
    onChange: (loopType: LOOPType) => void;
    onClose: () => void;
    onLoopDisable?: () => void;
    layout?: "grid" | "list";
  }>();

  let hapticService: HapticFeedback | null = null;
  let isMultiSelectMode = $state(false);
  let localSelectedComponents = $state(new Set<LOOPComponent>());

  // Sync local state with prop changes
  $effect(() => {
    localSelectedComponents = new Set<LOOPComponent>(selectedComponents);
  });

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Generate explanation text based on selected components
  const explanationText = $derived(
    generateExplanationText(localSelectedComponents)
  );

  // All component combinations are now implemented
  const isImplemented = $derived(true);

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

    const newLoopType = generateLOOPType(localSelectedComponents);
    onChange(newLoopType);
    onClose();
  }

  function handleConfirm() {
    if (selectionCount === 0) return;
    hapticService?.trigger("selection");
    applyAndClose();
  }

  function applyPreset(preset: LOOPPreset) {
    hapticService?.trigger("selection");
    const newLoopType = generateLOOPType(new Set(preset.components));
    onChange(newLoopType);
    onClose();
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  function handleDisableLoop() {
    hapticService?.trigger("selection");
    onLoopDisable?.();
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

  <!-- Mode selector (shared SegmentedControl per chip-primitives rule) -->
  <SegmentedControl
    options={[
      { value: "single", label: "Single" },
      { value: "combo", label: "Combo" },
    ]}
    value={isMultiSelectMode ? "combo" : "single"}
    onchange={(v) => handleModeChange(v === "combo")}
    size="sm"
    color="accent"
  />

  {#if layout === "list"}
    <LOOPQuickCombosStrip onApply={applyPreset} />
  {/if}

  <!-- Component grid -->
  <div class="grid-container">
    <LOOPComponentGrid
      selectedComponents={localSelectedComponents}
      {isMultiSelectMode}
      {layout}
      onToggleComponent={handleToggle}
    />
  </div>

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
    gap: 10px;
    padding: 12px;

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

    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .grid-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
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
    .disable-button {
      transition: none;
    }
  }
</style>
