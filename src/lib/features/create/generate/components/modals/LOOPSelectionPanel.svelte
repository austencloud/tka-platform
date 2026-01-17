<!--
LOOPSelectionPanel.svelte - Bottom sheet for selecting LOOP components
Includes curated presets, user favorites, and manual component selection
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import { onMount } from "svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { LOOPExplanationTextGenerator } from "$lib/features/create/generate/shared/services/implementations/LOOPExplanationTextGenerator";
  import { loopFavoritesManager } from "$lib/features/create/generate/shared/services/implementations/LOOPFavoritesManager";
  import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
  import type { LOOPPreset } from "../../shared/domain/constants/loop-presets";
  import LOOPComponentGrid from "./LOOPComponentGrid.svelte";
  import LOOPExplanationPanel from "./LOOPExplanationPanel.svelte";
  import LOOPModalHeader from "./LOOPModalHeader.svelte";
  import LOOPModeSelector from "./LOOPModeSelector.svelte";
  import LOOPPresetsSection from "./LOOPPresetsSection.svelte";
  import Drawer from "../../../../../shared/foundation/ui/Drawer.svelte";
  import SheetDragHandle from "../../../../../shared/foundation/ui/SheetDragHandle.svelte";

  let { isOpen, selectedComponents, onToggleComponent, onConfirm, onClose } =
    $props<{
      isOpen: boolean;
      selectedComponents: Set<LOOPComponent>;
      onToggleComponent: (component: LOOPComponent) => void;
      onConfirm: () => void;
      onClose: () => void;
    }>();

  let hapticService: IHapticFeedback | null = null;
  let LOOPTypeResolver: ILOOPTypeResolver | null = null;
  let isMultiSelectMode = $state(false);
  let showPresets = $state(false);
  let favorites = $state<string[]>([]);
  const explanationGenerator = new LOOPExplanationTextGenerator();

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    LOOPTypeResolver = container.items.loopTypeResolver;
    favorites = loopFavoritesManager.getFavorites();
  });

  // Generate explanation text based on selected components
  const explanationText = $derived(
    explanationGenerator.generateExplanationText(selectedComponents)
  );

  // Check if the current combination is implemented
  const isImplemented = $derived.by(() => {
    if (!LOOPTypeResolver || selectionCount === 0) return true;
    return LOOPTypeResolver.isImplemented(selectedComponents);
  });

  // Derive selection count and adaptive button text
  const selectionCount = $derived(selectedComponents.size);
  const buttonText = $derived.by(() => {
    if (selectionCount === 0) return "Select Components Above";
    if (!isImplemented) return "Coming Soon!";
    if (selectionCount === 1) {
      const component = Array.from(selectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });
  const isButtonDisabled = $derived(selectionCount === 0);

  function handleToggle(component: LOOPComponent) {
    hapticService?.trigger("selection");

    // Single-select mode: Apply immediately if clicking an unselected component
    if (!isMultiSelectMode) {
      // Clear any existing selection first
      for (const existing of selectedComponents) {
        onToggleComponent(existing);
      }

      // Select the new component
      if (!selectedComponents.has(component)) {
        onToggleComponent(component);
      }

      // Apply immediately and close
      onConfirm();
      return;
    }

    // Multi-select mode: Toggle selection
    onToggleComponent(component);
  }

  function handleConfirm() {
    if (selectionCount === 0) return; // Prevent confirming with no selection
    hapticService?.trigger("selection");
    onConfirm();
  }

  function handleClose() {
    onClose();
  }

  function handleModeChange(isMulti: boolean) {
    hapticService?.trigger("selection");
    isMultiSelectMode = isMulti;
  }

  function handleSelectPreset(preset: LOOPPreset) {
    hapticService?.trigger("selection");

    // Clear existing selection
    for (const existing of selectedComponents) {
      onToggleComponent(existing);
    }

    // Select all components from the preset
    for (const component of preset.components) {
      if (!selectedComponents.has(component)) {
        onToggleComponent(component);
      }
    }

    // Apply immediately
    onConfirm();
  }

  function handleToggleFavorite(presetId: string) {
    hapticService?.trigger("selection");
    loopFavoritesManager.toggleFavorite(presetId);
    favorites = loopFavoritesManager.getFavorites();
  }

  const createModuleContext = tryGetCreateModuleContext();
  const isSideBySideLayout = $derived(
    createModuleContext
      ? createModuleContext.layout.shouldUseSideBySideLayout
      : false
  );
  const drawerPlacement = $derived(isSideBySideLayout ? "right" : "bottom");
</script>

<Drawer
  {isOpen}
  onOpenChange={(open) => !open && handleClose()}
  labelledBy="loop-title"
  closeOnBackdrop={true}
  showHandle={false}
  respectLayoutMode={true}
  placement={drawerPlacement}
  class="loop-selection-sheet"
  backdropClass="loop-selection-backdrop"
>
  <div class="loop-modal-content" class:desktop-layout={isSideBySideLayout}>
    <SheetDragHandle class={isSideBySideLayout ? "side-handle" : ""} />
    <LOOPModalHeader
      title="Select LOOP Type"
      onClose={handleClose}
    />

    <!-- Mode selector - clearly shows single vs combo options -->
    <LOOPModeSelector
      {isMultiSelectMode}
      onModeChange={handleModeChange}
    />

    <!-- Main Component Selection - always visible -->
    <LOOPComponentGrid
      {selectedComponents}
      {isMultiSelectMode}
      onToggleComponent={handleToggle}
    />

    <!-- Explanation panel - only shown in Build Combo mode -->
    {#if isMultiSelectMode}
      <div class="info-section">
        <LOOPExplanationPanel {explanationText} />
        {#if !isImplemented && selectionCount > 0}
          <div class="coming-soon-badge">
            This combination is under development
          </div>
        {/if}
      </div>
    {/if}

    <!-- Collapsible Presets Section -->
    <div class="presets-toggle-section">
      <button
        class="presets-toggle"
        class:expanded={showPresets}
        onclick={() => (showPresets = !showPresets)}
      >
        <span>Quick Presets</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {#if showPresets}
        <div class="presets-content">
          <LOOPPresetsSection
            onSelectPreset={handleSelectPreset}
            {favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      {/if}
    </div>

    {#if isMultiSelectMode}
      <button
        class="confirm-button"
        class:disabled={isButtonDisabled}
        class:coming-soon={!isImplemented && selectionCount > 0}
        onclick={handleConfirm}
        disabled={isButtonDisabled}
        aria-label={buttonText}
      >
        {buttonText}
      </button>
    {/if}
  </div>
</Drawer>

<style>
  /* Custom styling for LOOP selection bottom sheet */
  :global(.drawer-content.loop-selection-sheet) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.6);
    --sheet-backdrop-filter: none;
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
    --sheet-pointer-events: auto;
    max-width: 600px;
    margin: 0 auto;
    height: auto !important;
    max-height: 85vh;
  }

  /* Slide animations for drawer */
  :global(.drawer-content.loop-selection-sheet[data-placement="bottom"]) {
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.drawer-content.loop-selection-sheet[data-placement="right"]) {
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(
    .drawer-content.loop-selection-sheet[data-state="closed"][data-placement="bottom"]
  ) {
    transform: translateY(100%);
  }

  :global(
    .drawer-content.loop-selection-sheet[data-state="closed"][data-placement="right"]
  ) {
    transform: translateX(100%);
  }

  :global(.drawer-content.loop-selection-sheet[data-state="open"]) {
    transform: translate(0, 0);
  }

  :global(.drawer-content.loop-selection-sheet:hover) {
    box-shadow: none;
  }

  .loop-modal-content {
    container-type: inline-size;
    container-name: loop-modal;
    position: relative;
    height: auto;

    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));

    /* Solid opaque background - no transparency */
    background: #1a1a2e;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid var(--theme-accent, #6366f1);

    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;

    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .loop-modal-content::-webkit-scrollbar {
    width: 8px;
  }

  .loop-modal-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .loop-modal-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .loop-modal-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35));
  }

  .loop-modal-content.desktop-layout {
    height: auto;
    max-height: 80vh;
    border-radius: 16px 0 0 16px;
    padding-bottom: 20px;
  }


  /* Position drag handle on the left for side-by-side layout */
  .loop-modal-content.desktop-layout :global(.sheet-drag-handle.side-handle) {
    position: absolute;
    top: 50%;
    left: 18px;
    width: 4px;
    height: var(--min-touch-target);
    margin: 0;
    border-radius: 999px;
    transform: translateY(-50%);
  }

  .presets-toggle-section {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding-top: 12px;
  }

  .presets-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .presets-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .presets-toggle .chevron {
    width: 18px;
    height: 18px;
    transition: transform 0.2s ease;
  }

  .presets-toggle.expanded .chevron {
    transform: rotate(180deg);
  }

  .presets-content {
    margin-top: 12px;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .coming-soon-badge {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 20%,
      transparent
    );
    border: 2px solid
      color-mix(
        in srgb,
        var(--semantic-warning, var(--semantic-warning)) 60%,
        transparent
      );
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--semantic-warning);
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .confirm-button {
    position: relative;
    z-index: 1;
    flex-shrink: 0;

    max-width: 600px;
    margin: 0 auto;
    width: 100%;
    padding: 14px 24px;
    min-height: var(--min-touch-target);

    background: color-mix(in srgb, var(--theme-text) 25%, transparent);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: var(--theme-text, white);

    font-size: var(--font-size-base);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.2;

    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 12px var(--theme-shadow);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);

    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .confirm-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 35%, transparent);
    border-color: var(--theme-text, white);
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .confirm-button:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  .confirm-button:disabled,
  .confirm-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--theme-stroke);
    border-color: var(--theme-stroke);
  }

  .confirm-button.coming-soon {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 25%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 60%,
      transparent
    );
    color: var(--semantic-warning);
    cursor: pointer;
  }

  .confirm-button.coming-soon:hover {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 35%,
      transparent
    );
    border-color: var(--semantic-warning);
    transform: translateY(-2px) scale(1.02);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .confirm-button {
      transition: none;
    }

    .confirm-button:hover:not(:disabled),
    .confirm-button:active:not(:disabled) {
      transform: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .loop-modal-content {
      border-top: 2px solid var(--theme-text, white);
    }

    .confirm-button {
      background: var(--theme-stroke);
      border: 2px solid var(--theme-stroke-strong);
    }

    .confirm-button:hover:not(:disabled) {
      background: var(--theme-stroke-strong);
      border-color: var(--theme-text, white);
    }
  }

  /* Mobile responsiveness for very small viewport screens */
  @media (max-width: 380px) {
    .loop-modal-content {
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom));
      gap: 8px;
    }

    .confirm-button {
      padding: 10px 16px;
      font-size: var(--font-size-sm);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .coming-soon-badge {
      animation: none;
    }
  }
</style>
