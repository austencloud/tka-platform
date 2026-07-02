<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { BrowseEngine } from "$lib/shared/browse/engine/types";

  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import InviteCollaboratorsPanel from "$lib/shared/video-collaboration/components/InviteCollaboratorsPanel.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import VariationPickerDrawer from "../../sequences/display/components/VariationPickerDrawer.svelte";
  import { sequencePanelManager } from "$lib/shared/browse/state/sequence-panel-state.svelte";
  import {
    getVariationPickerState,
    closeVariationPicker,
  } from "../state/variation-picker-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    isMobile: boolean;
    drawerWidth: string;
    engine: BrowseEngine;
    error: string | null;
    onSequenceAction: (action: string, sequence: SequenceData, variations?: SequenceData[]) => Promise<void>;
    /** Back to the drill chooser — rendered as a leading pill in the toolbar. */
    onBackToStart?: () => void;
  }

  let {
    isMobile,
    drawerWidth,
    engine,
    error,
    onSequenceAction,
    onBackToStart,
  }: Props = $props();

  // State for sub-sheets
  let isFilterSheetOpen = $state(false);
  let isInvitePanelOpen = $state(false);
  let inviteVideo = $state<CollaborativeVideo | null>(null);

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
    onBack={onBackToStart}
    backLabel="Start here"
    hideToolbarSearch
    onOpenFilters={() => (isFilterSheetOpen = true)}
  />
</div>

<!-- Filter Sheet — the drill's categories as a bottom sheet. The composition
     (Drawer + drill sheet variant + LOOP/family stacking) lives in
     GalleryFilterSheet, shared with every other Filters-pill host. -->
<GalleryFilterSheet {engine} bind:isOpen={isFilterSheetOpen} {isMobile} />

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

<style>
  .sequences-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    height: 100%;
  }

  /*
   * Drawer skin routed through the Drawer.svelte --sheet-* token API instead
   * of !important property overrides.
   */
  :global(.invite-collaborators-panel.drawer-content) {
    --sheet-bg: var(--theme-panel-bg);
    --sheet-border: none;
    --sheet-border-strong: 1px solid var(--theme-stroke);
    --sheet-radius-large: 0;
    --sheet-border-radius-top-left: 16px;
    --sheet-border-radius-top-right: 16px;
    --sheet-shadow: -4px 0 24px var(--theme-shadow);
    --sheet-transition:
      transform 350ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 350ms cubic-bezier(0.32, 0.72, 0, 1);
    --sheet-width: var(--drawer-width, min(520px, 45vw));
    --sheet-max-height: 90vh;
  }
</style>
