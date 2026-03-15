/**
 * ChoreoCard Context Menu Builder
 *
 * Reads current state from ExportOptionsStateManager (export mode)
 * or ImageCompositionStateManager (normal mode) and produces
 * ContextMenuEntry[] for the ChoreoCard right-click menu.
 *
 * Structure:
 *   - Display submenu: Word, Start Position, Difficulty, Step Numbers, Creator Name, Notes, Birthday
 *   - Columns submenu: Auto, 2, 3, 4, 5, 6 (radio-style)
 * Plus: Edit Notes Text..., Export Image actions.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";

export interface ChoreoCardContextMenuDeps {
  // Current toggle states (read from whichever manager is active)
  showWord: boolean;
  showStepNumbers: boolean;
  showDifficulty: boolean;
  includeStartPosition: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
  columnCount: number | null; // null = auto

  // Callbacks to toggle each setting
  setShowWord: (v: boolean) => void;
  setShowStepNumbers: (v: boolean) => void;
  setShowDifficulty: (v: boolean) => void;
  setIncludeStartPosition: (v: boolean) => void;
  setShowCreatorName: (v: boolean) => void;
  setShowNotes: (v: boolean) => void;
  setShowBirthday: (v: boolean) => void;
  setColumnCount: (v: number | null) => void;

  // Actions
  onEditNotes?: () => void;
  onExportImage?: () => void;
  onSendTo?: () => void;
}

const COLUMN_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Auto", value: null },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
];

function buildColumnChildren(
  currentCount: number | null,
  setColumnCount: (v: number | null) => void
): ContextMenuItem[] {
  return COLUMN_OPTIONS.map((opt) => ({
    id: `columns-${opt.value ?? "auto"}`,
    label: opt.label,
    checked: currentCount === opt.value,
    action: () => setColumnCount(opt.value),
  }));
}

export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const displayChildren: ContextMenuItem[] = [
    {
      id: "toggle-word",
      label: "Word",
      icon: "fa-font",
      checked: deps.showWord,
      keepOpen: true,
      action: () => deps.setShowWord(!deps.showWord),
    },
    {
      id: "toggle-start",
      label: "Start Position",
      icon: "fa-play",
      checked: deps.includeStartPosition,
      keepOpen: true,
      action: () => deps.setIncludeStartPosition(!deps.includeStartPosition),
    },
    {
      id: "toggle-difficulty",
      label: "Difficulty",
      icon: "fa-signal",
      checked: deps.showDifficulty,
      keepOpen: true,
      action: () => deps.setShowDifficulty(!deps.showDifficulty),
    },
    {
      id: "toggle-step-numbers",
      label: "Step Numbers",
      icon: "fa-list-ol",
      checked: deps.showStepNumbers,
      keepOpen: true,
      action: () => deps.setShowStepNumbers(!deps.showStepNumbers),
    },
    {
      id: "toggle-creator-name",
      label: "Creator Name",
      icon: "fa-user",
      checked: deps.showCreatorName,
      keepOpen: true,
      action: () => deps.setShowCreatorName(!deps.showCreatorName),
    },
    {
      id: "toggle-notes",
      label: "Notes",
      icon: "fa-sticky-note",
      checked: deps.showNotes,
      keepOpen: true,
      action: () => deps.setShowNotes(!deps.showNotes),
    },
    {
      id: "toggle-birthday",
      label: "Birthday",
      icon: "fa-cake-candles",
      checked: deps.showBirthday,
      keepOpen: true,
      action: () => deps.setShowBirthday(!deps.showBirthday),
    },
  ];

  const items: ContextMenuEntry[] = [
    {
      id: "display-submenu",
      label: "Display",
      icon: "fa-eye",
      children: displayChildren,
    },
    {
      id: "columns-submenu",
      label: "Columns",
      icon: "fa-table-columns",
      children: buildColumnChildren(deps.columnCount, deps.setColumnCount),
    },
  ];

  if (deps.onEditNotes || deps.onExportImage || deps.onSendTo) {
    items.push({ type: "separator" as const });

    if (deps.onEditNotes) {
      items.push({
        id: "edit-notes",
        label: "Edit Notes Text\u2026",
        icon: "fa-pen",
        action: deps.onEditNotes,
      });
    }

    if (deps.onExportImage) {
      items.push({
        id: "export-image",
        label: "Export Image",
        icon: "fa-download",
        action: deps.onExportImage,
      });
    }

    if (deps.onSendTo) {
      items.push({
        id: "send-to",
        label: "Send to\u2026",
        icon: "fa-paper-plane",
        action: deps.onSendTo,
      });
    }
  }

  return items;
}
