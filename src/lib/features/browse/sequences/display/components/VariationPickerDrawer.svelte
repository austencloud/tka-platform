<!--
  VariationPickerDrawer.svelte

  Shown when a user taps a card that has multiple variations (same word).
  Displays all variations as choreo card thumbnails in a centered modal.
  Tapping one opens the standard sequence viewer with that single sequence.

  Despite the filename it now renders as a centered BaseModal (not a Drawer):
  fixed-max-width medium cards in an auto-fill grid so a single variation
  renders at ~340px centered rather than stretched across a 4K viewport.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  const {
    isOpen = false,
    variations = [],
    onSelect = () => {},
    onClose = () => {},
  }: {
    isOpen: boolean;
    variations: SequenceData[];
    onSelect: (sequence: SequenceData) => void;
    onClose: () => void;
  } = $props();

  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  const isCatDog = $derived(
    isCatDogMode(
      propSettings.bluePropType,
      propSettings.redPropType,
      propSettings.catDogMode
    )
  );

  const visibilityManager = getAnimationVisibilityManager();
  const lightMode = $derived(!visibilityManager.isDarkMode());

  function handleSelect(sequence: SequenceData) {
    onClose();
    onSelect(sequence);
  }
</script>

<BaseModal
  open={isOpen}
  onclose={onClose}
  size="lg"
  class="variation-picker-modal"
>
  {#snippet header()}
    <ModalHeader
      title={t('browse_variations_title')}
      subtitle={t('browse_choose_variation')}
      onClose={onClose}
    />
  {/snippet}

  <div class="picker-grid">
    {#each variations as variation, i (variation.id)}
      <!-- data-animate reuses BaseModal's staggered entrance (modal-tokens.css);
           capped at the defined 1..6 range, reduced-motion-safe automatically. -->
      <div class="picker-item" data-animate={Math.min(i + 1, 6)}>
        <!-- allowQR: unlike grid cards, these render at 300-340px — scannable
             size, and the grid's fixed cells already reserve the QR slot. -->
        <ChoreoCardThumbnail
          sequence={variation}
          onPrimaryAction={() => handleSelect(variation)}
          bluePropType={propSettings.bluePropType}
          redPropType={propSettings.redPropType}
          catDogModeEnabled={isCatDog}
          {lightMode}
          eager
          allowQR
        />
      </div>
    {/each}
  </div>
</BaseModal>

<style>
  .picker-grid {
    display: grid;
    /* Fixed-max cells (auto-FILL, NOT 1fr): each card stays 300-340px and the
       row centers. A single variation renders at 340px centered, never stretched
       across a wide viewport. Fixed-cell sizing also means no reflow when a card's
       QR slot appears/disappears. */
    grid-template-columns: repeat(auto-fill, minmax(300px, 340px));
    justify-content: center;
    gap: clamp(16px, 2vw, 24px);
    padding: clamp(16px, 3vw, 32px);
  }

  /* Cap the dialog width at ~1100px (the `lg` default of 640px is too narrow for
     a multi-column medium-card grid). Body scroll + max-height come from BaseModal. */
  :global(dialog.base-modal.variation-picker-modal) {
    width: min(1100px, 92vw);
  }

  /* Phones: 2-up compact cards so BOTH variations are visible at once.
     Full-screen single-column 340px cards made each variation fill the whole
     viewport — nothing signalled that the second one was below the fold. */
  @media (max-width: 767px) {
    :global(dialog.base-modal.variation-picker-modal) {
      width: 100%;
      max-width: none;
      max-height: 90dvh;
      height: auto;
      border-radius: 16px 16px 0 0;
      margin: auto 0 0;
    }

    .picker-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      justify-content: stretch;
      gap: 10px;
      padding: 12px 12px 20px;
    }
  }
</style>
