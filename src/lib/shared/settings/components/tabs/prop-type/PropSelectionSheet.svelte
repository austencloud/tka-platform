<!--
  PropSelectionSheet.svelte
  Bottom drawer for selecting props.
  Uses BentoPropGrid to show all variations organized by family.

  Optional cat/dog mode: pass showTabs=true to render blue/red tab bar.
  Optional cat/dog toggle: pass showCatDogToggle=true to let users enable it.
  Parent controls which prop is selected and handles the selection callback.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BentoPropGrid from "./BentoPropGrid.svelte";
  import CatDogToggle from "./CatDogToggle.svelte";

  let {
    isOpen = $bindable(false),
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    showTabs = false,
    activeTab = $bindable<"blue" | "red">("blue"),
    autoClose = true,
    showCatDogToggle = false,
    catDogEnabled = false,
    onCatDogToggle,
  } = $props<{
    isOpen?: boolean;
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
    /** Show blue/red tab bar for cat/dog mode */
    showTabs?: boolean;
    /** Active tab when showTabs is true */
    activeTab?: "blue" | "red";
    /** Auto-close after selection. Set false when parent manages closing (e.g. cat/dog flow). */
    autoClose?: boolean;
    /** Show a cat/dog mode toggle in the drawer header */
    showCatDogToggle?: boolean;
    /** Current cat/dog mode state (read by toggle) */
    catDogEnabled?: boolean;
    /** Callback when user toggles cat/dog mode */
    onCatDogToggle?: () => void;
  }>();

  function handlePropSelect(propType: PropType) {
    const hapticService = container.items.hapticFeedback;
    hapticService?.trigger("selection");
    onSelect(propType);
    if (autoClose) {
      isOpen = false;
    }
  }

  function handleTabChange(tab: "blue" | "red") {
    const hapticService = container.items.hapticFeedback;
    hapticService?.trigger("selection");
    activeTab = tab;
  }
</script>

<Drawer
  {isOpen}
  placement="bottom"
  closeOnBackdrop={true}
  closeOnEscape={true}
  dismissible={true}
  showHandle={true}
  ariaLabel={title}
  class="prop-selection-drawer"
  onOpenChange={(open) => {
    if (!open) isOpen = false;
  }}
>
  <div class="sheet-content">
    <!-- Header row: cat/dog toggle when enabled -->
    {#if showCatDogToggle}
      <div class="drawer-header-row">
        <CatDogToggle catDogMode={catDogEnabled} onToggle={() => onCatDogToggle?.()} />
      </div>
    {/if}

    <!-- Blue/Red tabs for cat/dog mode -->
    {#if showTabs}
      <div class="tab-bar" role="tablist" aria-label="Prop hand selection">
        <button
          type="button"
          role="tab"
          class="tab-btn"
          class:active={activeTab === "blue"}
          aria-selected={activeTab === "blue"}
          onclick={() => handleTabChange("blue")}
        >
          <span class="tab-indicator blue" aria-hidden="true"></span>
          Blue
        </button>
        <button
          type="button"
          role="tab"
          class="tab-btn"
          class:active={activeTab === "red"}
          aria-selected={activeTab === "red"}
          onclick={() => handleTabChange("red")}
        >
          <span class="tab-indicator red" aria-hidden="true"></span>
          Red
        </button>
      </div>
    {/if}

    <BentoPropGrid
      {selectedPropType}
      {color}
      {title}
      onSelect={handlePropSelect}
    />
  </div>
</Drawer>

<style>
  /* Bottom drawer sizing - centered with margin auto (avoids transform conflicts with drag) */
  :global(.prop-selection-drawer[data-placement="bottom"]) {
    height: fit-content;
    max-height: 70vh;
    min-height: 0 !important;
    max-width: 480px;
    left: 0 !important;
    right: 0 !important;
    margin-left: auto;
    margin-right: auto;
    border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
  }

  /* Content - fills drawer */
  .sheet-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }

  /* Header row with cat/dog toggle */
  .drawer-header-row {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px 12px;
    flex-shrink: 0;
  }

  /* Tab bar */
  .tab-bar {
    display: flex;
    gap: 8px;
    padding: 4px 8px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    margin-bottom: 8px;
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
    transition: all var(--duration-normal) ease;
    min-height: 48px;
  }

  .tab-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
  }

  .tab-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
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

  @media (prefers-reduced-motion: reduce) {
    .tab-btn {
      transition: none;
    }
  }
</style>
