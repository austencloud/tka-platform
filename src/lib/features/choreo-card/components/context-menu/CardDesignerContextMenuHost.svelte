<!--
  CardDesignerContextMenuHost - Orchestrates the Card Designer right-click context menu.
  Single entry: "Card Settings..." plus optional Re-render action.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/shared/choreo-card/services/card-designer-context-menu-builder";

  interface Props {
    onOpenSettings: () => void;
    onRerender?: () => void;
  }

  let { onOpenSettings, onRerender }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildChoreoCardContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      onRerender,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
