/**
 * Card Designer Context Menu Builder
 *
 * Builds context menu items for toggling visibility settings on the
 * Card Designer's ChoreoCard. Reads from VisibilityStateManager (grid,
 * hand points, TKA) and ImageCompositionStateManager (word, start position).
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";

export interface CardDesignerContextMenuDeps {
  // Current toggle states
  handPointsVisible: boolean;
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;

  // Callbacks to toggle each setting
  setHandPointsVisible: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setShowTKA: (v: boolean) => void;
  setShowWord: (v: boolean) => void;
  setIncludeStartPosition: (v: boolean) => void;
}

export function buildCardDesignerContextMenuItems(
  deps: CardDesignerContextMenuDeps
): ContextMenuEntry[] {
  const displayChildren: ContextMenuItem[] = [
    {
      id: "toggle-hand-points",
      label: "Hand Points",
      icon: "fa-hand-dots",
      checked: deps.handPointsVisible,
      keepOpen: true,
      action: () => deps.setHandPointsVisible(!deps.handPointsVisible),
    },
    {
      id: "toggle-grid",
      label: "Grid",
      icon: "fa-border-all",
      checked: deps.showGrid,
      keepOpen: true,
      action: () => deps.setShowGrid(!deps.showGrid),
    },
    {
      id: "toggle-tka",
      label: "TKA Glyphs",
      icon: "fa-t",
      checked: deps.showTKA,
      keepOpen: true,
      action: () => deps.setShowTKA(!deps.showTKA),
    },
    {
      id: "toggle-word",
      label: "Word",
      icon: "fa-font",
      checked: deps.showWord,
      keepOpen: true,
      action: () => deps.setShowWord(!deps.showWord),
    },
    {
      id: "toggle-start-position",
      label: "Start Position",
      icon: "fa-play",
      checked: deps.includeStartPosition,
      keepOpen: true,
      action: () => deps.setIncludeStartPosition(!deps.includeStartPosition),
    },
  ];

  return [
    {
      id: "display-submenu",
      label: "Display",
      icon: "fa-eye",
      children: displayChildren,
    },
  ];
}
