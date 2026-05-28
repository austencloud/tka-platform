<!--
  ChoreoCard.svelte - Card front for Choreo Cards

  Displays a sequence thumbnail using PropAwareThumbnail with Firebase caching.
  The front is the "reading" face: word, pictographs, footer.
  Level badge and LOOP icons live on the card back (the "sorting" face).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onMount } from "svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  interface Props {
    sequence: SequenceData;
    printMode?: boolean;
    showQRCodes?: boolean;
    showBirthday?: boolean;
    // Visibility settings
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    /** "row" = start position as top row, "column" = start position as left column */
    startPositionLayout?: "row" | "column";
    /** Render as hand path card: HAND props, float arrows, no TKA/reversals */
    handPathMode?: boolean;
    /** Use 5:7 playing card layout for physical card export (different from printMode) */
    cardMode?: boolean;
    /** Override the notes text in the card footer (e.g. TnD description) */
    customNotesText?: string;
    /** Pre-rendered image URL - displays this instead of rendering via PropAwareThumbnail */
    preRenderedImageUrl?: string | null;
    /** Show mandala fills in empty grid cells */
    showMandala?: boolean;
    onSelect?: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    sequence,
    printMode = false,
    showQRCodes = true,
    showBirthday = false,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    startPositionLayout = "row",
    handPathMode = false,
    cardMode = false,
    customNotesText = "🔥 FireDrums 2026 🔥",
    preRenderedImageUrl: preRenderedImageUrlProp,
    showMandala = false,
    onSelect,
    onContextMenu,
  }: Props = $props();

  // Local override so re-render can clear the pre-rendered URL
  let preRenderedCleared = $state(false);
  const usePreRendered = $derived(!!preRenderedImageUrlProp && !preRenderedCleared);

  let hapticService: HapticFeedback;
  let thumbnailRef: PropAwareThumbnail | undefined = $state();

  export function rerender(): void {
    preRenderedCleared = true;
    thumbnailRef?.forceRerender();
  }


  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Get prop settings from global state
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  // Build visibility settings for thumbnail render
  const visibilitySettings = $derived({
    showTKA: handPathMode ? false : showTKA,
    showReversals: handPathMode ? false : true,
    showGrid,
    showNonRadialPoints: false, // Off by default for cleaner choreo cards
    handPointVisibility: handPointsVisible ? "all" as const : "active" as const,
    showQRCode: showQRCodes,
    handPathMode,
    showMandala,
  });

  function handleClick() {
    hapticService?.trigger("selection");
    onSelect?.(sequence);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }

  function handleContextMenu(event: MouseEvent) {
    if (!onContextMenu) return;
    event.preventDefault();
    onContextMenu(event.clientX, event.clientY, rerender);
  }
</script>

<button
  class="choreo-card"
  class:print-mode={printMode}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  oncontextmenu={handleContextMenu}
  aria-label="View sequence {sequence.name}"
  type="button"
>
  <div class="card-content">
    {#if usePreRendered}
      <img
        class="pre-rendered-image"
        src={preRenderedImageUrlProp}
        alt="Preview of {sequence.name}"
        draggable="false"
      />
    {:else}
      <PropAwareThumbnail
        bind:this={thumbnailRef}
        {sequence}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={propSettings.catDogMode}
        lightMode={printMode || cardMode}
        variant="wordcard"
        addWord={showWord}
        addDifficultyLevel={false}
        {includeStartPosition}
        {startPositionLayout}
        showBirthday={false}
        showCreatorName={false}
        showNotes={true}
        userName={sequence.author ?? ""}
        visibility={visibilitySettings}
        {cardMode}
        {customNotesText}
      />
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
    border: 2px solid #999999;
    border-radius: 0;
    overflow: hidden;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .choreo-card:hover {
    box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.15));
  }

  .choreo-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .pre-rendered-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  /* Card content wrapper */
  .card-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .choreo-card {
      transition: none;
    }
  }
</style>
