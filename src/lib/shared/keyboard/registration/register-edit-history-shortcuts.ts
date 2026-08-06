import type { KeyboardShortcutManager } from "../services/keyboard-shortcut-manager";
import {
  activateEditHistoryShortcutTarget,
  hasEditHistoryShortcutTarget,
  type EditHistoryAction,
} from "../domain/edit-history-shortcut-target";
import type { KeyModifier } from "../domain/types/keyboard-types";

export function registerEditHistoryShortcuts(
  service: KeyboardShortcutManager,
  isMac: boolean
): void {
  const platformModifier: KeyModifier = isMac ? "meta" : "ctrl";
  registerHistoryAction(service, "undo", {
    key: "z",
    modifiers: [platformModifier],
  });
  registerHistoryAction(service, "redo", {
    key: "z",
    modifiers: [platformModifier, "shift"],
    alternateBindings: isMac ? [] : [{ key: "y", modifiers: ["ctrl"] }],
  });
}

function registerHistoryAction(
  service: KeyboardShortcutManager,
  action: EditHistoryAction,
  binding: {
    key: string;
    modifiers: KeyModifier[];
    alternateBindings?: Array<{ key: string; modifiers: KeyModifier[] }>;
  }
): void {
  const label = action === "undo" ? "Undo" : "Redo";
  service.register({
    id: `global.${action}`,
    label,
    description: `${label} the latest change in the active editor`,
    key: binding.key,
    modifiers: binding.modifiers,
    alternateBindings: binding.alternateBindings,
    context: "global",
    scope: "editing",
    priority: "critical",
    forceExecute: true,
    stopPropagation: true,
    condition: () => hasEditHistoryShortcutTarget(action),
    action: () => {
      activateEditHistoryShortcutTarget(action);
    },
  });
}
