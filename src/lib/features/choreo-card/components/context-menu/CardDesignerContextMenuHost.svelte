<!--
  CardDesignerContextMenuHost — Orchestrates the Card Designer right-click context menu.
  Reads from VisibilityStateManager (grid, hand points, TKA) and
  ImageCompositionStateManager (word, start position).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCardDesignerContextMenuItems } from "./CardDesignerContextMenuBuilder";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  let menuState: ContextMenuState = $state({ open: false });

  // Get singleton managers
  const imageComposition = getImageCompositionManager();
  const visibility = getVisibilityStateManager();

  // Observer-based reactivity for ImageCompositionStateManager
  let compositionVersion = $state(0);
  function onCompositionChanged(): void {
    compositionVersion++;
  }
  imageComposition.registerObserver(onCompositionChanged);

  // Observer-based reactivity for VisibilityStateManager
  let visibilityVersion = $state(0);
  function onVisibilityChanged(): void {
    visibilityVersion++;
  }
  visibility.registerObserver(onVisibilityChanged, ["all"]);

  onDestroy(() => {
    imageComposition.unregisterObserver(onCompositionChanged);
    visibility.unregisterObserver(onVisibilityChanged);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  // Build menu items reactively. Touch version counters to create
  // Svelte reactive dependencies on the observer notifications.
  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    void compositionVersion;
    void visibilityVersion;

    return buildCardDesignerContextMenuItems({
      handPointsVisible: visibility.getHandPointVisibility() === "all",
      showGrid: visibility.getGridVisibility(),
      showTKA: visibility.getGlyphVisibility("tkaGlyph"),
      showWord: imageComposition.addWord,
      includeStartPosition: imageComposition.includeStartPosition,

      setHandPointsVisible: (v) => visibility.setHandPointVisibility(v ? "all" : "active"),
      setShowGrid: (v) => visibility.setGridVisibility(v),
      setShowTKA: (v) => visibility.setGlyphVisibility("tkaGlyph", v),
      setShowWord: (v) => imageComposition.setAddWord(v),
      setIncludeStartPosition: (v) => imageComposition.setIncludeStartPosition(v),
    });
  });

  /**
   * Open the context menu at the given viewport coordinates.
   * Called from parent via bind:this.
   */
  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
