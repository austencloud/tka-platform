<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Column picker in submenu, plus Re-render, Send to, and Send to Sticker Lab actions.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/shared/choreo-card/services/card-designer-context-menu-builder";
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

  let menuState: ContextMenuState = $state({ open: false });
  let menuVersion = $state(0);

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    void menuVersion;
    return buildChoreoCardContextMenuItems({
      onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
      onSendToStickerLab: onSendToStickerLab ? () => { closeContextMenu(); onSendToStickerLab(); } : undefined,
      onRerender: onRerender ? () => { closeContextMenu(); onRerender(); } : undefined,
      stepCount,
      onColumnCountChange: () => { menuVersion++; },
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
