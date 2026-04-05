<!--
  Viewer3DContextMenuHost — Orchestrator for the 3D viewer right-click context menu.
  Quick-access submenus for Effects, Visibility, Grid, plus Exit 3D View.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type {
    ContextMenuState,
    ContextMenuEntry,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildViewer3DContextMenuItems } from "./Viewer3DContextMenuBuilder";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getViewer3DContext } from "../../context/viewer-3d-context";

  let menuState: ContextMenuState = $state({ open: false });
  let menuItemsVersion: number = $state(0);

  const visibilityManager = getAnimationVisibilityManager();
  const viewer3DState = getViewer3DContext();

  function onSettingsChanged(): void {
    menuItemsVersion++;
  }

  visibilityManager.registerObserver(onSettingsChanged);

  onDestroy(() => {
    visibilityManager.unregisterObserver(onSettingsChanged);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    // Touch menuItemsVersion to re-derive when visibility settings change
    void menuItemsVersion;

    return buildViewer3DContextMenuItems({
      visibilityManager,
      onExit3D: () => {
        closeContextMenu();
        viewer3DState.exit3D();
      },
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
