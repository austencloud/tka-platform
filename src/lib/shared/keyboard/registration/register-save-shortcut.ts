import type { KeyboardShortcutManager } from "../services/keyboard-shortcut-manager";
import {
  activateSaveShortcutTarget,
  hasSaveShortcutTarget,
} from "../domain/save-shortcut-target";

export function registerSaveShortcut(
  service: KeyboardShortcutManager,
  isMac: boolean
): void {
  service.register({
    id: "global.save",
    label: "Save",
    description: "Use the Save action on the current surface",
    key: "s",
    modifiers: isMac ? ["meta"] : ["ctrl"],
    context: "global",
    scope: "action",
    priority: "critical",
    forceExecute: true,
    condition: () => hasSaveShortcutTarget(),
    action: (event) => {
      if (!event.repeat) activateSaveShortcutTarget();
    },
  });
}
