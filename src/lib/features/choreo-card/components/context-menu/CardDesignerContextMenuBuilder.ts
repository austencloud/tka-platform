/**
 * Unified Choreo Card Context Menu Builder
 *
 * Simplified: single "Card Settings..." entry that opens the full modal.
 * Plus optional Re-render and Send to... actions.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

export interface ChoreoCardContextMenuDeps {
  onOpenSettings: () => void;
  onRerender?: () => void;
  onSendTo?: () => void;
}

/** @deprecated Use ChoreoCardContextMenuDeps */
export type CardDesignerContextMenuDeps = ChoreoCardContextMenuDeps;

export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    {
      id: "open-card-settings",
      label: "Card Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];

  const actions: ContextMenuEntry[] = [];

  if (deps.onRerender) {
    actions.push({
      id: "rerender",
      label: "Re-render",
      icon: "fa-sync-alt",
      action: deps.onRerender,
    });
  }

  if (deps.onSendTo) {
    actions.push({
      id: "send-to",
      label: "Send to\u2026",
      icon: "fa-paper-plane",
      action: deps.onSendTo,
    });
  }

  if (actions.length > 0) {
    items.push({ type: "separator" as const });
    items.push(...actions);
  }

  return items;
}

/** @deprecated Use buildChoreoCardContextMenuItems instead */
export const buildCardDesignerContextMenuItems = buildChoreoCardContextMenuItems;
