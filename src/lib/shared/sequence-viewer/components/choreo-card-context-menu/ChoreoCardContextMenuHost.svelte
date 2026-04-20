<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Includes inline column picker plus optional Re-render and Send to actions.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder";
  import type { ExportOptionsStateManager } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";

  interface Props {
    onRerender?: () => void;
    isExportMode?: boolean;
    exportOptions?: ExportOptionsStateManager;
    onSendTo?: () => void;
    stepCount?: number;
  }

  const { onRerender, isExportMode = false, exportOptions, onSendTo, stepCount = 0 }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });
  let menuVersion = $state(0);

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    void menuVersion;
    return buildChoreoCardContextMenuItems({
      onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
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
