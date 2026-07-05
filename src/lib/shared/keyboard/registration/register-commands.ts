/**
 * Register Command Palette Commands
 *
 * Registers all commands available in the command palette.
 *
 * Side-effectful registration/orchestration — lives in registration/, not utils/.
 *
 * Domain: Keyboard Shortcuts - Command Registration
 */

import type { CommandPalette } from '$lib/shared/keyboard/services/command-palette'
import type { createKeyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import {
  handleModuleChange,
  getModuleDefinitions,
} from "../../navigation-coordinator/navigation-coordinator.svelte";
import { navigationState } from "../../navigation/state/navigation-state.svelte";
import type { ModuleId } from "../../navigation/domain/types";
import { authState } from "../../auth/state/auth-state.svelte";

export function registerCommandPaletteCommands(
  service: CommandPalette,
  state: ReturnType<typeof createKeyboardShortcutState>
) {
  // Get accessible modules
  const moduleDefinitions = getModuleDefinitions();
  const isAdmin = authState.isAdmin;

  // Filter modules to only show accessible ones
  const accessibleModules = moduleDefinitions.filter((module) => {
    // Filter out admin module for non-admin users
    if (module.id === "admin" && !isAdmin) {
      return false;
    }
    // Filter out modules that aren't implemented yet
    const notImplemented = ["choreo"];
    if (notImplemented.includes(module.id)) {
      return false;
    }
    return true;
  });

  // ==================== Navigation Commands ====================

  // Dynamically register commands for accessible modules
  accessibleModules.forEach((module, index) => {
    const shortcutNumber = index + 1;
    const shortcutKey = shortcutNumber <= 5 ? `${shortcutNumber}` : undefined;

    service.registerCommand({
      id: `navigate.${module.id}`,
      label: module.label,
      description: module.description || `Navigate to ${module.label}`,
      icon: module.icon || "fa-circle",
      category: "Navigation",
      ...(shortcutKey !== undefined && { shortcut: shortcutKey }),
      keywords: [module.label.toLowerCase(), module.id],
      available: true,
      action: async () => {
        await handleModuleChange(module.id);
        state.closeCommandPalette();
      },
    });
  });

  // ==================== Settings Commands ====================

  service.registerCommand({
    id: "settings.toggle",
    label: "Toggle Settings",
    description: "Open settings or return to previous module",
    icon: "fa-cog",
    category: "Settings",
    shortcut: state.isMac ? "⌘," : "Ctrl+,",
    keywords: ["settings", "preferences", "config", "options"],
    available: true,
    action: async () => {
      // Toggle behavior: if in settings, go back to previous module
      if (navigationState.currentModule === "settings") {
        const previousModule = navigationState.previousModule || "create";
        await handleModuleChange(previousModule as ModuleId);
      } else {
        await handleModuleChange("settings" as ModuleId);
      }
      state.closeCommandPalette();
    },
  });

  // ==================== Help Commands ====================

  service.registerCommand({
    id: "help.shortcuts",
    label: "Show Keyboard Shortcuts",
    description: "View all available shortcuts",
    icon: "fa-keyboard",
    category: "Help",
    shortcut: state.isMac ? "⌘/" : "Ctrl+/",
    keywords: ["help", "shortcuts", "keyboard", "hotkeys"],
    available: true,
    action: () => {
      state.openHelp();
      state.closeCommandPalette();
    },
  });
}
