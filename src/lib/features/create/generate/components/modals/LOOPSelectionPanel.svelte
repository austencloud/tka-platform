<!--
LOOPSelectionPanel.svelte - Bottom sheet for selecting LOOP components
Refactored to use Drawer component for consistent behavior
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import { onMount } from "svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { LOOPExplanationTextGenerator } from "$lib/features/create/generate/shared/services/implementations/LOOPExplanationTextGenerator";
  import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
  import LOOPComponentGrid from "./LOOPComponentGrid.svelte";
  import LOOPExplanationPanel from "./LOOPExplanationPanel.svelte";
  import LOOPModalHeader from "./LOOPModalHeader.svelte";
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
  const explanationGenerator = new LOOPExplanationTextGenerator();

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    LOOPTypeResolver = container.items.loopTypeResolver;
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
    if (!isMultiSelectMode) {
      return "Click a LOOP Type";
    }
    if (selectionCount === 0) return "Select a LOOP Type";
    if (!isImplemented) return "Coming Soon!";
    if (selectionCount === 1) {
      const component = Array.from(selectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount} Components`;
  });
  const isButtonDisabled = $derived(!isMultiSelectMode || selectionCount === 0);

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

  function handleToggleMultiSelect() {
    hapticService?.trigger("selection");
    isMultiSelectMode = !isMultiSelectMode;
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
      {isMultiSelectMode}
      onToggleMultiSelect={handleToggleMultiSelect}
      onClose={handleClose}
    />

    <LOOPComponentGrid
      {selectedComponents}
      {isMultiSelectMode}
      onToggleComponent={handleToggle}
    />

    <div class="info-section">
      <LOOPExplanationPanel {explanationText} />
      {#if !isImplemented && selectionCount > 0}
        <div class="coming-soon-badge">
          This combination is under development
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
  /* Pops up halfway on mobile, side panel on desktop */
  :global(.drawer-content.loop-selection-sheet) {
    --sheet-backdrop-bg: var(--backdrop-transparent);
    --sheet-backdrop-filter: var(--backdrop-blur-none);
    --sheet-backdrop-pointer-events: none;
    --sheet-bg: var(--sheet-bg-gradient);
    --sheet-border: var(--sheet-border-medium);
    --sheet-shadow: none;
    --sheet-pointer-events: auto;
    max-width: 1200px;
    margin: 0 auto;
    height: auto !important; /* Override default full height */
    max-height: 60vh; /* Pop up about halfway */
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
    /* Container query context for intelligent layout switching */
    container-type: inline-size;
    container-name: loop-modal;

    position: relative;
    height: auto; /* Natural height based on content */

    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px 20px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));

    /* Animated rainbow gradient background */
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong) 0%,
      #6b21a8 12.5%,
      #db2777 25%,
      #f97316 37.5%,
      #eab308 50%,
      var(--semantic-success) 62.5%,
      #0891b2 75%,
      var(--semantic-info) 87.5%,
      var(--theme-accent, var(--theme-accent)) 100%
    );
    background-size: 300% 300%;
    animation: meshGradientFlow 15s ease infinite;

    overflow-y: auto;
    overflow-x: hidden;

    /* Enable smooth scrolling */
    overscroll-behavior: contain;
  }

  .loop-modal-content.desktop-layout {
    height: 100vh; /* Full height on desktop side panel */
    justify-content: center; /* Center content on desktop */
    padding-bottom: 24px;
  }

  @keyframes meshGradientFlow {
    0%,
    100% {
      background-position: 0% 50%;
    }
    25% {
      background-position: 50% 100%;
    }
    50% {
      background-position: 100% 50%;
    }
    75% {
      background-position: 50% 0%;
    }
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
</style>
