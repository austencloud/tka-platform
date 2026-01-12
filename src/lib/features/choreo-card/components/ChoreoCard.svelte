<!--
  ChoreoCard.svelte - Sequence card for print preview

  Displays a sequence thumbnail using PropAwareThumbnail with Firebase caching.
  Choreo cards always include user data footer (creator name, notes, birthday).
  In print mode, uses light background for paper preview.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import PropAwareThumbnail from "$lib/features/discover/sequences/display/components/PropAwareThumbnail.svelte";
  import ChoreoCardQR from "./ChoreoCardQR.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  interface Props {
    sequence: SequenceData;
    printMode?: boolean;
    showQRCodes?: boolean;
    // Visibility settings
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
  }

  let {
    sequence,
    printMode = false,
    showQRCodes = false,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
  }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Get prop settings from global state
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  // Build visibility settings for thumbnail render
  const visibilitySettings = $derived({
    showTKA,
    showReversals: true, // Always show reversals in choreo cards
    showGrid,
    showNonRadialPoints: false, // Off by default for cleaner choreo cards
    handPointVisibility: handPointsVisible ? "all" as const : "active" as const,
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
  class="choreo-card"
  class:print-mode={printMode}
  class:with-qr={showQRCodes}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  aria-label="View sequence {sequence.name}"
  type="button"
>
  <div class="card-content">
    <PropAwareThumbnail
      {sequence}
      bluePropType={propSettings.bluePropType}
      redPropType={propSettings.redPropType}
      catDogModeEnabled={propSettings.catDogMode}
      lightMode={printMode}
      variant="wordcard"
      addWord={showWord}
      {includeStartPosition}
      visibility={visibilitySettings}
    />
    {#if showQRCodes}
      <div class="qr-overlay">
        <ChoreoCardQR {sequence} size={60} />
      </div>
    {/if}
  </div>
</button>

<style>
  /* Print-mode semantic tokens for choreo cards (light mode for paper) */
  .choreo-card {
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

  .choreo-card:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .choreo-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* PropAwareThumbnail scales to fit within the card cell */
  .choreo-card :global(.prop-thumbnail) {
    width: 100%;
    height: 100%;
    background: var(--print-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .choreo-card :global(.prop-thumbnail img) {
    width: 100%;
    height: 100%;
    object-fit: contain; /* Scale down to fit, maintain aspect ratio */
  }

  /* Light-mode loading placeholder for choreo cards */
  .choreo-card :global(.loading-placeholder),
  .choreo-card :global(.error-placeholder),
  .choreo-card :global(.empty-placeholder) {
    background: var(--print-bg);
    color: var(--print-text-dim);
  }

  .choreo-card :global(.spinner) {
    border-color: var(--print-spinner-track);
    border-top-color: var(--print-text-dim);
  }

  .choreo-card :global(.loading-status) {
    color: var(--print-text-dim);
  }

  .choreo-card :global(.error-icon) {
    background: var(--print-error-bg);
    color: var(--print-error-text);
  }

  .choreo-card :global(.letter) {
    color: var(--print-text-muted);
  }

  /* Card content wrapper for QR overlay positioning */
  .card-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* QR code overlay - positioned bottom-left (below start position column) */
  .qr-overlay {
    position: absolute;
    bottom: 4px;
    left: 4px;
    z-index: 1;
    pointer-events: none; /* Allow clicks through to card */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }

  /* Adjust card layout when QR codes are shown */
  .choreo-card.with-qr .card-content {
    /* Ensure thumbnail doesn't overlap QR code */
    padding-bottom: 8px;
  }

  /* Print styles for QR codes */
  @media print {
    .qr-overlay {
      box-shadow: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .choreo-card {
      transition: none;
    }
  }
</style>
