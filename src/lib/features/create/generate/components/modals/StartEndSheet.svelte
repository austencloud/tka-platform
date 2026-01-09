<!--
StartEndSheet.svelte - Sheet for configuring start/end position options
Follows modern 2026 Material Design patterns with 48px touch targets
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import { onMount } from "svelte";
  import PositionSection from "./customize/PositionSection.svelte";
  import LetterConstraintsSection from "./customize/LetterConstraintsSection.svelte";

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

  let hapticService: IHapticFeedback;

  // Local pending state for editing
  let pendingOptions = $state<StartEndOptions>({
    startPosition: null,
    endPosition: null,
    mustContainLetters: [],
    mustNotContainLetters: [],
  });

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Sync options when panel opens
  $effect(() => {
    if (isOpen && options) {
      pendingOptions = { ...options };
    }
  });

  function handleStartPositionChange(position: PictographData | null) {
    hapticService?.trigger("selection");
    pendingOptions = { ...pendingOptions, startPosition: position };
    // Auto-apply changes
    onChange(pendingOptions);
  }

  function handleEndPositionChange(position: PictographData | null) {
    hapticService?.trigger("selection");
    pendingOptions = { ...pendingOptions, endPosition: position };
    onChange(pendingOptions);
  }

  function handleMustContainChange(letters: Letter[]) {
    hapticService?.trigger("selection");
    pendingOptions = { ...pendingOptions, mustContainLetters: letters };
    onChange(pendingOptions);
  }

  function handleMustNotContainChange(letters: Letter[]) {
    hapticService?.trigger("selection");
    pendingOptions = { ...pendingOptions, mustNotContainLetters: letters };
    onChange(pendingOptions);
  }

  function handleClose() {
    onClose();
  }

  function handleClearAll() {
    hapticService?.trigger("selection");
    pendingOptions = {
      startPosition: null,
      endPosition: null,
      mustContainLetters: [],
      mustNotContainLetters: [],
    };
    onChange(pendingOptions);
  }

  const hasAnyOptions = $derived(
    pendingOptions.startPosition !== null ||
      (isFreeformMode && pendingOptions.endPosition !== null) ||
      pendingOptions.mustContainLetters.length > 0 ||
      pendingOptions.mustNotContainLetters.length > 0
  );

  const createModuleContext = tryGetCreateModuleContext();
  const isSideBySideLayout = $derived(
    createModuleContext
      ? createModuleContext.layout.shouldUseSideBySideLayout
      : false
  );
  const drawerPlacement = $derived(isSideBySideLayout ? "right" : "bottom");
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
      <PositionSection
        title="Start Position"
        description="Where the sequence begins"
        currentPosition={pendingOptions.startPosition}
        onPositionChange={handleStartPositionChange}
        {gridMode}
      />

      <PositionSection
        title="End Position"
        description="Where the sequence ends"
        currentPosition={isFreeformMode ? pendingOptions.endPosition : null}
        onPositionChange={handleEndPositionChange}
        {gridMode}
        disabled={!isFreeformMode}
        disabledReason="In circular mode, the end position matches the start position"
      />

      <!-- Letter constraints removed - too complex given generation constraints -->
      <!-- <LetterConstraintsSection
        mustContainLetters={pendingOptions.mustContainLetters}
        mustNotContainLetters={pendingOptions.mustNotContainLetters}
        onMustContainChange={handleMustContainChange}
        onMustNotContainChange={handleMustNotContainChange}
      /> -->
    </div>
  </div>
</Drawer>

<style>
  /* Custom styling for customize options sheet */
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
    max-height: 85vh;
  }

  /* Slide animations for drawer */
  :global(.drawer-content.start-end-sheet[data-placement="bottom"]) {
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.drawer-content.start-end-sheet[data-placement="right"]) {
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
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

    /* Classy slate/charcoal gradient - elegant, not overwhelming */
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
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .start-end-content {
      animation: none;
      background-position: 0% 50%;
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
  }
</style>
