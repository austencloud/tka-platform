<!--
  PropSelectionSheet.svelte
  Bottom drawer for selecting props.
  Uses BentoPropGrid to show all variations organized by family.

  Optional cat/dog mode: pass showTabs=true to render blue/red tab bar.
  Optional cat/dog toggle: pass showCatDogToggle=true to let users enable it.
  Parent controls which prop is selected and handles the selection callback.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
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

  // Desktop (side-by-side layout, i.e. nav sidebar present) opens the picker as
  // a full-height RIGHT side drawer instead of a bottom sheet — matches the
  // inbox/messages drawer for consistency. On mobile/narrow viewports it stays
  // a bottom sheet (the iOS full-height fix lives in the [data-placement="bottom"]
  // CSS override below). Driven directly off the layout manager rather than
  // Drawer's respectLayoutMode, which would also tag the overlay with
  // side-by-side-layout and clamp the backdrop to the right half.
  let isSideBySide = $state(false);
  let layoutUnsubscribe: (() => void) | null = null;

  onMount(() => {
    isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    layoutUnsubscribe = responsiveLayoutManager.onLayoutChange(() => {
      isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    });
  });

  onDestroy(() => layoutUnsubscribe?.());

  const placement = $derived(isSideBySide ? "right" : "bottom");

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

  function handleClose() {
    const hapticService = getHapticFeedback();
    hapticService?.trigger("selection");
    isOpen = false;
  }
</script>

<Drawer
  {isOpen}
  {placement}
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
    <!-- Explicit close affordance in addition to the drag handle / backdrop -->
    <button
      type="button"
      class="close-button"
      onclick={handleClose}
      aria-label="Close prop picker"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

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
    /* DEFINITE height, not fit-content. BentoPropGrid's .grid-scroll is a
       flex:1 + overflow:auto region; under an indefinite (fit-content) parent
       iOS WebKit collapses it to its 0 min-size when computing the intrinsic
       height, so the sheet lands at the min-height floor (~half screen) while
       Blink/Android grows to full. A definite height removes the intrinsic-size
       step entirely, so both engines render the same.
       calc(100dvh - safe-area-top): iOS tucks under the notch; on Android the
       top inset is ~0 so it stays pinned to the top (matches the Fold). */
    height: 100vh;
    height: calc(100dvh - env(safe-area-inset-top, 0px));
    max-width: 480px;
    left: 0 !important;
    right: 0 !important;
    margin-left: auto;
    margin-right: auto;
    border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
  }

  /* Desktop side drawer: full-height right panel (matches the inbox/messages
     drawer). Width tracks the bottom sheet's content width so the grid layout
     stays consistent across placements. Height comes from Drawer's right-
     placement rules (top:0/bottom:0). */
  :global(.prop-selection-drawer[data-placement="right"]) {
    --sheet-width: min(480px, 92vw);
  }

  /* Content - fills drawer */
  .sheet-content {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }

  /* Explicit X close — top-right, sits above the grid */
  .close-button {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 18px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, white);
  }

  .close-button:active {
    transform: scale(0.92);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }
    .close-button:active {
      transform: none;
    }
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
