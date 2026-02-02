<!--
LOOPSelectionTabbed.svelte - Desktop tabbed modal for LOOP selection

Modal with 2 tabs:
1. Browse Presets - Discover presets from trending, following, and saved
2. Build Combo - Interactive pie chart to build custom combinations
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

  type TabId = "browse" | "build";
  let activeTab = $state<TabId>("browse");
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
  size="lg"
  labelledBy="loop-selection-title"
  class="loop-selection-modal"
>
  <div class="modal-layout">
    <header class="modal-header">
      <h2 id="loop-selection-title">Select LOOP Type</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div class="tab-switcher">
      <button
        class="tab-btn"
        class:active={activeTab === "browse"}
        onclick={() => (activeTab = "browse")}
      >
        <i class="fas fa-compass"></i>
        <span>Browse Presets</span>
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === "build"}
        onclick={() => (activeTab = "build")}
      >
        <i class="fas fa-sliders-h"></i>
        <span>Build Combo</span>
      </button>
    </div>

    <div class="modal-body">
      {#if activeTab === "browse"}
        <LOOPPresetBrowser
          onSelectComponents={handleSelectComponents}
          {favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      {:else}
        <LOOPComponentBuilder
          {selectedComponents}
          onToggleComponent={(c) => {
            hapticService?.trigger("selection");
            onToggleComponent(c);
          }}
          iconSize={28}
        />
      {/if}
    </div>

    {#if activeTab === "build"}
      <footer class="modal-footer">
        <button
          class="confirm-button"
          class:disabled={selectionCount === 0}
          class:coming-soon={!isImplemented && selectionCount > 0}
          onclick={handleConfirm}
          disabled={selectionCount === 0}
        >
          {buttonText}
        </button>
      </footer>
    {/if}
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
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 40px;
    height: 40px;
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
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .tab-switcher {
    display: flex;
    justify-content: center;
    padding: 16px 24px;
    gap: 8px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    min-width: 160px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 48px;
  }

  .tab-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .tab-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .modal-body {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
    min-height: 0;
  }

  .modal-footer {
    flex-shrink: 0;
    padding: 16px 24px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .confirm-button {
    width: 100%;
    padding: 14px 24px;
    min-height: 48px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .confirm-button:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
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
