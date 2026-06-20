/**
 * Pictograph Context Menu Builder
 *
 * Inline visibility toggles for pictograph right-click menu.
 * Submenus for Grid & Points, Glyphs. Direct toggle for Step Numbers.
 * Optional arrow adjustment items (admin only).
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type { VisibilityStateManager } from "../../state/visibility-state.svelte";

interface PictographContextMenuDeps {
  visibilityManager: VisibilityStateManager;
  onAdjustArrow?: (color: "blue" | "red") => void;
  /** True if the user is admin and the pictograph has motions (not a blank/start beat) */
  showArrowAdjustment?: boolean;
}

function buildGridChildren(vm: VisibilityStateManager): ContextMenuItem[] {
  return [
    {
      id: "toggle-grid",
      label: "Grid",
      checked: vm.getGridVisibility(),
      keepOpen: true,
      action: () => vm.setGridVisibility(!vm.getGridVisibility()),
    },
    {
      id: "toggle-hand-points",
      label: "Hand Points",
      checked: vm.getHandPointVisibility() !== "none",
      keepOpen: true,
      action: () => vm.setHandPointVisibility(vm.getHandPointVisibility() === "none" ? "all" : "none"),
    },
    {
      id: "toggle-non-radial",
      label: "Non-Radial Points",
      checked: vm.getNonRadialVisibility(),
      keepOpen: true,
      action: () => vm.setNonRadialVisibility(!vm.getNonRadialVisibility()),
    },
  ];
}

function buildGlyphChildren(vm: VisibilityStateManager): ContextMenuItem[] {
  return [
    {
      id: "toggle-tka-glyph",
      label: "TKA",
      checked: vm.getRawGlyphVisibility("tkaGlyph"),
      keepOpen: true,
      action: () => vm.setGlyphVisibility("tkaGlyph", !vm.getRawGlyphVisibility("tkaGlyph")),
    },
    {
      id: "toggle-tnd-glyph",
      label: "TnD",
      checked: vm.getRawGlyphVisibility("tndGlyph"),
      keepOpen: true,
      action: () => vm.setGlyphVisibility("tndGlyph", !vm.getRawGlyphVisibility("tndGlyph")),
    },
    {
      id: "toggle-positions-glyph",
      label: "Positions",
      checked: vm.getRawGlyphVisibility("positionsGlyph"),
      keepOpen: true,
      action: () => vm.setGlyphVisibility("positionsGlyph", !vm.getRawGlyphVisibility("positionsGlyph")),
    },
  ];
}

export function buildPictographContextMenuItems(
  deps: PictographContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;

  const items: ContextMenuEntry[] = [
    {
      id: "grid-submenu",
      label: "Grid & Points",
      icon: "fa-border-all",
      children: buildGridChildren(vm),
    },
    {
      id: "glyphs-submenu",
      label: "Glyphs",
      icon: "fa-font",
      children: buildGlyphChildren(vm),
    },
    { type: "separator" },
    {
      id: "toggle-step-numbers",
      label: "Step Numbers",
      icon: "fa-list-ol",
      checked: vm.getStepNumbersVisibility(),
      keepOpen: true,
      action: () => vm.setStepNumbersVisibility(!vm.getStepNumbersVisibility()),
    },
  ];

  if (deps.showArrowAdjustment && deps.onAdjustArrow) {
    items.push({ type: "separator" });
    items.push({
      id: "adjust-blue-arrow",
      label: "Adjust Blue Arrow",
      icon: "fa-arrows-alt",
      iconColor: "#2563eb",
      action: () => deps.onAdjustArrow!("blue"),
    });
    items.push({
      id: "adjust-red-arrow",
      label: "Adjust Red Arrow",
      icon: "fa-arrows-alt",
      iconColor: "#dc2626",
      action: () => deps.onAdjustArrow!("red"),
    });
  }

  return items;
}
