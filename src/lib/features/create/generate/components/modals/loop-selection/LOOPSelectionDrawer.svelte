<!--
LOOPSelectionDrawer.svelte - Mobile drawer layout for LOOP selection

Bottom drawer with:
- Mode selector (Quick Apply / Build Combo)
- Component selection (grid or pie chart)
- Collapsible presets section
- Confirm button
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import { LOOP_COMPONENTS } from "../../../shared/domain/constants/loop-constants";
  import { LOOPExplanationTextGenerator } from "../../../shared/services/implementations/LOOPExplanationTextGenerator";
  import { loopFavoritesManager } from "../../../shared/services/implementations/LOOPFavoritesManager";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import type { LOOPPreset } from "../../../shared/domain/constants/loop-presets";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import LOOPModalHeader from "../LOOPModalHeader.svelte";
  import LOOPModeSelector from "../LOOPModeSelector.svelte";
  import LOOPComponentGrid from "../LOOPComponentGrid.svelte";
  import LOOPComponentBuilder from "./LOOPComponentBuilder.svelte";
  import LOOPPresetsSection from "../LOOPPresetsSection.svelte";

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
  let isMultiSelectMode = $state(false);
  let showPresets = $state(false);
  let favorites = $state<string[]>([]);
  const explanationGenerator = new LOOPExplanationTextGenerator();

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    favorites = loopFavoritesManager.getFavorites();
  });

  // Check if the current combination is implemented
  const isImplemented = $derived.by(() => {
    if (selectionCount === 0) return true;
    return loopTypeResolver.isImplemented(selectedComponents);
  });

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

    if (!isMultiSelectMode) {
      // Single-select mode: clear existing and apply immediately
      for (const existing of selectedComponents) {
        onToggleComponent(existing);
      }
      if (!selectedComponents.has(component)) {
        onToggleComponent(component);
      }
      onConfirm();
      return;
    }

    onToggleComponent(component);
  }

  function handleConfirm() {
    if (selectionCount === 0) return;
    hapticService?.trigger("selection");
    onConfirm();
  }

  function handleModeChange(isMulti: boolean) {
    hapticService?.trigger("selection");
    isMultiSelectMode = isMulti;
  }

  function handleSelectPreset(preset: LOOPPreset) {
    hapticService?.trigger("selection");
    for (const existing of selectedComponents) {
      onToggleComponent(existing);
    }
    for (const component of preset.components) {
      if (!selectedComponents.has(component)) {
        onToggleComponent(component);
      }
    }
    onConfirm();
  }

  function handleToggleFavorite(presetId: string) {
    hapticService?.trigger("selection");
    loopFavoritesManager.toggleFavorite(presetId);
    favorites = loopFavoritesManager.getFavorites();
  }
</script>

<Drawer
  {isOpen}
  onOpenChange={(open) => !open && onClose()}
  labelledBy="loop-title"
  closeOnBackdrop={true}
  showHandle={false}
  placement="bottom"
  class="loop-selection-sheet"
>
  <div class="drawer-content">
    <SheetDragHandle />
    <LOOPModalHeader title="Select LOOP Type" onClose={onClose} />

    <LOOPModeSelector {isMultiSelectMode} onModeChange={handleModeChange} />

    {#if isMultiSelectMode}
      <LOOPComponentBuilder
        {selectedComponents}
        onToggleComponent={handleToggle}
        iconSize={24}
        compact={true}
      />
    {:else}
      <LOOPComponentGrid
        {selectedComponents}
        {isMultiSelectMode}
        onToggleComponent={handleToggle}
      />
    {/if}

    <!-- Collapsible Presets Section -->
    <div class="presets-toggle-section">
      <button
        class="presets-toggle"
        class:expanded={showPresets}
        onclick={() => (showPresets = !showPresets)}
      >
        <span>Quick Presets</span>
        <svg
          class="chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
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
      >
        {buttonText}
      </button>
    {/if}
  </div>
</Drawer>

<style>
  :global(.drawer-content.loop-selection-sheet) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.6);
    --sheet-backdrop-filter: none;
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
    max-width: 600px;
    margin: 0 auto;
    height: auto !important;
    max-height: 85vh;
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    background: #1a1a2e;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid var(--theme-accent, #6366f1);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
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
    transition: all var(--duration-normal) ease;
  }

  .presets-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .presets-toggle .chevron {
    width: 18px;
    height: 18px;
    transition: transform var(--duration-normal) ease;
  }

  .presets-toggle.expanded .chevron {
    transform: rotate(180deg);
  }

  .presets-content {
    margin-top: 12px;
  }

  .confirm-button {
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
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .confirm-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 35%, transparent);
    border-color: var(--theme-text, white);
    transform: translateY(-2px) scale(1.02);
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

  @media (prefers-reduced-motion: reduce) {
    .confirm-button {
      transition: none;
    }
  }
</style>
