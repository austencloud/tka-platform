<!--
  MyPropsDrawer.svelte — Two-phase drawer for selecting props and picking a favorite.

  Phase 1: "What do you spin?" — curated prop family grid with multi-select
  Phase 2: "Your go-to?" — pick one favorite from selections (shown when 2+ selected)

  Content morphs in place. No navigation, no step indicators.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import PropFamilyGrid from "./PropFamilyGrid.svelte";
  import { PROP_FAMILIES } from "./PropFamilyGrid.svelte";
  import SelectionFooterBar from "./SelectionFooterBar.svelte";
  import FavoritePicker from "./FavoritePicker.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import { getBasePropType } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  interface Props {
    isOpen: boolean;
    propState: PropPreferenceState;
    onclose: () => void;
  }

  let { isOpen = $bindable(), propState, onclose }: Props = $props();

  type Phase = "select" | "favorite";
  let phase = $state<Phase>("select");

  // Set of base types that exist in PROP_FAMILIES for filtering
  const familyBases = new Set(PROP_FAMILIES.map((f) => f.base));

  // Normalize stored propsISpinWith to base types, filtered to families in the grid
  const gridSelections = $derived(
    propState.propsISpinWith
      .map(getBasePropType)
      .filter((p) => familyBases.has(p))
      // Deduplicate (multiple variants of same family → one entry)
      .filter((p, i, arr) => arr.indexOf(p) === i)
  );

  const headerText = $derived(
    phase === "select" ? "What do you spin?" : "Your go-to?"
  );

  function triggerHaptic(type: "selection" | "success" = "selection") {
    try {
      const haptic = container.items.hapticFeedback as IHapticFeedback;
      haptic?.trigger(type);
    } catch {
      // Not available
    }
  }

  function handleToggle(propType: PropType) {
    triggerHaptic("selection");
    propState.toggleProp(propType);
  }

  function handleAdvanceToFavorite() {
    triggerHaptic("selection");
    phase = "favorite";
  }

  function handleDone() {
    // 1 prop selected — auto-favorite it
    const singleProp = gridSelections[0];
    if (gridSelections.length === 1 && singleProp) {
      propState.setFavorite(singleProp);
    }
    closeDrawer();
  }

  function handleFavoriteSelected(propType: PropType) {
    propState.setFavorite(propType);
    // FavoritePicker has a 400ms delay built in before calling this
    closeDrawer();
  }

  function handleBack() {
    phase = "select";
  }

  function closeDrawer() {
    phase = "select";
    onclose();
  }

  // Reset phase when drawer opens
  $effect(() => {
    if (isOpen) {
      phase = "select";
    }
  });
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  ariaLabel="My props editor"
  class="my-props-drawer"
  backdropClass="my-props-backdrop"
  onclose={closeDrawer}
>
  <div class="drawer-content">
    <!-- Header -->
    <div class="drawer-header">
      {#if phase === "favorite"}
        <button
          class="back-button"
          onclick={handleBack}
          aria-label="Back to prop selection"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      {/if}
      <h2 class="drawer-title" aria-live="polite">{headerText}</h2>
    </div>

    <!-- Phase content -->
    <div class="phase-container">
      {#if phase === "select"}
        <PropFamilyGrid
          selectedProps={gridSelections}
          favoriteProp={propState.favoriteProp ? getBasePropType(propState.favoriteProp) : null}
          disabled={propState.loading}
          ontoggle={handleToggle}
        />
      {:else}
        <FavoritePicker
          selectedProps={gridSelections}
          onfavorite={handleFavoriteSelected}
        />
      {/if}
    </div>

    <!-- Footer (Phase 1 only) -->
    {#if phase === "select"}
      <SelectionFooterBar
        selectedProps={gridSelections}
        saving={propState.saving}
        onadvance={handleAdvanceToFavorite}
        ondone={handleDone}
      />
    {/if}
  </div>
</Drawer>

<style>
  /* Backdrop: dim the screen behind the drawer */
  :global(.my-props-backdrop) {
    background: rgba(0, 0, 0, 0.5) !important;
    /* Override desktop sidebar constraint — this drawer covers everything */
    left: 0 !important;
  }

  :global(.my-props-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    /* Override desktop sidebar constraint — center on full viewport */
    left: 0 !important;
  }

  /* On desktop, constrain to a reasonable width so it's not awkwardly wide */
  @media (min-width: 768px) {
    :global(.my-props-drawer) {
      max-width: 420px;
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%) !important;
      border-radius: 16px 16px 0 0;
      min-height: auto;
    }

    :global(.my-props-drawer[data-state="closed"]) {
      transform: translateX(-50%) translate3d(0, 100%, 0) !important;
    }
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px;
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    border-radius: 6px;
    transition: color var(--duration-fast, 150ms) ease;
    min-height: 32px;
  }

  .back-button:hover {
    color: var(--theme-text, white);
  }

  .back-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .back-button i {
    font-size: 10px;
  }

  .phase-container {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
    min-height: 0;
    padding-bottom: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
