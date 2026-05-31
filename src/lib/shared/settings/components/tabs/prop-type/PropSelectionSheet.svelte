<!--
  PropSelectionSheet.svelte
  Bottom drawer for selecting props.
  Uses BentoPropGrid to show all variations organized by family.

  Optional cat/dog mode: pass showTabs=true to render blue/red tab bar.
  Optional cat/dog toggle: pass showCatDogToggle=true to let users enable it.
  Parent controls which prop is selected and handles the selection callback.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
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
    const hapticService = getHapticFeedback();
    hapticService?.trigger("selection");
    onSelect(propType);
    if (autoClose) {
      isOpen = false;
    }
  }

  function handleTabChange(tab: "blue" | "red") {
    const hapticService = getHapticFeedback();
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
      <div class="segment-wrapper">
        <div class="segment-control" role="tablist" aria-label="Prop hand selection">
          <button
            type="button"
            role="tab"
            class="segment-btn"
            class:active={activeTab === "blue"}
            aria-selected={activeTab === "blue"}
            onclick={() => handleTabChange("blue")}
          >
            <span class="color-dot blue" aria-hidden="true"></span>
            Blue
          </button>
          <button
            type="button"
            role="tab"
            class="segment-btn"
            class:active={activeTab === "red"}
            aria-selected={activeTab === "red"}
            onclick={() => handleTabChange("red")}
          >
            <span class="color-dot red" aria-hidden="true"></span>
            Red
          </button>
        </div>
      </div>
    {/if}

    <BentoPropGrid
      {selectedPropType}
      {color}
      {title}
      variant="inline"
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

  /* Segmented control - compact centered pill */
  .segment-wrapper {
    display: flex;
    justify-content: center;
    padding: 4px 8px 12px;
    flex-shrink: 0;
  }

  .segment-control {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    width: fit-content;
  }

  .segment-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    padding: 8px 20px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    min-height: 36px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .segment-btn:hover {
    background: color-mix(in srgb, var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08)) 50%, transparent);
    color: var(--theme-text, white);
  }

  .segment-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, white);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      0 2px 8px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .segment-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .color-dot.blue {
    background: var(--prop-blue, #3b82f6);
  }

  .color-dot.red {
    background: var(--prop-red, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .segment-btn {
      transition: none;
    }
  }
</style>
