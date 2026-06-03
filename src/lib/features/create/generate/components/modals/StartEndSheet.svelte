<!--
StartEndSheet.svelte - Sheet for configuring start/end position options

Start Position: Multi-select with presets (All, Classic 3, Custom)
End Position: Single select (for freeform mode only)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import {
    GridMode,
    type GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import { onMount } from "svelte";
  import PositionSection from "./customize/PositionSection.svelte";
  import MultiSelectPositionPicker from "$lib/shared/components/position-picker/MultiSelectPositionPicker.svelte";
  import {
    StartPositionPreset,
    PRESET_LABELS,
    PRESET_DESCRIPTIONS,
    getBlockedPositionsForPreset,
    detectPresetFromBlocked,
    getAllPositions,
  } from "../../shared/domain/start-position-presets";

  let {
    isOpen,
    options,
    onChange,
    onClose,
    isFreeformMode = true,
    gridMode = GridMode.DIAMOND,
  } = $props<{
    isOpen: boolean;
    options: StartEndOptions | null;
    onChange: (options: StartEndOptions) => void;
    onClose: () => void;
    isFreeformMode?: boolean;
    gridMode?: GridMode;
  }>();

  let hapticService: HapticFeedback;

  // Local pending state for editing
  let pendingOptions = $state<StartEndOptions>({
    blockedStartPositions: [],
    startPosition: null,
    endPosition: null,
    mustContainLetters: [],
    mustNotContainLetters: [],
  });

  // Track whether start position section is expanded (default open so grid is immediately visible)
  let isStartPositionExpanded = $state(true);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Sync options when panel opens
  $effect(() => {
    if (isOpen && options) {
      pendingOptions = {
        ...options,
        // Ensure blockedStartPositions exists (migration from old format)
        blockedStartPositions: options.blockedStartPositions ?? [],
      };
    }
  });

  // Detect current preset from blocked positions
  const currentPreset = $derived(
    detectPresetFromBlocked(pendingOptions.blockedStartPositions, gridMode)
  );

  // Count of enabled positions
  const enabledCount = $derived(
    getAllPositions(gridMode).length -
      pendingOptions.blockedStartPositions.length
  );

  const totalPositions = $derived(getAllPositions(gridMode).length);

  // Display text for start position summary
  const startPositionSummary = $derived.by(() => {
    if (pendingOptions.blockedStartPositions.length === 0) {
      return "Any position";
    }
    if (enabledCount === 1) {
      return "1 position";
    }
    return `${enabledCount} positions`;
  });

  function handlePresetSelect(preset: StartPositionPreset) {
    hapticService?.trigger("selection");

    const blockedPositions = getBlockedPositionsForPreset(preset, gridMode);
    pendingOptions = {
      ...pendingOptions,
      blockedStartPositions: blockedPositions,
      // Clear legacy single position when using presets
      startPosition: null,
    };
    onChange(pendingOptions);
  }

  function handleBlockedChange(blocked: GridPosition[]) {
    pendingOptions = {
      ...pendingOptions,
      blockedStartPositions: blocked,
      startPosition: null,
    };
    onChange(pendingOptions);
  }

  function handleEndPositionChange(position: PictographData | null) {
    hapticService?.trigger("selection");
    pendingOptions = { ...pendingOptions, endPosition: position };
    onChange(pendingOptions);
  }

  function handleClose() {
    isStartPositionExpanded = true;
    onClose();
  }

  function handleClearAll() {
    hapticService?.trigger("selection");
    pendingOptions = {
      blockedStartPositions: [],
      startPosition: null,
      endPosition: null,
      mustContainLetters: [],
      mustNotContainLetters: [],
    };
    onChange(pendingOptions);
  }

  function toggleStartPositionExpanded() {
    hapticService?.trigger("selection");
    isStartPositionExpanded = !isStartPositionExpanded;
  }

  const hasAnyOptions = $derived(
    pendingOptions.blockedStartPositions.length > 0 ||
      (isFreeformMode && pendingOptions.endPosition !== null)
  );

  const createModuleContext = tryGetCreateModuleContext();
  const isSideBySideLayout = $derived(
    createModuleContext
      ? createModuleContext.layout.shouldUseSideBySideLayout
      : false
  );
  const drawerPlacement = $derived(isSideBySideLayout ? "right" : "bottom");

  // Available presets: All, Classic 3, Custom
  const availablePresets = [
    StartPositionPreset.ANY,
    StartPositionPreset.CLASSIC,
    StartPositionPreset.CUSTOM,
  ];
</script>

<Drawer
  {isOpen}
  onOpenChange={(open) => !open && handleClose()}
  labelledBy="start-end-title"
  closeOnBackdrop={true}
  showHandle={false}
  respectLayoutMode={true}
  placement={drawerPlacement}
  class="start-end-sheet"
  backdropClass="start-end-backdrop"
>
  <div class="start-end-content" class:desktop-layout={isSideBySideLayout}>
    <SheetDragHandle class={isSideBySideLayout ? "side-handle" : ""} />

    <header class="sheet-header">
      <h2 id="start-end-title" class="sheet-title">Start/End</h2>
      <div class="header-actions">
        {#if hasAnyOptions}
          <button
            class="clear-button"
            onclick={handleClearAll}
            aria-label="Clear all options"
          >
            Clear All
          </button>
        {/if}
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close start/end options"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>

    <div class="sections-container">
      <!-- Start Position Section -->
      <section class="section">
        <button
          class="section-header"
          onclick={toggleStartPositionExpanded}
          aria-expanded={isStartPositionExpanded}
        >
          <div class="section-title-row">
            <h3 class="section-title">Start Position</h3>
            <span class="section-value">{startPositionSummary}</span>
          </div>
          <svg
            class="chevron"
            class:expanded={isStartPositionExpanded}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {#if isStartPositionExpanded}
          <div class="section-content">
            <!-- Preset buttons -->
            <div class="presets-row">
              {#each availablePresets as preset}
                <button
                  class="preset-button"
                  class:active={currentPreset === preset}
                  onclick={() => handlePresetSelect(preset)}
                  aria-pressed={currentPreset === preset}
                >
                  <span class="preset-label">{PRESET_LABELS[preset]}</span>
                  <span class="preset-description"
                    >{PRESET_DESCRIPTIONS[preset]}</span
                  >
                </button>
              {/each}
            </div>

            <!-- Custom indicator if using custom selection -->
            {#if currentPreset === StartPositionPreset.CUSTOM}
              <div class="custom-indicator">
                <span class="custom-badge">Custom</span>
                <span class="custom-text"
                  >{enabledCount} of {totalPositions} positions</span
                >
              </div>
            {/if}

            <!-- Multi-select position grid -->
            <MultiSelectPositionPicker
              blockedPositions={pendingOptions.blockedStartPositions}
              onBlockedChange={handleBlockedChange}
              {gridMode}
            />
          </div>
        {/if}
      </section>

      <!-- End Position Section (freeform only) -->
      <PositionSection
        title="End Position"
        description="Where the sequence ends"
        currentPosition={isFreeformMode ? pendingOptions.endPosition : null}
        onPositionChange={handleEndPositionChange}
        {gridMode}
        disabled={!isFreeformMode}
        disabledReason="In circular mode, the end position matches the start position"
      />
    </div>
  </div>
</Drawer>

<style>
  /* Custom styling for start/end options sheet */
  :global(.drawer-content.start-end-sheet) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.5);
    --sheet-backdrop-filter: blur(8px);
    --sheet-backdrop-pointer-events: auto;
    --sheet-bg: var(--sheet-bg-gradient);
    --sheet-border: var(--sheet-border-medium);
    --sheet-shadow: none;
    --sheet-pointer-events: auto;
    max-width: 1200px;
    margin: 0 auto;
    height: auto !important;
    max-height: 90vh;
  }

  /* Slide animations for drawer */
  :global(.drawer-content.start-end-sheet[data-placement="bottom"]) {
    transition: transform var(--duration-dramatic) cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.drawer-content.start-end-sheet[data-placement="right"]) {
    transition: transform var(--duration-dramatic) cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(
      .drawer-content.start-end-sheet[data-state="closed"][data-placement="bottom"]
    ) {
    transform: translateY(100%);
  }

  :global(
      .drawer-content.start-end-sheet[data-state="closed"][data-placement="right"]
    ) {
    transform: translateX(100%);
  }

  :global(.drawer-content.start-end-sheet[data-state="open"]) {
    transform: translate(0, 0);
  }

  .start-end-content {
    container-type: inline-size;
    container-name: customize;

    position: relative;
    height: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;

    /* Classy slate/charcoal gradient */
    background: linear-gradient(
      135deg,
      #334155 0%,
      #475569 25%,
      #64748b 50%,
      #475569 75%,
      #334155 100%
    );
    background-size: 300% 300%;
    animation: gradientFlow 20s ease infinite;

    overflow: hidden;
  }

  .start-end-content.desktop-layout {
    height: 100vh;
    height: 100dvh;
  }

  @keyframes gradientFlow {
    0%,
    100% {
      background-position: 0% 50%;
    }
    25% {
      background-position: 50% 100%;
    }
    50% {
      background-position: 100% 50%;
    }
    75% {
      background-position: 50% 0%;
    }
  }

  /* Position drag handle on the left for side-by-side layout */
  .start-end-content.desktop-layout :global(.sheet-drag-handle.side-handle) {
    position: absolute;
    top: 50%;
    left: 18px;
    width: 4px;
    height: var(--min-touch-target);
    margin: 0;
    border-radius: 999px;
    transform: translateY(-50%);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .sheet-title {
    font-size: clamp(1.25rem, 3vw, 1.5rem);
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    letter-spacing: 0.02em;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .clear-button {
    min-height: var(--min-touch-target);
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 24px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-button:hover {
    background: var(--theme-stroke-strong);
  }

  .clear-button:active {
    transform: scale(0.95);
  }

  .close-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 50%;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: var(--theme-stroke-strong);
    transform: scale(1.05);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  .close-button svg {
    width: 24px;
    height: 24px;
  }

  .sections-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    background: var(--theme-card-bg);
  }

  /* Section styling */
  .section {
    background: rgba(0, 0, 0, 0.2);
  }

  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--theme-text, white);
    transition: background var(--duration-normal) ease;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .section-title-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, white);
  }

  .section-value {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .chevron {
    width: 24px;
    height: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-normal) ease;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Presets row */
  .presets-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .preset-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px;
    min-height: var(--min-touch-target, 48px);
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .preset-button:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .preset-button.active {
    background: rgba(100, 200, 255, 0.15);
    border-color: rgba(100, 200, 255, 0.6);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.2);
  }

  .preset-button:active {
    transform: scale(0.97);
  }

  .preset-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .preset-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  /* Custom indicator */
  .custom-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 200, 100, 0.1);
    border: 1px solid rgba(255, 200, 100, 0.3);
    border-radius: 8px;
  }

  .custom-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: rgba(255, 200, 100, 0.9);
    padding: 2px 8px;
    background: rgba(255, 200, 100, 0.15);
    border-radius: 4px;
  }

  .custom-text {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .start-end-content {
      animation: none;
      background-position: 0% 50%;
    }

    .chevron,
    .preset-button,
    .section-header {
      transition: none;
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 380px) {
    .sheet-header {
      padding: 16px 20px;
    }

    .sheet-title {
      font-size: 1.125rem;
    }

    .clear-button {
      padding: 0 12px;
      font-size: var(--font-size-compact);
    }

    .presets-row {
      gap: 6px;
    }

    .preset-button {
      padding: 10px 6px;
    }

    .preset-label {
      font-size: var(--font-size-compact, 12px);
    }

    .preset-description {
      font-size: 10px;
    }
  }
</style>
