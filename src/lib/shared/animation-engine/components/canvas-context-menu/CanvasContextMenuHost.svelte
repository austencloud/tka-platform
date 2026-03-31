<!--
  CanvasContextMenuHost — Orchestrator for the canvas right-click context menu.
  Quick-access submenus for Effects, Efforts, Path Shape, plus Animation Settings launcher.
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
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    onOpenSettings: () => void;
    disassembled?: boolean;
    onToggleDisassemble?: () => void;
    captureEffectDiagnostics?: () => Record<string, unknown>;
    sequenceData?: SequenceData | null;
  }

  const {
    onOpenSettings,
    disassembled = false,
    onToggleDisassemble,
    captureEffectDiagnostics,
    sequenceData,
  }: Props = $props();

  // Try to read the viewer-3d context. When this component is rendered inside
  // a sequence viewer, the orchestrator will have set it. In other contexts
  // (e.g., the compose tab) it won't be present and we gracefully omit the
  // 3D menu item.
  const viewer3DState = getViewer3DContext();

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
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      disassembled,
      onToggleDisassemble,
      captureEffectDiagnostics,
      viewer3DState,
      sequenceData,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
