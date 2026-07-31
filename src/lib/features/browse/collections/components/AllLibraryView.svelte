<!--
AllLibraryView.svelte

The "All" shelf: your whole library as the full browse grid. Same composition
as GalleryTab (BrowsePanel + GalleryFilterSheet + variation picker + mobile
sort sheet) around a library-scoped engine — sort, filters pill, search chip,
word-collapse and the variation drawer all come from the shared primitives.

The engine is created here (not shared with the gallery): its persisted state
is a separate localStorage record, so your library's sort/filters don't fight
the gallery's, and the source is pinned to my-library with no toggle.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import SmartCollectionSaveDialog from "$lib/features/library/components/SmartCollectionSaveDialog.svelte";
  import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import SortJumpSheet from "../../sequences/navigation/components/SortJumpSheet.svelte";
  import VariationPickerDrawer from "../../sequences/display/components/VariationPickerDrawer.svelte";
  import { sequencePanelManager } from "$lib/shared/browse/state/sequence-panel-state.svelte";
  import {
    getVariationPickerState,
    openVariationPicker,
    closeVariationPicker,
  } from "../../shared/state/variation-picker-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { loadSoloLibrarySequences } from "$lib/features/browse/shared/services/solo-library-sequence-loader";
  import { createMultiSelectionState } from "$lib/shared/selection/state/create-multi-selection-state.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { openCollectionPickerForSequences } from "$lib/features/library/state/collection-picker-state.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // The desktop split view keeps the collection rail visible, so it passes no
  // onBack — BrowsePanel then omits the back pill entirely.
  let { onBack }: { onBack?: () => void } = $props();

  const engine = createBrowseEngine({
    persistKey: "tka-browse-library-all",
    initialSource: "my-library",
    sources: ["my-library"],
    sections: true,
    loadSoloLibrarySequences,
  });

  const selectionState = createMultiSelectionState({
    getAllIds: () => engine.sequences.map((sequence) => sequence.id),
    onModeChange: () => getHapticFeedback()?.trigger("selection"),
  });

  // BrowsePanel owns the shared toolbar/card wiring; this view owns the one
  // library-specific outcome: filing the selected sequence ids together.
  const selection = {
    get active() {
      return selectionState.active;
    },
    get selectedIds() {
      return selectionState.selectedIds;
    },
    enter(sequence?: SequenceData) {
      selectionState.enter(sequence?.id);
    },
    toggle(sequence: SequenceData) {
      selectionState.toggle(sequence.id);
      getHapticFeedback()?.trigger("selection");
    },
    selectAll() {
      selectionState.selectAll();
      getHapticFeedback()?.trigger("selection");
    },
    clear() {
      selectionState.clear();
      getHapticFeedback()?.trigger("selection");
    },
    exit() {
      selectionState.exit();
    },
    openPrimaryAction() {
      if (selectionState.selectedCount === 0) return;
      openCollectionPickerForSequences({
        sequenceIds: [...selectionState.selectedIds],
        onComplete: () => selectionState.exit(),
      });
    },
    openDangerAction() {
      if (selectionState.selectedCount === 0) return;
      deleteTargets = [...selectionState.selectedIds];
      deleteConfirmOpen = true;
    },
  };

  let deleteConfirmOpen = $state(false);
  let deleteTargets = $state<string[]>([]);
  let isDeleting = $state(false);

  const deleteTitle = $derived(
    deleteTargets.length === 1
      ? "Permanently delete this sequence?"
      : `Permanently delete ${deleteTargets.length} sequences?`
  );
  const deleteMessage = $derived(
    deleteTargets.length === 1
      ? "This removes the sequence from your library, this device, and the community gallery. It can't be undone."
      : "This removes the selected sequences from your library, this device, and the community gallery. It can't be undone."
  );

  async function deleteSelectedSequences(): Promise<void> {
    if (isDeleting || deleteTargets.length === 0) return;
    const ids = [...deleteTargets];
    isDeleting = true;

    try {
      await getLibraryRepository().deleteSequences(ids);
      toast.success(
        ids.length === 1
          ? "Sequence permanently deleted"
          : `${ids.length} sequences permanently deleted`
      );
      selectionState.exit();
      deleteTargets = [];
    } catch (error) {
      console.error("[AllLibraryView] Permanent delete failed:", error);
      toast.error(
        ids.length === 1
          ? "Sequence wasn't deleted. Try again."
          : "Some sequences weren't deleted. Try again."
      );
    } finally {
      isDeleting = false;
    }
  }

  function cancelDelete(): void {
    deleteConfirmOpen = false;
    deleteTargets = [];
  }

  let isSideBySide = $state(false);
  const isMobile = $derived(!isSideBySide);

  onMount(() => {
    engine.initialize();
    isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    const unsubscribe = responsiveLayoutManager.onLayoutChange(() => {
      isSideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    });
    return () => {
      unsubscribe();
      engine.destroy();
    };
  });

  let isFilterSheetOpen = $state(false);
  let smartSaveOpen = $state(false);

  const pickerState = getVariationPickerState();

  function openViewer(sequence: SequenceData) {
    openSequenceViewer(sequence, {
      returnPath: "/browse/library",
      returnLabel: "Library",
      scrollY: browseScrollState.lastScrollY,
      handPathMode: engine.viewMode.subject === "hands",
    });
  }

  function handleSelect(sequence: SequenceData, variations?: SequenceData[]) {
    if (variations && variations.length > 1) {
      openVariationPicker(variations);
    } else {
      openViewer(sequence);
    }
  }

  const availableNavigationSections = $derived(
    engine.sections.map((s) => s.title)
  );

  // Empty-library CTA: a plain door into Construct. The one-tap starter it
  // used to re-arm was removed 2026-07-29 — building the sequence yourself IS
  // the flow now.
  const emptyAction = {
    label: "Make your first sequence",
    onClick: () => {
      navigationState.setCurrentModule("create", "construct");
    },
  };
</script>

<div class="all-library">
  <BrowsePanel
    {engine}
    layout="fullpage"
    onSelect={handleSelect}
    {onBack}
    backLabel="Library"
    hideToolbarSearch
    onOpenFilters={() => (isFilterSheetOpen = true)}
    onSaveSmart={() => (smartSaveOpen = true)}
    {emptyAction}
    {selection}
  />
</div>

<GalleryFilterSheet {engine} bind:isOpen={isFilterSheetOpen} {isMobile} />

<SmartCollectionSaveDialog {engine} bind:show={smartSaveOpen} />

{#if isMobile}
  <Drawer
    isOpen={sequencePanelManager.isSortJumpOpen}
    placement="bottom"
    onOpenChange={(open) => {
      if (!open) sequencePanelManager.close();
    }}
  >
    <DrawerHeader
      title={t("browse_sort_navigate")}
      onClose={() => sequencePanelManager.close()}
    />
    <SortJumpSheet
      currentSortMethod={engine.sortMethod}
      availableSections={availableNavigationSections}
      onSortMethodChange={(method) => {
        engine.setSort(method, "asc");
        sequencePanelManager.close();
      }}
      onSectionClick={() => {
        sequencePanelManager.close();
      }}
    />
  </Drawer>
{/if}

<VariationPickerDrawer
  isOpen={pickerState.isOpen}
  variations={pickerState.variations}
  onSelect={openViewer}
  onClose={closeVariationPicker}
/>

<ConfirmDialog
  bind:isOpen={deleteConfirmOpen}
  title={deleteTitle}
  message={deleteMessage}
  confirmText="Delete permanently"
  cancelText="Keep"
  variant="danger"
  onConfirm={deleteSelectedSequences}
  onCancel={cancelDelete}
/>

<style>
  .all-library {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    height: 100%;
  }
</style>
