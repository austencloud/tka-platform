<!--
  CanvasContextMenuHost — Orchestrator for the canvas right-click context menu.
  Renders the ContextMenu with quick toggle items.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import {
    buildCanvasContextMenuItems,
    type SettingsPanelCategory,
  } from "./CanvasContextMenuBuilder";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

  interface CanvasContextMenuHostProps {
    onOpenPanel?: (category: SettingsPanelCategory) => void;
    decomposed?: boolean;
    onToggleDecompose?: () => void;
  }

  const { onOpenPanel, decomposed = false, onToggleDecompose }: CanvasContextMenuHostProps = $props();

  let menuState: ContextMenuState = $state({ open: false });
  let menuItemsVersion: number = $state(0);

  const visibilityManager = getAnimationVisibilityManager();

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

    return buildCanvasContextMenuItems({
      visibilityManager,
      onOpenPanel: (category) => {
        menuState = { open: false };
        onOpenPanel?.(category);
      },
      decomposed,
      onToggleDecompose,
    });
  });

  /**
   * Open the context menu at the given coordinates.
   * Called from AnimatorCanvas via bind:this.
   */
  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
