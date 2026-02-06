/**
 * Keyboard Shortcut State
 *
 * Global state for keyboard shortcuts using Svelte 5 runes.
 * Manages shortcut settings, context, and UI state.
 *
 * Domain: Keyboard Shortcuts - State Management
 */

import type {
  CustomBinding,
  ShortcutContext,
  ShortcutSettings,
} from "../domain/types/keyboard-types";
import { browser } from "$app/environment";

/**
 * Default shortcut settings
 */
const defaultSettings: ShortcutSettings = {
  enableSingleKeyShortcuts: true,
  enableVimStyleNavigation: false,
  showShortcutHints: true,
  playSoundOnActivation: false,
  customBindings: {} as Record<string, CustomBinding>,
};

/**
 * Load settings from localStorage
 */
function loadSettings(): ShortcutSettings {
  if (!browser) return defaultSettings;

  try {
    const stored = localStorage.getItem("tka-keyboard-shortcuts-settings");
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn("Failed to load keyboard shortcut settings:", error);
  }

  return defaultSettings;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: ShortcutSettings): void {
  if (!browser) return;

  try {
    localStorage.setItem(
      "tka-keyboard-shortcuts-settings",
      JSON.stringify(settings)
    );
  } catch (error) {
    console.warn("Failed to save keyboard shortcut settings:", error);
  }
}

/**
 * Detect operating system
 */
function detectOS(): "macos" | "windows" | "linux" | "unknown" {
  if (!browser) return "unknown";

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes("mac") || userAgent.includes("mac")) {
    return "macos";
  } else if (platform.includes("win")) {
    return "windows";
  } else if (platform.includes("linux")) {
    return "linux";
  }

  return "unknown";
}

/**
 * Create keyboard shortcut state
 */
export function createKeyboardShortcutState() {
  // Current shortcut context
  let currentContext = $state<ShortcutContext>("global");

  // Shortcut settings
  let settings = $state<ShortcutSettings>(loadSettings());

  // Operating system
  const os = detectOS();
  const isMac = os === "macos";

  // Help dialog state
  let showHelp = $state(false);

  // Command palette state
  let showCommandPalette = $state(false);

  // Shortcut hint state (for showing tooltips) - derived from settings
  const showHints = $derived(settings.showShortcutHints);

  // Recently activated shortcuts (for feedback)
  let recentlyActivated = $state<string[]>([]);

  return {
    // Context
    get context() {
      return currentContext;
    },
    setContext(context: ShortcutContext) {
      currentContext = context;
    },

    // Settings
    get settings() {
      return settings;
    },
    updateSettings(updates: Partial<ShortcutSettings>) {
      settings = { ...settings, ...updates };
      saveSettings(settings);
    },
    resetSettings() {
      settings = defaultSettings;
      saveSettings(settings);
    },

    // OS detection
    get os() {
      return os;
    },
    get isMac() {
      return isMac;
    },

    // Help dialog
    get showHelp() {
      return showHelp;
    },
    openHelp() {
      showHelp = true;
    },
    closeHelp() {
      showHelp = false;
    },
    toggleHelp() {
      showHelp = !showHelp;
    },

    // Command palette
    get showCommandPalette() {
      return showCommandPalette;
    },
    openCommandPalette() {
      showCommandPalette = true;
    },
    closeCommandPalette() {
      showCommandPalette = false;
    },
    toggleCommandPalette() {
      showCommandPalette = !showCommandPalette;
    },

    // Hints
    get showHints() {
      return showHints;
    },
    setShowHints(show: boolean) {
      settings.showShortcutHints = show;
      saveSettings(settings);
    },

    // Recently activated (for visual feedback)
    get recentlyActivated() {
      return recentlyActivated;
    },
    trackActivation(shortcutId: string) {
      recentlyActivated = [shortcutId, ...recentlyActivated.slice(0, 4)];

      // Clear after 2 seconds
      setTimeout(() => {
        recentlyActivated = recentlyActivated.filter((id) => id !== shortcutId);
      }, 2000);
    },

    // Custom binding management
    setCustomBinding(shortcutId: string, binding: CustomBinding) {
      settings = {
        ...settings,
        customBindings: {
          ...settings.customBindings,
          [shortcutId]: binding,
        },
      };
      saveSettings(settings);
    },

    removeCustomBinding(shortcutId: string) {
      const { [shortcutId]: _, ...rest } = settings.customBindings;
      settings = {
        ...settings,
        customBindings: rest,
      };
      saveSettings(settings);
    },

    resetAllCustomBindings() {
      settings = {
        ...settings,
        customBindings: {},
      };
      saveSettings(settings);
    },

    getCustomBinding(shortcutId: string): CustomBinding | undefined {
      return settings.customBindings[shortcutId];
    },

    get customBindingCount() {
      return Object.keys(settings.customBindings).length;
    },

    get hasCustomBindings() {
      return Object.keys(settings.customBindings).length > 0;
    },
  };
}

/**
 * Global keyboard shortcut state instance
 */
export const keyboardShortcutState = createKeyboardShortcutState();
