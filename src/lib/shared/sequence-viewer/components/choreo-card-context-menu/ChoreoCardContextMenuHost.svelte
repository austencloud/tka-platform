<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Reads from ExportOptionsStateManager (export mode) or ImageCompositionStateManager (normal mode).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "./ChoreoCardContextMenuBuilder";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { ExportOptionsStateManager } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";

  interface Props {
    isExportMode: boolean;
    exportOptions: ExportOptionsStateManager;
    onSendTo?: () => void;
  }

  const { isExportMode, exportOptions, onSendTo }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  // ImageCompositionStateManager is a singleton — get it directly
  const imageComposition = getImageCompositionManager();

  // Observer for ImageCompositionStateManager (non-rune reactivity)
  let compositionVersion = $state(0);

  function onCompositionChanged(): void {
    compositionVersion++;
  }

  imageComposition.registerObserver(onCompositionChanged);

  onDestroy(() => {
    imageComposition.unregisterObserver(onCompositionChanged);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  // Build menu items reactively.
  // In export mode: reads ExportOptionsStateManager getters ($state runes = automatic reactivity).
  // In normal mode: reads ImageCompositionStateManager via compositionVersion (observer = $derived).
  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    if (isExportMode) {
      // Reading $state getters creates Svelte reactive dependencies automatically
      return buildChoreoCardContextMenuItems({
        showWord: exportOptions.imageShowWord,
        showStepNumbers: exportOptions.imageShowStepNumbers,
        showDifficulty: exportOptions.imageShowDifficulty,
        includeStartPosition: exportOptions.imageIncludeStartPosition,
        showCreatorName: exportOptions.imageShowCreatorName,
        showNotes: exportOptions.imageShowNotes,
        showBirthday: imageComposition.showBirthday, // Always from composition manager
        showQRCode: exportOptions.imageShowQRCode,

        setShowWord: (v) => exportOptions.setImageShowWord(v),
        setShowStepNumbers: (v) => exportOptions.setImageShowStepNumbers(v),
        setShowDifficulty: (v) => exportOptions.setImageShowDifficulty(v),
        setIncludeStartPosition: (v) => exportOptions.setImageIncludeStartPosition(v),
        setShowCreatorName: (v) => exportOptions.setImageShowCreatorName(v),
        setShowNotes: (v) => exportOptions.setImageShowNotes(v),
        setShowBirthday: (v) => imageComposition.setShowBirthday(v),
        setShowQRCode: (v) => exportOptions.setImageShowQRCode(v),

        onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
      });
    } else {
      // Touch compositionVersion to create reactive dependency on observer
      void compositionVersion;

      const comp = imageComposition;
      return buildChoreoCardContextMenuItems({
        showWord: comp.addWord,
        showStepNumbers: comp.addStepNumbers,
        showDifficulty: comp.addDifficultyLevel,
        includeStartPosition: comp.includeStartPosition,
        showCreatorName: comp.showCreatorName,
        showNotes: comp.showNotes,
        showBirthday: comp.showBirthday,
        showQRCode: comp.showQRCode,

        setShowWord: (v) => comp.setAddWord(v),
        setShowStepNumbers: (v) => comp.setAddBeatNumbers(v),
        setShowDifficulty: (v) => comp.setAddDifficultyLevel(v),
        setIncludeStartPosition: (v) => comp.setIncludeStartPosition(v),
        setShowCreatorName: (v) => comp.setShowCreatorName(v),
        setShowNotes: (v) => comp.setShowNotes(v),
        setShowBirthday: (v) => comp.setShowBirthday(v),
        setShowQRCode: (v) => comp.setShowQRCode(v),

        onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
      });
    }
  });

  /**
   * Open the context menu at the given viewport coordinates.
   * Called from parent via bind:this.
   */
  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
