/**
 * Canvas Context Menu Builder
 *
 * Simplified: single "Animation Settings..." entry that opens the full modal.
 * Plus optional Disassemble toggle.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

interface CanvasContextMenuDeps {
  onOpenSettings: () => void;
  disassembled?: boolean;
  onToggleDisassemble?: () => void;
}

export function buildCanvasContextMenuItems(
  deps: CanvasContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    {
      id: "open-animation-settings",
      label: "Animation Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];

  if (deps.onToggleDisassemble) {
    items.push(
      { type: "separator" as const },
      {
        id: "toggle-disassemble",
        label: deps.disassembled ? "Reassemble" : "Disassemble",
        icon: deps.disassembled ? "fa-compress" : "fa-table-columns",
        checked: deps.disassembled,
        action: () => deps.onToggleDisassemble!(),
      },
    );
  }

  return items;
}
