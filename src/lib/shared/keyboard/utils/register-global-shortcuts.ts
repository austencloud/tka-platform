/**
 * Register Global Shortcuts
 *
 * Registers all global keyboard shortcuts that are available app-wide.
 *
 * Domain: Keyboard Shortcuts - Registration
 */

import type { IKeyboardShortcutManager } from "../services/contracts/IKeyboardShortcutManager";
import type { createKeyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import {
  handleModuleChange,
  getModuleDefinitions,
} from "../../navigation-coordinator/navigation-coordinator.svelte";
import { authState } from "../../auth/state/authState.svelte";
import { quickFeedbackState } from "$lib/features/feedback/state/quick-feedback-state.svelte";
import { saveActiveTab } from "../../settings/utils/tab-persistence.svelte";
import { adminToolbarState } from "../../debug/state/admin-toolbar-state.svelte";
import { settingsService } from "../../settings/state/SettingsState.svelte";
import { getAnimationVisibilityManager } from "../../animation-engine/state/animation-visibility-state.svelte";
import {
  getSettings,
  updateSettings,
  isSettingsPreviewMode,
} from "../../application/state/app-state.svelte";
import { toast } from "../../toast/state/toast-state.svelte";
import { backgroundsConfig } from "../../settings/components/tabs/background/background-config";
import { BackgroundType } from "../../background/shared/domain/enums/background-enums";
import { applyThemeFromColors } from "../../settings/utils/background-theme-calculator";
import { PropType } from "../../pictograph/prop/domain/enums/PropType";

export function registerGlobalShortcuts(
  service: IKeyboardShortcutManager,
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
    const notImplemented = ["write"];
    if (notImplemented.includes(module.id)) {
      return false;
    }
    return true;
  });
  // ==================== TIER 1: Essential Global Shortcuts ====================
  // Using single-key shortcuts (Gmail/Notion style) since Chrome blocks most Ctrl combinations

  // ? - Show keyboard shortcuts settings (Gmail standard, opens Settings → Keyboard)
  service.register({
    id: "global.shortcuts-help",
    label: "Keyboard shortcuts",
    description: "Open keyboard shortcuts settings (press ? key)",
    key: "?",
    modifiers: [],
    context: "global",
    scope: "help",
    priority: "critical",
    action: async () => {
      // Set the active tab to Keyboard before navigating to settings
      saveActiveTab("Keyboard");
      await handleModuleChange("settings");
    },
  });

  // Escape - Close current modal/panel
  service.register({
    id: "global.escape",
    label: "Close modal",
    description: "Close the current modal, panel, or dialog",
    key: "Escape",
    modifiers: [],
    context: "global",
    scope: "navigation",
    priority: "critical",
    action: () => {
      // Close command palette if open
      if (state.showCommandPalette) {
        state.closeCommandPalette();
        return;
      }

      // Other escape handlers will be context-specific
    },
  });

  // ==================== Module Switching (Ctrl + Numbers) ====================
  // Ctrl+1-5 for module navigation
  // Part of the trifecta: Ctrl=modules, Alt=props, Shift=themes

  // Map modules to number keys
  const moduleKeyMap = ["1", "2", "3", "4", "5"];

  accessibleModules.slice(0, 5).forEach((module, index) => {
    const key = moduleKeyMap[index];
    if (!key) return;

    service.register({
      id: `global.switch-to-${module.id}`,
      label: module.label,
      description: `Navigate to ${module.label} (Ctrl+${key})`,
      key: key,
      modifiers: ["ctrl"],
      context: "global",
      scope: "navigation",
      priority: "high",
      action: async () => {
        // Force View Transition for keyboard shortcuts (even when leaving Dashboard)
        await handleModuleChange(module.id, undefined, {
          forceViewTransition: true,
        });
      },
    });
  });

  // ==================== Quick Actions ====================

  // f - Quick Feedback (opens feedback drawer)
  service.register({
    id: "global.quick-feedback",
    label: "Quick Feedback",
    description: "Open the quick feedback panel (press f)",
    key: "f",
    modifiers: [],
    context: "global",
    scope: "action",
    priority: "high",
    action: () => {
      quickFeedbackState.toggle();
    },
  });

  // l - Toggle Dark Mode (dark background)
  service.register({
    id: "global.toggle-dark-mode",
    label: "Toggle Dark Mode",
    description: "Toggle Dark Mode (dark background)",
    key: "l",
    modifiers: [],
    context: "global",
    scope: "action",
    priority: "high",
    action: () => {
      // Block changes in preview mode - don't modify the previewed user's settings
      if (isSettingsPreviewMode()) {
        return;
      }

      const currentSettings = getSettings();
      const beforeValue = currentSettings.darkMode ?? false;
      const newValue = !beforeValue;

      // Update AppSettings (syncs to Firebase)
      void updateSettings({ darkMode: newValue });

      // Also sync to animation visibility manager for immediate visual feedback
      const visibilityManager = getAnimationVisibilityManager();
      visibilityManager.setDarkMode(newValue);

      // Show toast notification
      const message = newValue
        ? "Dark Mode enabled — press L to toggle"
        : "Dark Mode disabled — press L to toggle";
      toast.info(message, 2500);
    },
  });

  // ==================== Prop Preset Shortcuts ====================

  // Alt+1 - Switch to Prop Preset 1
  service.register({
    id: "global.prop-preset-1",
    label: "Prop Preset 1",
    description: "Switch to prop preset 1 (Alt+1)",
    key: "1",
    modifiers: ["alt"],
    context: "global",
    scope: "action",
    priority: "high", // Higher priority than module navigation
    action: () => {
      const presets = settingsService.settings.propPresets || [];
      const preset = presets[0];
      if (preset) {
        settingsService.updateSettings({
          selectedPresetIndex: 0,
          bluePropType: preset.bluePropType,
          redPropType: preset.redPropType,
          catDogMode: preset.catDogMode,
        });
        toast.info(`Preset 1: ${preset.bluePropType}`, 1500);
      }
    },
  });

  // Alt+2 - Switch to Prop Preset 2
  service.register({
    id: "global.prop-preset-2",
    label: "Prop Preset 2",
    description: "Switch to prop preset 2 (Alt+2)",
    key: "2",
    modifiers: ["alt"],
    context: "global",
    scope: "action",
    priority: "high", // Higher priority than module navigation
    action: () => {
      const presets = settingsService.settings.propPresets || [];
      const preset = presets[1];
      if (preset) {
        settingsService.updateSettings({
          selectedPresetIndex: 1,
          bluePropType: preset.bluePropType,
          redPropType: preset.redPropType,
          catDogMode: preset.catDogMode,
        });
        toast.info(`Preset 2: ${preset.bluePropType}`, 1500);
      }
    },
  });

  // Alt+3 - Switch to Prop Preset 3
  service.register({
    id: "global.prop-preset-3",
    label: "Prop Preset 3",
    description: "Switch to prop preset 3 (Alt+3)",
    key: "3",
    modifiers: ["alt"],
    context: "global",
    scope: "action",
    priority: "high", // Higher priority than module navigation
    action: () => {
      const presets = settingsService.settings.propPresets || [];
      const preset = presets[2];
      if (preset) {
        settingsService.updateSettings({
          selectedPresetIndex: 2,
          bluePropType: preset.bluePropType,
          redPropType: preset.redPropType,
          catDogMode: preset.catDogMode,
        });
        toast.info(`Preset 3: ${preset.bluePropType}`, 1500);
      }
    },
  });

  // ==================== Prop Type Cycle Shortcuts ====================

  // Common prop types to cycle through (subset of most used props)
  const cyclePropTypes: PropType[] = [
    PropType.STAFF,
    PropType.CLUB,
    PropType.FAN,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.BUUGENG,
    PropType.HAND,
  ];

  // P - Cycle to next prop type
  service.register({
    id: "global.cycle-prop-type",
    label: "Cycle Prop Type",
    description: "Cycle to next prop type (P)",
    key: "p",
    modifiers: [],
    context: "global",
    scope: "action",
    priority: "high",
    action: () => {
      const currentPropType = settingsService.settings.bluePropType || PropType.STAFF;
      const currentIndex = cyclePropTypes.indexOf(currentPropType as PropType);
      const nextIndex = (currentIndex + 1) % cyclePropTypes.length;
      const nextPropType = cyclePropTypes[nextIndex];

      settingsService.updateSettings({
        bluePropType: nextPropType,
        redPropType: nextPropType,
      });
      toast.info(`Prop: ${nextPropType}`, 1500);
    },
  });

  // Shift+P - Cycle to previous prop type
  service.register({
    id: "global.cycle-prop-type-reverse",
    label: "Cycle Prop Type (Reverse)",
    description: "Cycle to previous prop type (Shift+P)",
    key: "p",
    modifiers: ["shift"],
    context: "global",
    scope: "action",
    priority: "high",
    action: () => {
      const currentPropType = settingsService.settings.bluePropType || PropType.STAFF;
      const currentIndex = cyclePropTypes.indexOf(currentPropType as PropType);
      const prevIndex =
        currentIndex <= 0 ? cyclePropTypes.length - 1 : currentIndex - 1;
      const prevPropType = cyclePropTypes[prevIndex];

      settingsService.updateSettings({
        bluePropType: prevPropType,
        redPropType: prevPropType,
      });
      toast.info(`Prop: ${prevPropType}`, 1500);
    },
  });

  // ==================== Admin Shortcuts ====================
  // Only registered for admin users

  // F9 - Admin Toolbar (admin-only debug tools)
  service.register({
    id: "admin.toolbar",
    label: "Admin Toolbar",
    description: "Toggle the admin debug toolbar (admin only)",
    key: "F9",
    modifiers: [],
    context: "global",
    scope: "admin",
    priority: "high",
    // No condition needed - AdminToolbar handles admin check
    action: () => {
      adminToolbarState.toggle();
    },
  });

  // ==================== Theme/Background Shortcuts (Shift + Numbers) ====================
  // Shift+1-0 for quick theme switching
  // Part of the trifecta: Ctrl=modules, Alt=props, Shift=themes

  // Map number keys to background indices (1-9, 0 for 10th)
  const themeKeyMap = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  backgroundsConfig.slice(0, 10).forEach((bgConfig, index) => {
    const key = themeKeyMap[index];
    if (!key) return;

    service.register({
      id: `global.theme-${bgConfig.type}`,
      label: bgConfig.name,
      description: `Switch to ${bgConfig.name} theme (Shift+${key})`,
      key: key,
      modifiers: ["shift"],
      context: "global",
      scope: "action",
      priority: "high",
      action: () => {
        // Block changes in preview mode
        if (isSettingsPreviewMode()) {
          return;
        }

        // Apply theme colors for UI
        if (bgConfig.type === BackgroundType.SOLID_COLOR && bgConfig.color) {
          applyThemeFromColors(bgConfig.color);
          void updateSettings({
            backgroundType: bgConfig.type,
            backgroundColor: bgConfig.color,
          });
        } else if (
          bgConfig.type === BackgroundType.LINEAR_GRADIENT &&
          bgConfig.colors
        ) {
          applyThemeFromColors(undefined, bgConfig.colors);
          void updateSettings({
            backgroundType: bgConfig.type,
            gradientColors: bgConfig.colors,
            gradientDirection: bgConfig.direction || 135,
          });
        } else if (bgConfig.themeColors) {
          // Animated backgrounds
          applyThemeFromColors(undefined, bgConfig.themeColors);
          void updateSettings({
            backgroundType: bgConfig.type,
          });
        }

        toast.info(`Theme: ${bgConfig.name}`, 1500);
      },
    });
  });
}
