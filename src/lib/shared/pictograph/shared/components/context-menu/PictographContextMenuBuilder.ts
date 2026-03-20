/**
 * Pictograph Context Menu Builder
 *
 * Minimal menu: single "Pictograph Settings..." entry that opens
 * the PictographSettingsModal with live preview.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

interface PictographContextMenuDeps {
  onOpenSettings: () => void;
}

export function buildPictographContextMenuItems(
  deps: PictographContextMenuDeps
): ContextMenuEntry[] {
  return [
    {
      id: "open-pictograph-settings",
      label: "Pictograph Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];
}
