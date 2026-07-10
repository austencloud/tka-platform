<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Additive composition: "Pictograph" section (global visibility toggles — viewer
  cards live-follow the VisibilityStateManager) + "Card" section (columns,
  Re-render, Send to, Sticker Lab).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { composeMenu } from "$lib/shared/components/context-menu/compose-menu";
  import { buildCardMenuSection } from "$lib/shared/choreo-card/services/card-menu-section";
  import { buildPictographContextMenuItems } from "$lib/shared/pictograph/shared/components/context-menu/pictograph-context-menu-builder";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import type { ExportOptionsStateManager } from "$lib/shared/animation-panel/state/export-options-state.svelte";

  interface Props {
    onRerender?: () => void;
    isExportMode?: boolean;
    exportOptions?: ExportOptionsStateManager;
    onSendTo?: () => void;
    onSendToStickerLab?: () => void;
    stepCount?: number;
  }

  const { onRerender, isExportMode = false, exportOptions, onSendTo, onSendToStickerLab, stepCount = 0 }: Props = $props();

  const visibilityManager = getVisibilityStateManager();

  let menuState: ContextMenuState = $state({ open: false });
  let menuVersion = $state(0);

  // Rebuild menu items (fresh checked states) whenever any visibility changes.
  onMount(() => {
    const bump = () => { menuVersion++; };
    visibilityManager.registerObserver(bump, ["all"]);
    return () => visibilityManager.unregisterObserver(bump);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    void menuVersion;
    return composeMenu([
      {
        header: "Pictograph",
        entries: buildPictographContextMenuItems({
          visibilityManager,
          // Card step numbers read ImageComposition.addStepNumbers, not this
          // manager — the toggle would lie here.
          includeStepNumbers: false,
        }),
      },
      {
        header: "Card",
        entries: buildCardMenuSection({
          onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
          onSendToStickerLab: onSendToStickerLab ? () => { closeContextMenu(); onSendToStickerLab(); } : undefined,
          onRerender: onRerender ? () => { closeContextMenu(); onRerender(); } : undefined,
          stepCount,
          onColumnCountChange: () => { menuVersion++; },
        }),
      },
    ]);
  });

  export function openContextMenu(x: number, y: number): void {
    menuVersion++;
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
