<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";

  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import SequenceDrawer from "$lib/shared/sequence-viewer/components/SequenceDrawer.svelte";
  import InviteCollaboratorsPanel from "$lib/shared/video-collaboration/components/InviteCollaboratorsPanel.svelte";
  import ViewPresetsSheet from "../../sequences/filtering/components/ViewPresetsSheet.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import { ExploreSortMethod } from "../domain/enums/discover-enums";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import BentoFilterPanel from "../../sequences/filtering/components/bento-filter/BentoFilterPanel.svelte";
  import LetterSelectionSheet from "../../sequences/filtering/components/bento-filter/LetterSelectionSheet.svelte";
  import PositionOptionsSheet from "../../sequences/filtering/components/bento-filter/PositionOptionsSheet.svelte";
  import type { FilterPreset } from "../domain/types/discover-types";

  interface CurrentFilter {
    type: FilterPreset | string;
    value: ExploreFilterValue;
  }

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    currentFilter: CurrentFilter;
    currentSortMethod: ExploreSortMethod;
    availableSections: string[];
    loopTypeCounts?: Record<string, number>;
    isNavVisible?: boolean;
    onFilterChange: (type: string, value?: ExploreFilterValue) => void;
    onSortMethodChange: (method: ExploreSortMethod) => void;
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
  function handleBentoFilterChange(type: string, value?: ExploreFilterValue) {
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
    <DrawerHeader title="View Presets" onClose={() => sequencePanelManager.close()} />
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
    <DrawerHeader title="Sort & Navigate" onClose={() => sequencePanelManager.close()} />
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
    <DrawerHeader title="Browse & Filter" onClose={() => sequencePanelManager.close()} />
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
    <DrawerHeader title="Select Letter" onClose={() => (isLetterSheetOpen = false)} />
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
    <DrawerHeader title="Position Options" onClose={() => (isOptionsSheetOpen = false)} />
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
<!-- Uses SequenceDrawer with mode="browse" -->
{#if sequencePanelManager.activeSequence}
  <SequenceDrawer
    isOpen={sequencePanelManager.isDetailOpen}
    sequence={sequencePanelManager.activeSequence}
    mode="browse"
    {isMobile}
    drawerWidth={sequencePanelManager.isDetailExpanded ? "min(900px, 85vw)" : drawerWidth}
    {isNavVisible}
    variations={sequencePanelManager.activeVariations}
    variationIndex={sequencePanelManager.variationIndex}
    onClose={() => {
      handleCloseInvitePanel();
      onCloseDetailPanel();
    }}
    onAction={onDetailPanelAction}
    onInviteCollaborators={handleInviteCollaborators}
    onVariationSelect={(index, seq) => {
      sequencePanelManager.setVariationIndex(index);
    }}
  />
{/if}

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
