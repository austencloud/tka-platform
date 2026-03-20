<!--
  CanvasContextMenuHost — Orchestrator for the canvas right-click context menu.
  Single entry: "Animation Settings..." plus optional Disassemble toggle.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCanvasContextMenuItems } from "./CanvasContextMenuBuilder";

  interface Props {
    onOpenSettings: () => void;
    disassembled?: boolean;
    onToggleDisassemble?: () => void;
  }

  const { onOpenSettings, disassembled = false, onToggleDisassemble }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildCanvasContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      disassembled,
      onToggleDisassemble,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
