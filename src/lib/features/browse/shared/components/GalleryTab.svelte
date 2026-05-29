<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { BrowseEngine } from "$lib/shared/browse/engine/types";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import { BrowseSortMethod } from "../domain/enums/browse-enums";

  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import InviteCollaboratorsPanel from "$lib/shared/video-collaboration/components/InviteCollaboratorsPanel.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import LetterSelectionSheet from "../../sequences/filtering/components/bento-filter/LetterSelectionSheet.svelte";
  import PositionOptionsSheet from "../../sequences/filtering/components/bento-filter/PositionOptionsSheet.svelte";
  import VariationPickerDrawer from "../../sequences/display/components/VariationPickerDrawer.svelte";
  import { sequencePanelManager } from "$lib/shared/browse/state/sequence-panel-state.svelte";
  import {
    getVariationPickerState,
    closeVariationPicker,
  } from "../state/variation-picker-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
  import { browseScrollState } from "$lib/shared/browse/state/BrowseScrollState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import VirtualKeyboard from "$lib/shared/components/touch/VirtualKeyboard.svelte";

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    engine: BrowseEngine;
    error: string | null;
    onSequenceAction: (action: string, sequence: SequenceData, variations?: SequenceData[]) => Promise<void>;
  }

  let {
    isMobile,
    drawerWidth,
    engine,
    error,
    onSequenceAction,
  }: Props = $props();

  // State for sub-sheets
  let isLetterSheetOpen = $state(false);
  let isOptionsSheetOpen = $state(false);
  let isInvitePanelOpen = $state(false);
  let inviteVideo = $state<CollaborativeVideo | null>(null);

  // Position filter state
  let startPosition = $state<PictographData | null>(null);
  let endPosition = $state<PictographData | null>(null);

  // Derived: current letter filter from engine
  const currentLetter = $derived.by(() => {
    const filter = engine.activeFilters.get(String(BrowseFilterType.STARTING_LETTER));
    return filter ? filter.value as string : null;
  });

  // Handler functions
  function handleOpenLetterSheet() {
    isLetterSheetOpen = true;
  }

  function handleLetterSelect(letter: string) {
    engine.addFilter(BrowseFilterType.STARTING_LETTER, letter, letter, "var(--semantic-info)");
    isLetterSheetOpen = false;
  }

  function handleLetterClear() {
    engine.removeFilter(String(BrowseFilterType.STARTING_LETTER));
    isLetterSheetOpen = false;
  }

  function handleOpenOptionsSheet() {
    isOptionsSheetOpen = true;
  }

  function handleStartPositionChange(position: PictographData | null) {
    startPosition = position;
    if (position) {
      engine.addFilter(BrowseFilterType.STARTING_POSITION, position.startPosition ?? "", "Start Position", "var(--theme-accent)");
    } else {
      engine.removeFilter(String(BrowseFilterType.STARTING_POSITION));
      if (!endPosition) {
        // No position filters left
      }
    }
  }

  function handleEndPositionChange(position: PictographData | null) {
    endPosition = position;
    if (position) {
      engine.addFilter(BrowseFilterType.END_POSITION, position.endPosition ?? "", "End Position", "var(--theme-accent)");
    } else {
      engine.removeFilter(String(BrowseFilterType.END_POSITION));
      if (!startPosition) {
        // No position filters left
      }
    }
  }

  function handleClearAllPositions() {
    startPosition = null;
    endPosition = null;
    engine.removeFilter(String(BrowseFilterType.STARTING_POSITION));
    engine.removeFilter(String(BrowseFilterType.END_POSITION));
  }

  function handleInviteCollaborators(video: CollaborativeVideo) {
    inviteVideo = video;
    isInvitePanelOpen = true;
  }

  function handleCloseInvitePanel() {
    isInvitePanelOpen = false;
    inviteVideo = null;
  }

  // Variation picker
  const pickerState = getVariationPickerState();

  function handleVariationSelected(sequence: SequenceData) {
    openSequenceViewer(sequence, {
      returnPath: "/browse/gallery",
      returnLabel: "Browse",
      scrollY: browseScrollState.lastScrollY,
      handPathMode: engine.viewMode.subject === "hands",
    });
  }

  // Floating Search State (mobile only — desktop uses BrowseToolbar search bar)
  let showSearchTerminal = $state(false);
  let searchMode = $state<"standard" | "spelled">("standard");
  const hapticService = getHapticFeedback();
  const hasFinePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  const showMobileSearch = $derived(isMobile && !hasFinePointer);

  const currentSearchQuery = $derived(engine.searchQuery);

  function handleToggleSearch() {
    hapticService?.trigger("selection");
    showSearchTerminal = !showSearchTerminal;
  }

  function handleSearchClear() {
    engine.setSearch("");
    engine.clearUserFilters();
  }

  function handleSearchKey(char: string) {
    const newValue = currentSearchQuery + char;
    engine.setSearch(newValue);
  }

  function handleSearchBackspace() {
    const newValue = currentSearchQuery.slice(0, -1);
    engine.setSearch(newValue);
  }

  // Derived: available sections for SortJumpSheet
  const availableNavigationSections = $derived(
    engine.sections.map((s) => s.title)
  );
</script>

<div class="sequences-main">
  <BrowsePanel
    {engine}
    layout="fullpage"
    onSelect={(sequence, variations) => onSequenceAction("view-detail", sequence, variations)}
    showSourceToggle
  />
</div>

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
      currentSortMethod={engine.sortMethod}
      availableSections={availableNavigationSections}
      onSortMethodChange={(method) => {
        engine.setSort(method, "asc");
        sequencePanelManager.close();
      }}
      onSectionClick={(sectionId) => {
        sequencePanelManager.close();
      }}
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

<!-- Notation Terminal Keyboard (mobile only — fine pointer = desktop keyboard available) -->
{#if showMobileSearch && showSearchTerminal}
  <VirtualKeyboard
    bind:isOpen={showSearchTerminal}
    value={currentSearchQuery}
    resultCount={engine.resultCount}
    {searchMode}
    onKey={handleSearchKey}
    onBackspace={handleSearchBackspace}
    onClear={handleSearchClear}
    onClose={() => (showSearchTerminal = false)}
    onModeToggle={(mode) => (searchMode = mode)}
  />
{/if}

<!-- Floating Search Trigger (FAB, mobile only) -->
{#if showMobileSearch}
  <button
    class="floating-search-trigger"
    class:kb-active={showSearchTerminal}
    onclick={handleToggleSearch}
    type="button"
    aria-label="Search Sequences"
  >
    <i class="fas fa-search"></i>
  </button>
{/if}

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
    z-index: var(--z-modal);
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

  @media (min-width: 1100px) {
    .floating-search-trigger {
      display: none;
    }
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
