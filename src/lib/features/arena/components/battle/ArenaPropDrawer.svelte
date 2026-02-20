<!--
  ArenaPropDrawer.svelte

  Prop type selector for the arena.
  Unlike the settings PropSelectorDrawer, this doesn't change global settings.
  It just returns the selected prop type via callback.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";

  let {
    isOpen = $bindable(false),
    selectedPropType,
    onSelect,
    onClose,
  }: {
    isOpen: boolean;
    selectedPropType: PropType;
    onSelect: (propType: PropType) => void;
    onClose: () => void;
  } = $props();

  function handleSelect(propType: PropType) {
    onSelect(propType);
    isOpen = false;
    onClose();
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
  ariaLabel="Select prop type for arena"
  class="arena-prop-drawer"
  onOpenChange={(open) => {
    if (!open) handleDrawerClose();
  }}
>
  <div class="arena-drawer-body">
    <div class="drawer-header">
      <h3 class="drawer-title">Arena Prop</h3>
      <button
        type="button"
        class="close-btn"
        onclick={handleDrawerClose}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="grid-container">
      <BentoPropGrid
        {selectedPropType}
        color="blue"
        title="Prop Type"
        onSelect={handleSelect}
      />
    </div>
  </div>
</Drawer>

<style>
  :global(.arena-prop-drawer[data-placement="bottom"]) {
    height: fit-content;
    max-height: 85vh;
    min-height: 0 !important; /* Override base 50vh min */
    width: 100%;
    max-width: 480px;
    left: 50% !important;
    transform: translateX(-50%);
    border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
  }

  :global(.arena-prop-drawer[data-placement="bottom"][data-state="open"]) {
    transform: translate(-50%, 0);
  }

  :global(.arena-prop-drawer[data-placement="bottom"][data-state="closed"]) {
    transform: translate(-50%, 100%);
  }

  .arena-drawer-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

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

  .grid-container {
    flex: 1;
    min-height: 0;
    padding: 8px;
    overflow-y: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>
