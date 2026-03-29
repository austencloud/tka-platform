/**
 * Pictograph Context Menu Builder
 *
 * Inline visibility toggles for pictograph right-click menu.
 * Submenus for Motions, Grid & Points, Glyphs. Direct toggle for Step Numbers.
 * Optional arrow adjustment items (admin only).
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type { VisibilityStateManager } from "../../state/visibility-state.svelte";
import { MotionColor } from "../../domain/enums/pictograph-enums";

interface PictographContextMenuDeps {
  visibilityManager: VisibilityStateManager;
  onAdjustArrow?: (color: "blue" | "red") => void;
  /** True if the user is admin and the pictograph has motions (not a blank/start beat) */
  showArrowAdjustment?: boolean;
}

function buildMotionChildren(vm: VisibilityStateManager): ContextMenuItem[] {
  return [
    {
      id: "toggle-blue-motion",
      label: "Blue Motion",
      icon: "fa-circle",
      iconColor: "#2563eb",
      checked: vm.getMotionVisibility(MotionColor.BLUE),
      keepOpen: true,
      action: () => vm.setMotionVisibility(MotionColor.BLUE, !vm.getMotionVisibility(MotionColor.BLUE)),
    },
    {
      id: "toggle-red-motion",
      label: "Red Motion",
      icon: "fa-circle",
      iconColor: "#dc2626",
      checked: vm.getMotionVisibility(MotionColor.RED),
      keepOpen: true,
      action: () => vm.setMotionVisibility(MotionColor.RED, !vm.getMotionVisibility(MotionColor.RED)),
    },
  ];
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
      label: "All Hand Points",
      checked: vm.getHandPointVisibility() === "all",
      keepOpen: true,
      action: () => vm.setHandPointVisibility(vm.getHandPointVisibility() === "all" ? "active" : "all"),
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
  const allMotionsVisible = vm.areAllMotionsVisible();

  return [
    {
      id: "toggle-tka-glyph",
      label: "TKA",
      checked: vm.getRawGlyphVisibility("tkaGlyph"),
      disabled: !allMotionsVisible,
      keepOpen: true,
      action: () => vm.setGlyphVisibility("tkaGlyph", !vm.getRawGlyphVisibility("tkaGlyph")),
    },
    {
      id: "toggle-vtg-glyph",
      label: "VTG",
      checked: vm.getRawGlyphVisibility("vtgGlyph"),
      disabled: !allMotionsVisible,
      keepOpen: true,
      action: () => vm.setGlyphVisibility("vtgGlyph", !vm.getRawGlyphVisibility("vtgGlyph")),
    },
    {
      id: "toggle-elemental-glyph",
      label: "Elemental",
      checked: vm.getRawGlyphVisibility("elementalGlyph"),
      disabled: !allMotionsVisible,
      keepOpen: true,
      action: () => vm.setGlyphVisibility("elementalGlyph", !vm.getRawGlyphVisibility("elementalGlyph")),
    },
    {
      id: "toggle-positions-glyph",
      label: "Positions",
      checked: vm.getRawGlyphVisibility("positionsGlyph"),
      disabled: !allMotionsVisible,
      keepOpen: true,
      action: () => vm.setGlyphVisibility("positionsGlyph", !vm.getRawGlyphVisibility("positionsGlyph")),
    },
    {
      id: "toggle-reversals",
      label: "Reversals",
      checked: vm.getRawGlyphVisibility("reversalIndicators"),
      keepOpen: true,
      action: () => vm.setGlyphVisibility("reversalIndicators", !vm.getRawGlyphVisibility("reversalIndicators")),
    },
  ];
}

export function buildPictographContextMenuItems(
  deps: PictographContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;

  const items: ContextMenuEntry[] = [
    {
      id: "motions-submenu",
      label: "Motions",
      icon: "fa-arrows-spin",
      children: buildMotionChildren(vm),
    },
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
      checked: vm.getBeatNumbersVisibility(),
      keepOpen: true,
      action: () => vm.setBeatNumbersVisibility(!vm.getBeatNumbersVisibility()),
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
