<!--
  PictographContextMenuHost - Orchestrator for the pictograph right-click context menu.
  Entries: inline visibility toggles and optional arrow adjustment items (admin only).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildPictographContextMenuItems } from "./pictograph-context-menu-builder";
  import { getVisibilityStateManager } from "../../state/visibility-state.svelte";
  import type { HandSide } from "../../domain/enums/pictograph-enums";

  interface Props {
    onAdjustArrow?: (hand: HandSide) => void;
    showArrowAdjustment?: boolean;
  }

  const { onAdjustArrow, showArrowAdjustment = false }: Props = $props();

  const visibilityManager = getVisibilityStateManager();

  let menuState: ContextMenuState = $state({ open: false });

  // Increments on every visibility change so $derived rebuilds menu items with fresh checked states
  let version = $state(0);

  function bumpVersion() { version++; }

  onMount(() => {
    visibilityManager.registerObserver(bumpVersion, ["all"]);
    return () => visibilityManager.unregisterObserver(bumpVersion);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    void version;
    return buildPictographContextMenuItems({
      visibilityManager,
      onAdjustArrow: onAdjustArrow ? (color) => {
        closeContextMenu();
        onAdjustArrow(color);
      } : undefined,
      showArrowAdjustment,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    version++;
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
