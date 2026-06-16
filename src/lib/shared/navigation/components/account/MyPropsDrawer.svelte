<!--
  MyPropsDrawer.svelte - Two-phase modal for selecting props and picking a favorite.

  Phase 1: "What do you spin?" - curated prop family grid with multi-select
  Phase 2: "Your go-to?" - pick one favorite from selections (shown when 2+ selected)

  Content morphs in place. No navigation, no step indicators.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import PropFamilyGrid from "./PropFamilyGrid.svelte";
  import { PROP_FAMILIES } from "./PropFamilyGrid.svelte";
  import SelectionFooterBar from "./SelectionFooterBar.svelte";
  import FavoritePicker from "./FavoritePicker.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import { getBasePropType } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

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
      const haptic = getHapticFeedback() as HapticFeedback;
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
    // 1 prop selected - auto-favorite it
    const singleProp = gridSelections[0];
    if (gridSelections.length === 1 && singleProp) {
      propState.setFavorite(singleProp);
    }
    closeModal();
  }

  function handleFavoriteSelected(propType: PropType) {
    propState.setFavorite(propType);
    closeModal();
  }

  function handleBack() {
    phase = "select";
  }

  function closeModal() {
    phase = "select";
    onclose();
  }

  // Reset phase when modal opens
  $effect(() => {
    if (isOpen) {
      phase = "select";
    }
  });
</script>

<BaseModal
  bind:open={isOpen}
  onclose={() => closeModal()}
  size="fit"
  animation="pop"
  class="my-props-modal"
>
  {#snippet header()}
    <div class="modal-header">
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
      <h2 class="modal-title" aria-live="polite">{headerText}</h2>
    </div>
  {/snippet}

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

  {#snippet footer()}
    {#if phase === "select"}
      <SelectionFooterBar
        selectedProps={gridSelections}
        saving={propState.saving}
        onadvance={handleAdvanceToFavorite}
        ondone={handleDone}
      />
    {/if}
  {/snippet}
</BaseModal>

<style>
  /* Override the fit size to be content-responsive instead of fixed 480px.
     ~8 columns on 4K, ~4 on laptop, ~2 on phone. */
  :global(.my-props-modal) {
    width: min(92vw, 960px) !important;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 8px;
  }

  .modal-title {
    font-size: var(--font-size-base, 16px);
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
    font-size: var(--font-size-compact, 12px);
  }

  .phase-container {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
    padding-bottom: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
