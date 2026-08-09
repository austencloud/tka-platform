<!--
  MyPropsDrawer.svelte - One-screen editor for profile prop preferences.

  Users select every prop they spin and choose one favorite without leaving the
  grid. The same state owner persists both choices.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import PropFamilyGrid from "./PropFamilyGrid.svelte";
  import { PROP_FAMILIES } from "./PropFamilyGrid.svelte";
  import SelectionFooterBar from "./SelectionFooterBar.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import { getBasePropType } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { tryGetAccountSetupContext } from "$lib/shared/onboarding/context/account-setup-context";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  interface Props {
    isOpen: boolean;
    propState: PropPreferenceState;
    onclose: () => void;
  }

  let { isOpen = $bindable(), propState, onclose }: Props = $props();
  let choosingFavorite = $state(false);
  const accountSetupState = tryGetAccountSetupContext();

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

  const favoriteBase = $derived(
    propState.favoriteProp ? getBasePropType(propState.favoriteProp) : null
  );
  const canFinish = $derived(
    gridSelections.length === 1 ||
      (favoriteBase !== null && gridSelections.includes(favoriteBase))
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

  async function handleDone() {
    // 1 prop selected - auto-favorite it
    const singleProp = gridSelections[0];
    if (
      gridSelections.length === 1 &&
      singleProp &&
      favoriteBase !== singleProp
    ) {
      try {
        await propState.setFavorite(singleProp);
        accountSetupState?.markFavoritePropPresent(true);
      } catch (error) {
        console.error("[MyPropsDrawer] Favorite prop save failed", error);
        toast.error("Favorite prop didn't save. Try again.");
        return;
      }
    }
    closeModal();
  }

  async function handleFavoriteSelected(propType: PropType) {
    try {
      await propState.setFavorite(propType);
      accountSetupState?.markFavoritePropPresent(true);
      choosingFavorite = false;
      triggerHaptic("success");
    } catch (error) {
      console.error("[MyPropsDrawer] Favorite prop save failed", error);
      toast.error("Favorite prop didn't save. Try again.");
    }
  }

  function handleFavoriteModeToggle() {
    choosingFavorite = !choosingFavorite;
    triggerHaptic("selection");
  }

  function closeModal() {
    choosingFavorite = false;
    onclose();
  }
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
      <h2 class="modal-title">What do you spin?</h2>
      <p class="modal-description">
        Select every prop you spin, then choose one favorite.
      </p>
    </div>
  {/snippet}

  <div class="prop-grid-container">
    <PropFamilyGrid
      selectedProps={gridSelections}
      favoriteProp={favoriteBase}
      {choosingFavorite}
      disabled={propState.loading || propState.saving}
      ontoggle={handleToggle}
      onfavorite={handleFavoriteSelected}
    />
  </div>

  {#snippet footer()}
    <SelectionFooterBar
      selectedProps={gridSelections}
      saving={propState.saving}
      {canFinish}
      {choosingFavorite}
      onfavoritepick={handleFavoriteModeToggle}
      ondone={handleDone}
    />
  {/snippet}
</BaseModal>

<style>
  /* Keep two roomy columns on phones, then widen to the complete eight-column
     grid when the screen can show it without shrinking the favorite controls. */
  :global(.my-props-modal) {
    width: min(92vw, 60rem) !important;
  }

  .modal-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 16px 16px 8px;
  }

  .modal-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .modal-description {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    white-space: normal;
  }

  .prop-grid-container {
    container-type: inline-size;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
    padding-bottom: 8px;
  }

  @media (min-width: 1680px) {
    :global(.my-props-modal) {
      width: min(84vw, 90rem) !important;
    }
  }

  @media (min-width: 2600px) {
    :global(.my-props-modal) {
      width: 76vw !important;
    }

    .modal-header {
      gap: 0.5rem;
      padding: 2rem 2rem 1rem;
    }

    .modal-title {
      font-size: 2.25rem;
    }

    .modal-description {
      font-size: 1.375rem;
    }

    .prop-grid-container {
      padding-bottom: 1rem;
    }
  }
</style>
