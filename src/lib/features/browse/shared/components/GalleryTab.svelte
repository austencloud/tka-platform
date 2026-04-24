<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
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
  import LetterSelectionSheet from "../../sequences/filtering/components/bento-filter/LetterSelectionSheet.svelte";
  import PositionOptionsSheet from "../../sequences/filtering/components/bento-filter/PositionOptionsSheet.svelte";
  import SequenceDisplayPanel from "../../sequences/display/components/SequenceDisplayPanel.svelte";
  import VariationPickerDrawer from "../../sequences/display/components/VariationPickerDrawer.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import {
    getVariationPickerState,
    closeVariationPicker,
  } from "../state/variation-picker-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { browseScrollState } from "../state/BrowseScrollState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import VirtualKeyboard from "$lib/shared/components/touch/VirtualKeyboard.svelte";

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    galleryState: BrowseState;
    error: string | null;
    onSequenceAction: (action: string, sequence: SequenceData, variations?: SequenceData[]) => Promise<void>;
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

  // Derived values for inline filter chips
  const currentLetter = $derived(
    galleryState.currentFilter.type === "startingLetter" ||
    galleryState.currentFilter.type === "starting_letter"
      ? (galleryState.currentFilter.value as string)
      : null
  );

  const currentLevel = $derived(
    galleryState.currentFilter.type === "difficulty"
      ? (galleryState.currentFilter.value as number)
      : null
  );

  const currentLength = $derived(
    galleryState.currentFilter.type === "length"
      ? (galleryState.currentFilter.value as number)
      : null
  );

  const currentLoopType = $derived(
    galleryState.currentFilter.type === "cap_type"
      ? (galleryState.currentFilter.value as string)
      : null
  );

  const currentGridMode = $derived(
    galleryState.currentFilter.type === "gridMode"
      ? (galleryState.currentFilter.value as string)
      : null
  );

  const isFavoritesActive = $derived(
    galleryState.currentFilter.type === "favorites"
  );

  const hasActivePositions = $derived(
    startPosition !== null || endPosition !== null
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

  // Variation picker
  const pickerState = getVariationPickerState();

  function handleVariationSelected(sequence: SequenceData) {
    openSequenceViewer(sequence, {
      returnPath: "/browse/gallery",
      returnLabel: "Browse",
      scrollY: browseScrollState.lastScrollY,
    });
  }

  // Floating Search State
  let showSearchTerminal = $state(false);
  let searchMode = $state<"standard" | "spelled">("standard");
  const hapticService = getHapticFeedback();

  const currentSearchQuery = $derived.by(() => {
    const filter = galleryState.activeFilterList.find(f => f.type === 'contains_letters');
    return filter ? filter.value as string : "";
  });

  function handleToggleSearch() {
    hapticService?.trigger("selection");
    showSearchTerminal = !showSearchTerminal;
  }

  function handleSearchClear() {
    handleFilterChange('all');
  }

  function handleSearchKey(char: string) {
    const newValue = currentSearchQuery + char;
    handleFilterChange('contains_letters', newValue);
  }

  function handleSearchBackspace() {
    const newValue = currentSearchQuery.slice(0, -1);
    if (newValue) {
      handleFilterChange('contains_letters', newValue);
    } else {
      handleFilterChange('all');
    }
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
        activeFilterList={galleryState.activeFilterList}
        activeLevel={currentLevel}
        activeLetter={currentLetter}
        activeLength={currentLength}
        activeLoopType={currentLoopType}
        activeGridMode={currentGridMode}
        {isFavoritesActive}
        {hasActivePositions}
        availableLengths={galleryState.availableSequenceLengths}
        loopTypeCounts={galleryState.loopTypeCounts}
        onAction={onSequenceAction}
        onScroll={onContainerScroll}
        onFilterChange={handleFilterChange}
        onRemoveFilter={(type) => galleryState.removeFilter(type)}
        onClearAllFilters={() => galleryState.clearAllFilters()}
        onOpenLetterSheet={handleOpenLetterSheet}
        onOpenOptionsSheet={handleOpenOptionsSheet}
        getFilteredCount={galleryState.getFilteredCount}
        sequenceSections={galleryState.sequenceSections}
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
    <DrawerHeader title={t('browse_view_presets')} onClose={() => sequencePanelManager.close()} />
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
    <DrawerHeader title={t('browse_sort_navigate')} onClose={() => sequencePanelManager.close()} />
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
    <DrawerHeader title={t('browse_select_letter')} onClose={() => (isLetterSheetOpen = false)} />
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
    <DrawerHeader title={t('browse_position_options')} onClose={() => (isOptionsSheetOpen = false)} />
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

<!-- Variation Picker -->
<VariationPickerDrawer
  isOpen={pickerState.isOpen}
  variations={pickerState.variations}
  onSelect={handleVariationSelected}
  onClose={closeVariationPicker}
/>

<!-- Notation Terminal Keyboard -->
{#if showSearchTerminal}
  <VirtualKeyboard
    bind:isOpen={showSearchTerminal}
    value={currentSearchQuery}
    resultCount={galleryState.displayedSequences.length}
    {searchMode}
    onKey={handleSearchKey}
    onBackspace={handleSearchBackspace}
    onClear={handleSearchClear}
    onClose={() => (showSearchTerminal = false)}
    onModeToggle={(mode) => (searchMode = mode)}
  />
{/if}

<!-- Floating Search Trigger (FAB) -->
<button 
  class="floating-search-trigger" 
  class:kb-active={showSearchTerminal}
  onclick={handleToggleSearch}
  type="button"
  aria-label="Search Sequences"
>
  <i class="fas fa-search"></i>
</button>

<style>
  .sequences-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    height: 100%;
  }

  .sheet-content {
    padding: 16px 20px 24px;
    background: var(--theme-panel-bg);
  }

  .options-sheet-content {
    padding: 0;
    overflow-y: auto;
    max-height: calc(100vh - 80px);
    max-height: calc(100dvh - 80px);
  }

  /* Letter sheet drawer */
  :global(.letter-sheet-drawer.drawer-content[data-placement="right"]) {
    width: var(--drawer-width, min(400px, 40vw));
    transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1) !important;
    top: 0 !important;
    height: 100vh !important;
    height: 100dvh !important;
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
    height: 100dvh !important;
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
    height: 100dvh !important;
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

  .floating-search-trigger {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--theme-accent);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    z-index: 1000;
    transition: transform var(--duration-fast) ease, background var(--duration-fast) ease, opacity var(--duration-fast) ease;
  }

  .floating-search-trigger:hover {
    transform: scale(1.05);
    background: color-mix(in srgb, var(--theme-accent) 90%, white);
  }

  .floating-search-trigger:active {
    transform: scale(0.95);
  }

  .floating-search-trigger.kb-active {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.8);
  }

  @media (max-width: 640px) {
    .floating-search-trigger {
      bottom: calc(16px + env(safe-area-inset-bottom) + 70px);
      right: 16px;
      width: 56px;
      height: 56px;
      font-size: 20px;
    }
  }
</style>
