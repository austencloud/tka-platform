<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { FilterPreset } from "../domain/types/browse-types";
  import type { createBrowseState } from "../state/browse-state-factory.svelte";
  import type { SequenceFilterType } from "../state/sequence-controls-state.svelte";

  type BrowseState = ReturnType<typeof createBrowseState>;

  import BrowseLayout from "./BrowseLayout.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import InviteCollaboratorsPanel from "$lib/shared/video-collaboration/components/InviteCollaboratorsPanel.svelte";
  import ViewPresetsSheet from "../../sequences/filtering/components/ViewPresetsSheet.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import BentoFilterPanel from "../../sequences/filtering/components/bento-filter/BentoFilterPanel.svelte";
  import LetterSelectionSheet from "../../sequences/filtering/components/bento-filter/LetterSelectionSheet.svelte";
  import PositionOptionsSheet from "../../sequences/filtering/components/bento-filter/PositionOptionsSheet.svelte";
  import SequenceDisplayPanel from "../../sequences/display/components/SequenceDisplayPanel.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    galleryState: BrowseState;
    error: string | null;
    onSequenceAction: (action: string, sequence: SequenceData) => Promise<void>;
    onContainerScroll: (event: CustomEvent<{ scrollTop: number }>) => void;
  }

  let {
    isMobile,
    drawerWidth,
    galleryState,
    error,
    onSequenceAction,
    onContainerScroll,
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
    galleryState.currentFilter.type === "startingLetter"
      ? (galleryState.currentFilter.value as string)
      : null
  );

  // Handler functions
  function handleFilterChange(type: SequenceFilterType, value?: BrowseFilterValue) {
    galleryState.handleFilterChange(type, value);
  }

  function handleOpenLetterSheet() {
    isLetterSheetOpen = true;
  }

  function handleLetterSelect(letter: string) {
    handleFilterChange("startingLetter", letter);
    isLetterSheetOpen = false;
  }

  function handleLetterClear() {
    handleFilterChange("all");
    isLetterSheetOpen = false;
  }

  function handleOpenOptionsSheet() {
    isOptionsSheetOpen = true;
  }

  function handleStartPositionChange(position: PictographData | null) {
    startPosition = position;
    if (position) {
      handleFilterChange("startPosition", position.startPosition ?? undefined);
    } else if (!endPosition) {
      handleFilterChange("all");
    }
  }

  function handleEndPositionChange(position: PictographData | null) {
    endPosition = position;
    if (position) {
      handleFilterChange("endPosition", position.endPosition ?? undefined);
    } else if (!startPosition) {
      handleFilterChange("all");
    }
  }

  function handleClearAllPositions() {
    startPosition = null;
    endPosition = null;
    handleFilterChange("all");
  }

  function handleInviteCollaborators(video: CollaborativeVideo) {
    inviteVideo = video;
    isInvitePanelOpen = true;
  }

  function handleCloseInvitePanel() {
    isInvitePanelOpen = false;
    inviteVideo = null;
  }

  function handleSectionClick(sectionId: string) {
    galleryState.scrollToSection(sectionId);
    sequencePanelManager.close();
  }
</script>

<BrowseLayout>
  {#snippet centerPanel()}
    <div class="sequences-main">
      <SequenceDisplayPanel
        sequences={galleryState.displayedSequences}
        sections={galleryState.sequenceSections}
        isLoading={galleryState.isLoading}
        sectionsReady={galleryState.sectionsReady}
        {error}
        showSections={galleryState.showSections}
        source={galleryState.currentSource}
        onAction={onSequenceAction}
        onScroll={onContainerScroll}
      />
    </div>
  {/snippet}
</BrowseLayout>

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
      currentFilter={galleryState.currentFilter.type as FilterPreset}
      onFilterChange={(preset) => {
        handleFilterChange(preset);
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
      currentSortMethod={galleryState.currentSortMethod}
      availableSections={galleryState.availableNavigationSections}
      onSortMethodChange={(method) => {
        galleryState.handleSortChange(method, "asc");
        sequencePanelManager.close();
      }}
      onSectionClick={handleSectionClick}
    />
  </Drawer>
{/if}

<!-- Filters Panel (Both Mobile & Desktop) -->
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
      if (!open && sequencePanelManager.isFiltersOpen) {
        sequencePanelManager.close();
      }
    }}
  >
    <DrawerHeader title="Browse & Filter" onClose={() => sequencePanelManager.close()} />
    <div class="bento-filter-wrapper">
      <BentoFilterPanel
        currentFilter={galleryState.currentFilter}
        {startPosition}
        {endPosition}
        loopTypeCounts={galleryState.loopTypeCounts}
        onFilterChange={handleFilterChange}
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

<!-- Invite Collaborators Panel -->
{#if inviteVideo}
  <div style:--drawer-width={isMobile ? "min(720px, 95vw)" : "min(520px, 45vw)"}>
    <InviteCollaboratorsPanel
      show={isInvitePanelOpen}
      placement={isMobile ? "bottom" : "right"}
      video={inviteVideo}
      onClose={handleCloseInvitePanel}
    />
  </div>
{/if}

<style>
  .sequences-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    height: 100%;
  }

  /* Bento filter wrapper */
  .bento-filter-wrapper {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    background: var(--theme-panel-bg);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

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

  .sheet-content {
    padding: 16px 20px 24px;
    background: var(--theme-panel-bg);
  }

  .options-sheet-content {
    padding: 0;
    overflow-y: auto;
    max-height: calc(100vh - 80px);
  }

  /* Filters drawer - desktop */
  :global(.filters-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(420px, 90vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1),
      width 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    top: 0 !important;
    height: 100vh !important;
    background: var(--theme-panel-bg) !important;
    border: none !important;
    border-left: 1px solid var(--theme-stroke) !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px var(--theme-shadow) !important;
  }

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

  :global(.filters-drawer.drawer-content[data-placement="right"]:hover::before) {
    opacity: 1;
  }

  :global(.filters-drawer .close-button) {
    top: 20px !important;
    right: 20px !important;
    width: 36px !important;
    height: 36px !important;
    background: var(--theme-stroke-strong) !important;
    border: 1px solid color-mix(in srgb, var(--theme-text, white) 25%, transparent) !important;
    z-index: 100 !important;
    position: relative;
  }

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
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent) !important;
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent) !important;
  }

  /* Filters drawer - mobile */
  :global(.filters-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 100vh !important;
    height: 100vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Letter sheet drawer */
  :global(.letter-sheet-drawer.drawer-content[data-placement="right"]) {
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
    box-shadow: -4px 0 24px var(--theme-shadow) !important;
  }

  :global(.letter-sheet-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 80vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Options sheet drawer */
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
    box-shadow: -4px 0 24px var(--theme-shadow) !important;
  }

  :global(.options-sheet-drawer.drawer-content[data-placement="bottom"]) {
    max-height: 85vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

  /* Invite collaborators panel */
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
    box-shadow: -4px 0 24px var(--theme-shadow) !important;
  }

  :global(.invite-collaborators-panel.drawer-content[data-placement="bottom"]) {
    max-height: 90vh !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    background: var(--theme-panel-bg) !important;
  }

</style>
