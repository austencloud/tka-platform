/**
 * Panel Persistence State
 *
 * Remembers which panel was last open for each module:tab combination.
 * Extracted from navigation-state to maintain single responsibility.
 *
 * Key format: "moduleId:tabId" (e.g., "create:construct", "create:assembler")
 * Value: panel ID (e.g., "animation", "edit", "share") or null
 */

import { TAB_LAST_PANELS_KEY } from "../config/storage-keys";

export function createPanelPersistenceState() {
  // Panel persistence per tab
  // Key format: "moduleId:tabId" (e.g., "create:construct", "create:assembler")
  let lastPanelByTab = $state<Record<string, string | null>>({});

  // Persistence Helpers

  function persist() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(TAB_LAST_PANELS_KEY, JSON.stringify(lastPanelByTab));
    } catch (error) {
      console.warn("PanelPersistenceState: failed to persist:", error);
    }
  }


  /**
   * Load persisted panel state from localStorage
   * @param isValidTabKey Optional validator function to filter out invalid keys
   */
  function loadFromStorage(isValidTabKey?: (tabKey: string) => boolean) {
    if (typeof localStorage === "undefined") return;

    const saved = localStorage.getItem(TAB_LAST_PANELS_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Record<string, string | null>;
      const entries = Object.entries(parsed);

      // Filter to valid keys if validator provided
      const filteredEntries = isValidTabKey
        ? entries.filter(([tabKey]) => isValidTabKey(tabKey))
        : entries;

      if (filteredEntries.length > 0) {
        lastPanelByTab = Object.fromEntries(filteredEntries);
      }
    } catch (error) {
      console.warn(
        "PanelPersistenceState: failed to parse saved state:",
        error
      );
    }
  }

  return {
    /**
     * Load persisted state from localStorage
     * Call this during initialization with optional validator
     */
    loadFromStorage,

    /**
     * Get the last open panel for a specific tab
     * @param tabKey The tab key in format "moduleId:tabId"
     * @returns The panel ID or null if no panel was open
     */
    getLastPanel(tabKey: string): string | null {
      return lastPanelByTab[tabKey] ?? null;
    },

    /**
     * Set the last open panel for a specific tab
     * @param tabKey The tab key in format "moduleId:tabId"
     * @param panelId The panel ID to save, or null to clear
     */
    setLastPanel(tabKey: string, panelId: string | null) {
      lastPanelByTab = {
        ...lastPanelByTab,
        [tabKey]: panelId,
      };
      persist();
    },

    /**
     * Clear the panel state for a tab
     * @param tabKey The tab key in format "moduleId:tabId"
     */
    clearPanel(tabKey: string) {
      const updated = { ...lastPanelByTab };
      delete updated[tabKey];
      lastPanelByTab = updated;
      persist();
    },

    /**
     * Get all stored panel states (for debugging)
     */
    get allPanels(): Record<string, string | null> {
      return { ...lastPanelByTab };
    },
  };
}

/**
 * Type for PanelPersistenceState
 */
export type PanelPersistenceState = ReturnType<
  typeof createPanelPersistenceState
>;

// Global panel persistence state instance
export const panelPersistenceState = createPanelPersistenceState();
