<!--
LOOPSelectionWizard.svelte - Tiny mobile step-by-step wizard for LOOP selection

For screens <400px width, breaks the selection into clear steps:
1. Mode selection (Quick Apply vs Build Combo)
2. Component selection (single or multi-select based on mode)
3. Confirmation
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import { LOOP_COMPONENTS } from "../../../shared/domain/constants/loop-constants";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import type { LOOPWizardStep } from "../../../shared/domain/models/loop-selection-types";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import LOOPModalHeader from "../LOOPModalHeader.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";

  interface Props {
    isOpen: boolean;
    selectedComponents: Set<LOOPComponent>;
    onToggleComponent: (component: LOOPComponent) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { isOpen, selectedComponents, onToggleComponent, onConfirm, onClose }: Props =
    $props();

  let hapticService: IHapticFeedback | null = null;
  let currentStep = $state<LOOPWizardStep>("mode");
  let isMultiSelectMode = $state(false);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Reset wizard when opened
  $effect(() => {
    if (isOpen) {
      currentStep = "mode";
      isMultiSelectMode = false;
    }
  });

  const selectionCount = $derived(selectedComponents.size);
  const isImplemented = $derived.by(() => {
    if (selectionCount === 0) return true;
    return loopTypeResolver.isImplemented(selectedComponents);
  });

  const stepTitle = $derived.by(() => {
    switch (currentStep) {
      case "mode":
        return "Choose Mode";
      case "components":
        return isMultiSelectMode ? "Build Your Combo" : "Quick Apply";
      case "confirm":
        return "Confirm Selection";
      default:
        return "Select LOOP Type";
    }
  });

  const confirmButtonText = $derived.by(() => {
    if (selectionCount === 0) return "Select a Component";
    if (!isImplemented) return "Coming Soon!";
    if (selectionCount === 1) {
      const component = Array.from(selectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });

  function handleModeSelect(isMulti: boolean) {
    hapticService?.trigger("selection");
    isMultiSelectMode = isMulti;
    currentStep = "components";
  }

  function handleComponentSelect(component: LOOPComponent) {
    hapticService?.trigger("selection");

    if (!isMultiSelectMode) {
      // Single-select mode: clear existing, select new, apply immediately
      for (const existing of selectedComponents) {
        onToggleComponent(existing);
      }
      if (!selectedComponents.has(component)) {
        onToggleComponent(component);
      }
      // In quick mode, apply immediately
      onConfirm();
      return;
    }

    // Multi-select mode: toggle and stay on components step
    onToggleComponent(component);
  }

  function handleBack() {
    hapticService?.trigger("selection");
    if (currentStep === "components") {
      currentStep = "mode";
      // Clear selections when going back to mode
      for (const existing of selectedComponents) {
        onToggleComponent(existing);
      }
    } else if (currentStep === "confirm") {
      currentStep = "components";
    }
  }

  function handleNext() {
    hapticService?.trigger("selection");
    if (currentStep === "components" && selectionCount > 0) {
      currentStep = "confirm";
    }
  }

  function handleConfirm() {
    if (selectionCount === 0) return;
    hapticService?.trigger("selection");
    onConfirm();
  }
</script>

<Drawer
  {isOpen}
  onOpenChange={(open) => !open && onClose()}
  labelledBy="loop-wizard-title"
  closeOnBackdrop={true}
  showHandle={false}
  placement="bottom"
  class="loop-wizard-sheet"
>
  <div class="wizard-content">
    <SheetDragHandle />
    <LOOPModalHeader title={stepTitle} onClose={onClose} />

    <!-- Step Indicator -->
    <div class="step-indicator" role="progressbar" aria-valuenow={currentStep === "mode" ? 1 : currentStep === "components" ? 2 : 3} aria-valuemin={1} aria-valuemax={3}>
      <div class="step" class:active={currentStep === "mode"} class:completed={currentStep !== "mode"}>
        <span class="step-number">1</span>
      </div>
      <div class="step-line" class:completed={currentStep !== "mode"}></div>
      <div class="step" class:active={currentStep === "components"} class:completed={currentStep === "confirm"}>
        <span class="step-number">2</span>
      </div>
      <div class="step-line" class:completed={currentStep === "confirm"}></div>
      <div class="step" class:active={currentStep === "confirm"}>
        <span class="step-number">3</span>
      </div>
    </div>

    <!-- Step Content -->
    <div class="step-content">
      {#if currentStep === "mode"}
        <div class="mode-selection">
          <button class="mode-card" onclick={() => handleModeSelect(false)}>
            <div class="mode-icon">
              <i class="fas fa-bolt"></i>
            </div>
            <div class="mode-info">
              <span class="mode-name">Quick Apply</span>
              <span class="mode-desc">Tap a component to apply instantly</span>
            </div>
          </button>

          <button class="mode-card" onclick={() => handleModeSelect(true)}>
            <div class="mode-icon">
              <i class="fas fa-layer-group"></i>
            </div>
            <div class="mode-info">
              <span class="mode-name">Build Combo</span>
              <span class="mode-desc">Select multiple components</span>
            </div>
          </button>
        </div>

      {:else if currentStep === "components"}
        <div class="component-selection">
          <!-- Preview icons -->
          <div class="preview-section">
            <LOOPIconStrip activeComponents={selectedComponents} size={24} darkMode={true} />
          </div>

          <!-- Component grid -->
          <div class="component-grid">
            {#each LOOP_COMPONENTS as comp}
              {@const isSelected = selectedComponents.has(comp.component)}
              <button
                class="component-btn"
                class:selected={isSelected}
                onclick={() => handleComponentSelect(comp.component)}
                aria-pressed={isSelected}
              >
                {comp.label}
              </button>
            {/each}
          </div>

          {#if isMultiSelectMode && selectionCount > 0}
            <button class="next-btn" onclick={handleNext}>
              Continue with {selectionCount} component{selectionCount > 1 ? "s" : ""}
            </button>
          {/if}
        </div>

      {:else if currentStep === "confirm"}
        <div class="confirm-section">
          <div class="confirm-preview">
            <LOOPIconStrip activeComponents={selectedComponents} size={32} darkMode={true} />
          </div>

          <div class="confirm-summary">
            <h3>Your Selection</h3>
            <ul class="component-list">
              {#each Array.from(selectedComponents) as component}
                <li>{component.charAt(0) + component.slice(1).toLowerCase()}</li>
              {/each}
            </ul>
          </div>

          <button
            class="confirm-button"
            class:disabled={selectionCount === 0}
            class:coming-soon={!isImplemented && selectionCount > 0}
            onclick={handleConfirm}
            disabled={selectionCount === 0}
          >
            {confirmButtonText}
          </button>
        </div>
      {/if}
    </div>

    <!-- Back button (when not on first step) -->
    {#if currentStep !== "mode"}
      <button class="back-btn" onclick={handleBack}>
        <i class="fas fa-arrow-left"></i>
        Back
      </button>
    {/if}
  </div>
</Drawer>

<style>
  :global(.drawer-content.loop-wizard-sheet) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.6);
    --sheet-backdrop-filter: none;
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
    max-width: 400px;
    margin: 0 auto;
    height: auto !important;
    max-height: 90vh;
  }

  .wizard-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    background: #1a1a2e;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid var(--theme-accent, #6366f1);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 8px 24px;
  }

  .step {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .step.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .step.completed {
    background: var(--semantic-success, #10b981);
    border-color: var(--semantic-success, #10b981);
  }

  .step-number {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .step-line {
    width: 40px;
    height: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition: background 0.2s ease;
  }

  .step-line.completed {
    background: var(--semantic-success, #10b981);
  }

  .step-content {
    flex: 1;
    min-height: 0;
  }

  /* Mode Selection Step */
  .mode-selection {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mode-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    min-height: 72px;
  }

  .mode-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .mode-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: white;
    flex-shrink: 0;
  }

  .mode-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mode-name {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .mode-desc {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Component Selection Step */
  .component-selection {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .preview-section {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
  }

  .component-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    width: 100%;
  }

  .component-btn {
    padding: 12px 8px;
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .component-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .component-btn.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .next-btn {
    width: 100%;
    padding: 14px;
    min-height: 48px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 8px;
  }

  .next-btn:hover {
    filter: brightness(1.1);
  }

  /* Confirm Step */
  .confirm-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .confirm-preview {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 16px;
  }

  .confirm-summary {
    text-align: center;
  }

  .confirm-summary h3 {
    margin: 0 0 8px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .component-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .component-list li {
    padding: 4px 12px;
    background: var(--theme-accent, #6366f1);
    border-radius: 16px;
    font-size: var(--font-size-sm);
    color: white;
  }

  .confirm-button {
    width: 100%;
    padding: 16px;
    min-height: 56px;
    background: color-mix(in srgb, var(--theme-text) 25%, transparent);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: var(--theme-text, white);
    font-size: var(--font-size-lg);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .confirm-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 35%, transparent);
    transform: translateY(-2px);
  }

  .confirm-button:disabled,
  .confirm-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .confirm-button.coming-soon {
    background: color-mix(in srgb, var(--semantic-warning) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning) 60%, transparent);
    color: var(--semantic-warning);
  }

  /* Back Button */
  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    min-height: 48px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }
</style>
