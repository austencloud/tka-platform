<!--
  WordCard.svelte - Sequence card for print preview

  Displays a sequence thumbnail using PropAwareThumbnail with Firebase caching.
  Word cards always include user data footer (creator name, notes, birthday).
  In print mode, uses light background for paper preview.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import PropAwareThumbnail from "$lib/features/discover/gallery/display/components/PropAwareThumbnail.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  interface Props {
    sequence: SequenceData;
    printMode?: boolean;
  }

  let { sequence, printMode = false }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Get prop settings from global state
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  function handleClick() {
    hapticService?.trigger("selection");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="word-card"
  class:print-mode={printMode}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  aria-label="View sequence {sequence.name}"
  type="button"
>
  <PropAwareThumbnail
    {sequence}
    bluePropType={propSettings.bluePropType}
    redPropType={propSettings.redPropType}
    catDogModeEnabled={propSettings.catDogMode}
    lightMode={printMode}
    variant="wordcard"
  />
</button>

<style>
  /* Print-mode semantic tokens for word cards (light mode for paper) */
  .word-card {
    --print-bg: #ffffff;
    --print-border: #000000;
    --print-text: #333333;
    --print-text-dim: #666666;
    --print-text-muted: #999999;
    --print-spinner-track: #e0e0e0;
    --print-error-bg: #ffeeee;
    --print-error-text: #cc0000;

    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%; /* Fill grid cell */
    padding: 0;
    background: var(--print-bg);
    border: 1px solid var(--print-border);
    border-radius: 0;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .word-card:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .word-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* PropAwareThumbnail scales to fit within the card cell */
  .word-card :global(.prop-thumbnail) {
    width: 100%;
    height: 100%;
    background: var(--print-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .word-card :global(.prop-thumbnail img) {
    width: 100%;
    height: 100%;
    object-fit: contain; /* Scale down to fit, maintain aspect ratio */
  }

  /* Light-mode loading placeholder for word cards */
  .word-card :global(.loading-placeholder),
  .word-card :global(.error-placeholder),
  .word-card :global(.empty-placeholder) {
    background: var(--print-bg);
    color: var(--print-text-dim);
  }

  .word-card :global(.spinner) {
    border-color: var(--print-spinner-track);
    border-top-color: var(--print-text-dim);
  }

  .word-card :global(.loading-status) {
    color: var(--print-text-dim);
  }

  .word-card :global(.error-icon) {
    background: var(--print-error-bg);
    color: var(--print-error-text);
  }

  .word-card :global(.letter) {
    color: var(--print-text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .word-card {
      transition: none;
    }
  }
</style>
