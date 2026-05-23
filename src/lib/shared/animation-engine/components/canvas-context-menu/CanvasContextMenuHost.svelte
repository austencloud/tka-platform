<!--
  CanvasContextMenuHost - Orchestrator for the canvas right-click context menu.
  Quick-access submenus for Effects, Efforts, Path Shape.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type {
    ContextMenuState,
    ContextMenuEntry,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCanvasContextMenuItems } from "./CanvasContextMenuBuilder";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  interface Props {
    disassembled?: boolean;
    onToggleDisassemble?: () => void;
    captureEffectDiagnostics?: () => Record<string, unknown>;
    onToggle3DView?: () => void;
  }

  const {
    disassembled = false,
    onToggleDisassemble,
    captureEffectDiagnostics,
    onToggle3DView,
  }: Props = $props();

  // Try to read the viewer-3d context. When this component is rendered inside
  // a sequence viewer, the orchestrator will have set it. In other contexts
  // (e.g., the compose tab) it won't be present and we gracefully omit the
  // 3D menu item.
  let viewer3DState: ReturnType<typeof getViewer3DContext> | undefined;
  try {
    viewer3DState = getViewer3DContext();
  } catch {
    // Context not available - not in a sequence viewer
  }

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
      disassembled,
      onToggleDisassemble,
      captureEffectDiagnostics,
      viewer3DState,
      onToggle3DView,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
