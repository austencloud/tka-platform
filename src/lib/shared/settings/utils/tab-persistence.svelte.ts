/**
 * Tab Persistence Service
 * Manages localStorage persistence for active tab state
 */

const SETTINGS_TAB_STORAGE_KEY = "tka_settings_active_tab";

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
}

/**
 * Load the last active tab from localStorage (synchronous for initialization)
 */
export function loadActiveTab(
  validTabIds: string[],
  defaultTab: string
): string {
  if (typeof localStorage === "undefined") return defaultTab;

  try {
    const savedTab = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);

    // Validate against known tab IDs
    if (savedTab && validTabIds.includes(savedTab)) {
      return savedTab;
    }
  } catch (error) {
    console.warn("Failed to load settings tab from localStorage:", error);
  }

  return defaultTab;
}

/**
 * Validate the active tab against available tabs
 * Returns the validated tab or default if invalid
 */
export function validateActiveTab(
  currentTab: string,
  availableTabs: TabConfig[],
  defaultTab: string
): string {
  try {
    const savedTab = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);

    // Check if saved tab exists in available tabs
    if (savedTab && availableTabs.some((tab) => tab.id === savedTab)) {
      if (currentTab !== savedTab) {
        return savedTab;
      }
      return currentTab;
    }

    // Current tab is invalid, reset to default
    if (currentTab && !availableTabs.some((tab) => tab.id === currentTab)) {
      saveActiveTab(defaultTab);
      return defaultTab;
    }
  } catch (error) {
    console.warn("Failed to validate settings tab:", error);
  }

  return currentTab || defaultTab;
}

/**
 * Save the active tab to localStorage
 */
export function saveActiveTab(tabId: string): void {
  try {
    localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tabId);
  } catch (error) {
    console.warn("Failed to save settings tab to localStorage:", error);
  }
}

/**
 * Clear the saved tab from localStorage
 */
export function clearActiveTab(): void {
  try {
    localStorage.removeItem(SETTINGS_TAB_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear settings tab from localStorage:", error);
  }
}
