<!--
  VariationPickerDrawer.svelte

  Shown when a user taps a card that has multiple variations (same word).
  Displays all variations as choreo card thumbnails in a grid.
  Tapping one opens the standard sequence viewer with that single sequence.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
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

  const word = $derived(variations[0]?.word ?? "");

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

<Drawer
  {isOpen}
  placement="bottom"
  onclose={onClose}
  onOpenChange={(open) => { if (!open) onClose(); }}
  ariaLabel={t('browse_choose_variation')}
  class="variation-picker-drawer"
>
  <DrawerHeader
    title={t('browse_variations_title', { count: String(variations.length), word })}
    onClose={onClose}
  />

  <div class="picker-grid">
    {#each variations as variation (variation.id)}
      <div class="picker-item">
        <ChoreoCardThumbnail
          sequence={variation}
          onPrimaryAction={() => handleSelect(variation)}
          bluePropType={propSettings.bluePropType}
          redPropType={propSettings.redPropType}
          catDogModeEnabled={isCatDog}
          {lightMode}
          eager
        />
        <span class="picker-author">{variation.author ?? "Unknown"}</span>
      </div>
    {/each}
  </div>
</Drawer>

<style>
  .picker-grid {
    display: grid;
    /* Column min scales with viewport: 200px floor on phones, up to 480px on large screens.
       auto-fit + 1fr max means items expand to fill all available space. */
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, clamp(200px, 20vw, 480px)), 1fr)
    );
    gap: clamp(8px, 2vw, 24px);
    padding: clamp(12px, 3vw, 32px);
    overflow-y: auto;
    max-height: 75vh;
  }

  .picker-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .picker-author {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.variation-picker-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) !important;
    --sheet-filter: none !important;
  }
</style>
