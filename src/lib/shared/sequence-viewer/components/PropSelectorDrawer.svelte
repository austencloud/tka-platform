<!--
  PropSelectorDrawer.svelte

  Full-height drawer for selecting props in the sequence viewer.
  Works for both authenticated and anonymous users (uses localStorage via settingsState).
  Shows blue/red prop selection with tabs or side-by-side layout.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getSettings, updateSetting } from "$lib/shared/application/state/app-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";

  interface Props {
    /** Whether the drawer is open */
    isOpen: boolean;
    /** Callback when drawer closes */
    onClose: () => void;
  }

  let { isOpen = $bindable(false), onClose }: Props = $props();

  // Get current settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings.redPropType ?? PropType.STAFF);
  const catDogMode = $derived(settings.catDogMode ?? false);

  // Active tab: blue or red (only matters when catDogMode is on)
  let activeTab = $state<"blue" | "red">("blue");

  // Haptic feedback
  const hapticService = container.items.hapticFeedback as IHapticFeedback | undefined;

  function handleBlueSelect(propType: PropType) {
    hapticService?.trigger("selection");
    updateSetting("bluePropType", propType);
    // If not in cat/dog mode, also update red to match
    if (!catDogMode) {
      updateSetting("redPropType", propType);
    }
    // Close after selection
    isOpen = false;
    onClose();
  }

  function handleRedSelect(propType: PropType) {
    hapticService?.trigger("selection");
    updateSetting("redPropType", propType);
    // Close after selection
    isOpen = false;
    onClose();
  }

  function handleTabChange(tab: "blue" | "red") {
    hapticService?.trigger("selection");
    activeTab = tab;
  }

  function handleDrawerClose() {
    isOpen = false;
    onClose();
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  closeOnBackdrop={true}
  closeOnEscape={true}
  dismissible={true}
  showHandle={true}
  ariaLabel="Select prop type"
  class="prop-selector-drawer"
  onOpenChange={(open) => {
    if (!open) handleDrawerClose();
  }}
>
  <div class="drawer-content">
    <!-- Header -->
    <div class="drawer-header">
      <h3 class="drawer-title">Select Props</h3>
      <button
        type="button"
        class="close-btn"
        onclick={handleDrawerClose}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Tab selector (only when cat/dog mode is enabled) -->
    {#if catDogMode}
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === "blue"}
          onclick={() => handleTabChange("blue")}
        >
          <span class="tab-indicator blue"></span>
          Blue
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === "red"}
          onclick={() => handleTabChange("red")}
        >
          <span class="tab-indicator red"></span>
          Red
        </button>
      </div>
    {/if}

    <!-- Prop grid -->
    <div class="grid-container">
      {#if catDogMode}
        {#if activeTab === "blue"}
          <BentoPropGrid
            selectedPropType={bluePropType}
            color="blue"
            title="Blue Prop"
            onSelect={handleBlueSelect}
          />
        {:else}
          <BentoPropGrid
            selectedPropType={redPropType}
            color="red"
            title="Red Prop"
            onSelect={handleRedSelect}
          />
        {/if}
      {:else}
        <!-- Single grid when not in cat/dog mode -->
        <BentoPropGrid
          selectedPropType={bluePropType}
          color="blue"
          title="Prop Type"
          onSelect={handleBlueSelect}
        />
      {/if}
    </div>
  </div>
</Drawer>

<style>
  /* Drawer sizing - must be a definite height so .drawer-inner (flex:1) resolves correctly */
  :global(.prop-selector-drawer[data-placement="bottom"]) {
    height: 85vh;
    /* Center on desktop with a max width that suits the bento grid */
    max-width: 480px;
    left: 50% !important;
    transform: translateX(-50%);
    border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
  }

  /* Override transform for open/closed states so translateX(-50%) is preserved */
  :global(.prop-selector-drawer[data-placement="bottom"][data-state="open"]) {
    transform: translate(-50%, 0);
  }

  :global(.prop-selector-drawer[data-placement="bottom"][data-state="closed"]) {
    transform: translate(-50%, 100%);
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 150ms ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Tab bar */
  .tab-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 150ms ease;
    min-height: 48px;
  }

  .tab-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
  }

  .tab-btn.active {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.15));
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, white);
  }

  .tab-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .tab-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .tab-indicator.blue {
    background: var(--prop-blue, #3b82f6);
  }

  .tab-indicator.red {
    background: var(--prop-red, #ef4444);
  }

  /* Grid container */
  .grid-container {
    flex: 1;
    min-height: 0;
    padding: 8px;
    overflow-y: auto;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tab-btn,
    .close-btn {
      transition: none;
    }
  }
</style>
