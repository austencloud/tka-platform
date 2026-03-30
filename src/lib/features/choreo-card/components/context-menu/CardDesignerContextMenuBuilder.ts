/**
 * Unified Choreo Card Context Menu Builder
 *
 * Includes inline column picker, card settings, and optional actions.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

export interface ChoreoCardContextMenuDeps {
  onOpenSettings: () => void;
  onRerender?: () => void;
  onSendTo?: () => void;
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

  // Column picker (inline, only for 4+ steps)
  if (deps.stepCount && deps.stepCount >= 4) {
    const composition = getImageCompositionManager();
    const currentCols = composition.getColumnCountForStepCount(deps.stepCount);
    const stepCount = deps.stepCount;

    // Even column counts only: 2, 4, 6, 8... up to stepCount
    const maxCols = Math.min(stepCount, 8);
    const columnChoices: number[] = [];
    for (let n = 2; n <= maxCols; n += 2) {
      columnChoices.push(n);
    }

    if (columnChoices.length > 0) {
      items.push({ type: "header" as const, label: `${stepCount}-Count Columns` });

      items.push({
        id: "cols-auto",
        label: "Auto",
        checked: currentCols === null,
        keepOpen: true,
        action: () => {
          composition.setColumnCountForStepCount(stepCount, null);
          deps.onColumnCountChange?.();
        },
      });

      for (const n of columnChoices) {
        items.push({
          id: `cols-${n}`,
          label: `${n} columns`,
          checked: currentCols === n,
          keepOpen: true,
          action: () => {
            composition.setColumnCountForStepCount(stepCount, n);
            deps.onColumnCountChange?.();
          },
        });
      }

      items.push({ type: "separator" as const });
    }
  }

  items.push({
    id: "open-card-settings",
    label: "Card Settings\u2026",
    icon: "fa-sliders",
    action: () => deps.onOpenSettings(),
  });

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
