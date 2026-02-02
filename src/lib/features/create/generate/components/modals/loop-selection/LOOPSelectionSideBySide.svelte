<!--
LOOPSelectionSideBySide.svelte - 4K/Ultrawide side-by-side modal for LOOP selection

Full-featured modal with two panels:
- Left: Preset browser (My Presets, Trending, Following)
- Right: Interactive component builder (pie chart + legend)

Designed for large screens where both can be visible simultaneously.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import { loopFavoritesManager } from "../../../shared/services/implementations/LOOPFavoritesManager";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import LOOPComponentBuilder from "./LOOPComponentBuilder.svelte";
  import LOOPPresetBrowser from "./LOOPPresetBrowser.svelte";

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
  let favorites = $state<string[]>([]);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    favorites = loopFavoritesManager.getFavorites();
  });

  const selectionCount = $derived(selectedComponents.size);
  const isImplemented = $derived.by(() => {
    if (selectionCount === 0) return true;
    return loopTypeResolver.isImplemented(selectedComponents);
  });

  const buttonText = $derived.by(() => {
    if (selectionCount === 0) return "Select Components";
    if (!isImplemented) return "Coming Soon!";
    if (selectionCount === 1) {
      const component = Array.from(selectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });

  function handleSelectComponents(components: LOOPComponent[]) {
    hapticService?.trigger("selection");

    // Clear existing
    for (const existing of selectedComponents) {
      onToggleComponent(existing);
    }

    // Select new
    for (const component of components) {
      onToggleComponent(component);
    }

    // Apply immediately when selecting from browser
    onConfirm();
  }

  function handleToggleFavorite(presetId: string) {
    hapticService?.trigger("selection");
    loopFavoritesManager.toggleFavorite(presetId);
    favorites = loopFavoritesManager.getFavorites();
  }

  function handleConfirm() {
    if (selectionCount === 0) return;
    hapticService?.trigger("selection");
    onConfirm();
  }

  function handleClose() {
    onClose();
  }
</script>

<BaseModal
  open={isOpen}
  onclose={handleClose}
  size="xl"
  labelledBy="loop-selection-title"
  class="loop-selection-modal-xl"
>
  <div class="modal-layout">
    <header class="modal-header">
      <h2 id="loop-selection-title">Select LOOP Type</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div class="modal-panels">
      <!-- Left Panel: Preset Browser -->
      <div class="panel browse-panel">
        <h3 class="panel-title">
          <i class="fas fa-compass"></i>
          Browse Presets
        </h3>
        <LOOPPresetBrowser
          onSelectComponents={handleSelectComponents}
          {favorites}
          onToggleFavorite={handleToggleFavorite}
          presetColumns={2}
          cardVariant="card"
        />
      </div>

      <!-- Divider -->
      <div class="panel-divider"></div>

      <!-- Right Panel: Component Builder -->
      <div class="panel build-panel">
        <h3 class="panel-title">
          <i class="fas fa-sliders-h"></i>
          Build Combo
        </h3>
        <LOOPComponentBuilder
          {selectedComponents}
          onToggleComponent={(c) => {
            hapticService?.trigger("selection");
            onToggleComponent(c);
          }}
          iconSize={32}
          layout="dense"
        />

        <button
          class="confirm-button"
          class:disabled={selectionCount === 0}
          class:coming-soon={!isImplemented && selectionCount > 0}
          onclick={handleConfirm}
          disabled={selectionCount === 0}
        >
          {buttonText}
        </button>
      </div>
    </div>
  </div>
</BaseModal>

<style>
  .modal-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #ffffff);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .modal-header h2 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 44px;
    height: 44px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: var(--font-size-lg);
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .modal-panels {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }

  .panel::-webkit-scrollbar {
    width: 6px;
  }

  .panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
  }

  .panel-divider {
    width: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    align-self: stretch;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.8));
  }

  .panel-title i {
    color: var(--theme-accent, #6366f1);
  }

  .browse-panel {
    flex: 1.2;
  }

  .build-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .confirm-button {
    width: 100%;
    padding: 16px 24px;
    min-height: 56px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-lg);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .confirm-button:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .confirm-button:disabled,
  .confirm-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .confirm-button.coming-soon {
    background: var(--semantic-warning, #f59e0b);
  }
</style>
