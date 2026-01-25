<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import SequenceDetailContent from "../../sequences/display/components/SequenceDetailContent.svelte";
  import InviteCollaboratorsPanel from "$lib/shared/video-collaboration/components/InviteCollaboratorsPanel.svelte";
  import ViewPresetsSheet from "../../sequences/filtering/components/ViewPresetsSheet.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import { BrowseSortMethod } from "../domain/enums/browse-enums";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import BentoFilterPanel from "../../sequences/filtering/components/bento-filter/BentoFilterPanel.svelte";
  import LetterSelectionSheet from "../../sequences/filtering/components/bento-filter/LetterSelectionSheet.svelte";
  import PositionOptionsSheet from "../../sequences/filtering/components/bento-filter/PositionOptionsSheet.svelte";
  import type { FilterPreset } from "../domain/types/browse-types";

  interface CurrentFilter {
    type: FilterPreset | string;
    value: BrowseFilterValue;
  }

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    currentFilter: CurrentFilter;
    currentSortMethod: BrowseSortMethod;
    availableSections: string[];
    loopTypeCounts?: Record<string, number>;
    isNavVisible?: boolean;
    onFilterChange: (type: string, value?: BrowseFilterValue) => void;
    onSortMethodChange: (method: BrowseSortMethod) => void;
    onSectionClick: (sectionId: string) => void;
    onDetailPanelAction: (action: string, sequence: SequenceData) => void;
    onCloseDetailPanel: () => void;
  }

  let {
    isMobile,
    drawerWidth,
    currentFilter,
    currentSortMethod,
    availableSections,
    loopTypeCounts = {},
    isNavVisible = true,
    onFilterChange,
    onSortMethodChange,
    onSectionClick,
    onDetailPanelAction,
    onCloseDetailPanel,
  }: Props = $props();

  // State for sub-sheets
  let isLetterSheetOpen = $state(false);
  let isOptionsSheetOpen = $state(false);
  let isInvitePanelOpen = $state(false);
  let inviteVideo = $state<CollaborativeVideo | null>(null);

  // Position filter state
  let startPosition = $state<PictographData | null>(null);
  let endPosition = $state<PictographData | null>(null);

  // Derived values for sheets
  const currentLetter = $derived(
    currentFilter.type === "startingLetter"
      ? (currentFilter.value as string)
      : null
  );

  // Handler functions
  function handleBentoFilterChange(type: string, value?: BrowseFilterValue) {
    onFilterChange(type, value);
  }

  function handleOpenLetterSheet() {
    isLetterSheetOpen = true;
  }

  function handleLetterSelect(letter: string) {
    onFilterChange("startingLetter", letter);
    isLetterSheetOpen = false;
  }

  function handleLetterClear() {
    onFilterChange("all");
    isLetterSheetOpen = false;
  }

  function handleOpenOptionsSheet() {
    isOptionsSheetOpen = true;
  }

  function handleStartPositionChange(position: PictographData | null) {
    startPosition = position;
    // Apply position filter - pass the grid position string, not the full PictographData
    if (position) {
      onFilterChange("startPosition", position.startPosition ?? undefined);
    } else if (!endPosition) {
      // Only clear if no end position either
      onFilterChange("all");
    }
  }

  function handleEndPositionChange(position: PictographData | null) {
    endPosition = position;
    // Apply position filter - pass the grid position string, not the full PictographData
    if (position) {
      onFilterChange("endPosition", position.endPosition ?? undefined);
    } else if (!startPosition) {
      // Only clear if no start position either
      onFilterChange("all");
    }
  }

  function handleClearAllPositions() {
    startPosition = null;
    endPosition = null;
    onFilterChange("all");
  }

  function handleInviteCollaborators(video: CollaborativeVideo) {
    inviteVideo = video;
    isInvitePanelOpen = true;
  }

  function handleCloseInvitePanel() {
    isInvitePanelOpen = false;
    inviteVideo = null;
  }
</script>

<!-- View Presets Sheet (Mobile) -->
{#if isMobile}
  <Drawer
    isOpen={sequencePanelManager.isViewPresetsOpen}
    placement="bottom"
    onOpenChange={(open) => {
      if (!open) sequencePanelManager.close();
    }}
  >
    <div class="drawer-header">
      <h2>View Presets</h2>
      <button
        class="drawer-close-btn"
        onclick={() => sequencePanelManager.close()}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <ViewPresetsSheet
      currentFilter={currentFilter.type as FilterPreset}
      onFilterChange={(preset) => {
        onFilterChange(preset);
        sequencePanelManager.close();
      }}
    />
  </Drawer>
{/if}

<!-- Sort & Jump Sheet (Mobile) -->
{#if isMobile}
  <Drawer
    isOpen={sequencePanelManager.isSortJumpOpen}
    placement="bottom"
    onOpenChange={(open) => {
      if (!open) sequencePanelManager.close();
    }}
  >
    <div class="drawer-header">
      <h2>Sort & Navigate</h2>
      <button
        class="drawer-close-btn"
        onclick={() => sequencePanelManager.close()}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <SortJumpSheet
      {currentSortMethod}
      {availableSections}
      onSortMethodChange={(method) => {
        onSortMethodChange(method);
        sequencePanelManager.close();
      }}
      {onSectionClick}
    />
  </Drawer>
{/if}

<!-- Filters Panel (Both Mobile & Desktop) - Using BentoFilterPanel -->
<div style:--drawer-width={drawerWidth}>
  <Drawer
    isOpen={sequencePanelManager.isFiltersOpen}
    placement={isMobile ? "bottom" : "right"}
    class="filters-drawer"
    showHandle={false}
    closeOnBackdrop={false}
    backdropClass={!isMobile ? "transparent-backdrop" : ""}
    trapFocus={isMobile}
    setInertOnSiblings={isMobile}
    onOpenChange={(open) => {
      // Only close if drawer is actually closing AND we're not in a panel transition
      if (!open && sequencePanelManager.isFiltersOpen) {
        sequencePanelManager.close();
      }
    }}
  >
    <div class="drawer-header">
      <h2>Browse & Filter</h2>
      <button
        class="drawer-close-btn"
        onclick={() => sequencePanelManager.close()}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="bento-filter-wrapper">
      <BentoFilterPanel
        {currentFilter}
        {startPosition}
        {endPosition}
        {loopTypeCounts}
        onFilterChange={handleBentoFilterChange}
        onOpenLetterSheet={handleOpenLetterSheet}
        onOpenOptionsSheet={handleOpenOptionsSheet}
      />
    </div>
  </Drawer>
</div>

<!-- Letter Selection Sheet -->
<div style:--drawer-width={isMobile ? "min(600px, 90vw)" : "min(400px, 40vw)"}>
  <Drawer
    isOpen={isLetterSheetOpen}
    placement={isMobile ? "bottom" : "right"}
    class="letter-sheet-drawer"
    showHandle={false}
    onOpenChange={(open) => {
      if (!open) isLetterSheetOpen = false;
    }}
  >
    <div class="drawer-header">
      <h2>Select Letter</h2>
      <button
        class="drawer-close-btn"
        onclick={() => (isLetterSheetOpen = false)}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="sheet-content">
      <LetterSelectionSheet
        {currentLetter}
        onLetterSelect={handleLetterSelect}
        onClear={handleLetterClear}
      />
    </div>
  </Drawer>
</div>

<!-- Position Options Sheet -->
<div style:--drawer-width={isMobile ? "min(600px, 90vw)" : "min(500px, 50vw)"}>
  <Drawer
    isOpen={isOptionsSheetOpen}
    placement={isMobile ? "bottom" : "right"}
    class="options-sheet-drawer"
    showHandle={false}
    onOpenChange={(open) => {
      if (!open) isOptionsSheetOpen = false;
    }}
  >
    <div class="drawer-header">
      <h2>Position Options</h2>
      <button
        class="drawer-close-btn"
        onclick={() => (isOptionsSheetOpen = false)}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="sheet-content options-sheet-content">
      <PositionOptionsSheet
        {startPosition}
        {endPosition}
        onStartPositionChange={handleStartPositionChange}
        onEndPositionChange={handleEndPositionChange}
        onClearAll={handleClearAllPositions}
      />
    </div>
  </Drawer>
</div>

<!-- Detail Panel (Unified for Both Mobile & Desktop) -->
<!-- When expanded, use wider width to show horizontal animation controls -->
<div
  style:--drawer-width={sequencePanelManager.isDetailExpanded ? "min(900px, 85vw)" : drawerWidth}
  class:nav-visible={isMobile && isNavVisible}
>
  <Drawer
    isOpen={sequencePanelManager.isDetailOpen}
    placement={isMobile ? "bottom" : "right"}
    class="detail-drawer {isMobile && isNavVisible ? 'with-nav-offset' : ''}"
    showHandle={false}
    closeOnBackdrop={false}
    backdropClass={!isMobile
      ? "transparent-backdrop"
      : isMobile && isNavVisible
        ? "nav-offset-backdrop"
        : ""}
    trapFocus={isMobile && !isNavVisible}
    setInertOnSiblings={isMobile && !isNavVisible}
    onOpenChange={(open) => {
      // Only close if drawer is actually closing AND we're not in a panel transition
      if (!open && sequencePanelManager.isDetailOpen) {
        handleCloseInvitePanel();
        onCloseDetailPanel();
      }
    }}
  >
    {#if sequencePanelManager.activeSequence}
      <div class="detail-content-wrapper">
        <SequenceDetailContent
          sequence={sequencePanelManager.activeSequence}
          variations={sequencePanelManager.activeVariations}
          variationIndex={sequencePanelManager.variationIndex}
          onClose={onCloseDetailPanel}
          onAction={onDetailPanelAction}
          onInviteCollaborators={handleInviteCollaborators}
          onVariationSelect={(index, seq) => {
            sequencePanelManager.setVariationIndex(index);
          }}
        />
      </div>
    {/if}
  </Drawer>
</div>

<!-- Invite Collaborators Panel -->
{#if inviteVideo}
  <div
    style:--drawer-width={isMobile ? "min(720px, 95vw)" : "min(520px, 45vw)"}
  >
    <InviteCollaboratorsPanel
      show={isInvitePanelOpen}
      placement={isMobile ? "bottom" : "right"}
      video={inviteVideo}
      onClose={handleCloseInvitePanel}
    />
  </div>
{/if}

<style>
  /* Style the detail drawer with dynamic width and integrated appearance */
  :global(.detail-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(600px, 90vw));
    /* Animate both transform (slide) and width changes for cohesive motion */
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1),
      width 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    /* Overlay full content area - covers the gallery controls header */
    top: 0 !important;
    height: 100vh !important;
    /* Integrated, native feel - transparent background, no hard edges */
    background: color-mix(
      in srgb,
      var(--theme-panel-bg) 70%,
      transparent
    ) !important;
    backdrop-filter: blur(20px) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: -2px 0 16px var(--theme-shadow) !important;
  }

  /* Subtle vertical grip indicator on left edge for swipe affordance */
  :global(.detail-drawer.drawer-content[data-placement="right"]::before) {
    content: "";
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: var(--min-touch-target);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      var(--theme-stroke-strong) 10%,
      var(--theme-stroke-strong) 90%,
      transparent 100%
    );
    border-radius: 2px;
    opacity: 0.6;
    transition: opacity var(--duration-normal) ease;
  }

  :global(.detail-drawer.drawer-content[data-placement="right"]:hover::before) {
    opacity: 1;
  }

  /* Detail drawer close button - let SequenceDetailContent handle styling */

  /* Transparent backdrop for desktop - allows clicking through to grid */
  :global(.drawer-overlay.transparent-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  /* Detail content wrapper - absolute positioning for true crossfade */
  .detail-content-wrapper {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Bento filter wrapper - scrollable container for filter panel */
  .bento-filter-wrapper {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    background: var(--theme-panel-bg);
  }

  /* Modern scrollbar for bento filter panel */
  .bento-filter-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .bento-filter-wrapper::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .bento-filter-wrapper::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .bento-filter-wrapper::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Firefox scrollbar for bento filter */
  .bento-filter-wrapper {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Sheet content padding */
  .sheet-content {
    padding: 16px 20px 24px;
    background: var(--theme-panel-bg);
  }

  /* Drawer Headers */
  :global(.drawer-content) .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    flex-shrink: 0;
  }

  :global(.drawer-content) .drawer-header h2 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    margin: 0;
  }

  :global(.drawer-content) .drawer-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  :global(.drawer-content) .drawer-close-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  :global(.drawer-content) .drawer-close-btn:active {
    transform: scale(0.95);
  }

  /* Mobile drawer header adjustments */
  @media (max-width: 768px) {
    :global(.drawer-content) .drawer-header {
      padding: 16px 20px;
    }

    :global(.drawer-content) .drawer-header h2 {
      font-size: var(--font-size-lg);
    }
  }

  /* Style the filters drawer - 2026 solid color design */
  :global(.filters-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(420px, 90vw));
    /* Animate both transform (slide) and width changes for cohesive motion */
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1),
      width 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    /* Overlay full content area - covers the gallery controls header */
    top: 0 !important;
    height: 100vh !important;
    /* 2026 solid color style - no glassmorphism */
    background: var(--theme-panel-bg) !important;
    border: none !important;
    border-left: 1px solid var(--theme-stroke) !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px var(--theme-shadow, var(--theme-shadow)) !important;
  }

  /* Subtle vertical grip indicator on left edge for swipe affordance */
  :global(.filters-drawer.drawer-content[data-placement="right"]::before) {
    content: "";
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: var(--min-touch-target);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      var(--theme-stroke-strong) 10%,
      var(--theme-stroke-strong) 90%,
      transparent 100%
    );
    border-radius: 2px;
    opacity: 0.6;
    transition: opacity var(--duration-normal) ease;
  }

  :global(
    .filters-drawer.drawer-content[data-placement="right"]:hover::before
  ) {
    opacity: 1;
  }

  /* Position close button in filters drawer */
  :global(.filters-drawer .close-button) {
    top: 20px !important;
    right: 20px !important;
    width: 36px !important;
    height: 36px !important;
    background: var(--theme-stroke-strong) !important;
    border: 1px solid
      color-mix(in srgb, var(--theme-text, white) 25%, transparent) !important;
    z-index: 100 !important;
    position: relative;
  }

  /* Expand touch target while maintaining visual size */
  :global(.filters-drawer .close-button::before) {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: var(--min-touch-target) !important;
    min-height: var(--min-touch-target) !important;
  }

  :global(.filters-drawer .close-button:hover) {
    background: color-mix(
      in srgb,
      var(--theme-text, white) 25%,
      transparent
    ) !important;
    border-color: color-mix(
      in srgb,
      var(--theme-text, white) 40%,
      transparent
    ) !important;
  }

  /* Mobile: Make detail drawer full-height bottom sheet */
  :global(.detail-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 100vh !important;
    height: 100vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
  }

  /* Mobile: Offset detail drawer when bottom navigation is visible */
  :global(
    .detail-drawer.with-nav-offset.drawer-content[data-placement="bottom"]
  ) {
    bottom: var(--primary-nav-height, 64px) !important;
    max-height: calc(100vh - var(--primary-nav-height, 64px)) !important;
    height: calc(100vh - var(--primary-nav-height, 64px)) !important;
  }

  /* Mobile: Offset backdrop when bottom navigation is visible - allows nav clicks */
  :global(.drawer-overlay.nav-offset-backdrop) {
    inset: unset !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: var(--primary-nav-height, 64px) !important;
  }

  /* Mobile: Make filters drawer full-height bottom sheet with solid color */
  :global(.filters-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 100vh !important;
    height: 100vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Letter/Length sheet drawer styles - desktop side panel */
  :global(.letter-sheet-drawer.drawer-content[data-placement="right"]),
  :global(.length-sheet-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(400px, 40vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1) !important;
    top: 0 !important;
    height: 100vh !important;
    background: var(--theme-panel-bg) !important;
    border: none !important;
    border-left: 1px solid var(--theme-stroke) !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px var(--theme-shadow, var(--theme-shadow)) !important;
  }

  /* Mobile: Letter/Length sheets as bottom sheets */
  :global(.letter-sheet-drawer.drawer-content[data-placement="bottom"]),
  :global(.length-sheet-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 80vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Options sheet drawer styles - desktop side panel */
  :global(.options-sheet-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(500px, 50vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1) !important;
    top: 0 !important;
    height: 100vh !important;
    background: var(--theme-panel-bg) !important;
    border: none !important;
    border-left: 1px solid var(--theme-stroke) !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px var(--theme-shadow, var(--theme-shadow)) !important;
  }

  /* Mobile: Options sheet as bottom sheet */
  :global(.options-sheet-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 85vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Options sheet content - scrollable */
  .options-sheet-content {
    padding: 0;
    overflow-y: auto;
    max-height: calc(100vh - 80px);
  }

  :global(.invite-collaborators-panel.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(520px, 45vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1) !important;
    top: 0 !important;
    height: 100vh !important;
    background: var(--theme-panel-bg) !important;
    border: none !important;
    border-left: 1px solid var(--theme-stroke) !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px var(--theme-shadow, var(--theme-shadow)) !important;
  }

  :global(.invite-collaborators-panel.drawer-content[data-placement="bottom"]) {
    max-height: 90vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }
</style>
