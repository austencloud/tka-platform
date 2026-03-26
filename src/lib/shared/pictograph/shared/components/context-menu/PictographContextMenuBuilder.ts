/**
 * Pictograph Context Menu Builder
 *
 * Menu entries for pictograph right-click: settings and arrow adjustment.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

interface PictographContextMenuDeps {
  onOpenSettings: () => void;
  onAdjustArrow?: (color: "blue" | "red") => void;
  /** True if the user is admin and the pictograph has motions (not a blank/start beat) */
  showArrowAdjustment?: boolean;
}

export function buildPictographContextMenuItems(
  deps: PictographContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    {
      id: "open-pictograph-settings",
      label: "Pictograph Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
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
