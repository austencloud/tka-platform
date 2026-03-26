<!--
  PictographContextMenuHost — Orchestrator for the pictograph right-click context menu.
  Entries: "Pictograph Settings..." and optional arrow adjustment items (admin only).
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildPictographContextMenuItems } from "./PictographContextMenuBuilder";

  interface Props {
    onOpenSettings: () => void;
    onAdjustArrow?: (color: "blue" | "red") => void;
    showArrowAdjustment?: boolean;
  }

  const { onOpenSettings, onAdjustArrow, showArrowAdjustment = false }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildPictographContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      onAdjustArrow: onAdjustArrow ? (color) => {
        closeContextMenu();
        onAdjustArrow(color);
      } : undefined,
      showArrowAdjustment,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
