/**
 * Unified Choreo Card Context Menu Builder
 *
 * Column picker lives in a submenu. Top-level shows Re-render, Send to, and Send to Sticker Lab.
 */

import type { ContextMenuEntry, ContextMenuItem } from "$lib/shared/components/context-menu/context-menu-types";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

export interface ChoreoCardContextMenuDeps {
  /** Optional - when provided, adds a "Card Settings…" entry. CardDesigner uses this to toggle its sidebar. */
  onOpenSettings?: () => void;
  onRerender?: () => void;
  onSendTo?: () => void;
  onSendToStickerLab?: () => void;
  /** Step count of the current sequence (enables column picker) */
  stepCount?: number;
  /** Called after column count changes so the menu can rebuild */
  onColumnCountChange?: () => void;
}

/** @deprecated Use ChoreoCardContextMenuDeps */
export type CardDesignerContextMenuDeps = ChoreoCardContextMenuDeps;

export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [];

  // Column picker as submenu (only for 4+ steps)
  if (deps.stepCount && deps.stepCount >= 4) {
    const composition = getImageCompositionManager();
    const currentCols = composition.getColumnCountForStepCount(deps.stepCount);
    const stepCount = deps.stepCount;

    const maxCols = Math.min(stepCount, 8);
    const columnChoices: number[] = [];
    for (let n = 2; n <= maxCols; n += 2) {
      columnChoices.push(n);
    }

    if (columnChoices.length > 0) {
      const children: ContextMenuItem[] = [
        {
          id: "cols-auto",
          label: "Auto",
          checked: currentCols === null,
          keepOpen: true,
          action: () => {
            composition.setColumnCountForStepCount(stepCount, null);
            deps.onColumnCountChange?.();
          },
        },
        ...columnChoices.map((n) => ({
          id: `cols-${n}`,
          label: `${n} columns`,
          checked: currentCols === n,
          keepOpen: true,
          action: () => {
            composition.setColumnCountForStepCount(stepCount, n);
            deps.onColumnCountChange?.();
          },
        })),
      ];

      items.push({
        id: "columns-submenu",
        label: `${stepCount}-Count Columns`,
        icon: "fa-columns",
        children,
      });
    }
  }

  if (deps.onOpenSettings) {
    items.push({
      id: "open-card-settings",
      label: "Card Settings…",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings?.(),
    });
  }

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
      label: "Send to…",
      icon: "fa-paper-plane",
      action: deps.onSendTo,
    });
  }

  if (deps.onSendToStickerLab) {
    actions.push({
      id: "send-to-sticker-lab",
      label: "Send to Sticker Lab",
      icon: "fa-sticky-note",
      action: deps.onSendToStickerLab,
    });
  }

  if (actions.length > 0) {
    items.push({ type: "separator" as const });
    items.push(...actions);
  }

  return items;
}
