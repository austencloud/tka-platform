<!--
  ChoreoCard.svelte - Sequence card for print preview

  Displays a sequence thumbnail using PropAwareThumbnail with Firebase caching.
  Choreo cards always include user data footer (creator name, notes, birthday).
  In print mode, uses light background for paper preview.
  Shows LOOP primitive icons when sequence uses a LOOP pattern (detected algorithmically).
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ISequenceToEntryConverter } from "../services/contracts/ISequenceToEntryConverter";
  import { container } from "$lib/shared/di";
  import { loopDetector } from "$lib/features/loop-labeler/services/implementations/LOOPDetector";
  import { onMount } from "svelte";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import type { ComponentId } from "$lib/features/loop-labeler/domain/constants/loop-components";

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
    /** Render as hand path card: HAND props, float arrows, no TKA/reversals */
    handPathMode?: boolean;
    /** Use 5:7 playing card layout for physical card export (different from printMode) */
    cardMode?: boolean;
    onSelect?: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    sequence,
    printMode = false,
    showQRCodes = true,
    showBirthday = true,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    handPathMode = false,
    cardMode = false,
    onSelect,
    onContextMenu,
  }: Props = $props();

  let hapticService: IHapticFeedback;
  let sequenceToEntryConverter: ISequenceToEntryConverter;
  let thumbnailRef: PropAwareThumbnail;

  export function rerender(): void {
    thumbnailRef?.forceRerender();
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    sequenceToEntryConverter = container.items.sequenceToEntryConverter;
  });

  // Map ComponentId (loop-labeler format) to LOOPComponent (icon strip format)
  function componentIdToLOOPComponent(id: ComponentId): LOOPComponent | null {
    const mapping: Record<string, LOOPComponent> = {
      rotated: LOOPComponent.ROTATED,
      mirrored: LOOPComponent.MIRRORED,
      flipped: LOOPComponent.FLIPPED,
      swapped: LOOPComponent.SWAPPED,
      inverted: LOOPComponent.INVERTED,
      rewound: LOOPComponent.REWOUND,
    };
    return mapping[id] ?? null;
  }

  // Detect LOOP pattern from sequence steps algorithmically
  const loopComponents = $derived.by(() => {
    if (!sequenceToEntryConverter || !sequence.steps?.length) {
      return new Set<LOOPComponent>();
    }

    try {
      // Convert SequenceData to SequenceEntry format for LOOP detection
      const entry = sequenceToEntryConverter.convert(sequence);
      const result = loopDetector.detectLOOP(entry);

      // Convert detected components to LOOPComponent enum
      const components = new Set<LOOPComponent>();
      for (const componentId of result.components) {
        const mapped = componentIdToLOOPComponent(componentId);
        if (mapped) {
          components.add(mapped);
        }
      }
      return components;
    } catch {
      // If detection fails, return empty set
      return new Set<LOOPComponent>();
    }
  });

  // Only show LOOP icons if sequence has a LOOP pattern
  const hasLoopPattern = $derived(loopComponents.size > 0);

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
    showQRCode: showQRCodes, // QR rendered in empty cell by ImageComposer
    handPathMode,
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
    <PropAwareThumbnail
      bind:this={thumbnailRef}
      {sequence}
      bluePropType={propSettings.bluePropType}
      redPropType={propSettings.redPropType}
      catDogModeEnabled={propSettings.catDogMode}
      lightMode={printMode}
      variant="wordcard"
      addWord={showWord}
      addDifficultyLevel={handPathMode ? false : undefined}
      {includeStartPosition}
      {showBirthday}
      visibility={visibilitySettings}
      {cardMode}
    />
    {#if hasLoopPattern && !handPathMode}
      <div class="loop-overlay">
        <LOOPIconStrip
          activeComponents={loopComponents}
          size={14}
          darkMode={!printMode}
          showFreeformWhenEmpty={false}
        />
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
    transition: all var(--duration-fast) ease;
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

  /* Card content wrapper */
  .card-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* LOOP icons overlay - positioned top-right */
  .loop-overlay {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 1;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.5);
    padding: 3px 6px;
    border-radius: 4px;
  }

  /* Light background for print mode */
  .choreo-card.print-mode .loop-overlay {
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  @media (prefers-reduced-motion: reduce) {
    .choreo-card {
      transition: none;
    }
  }
</style>
