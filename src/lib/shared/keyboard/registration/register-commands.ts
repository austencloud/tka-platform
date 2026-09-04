/**
 * Registers Jump to destinations and actions.
 *
 * Side-effectful registration/orchestration lives here rather than in a
 * catalog or utility module.
 */

import type { CommandPalette } from "$lib/shared/keyboard/services/command-palette";
import type { createKeyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import {
  getAccessibleSectionsForModule,
  getModuleDefinitions,
  handleModuleChange,
  handleSectionChange,
} from "../../navigation-coordinator/navigation-coordinator.svelte";
import { buildNavigationDestinationId } from "../../navigation/domain/navigation-visit";
import { authState } from "../../auth/state/auth-state.svelte";
import {
  activateEditHistoryShortcutTarget,
  canActivateEditHistoryShortcutTarget,
  getEditHistoryShortcutActionLabel,
  type EditHistoryAction,
} from "../domain/edit-history-shortcut-target";
import { openShortcutSettings } from "../open-shortcut-settings";

function getCommandIcon(icon: string | undefined): string {
  return icon?.match(/\bfa-[a-z0-9-]+\b/i)?.[0] ?? "fa-circle";
}

export function registerCommandPaletteCommands(
  service: CommandPalette,
  state: ReturnType<typeof createKeyboardShortcutState>
) {
  // Auth and feature flags settle after the app shell mounts. Re-registration
  // replaces the optimistic list so Jump to never exposes a stale destination.
  for (const command of service.getAllCommands()) {
    if (
      command.id.startsWith("navigate.") ||
      command.id === "settings.toggle" ||
      command.id === "help.shortcuts"
    ) {
      service.unregisterCommand(command.id);
    }
  }

  const accessibleModules = getModuleDefinitions().filter((module) => {
    return module.id !== "admin" || authState.isAdmin;
  });

  // Modules with tabs contribute their actual destinations. A module-only row
  // would land on remembered state without telling the user where they are
  // going, which is the same ambiguity as clicking the module in the sidebar.
  for (const module of accessibleModules) {
    const sections = getAccessibleSectionsForModule(module.id).filter(
      (section) => !section.disabled
    );

    if (sections.length > 0) {
      for (const section of sections) {
        service.registerCommand({
          id: `navigate.${module.id}.${section.id}`,
          label: section.label,
          parentLabel: module.label,
          description: section.description,
          icon: getCommandIcon(section.icon),
          category: "Places",
          kind: "destination",
          destinationId: buildNavigationDestinationId(module.id, section.id),
          keywords: [
            module.label.toLowerCase(),
            module.id,
            section.label.toLowerCase(),
            section.id,
          ],
          available: true,
          action: async () => {
            if (module.id !== state.context) {
              await handleModuleChange(module.id, section.id);
            } else {
              handleSectionChange(section.id);
            }
            state.closeCommandPalette();
          },
        });
      }
      continue;
    }

    service.registerCommand({
      id: `navigate.${module.id}`,
      label: module.label,
      description: module.description,
      icon: getCommandIcon(module.icon),
      category: "Places",
      kind: "destination",
      destinationId: buildNavigationDestinationId(module.id),
      keywords: [module.label.toLowerCase(), module.id],
      available: true,
      action: async () => {
        if (module.linkHref) {
          window.location.assign(module.linkHref);
        } else {
          await handleModuleChange(module.id);
        }
        state.closeCommandPalette();
      },
    });
  }

  registerEditHistoryCommand(service, state, "undo");
  registerEditHistoryCommand(service, state, "redo");

  service.registerCommand({
    id: "help.shortcuts",
    label: "Keyboard shortcuts",
    description: "Review or change keyboard shortcuts",
    icon: "fa-keyboard",
    category: "Help",
    kind: "action",
    shortcut: "Shift+/",
    keywords: ["help", "shortcuts", "keyboard", "hotkeys"],
    available: true,
    action: () => {
      state.closeCommandPalette();
      void openShortcutSettings("command_palette");
    },
  });
}

function registerEditHistoryCommand(
  service: CommandPalette,
  state: ReturnType<typeof createKeyboardShortcutState>,
  action: EditHistoryAction
): void {
  const baseLabel = action === "undo" ? "Undo" : "Redo";
  service.registerCommand({
    id: `action.${action}`,
    label: baseLabel,
    description: `${baseLabel} the latest change in this editor`,
    icon: action === "undo" ? "fa-rotate-left" : "fa-rotate-right",
    category: "Actions",
    kind: "action",
    shortcut:
      action === "undo"
        ? state.isMac
          ? "Cmd+Z"
          : "Ctrl+Z"
        : state.isMac
          ? "Cmd+Shift+Z"
          : "Ctrl+Shift+Z",
    keywords: [action, "change", "edit", "history"],
    available: () =>
      canActivateEditHistoryShortcutTarget(action, document, {
        fromCommandPalette: true,
      }),
    resolvePresentation: () => {
      const actionLabel = getEditHistoryShortcutActionLabel(action, document, {
        fromCommandPalette: true,
      });
      return {
        label: actionLabel ? `${baseLabel}: ${actionLabel}` : baseLabel,
      };
    },
    action: () => {
      activateEditHistoryShortcutTarget(action, document, {
        fromCommandPalette: true,
      });
    },
  });
}
