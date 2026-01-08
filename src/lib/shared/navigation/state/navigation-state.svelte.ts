/**
 * Navigation State - Global Navigation State Management
 *
 * Manages global navigation state including current modes for tabs with sub-modes.
 * This provides a centralized way to track and update navigation state across the app.
 *
 * ARCHITECTURE:
 * - Tab/module definitions: config/tab-definitions.ts, config/module-definitions.ts
 * - Storage keys: config/storage-keys.ts
 * - Persistence service: services/implementations/NavigationPersister.ts (for DI contexts)
 * - Validation service: services/implementations/NavigationValidator.ts (for DI contexts)
 *
 * NOTE: This state is created at module load time (before DI container is ready),
 * so we use storage keys directly and lazy-resolve services where needed.
 */

import type { ModuleDefinition, ModuleId, Section } from "../domain/types";
import { tryResolve } from "../../inversify/resolve-utils";
import { TYPES } from "../../inversify/types";
import type { IActivityLogger } from "../../analytics/services/contracts/IActivityLogger";
import type { IPresenceTracker } from "../../presence/services/contracts/IPresenceTracker";

// Import configurations from separated files
import {
  CREATE_TABS,
  LEARN_TABS,
  DISCOVER_TABS,
  LIBRARY_TABS,
  COMMUNITY_TABS,
  ADMIN_TABS,
  ACCOUNT_TABS,
  SETTINGS_TABS,
} from "../config/tab-definitions";

import { MODULE_DEFINITIONS } from "../config/module-definitions";

// Import storage keys from centralized config
import {
  CURRENT_MODULE_KEY,
  ACTIVE_TAB_KEY,
  MODULE_LAST_TABS_KEY,
  CURRENT_CREATE_MODE_KEY,
  CURRENT_LEARN_MODE_KEY,
  PREVIOUS_MODULE_SESSION_KEY,
  PREVIOUS_TAB_SESSION_KEY,
} from "../config/storage-keys";

// Import panel persistence state (extracted for single responsibility)
import { panelPersistenceState } from "./panel-persistence-state.svelte";

// Re-export for backwards compatibility
export {
  CREATE_TABS,
  LEARN_TABS,
  DISCOVER_TABS,
  LIBRARY_TABS,
  COMMUNITY_TABS,
  ANIMATE_TABS,
  ADMIN_TABS,
  ACCOUNT_TABS,
  SETTINGS_TABS,
  COLLECT_TABS,
  BUILD_TABS,
  COLLECTION_TABS,
  ABOUT_TABS,
  EDIT_TABS,
  ML_TRAINING_TABS,
  FEEDBACK_TABS,
  TRAIN_TABS,
} from "../config/tab-definitions";

export { MODULE_DEFINITIONS } from "../config/module-definitions";

/**
 * Creates navigation state for managing modules and tabs
 */
export function createNavigationState() {
  // ─────────────────────────────────────────────────────────────────────────────
  // Reactive State
  // ─────────────────────────────────────────────────────────────────────────────

  // Current mode state (legacy, synced with activeTab)
  let currentCreateMode = $state<string>("constructor");
  let currentLearnMode = $state<string>("concepts");

  // Module-based state
  let currentModule = $state<ModuleId>("dashboard");
  let activeTab = $state<string>(""); // Active tab within the current module (dashboard has no tabs)
  let lastTabByModule = $state<Partial<Record<ModuleId, string>>>({});

  // Track previous module for settings toggle behavior
  let previousModule = $state<ModuleId | null>(loadPreviousModuleFromSession());

  // Track previous tab for feedback context (last tab before current navigation)
  let previousTab = $state<string>(loadPreviousTabFromSession());

  // ─────────────────────────────────────────────────────────────────────────────
  // Lazy Service Resolution (for when DI container is available)
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // Persistence Helpers (inline since state is created before DI is ready)
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper to load previous module from sessionStorage
  function loadPreviousModuleFromSession(): ModuleId | null {
    if (typeof sessionStorage === "undefined") return null;
    const saved = sessionStorage.getItem(PREVIOUS_MODULE_SESSION_KEY);
    if (saved && MODULE_DEFINITIONS.some((m) => m.id === saved)) {
      return saved as ModuleId;
    }
    return null;
  }

  // Helper to persist previous module to sessionStorage
  function savePreviousModuleToSession(moduleId: ModuleId | null) {
    if (typeof sessionStorage === "undefined") return;
    if (moduleId) {
      sessionStorage.setItem(PREVIOUS_MODULE_SESSION_KEY, moduleId);
    } else {
      sessionStorage.removeItem(PREVIOUS_MODULE_SESSION_KEY);
    }
  }

  // Helper to load previous tab from sessionStorage
  function loadPreviousTabFromSession(): string {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem(PREVIOUS_TAB_SESSION_KEY) || "";
  }

  // Helper to persist previous tab to sessionStorage
  function savePreviousTabToSession(tabId: string) {
    if (typeof sessionStorage === "undefined") return;
    if (tabId) {
      sessionStorage.setItem(PREVIOUS_TAB_SESSION_KEY, tabId);
    } else {
      sessionStorage.removeItem(PREVIOUS_TAB_SESSION_KEY);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Load Persisted State (runs at module initialization)
  // ─────────────────────────────────────────────────────────────────────────────

  if (typeof localStorage !== "undefined") {
    // Load create mode persistence
    const savedCreateMode = localStorage.getItem(CURRENT_CREATE_MODE_KEY);
    if (savedCreateMode && CREATE_TABS.some((t) => t.id === savedCreateMode)) {
      currentCreateMode = savedCreateMode;
    }

    const savedLearnMode = localStorage.getItem(CURRENT_LEARN_MODE_KEY);
    if (savedLearnMode && LEARN_TABS.some((t) => t.id === savedLearnMode)) {
      currentLearnMode = savedLearnMode;
    }

    // Load module persistence
    const savedModule = localStorage.getItem(CURRENT_MODULE_KEY);
    if (savedModule === "community" || savedModule === "account") {
      // Migration: community and account modules retired, redirect to dashboard
      currentModule = "dashboard";
      localStorage.setItem(CURRENT_MODULE_KEY, "dashboard");
    } else if (
      savedModule &&
      MODULE_DEFINITIONS.some((m) => m.id === savedModule)
    ) {
      currentModule = savedModule as ModuleId;
    }

    // Load last active tab for each module
    const savedLastTabs = localStorage.getItem(MODULE_LAST_TABS_KEY);
    if (savedLastTabs) {
      try {
        const parsed = JSON.parse(savedLastTabs) as Record<string, string>;
        const filteredEntries = Object.entries(parsed).filter(
          ([moduleId, tabId]) => {
            const moduleDefinition = MODULE_DEFINITIONS.find(
              (m) => m.id === moduleId
            );
            return (
              moduleDefinition?.sections.some((tab) => tab.id === tabId) ??
              false
            );
          }
        );

        if (filteredEntries.length > 0) {
          lastTabByModule = filteredEntries.reduce<
            Partial<Record<ModuleId, string>>
          >((acc, [moduleId, tabId]) => {
            acc[moduleId as ModuleId] = tabId;
            return acc;
          }, {});
        }
      } catch (error) {
        console.warn(
          "NavigationState: failed to parse saved module tab map:",
          error
        );
      }
    }

    // Load last open panel for each tab via panelPersistenceState
    // Validator ensures saved tab keys are still valid
    panelPersistenceState.loadFromStorage((tabKey: string) => {
      const [moduleId, tabId] = tabKey.split(":");
      if (!moduleId || !tabId) return false;
      const moduleDefinition = MODULE_DEFINITIONS.find(
        (m) => m.id === moduleId
      );
      return (
        moduleDefinition?.sections.some((tab) => tab.id === tabId) ?? false
      );
    });

    // Load current active tab
    const savedActiveTab = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedActiveTab) {
      activeTab = savedActiveTab;
    }

    // Remember the last active tab for current module (inline to avoid closure warning)
    const rememberedTab = lastTabByModule[currentModule];
    if (rememberedTab) {
      const moduleDefinition = MODULE_DEFINITIONS.find(
        (m) => m.id === currentModule
      );
      if (moduleDefinition?.sections.some((tab) => tab.id === rememberedTab)) {
        activeTab = rememberedTab;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // URL Path Parsing - URL takes priority over localStorage for deep linking
    // Parses paths like /realm/museum → module: "realm", tab: "museum"
    // ─────────────────────────────────────────────────────────────────────────────
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      // Remove leading slash and split by remaining slashes
      const pathParts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);

      const firstPart = pathParts[0];
      if (pathParts.length >= 1 && firstPart) {
        const urlModule = firstPart.toLowerCase();
        const urlTab = pathParts[1]?.toLowerCase();

        // Check if URL specifies a valid module
        const urlModuleDefinition = MODULE_DEFINITIONS.find(
          (m) => m.id === urlModule
        );

        if (urlModuleDefinition) {
          // URL has valid module - use it
          currentModule = urlModule as ModuleId;

          // If URL also specifies a tab, use it if valid
          if (urlTab && urlModuleDefinition.sections.length > 0) {
            const validTab = urlModuleDefinition.sections.find(
              (s) => s.id === urlTab
            );
            if (validTab) {
              activeTab = urlTab;
              // Also remember this tab for the module
              lastTabByModule[urlModule as ModuleId] = urlTab;
            } else {
              // URL tab not valid - use remembered or first tab
              const remembered = lastTabByModule[urlModule as ModuleId];
              const firstTab = urlModuleDefinition.sections[0]?.id || "";
              activeTab = remembered || firstTab;
            }
          } else if (urlModuleDefinition.sections.length > 0) {
            // Module has tabs but URL doesn't specify one - use remembered or first
            const remembered = lastTabByModule[urlModule as ModuleId];
            const firstTab = urlModuleDefinition.sections[0]?.id || "";
            activeTab = remembered || firstTab;
          } else {
            // Module has no tabs
            activeTab = "";
          }
        }
      }
    }

    // Sync mode-specific state with activeTab after all loading is complete
    // This ensures currentLearnMode/currentCreateMode match activeTab on refresh
    // Note: These comparisons use the current values directly (not in a closure)
    const moduleAtInit = currentModule;
    const tabAtInit = activeTab;
    if (
      moduleAtInit === "learn" &&
      LEARN_TABS.some((t) => t.id === tabAtInit)
    ) {
      currentLearnMode = tabAtInit;
    } else if (
      moduleAtInit === "create" &&
      CREATE_TABS.some((t) => t.id === tabAtInit)
    ) {
      currentCreateMode = tabAtInit;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Functions
  // ─────────────────────────────────────────────────────────────────────────────

  function setCreateMode(mode: string) {
    if (CREATE_TABS.some((t) => t.id === mode)) {
      currentCreateMode = mode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_CREATE_MODE_KEY, mode);
      }
    }
  }

  function setLearnMode(mode: string) {
    if (LEARN_TABS.some((t) => t.id === mode)) {
      currentLearnMode = mode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_LEARN_MODE_KEY, mode);
      }
      // Sync with new state when in Learn module
      if (currentModule === "learn") {
        activeTab = mode;
      }
    }
  }

  function persistLastTabs() {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(
        MODULE_LAST_TABS_KEY,
        JSON.stringify(lastTabByModule)
      );
    } catch (error) {
      console.warn("NavigationState: failed to persist module tab map:", error);
    }
  }

  // Module-based functions
  // targetTab: Optional tab to set directly (bypasses remembered/default tab logic)
  function setCurrentModule(moduleId: ModuleId, targetTab?: string) {
    if (MODULE_DEFINITIONS.some((m) => m.id === moduleId)) {
      const previousModuleLocal = currentModule;
      const _previousTabLocal = activeTab;

      // Track previous module/tab for feedback context
      // Save current location when LEAVING it (unless leaving feedback/settings)
      // This ensures previous always reflects where user was before opening feedback
      if (currentModule !== moduleId) {
        // Only save if leaving a "real" location (not feedback/settings)
        if (
          currentModule &&
          currentModule !== "feedback" &&
          currentModule !== "settings"
        ) {
          previousModule = currentModule;
          previousTab = activeTab;
          savePreviousModuleToSession(currentModule);
          savePreviousTabToSession(activeTab);
        }
      }

      currentModule = moduleId;

      // Set default tab for the module
      const moduleDefinition = MODULE_DEFINITIONS.find(
        (m) => m.id === moduleId
      );
      let nextTab = activeTab;
      if (moduleDefinition && moduleDefinition.sections.length > 0) {
        // If targetTab is specified and valid, use it directly
        if (
          targetTab &&
          moduleDefinition.sections.some((tab) => tab.id === targetTab)
        ) {
          nextTab = targetTab;
        } else {
          // Otherwise fall back to remembered or first tab
          const remembered = lastTabByModule[moduleId];
          const firstSection = moduleDefinition.sections[0];
          const fallbackTab = firstSection ? firstSection.id : "";
          nextTab =
            remembered &&
            moduleDefinition.sections.some((tab) => tab.id === remembered)
              ? remembered
              : fallbackTab;
        }

        lastTabByModule = {
          ...lastTabByModule,
          [moduleId]: nextTab,
        };
      } else {
        // Module has no sections (e.g., dashboard) - clear the active tab
        nextTab = "";
        const updatedMap = { ...lastTabByModule };
        delete updatedMap[moduleId];
        lastTabByModule = updatedMap;
      }

      activeTab = nextTab;

      // Log module navigation for analytics (non-blocking)
      // Include the tab for more granular tracking (e.g., "create:generator")
      if (previousModuleLocal !== moduleId) {
        try {
          const activityService = tryResolve<IActivityLogger>(
            TYPES.IActivityLogger
          );
          if (activityService) {
            const moduleWithTab = nextTab ? `${moduleId}:${nextTab}` : moduleId;
            void activityService.logModuleView(
              moduleWithTab,
              previousModuleLocal
            );
          }
        } catch {
          // Silently fail - activity logging is non-critical
        }

        // Update presence with new location (non-blocking)
        try {
          const presenceService = tryResolve<IPresenceTracker>(
            TYPES.IPresenceTracker
          );
          if (presenceService) {
            void presenceService.updateLocation(moduleId, nextTab || null);
          }
        } catch {
          // Silently fail - presence is non-critical
        }
      }

      // Persist both module and active tab
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CURRENT_MODULE_KEY, moduleId);
        if (nextTab) {
          localStorage.setItem(ACTIVE_TAB_KEY, nextTab);
        } else {
          // Clear persisted tab when module has no tabs (e.g., dashboard)
          localStorage.removeItem(ACTIVE_TAB_KEY);
        }
      }

      persistLastTabs();

      // Sync with mode-specific state
      const tab = getActiveTab();
      if (moduleId === "create") {
        setCreateMode(tab);
      } else if (moduleId === "learn") {
        setLearnMode(tab);
      }
    }
  }

  function setActiveTab(tabId: string) {
    const moduleDefinition = MODULE_DEFINITIONS.find(
      (m) => m.id === currentModule
    );
    const tabExists = moduleDefinition?.sections.some(
      (tab) => tab.id === tabId
    );
    if (moduleDefinition && tabExists) {
      const previousTab = activeTab;
      activeTab = tabId;

      // Log tab switch for analytics (non-blocking)
      if (previousTab !== tabId) {
        try {
          const activityService = tryResolve<IActivityLogger>(
            TYPES.IActivityLogger
          );
          if (activityService) {
            const moduleWithTab = `${currentModule}:${tabId}`;
            const previousModuleWithTab = `${currentModule}:${previousTab}`;
            void activityService.logModuleView(
              moduleWithTab,
              previousModuleWithTab
            );
          }
        } catch {
          // Silently fail - activity logging is non-critical
        }

        // Update presence with new tab (non-blocking)
        try {
          const presenceService = tryResolve<IPresenceTracker>(
            TYPES.IPresenceTracker
          );
          if (presenceService) {
            void presenceService.updateLocation(currentModule, tabId);
          }
        } catch {
          // Silently fail - presence is non-critical
        }
      }

      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ACTIVE_TAB_KEY, tabId);
      }

      lastTabByModule = {
        ...lastTabByModule,
        [currentModule]: tabId,
      };
      persistLastTabs();

      // Sync with mode-specific state
      const module = getCurrentModule();
      if (module === "create") {
        setCreateMode(tabId);
      } else if (module === "learn") {
        setLearnMode(tabId);
      }
    }
  }

  function getCurrentModule(): ModuleId {
    return currentModule;
  }

  function getActiveTab(): string {
    return activeTab;
  }

  function getTabsForModule(moduleId: ModuleId): Section[] {
    const moduleDefinition = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
    return moduleDefinition ? moduleDefinition.sections : [];
  }

  function getModuleDefinition(
    moduleId: ModuleId
  ): ModuleDefinition | undefined {
    return MODULE_DEFINITIONS.find((m) => m.id === moduleId);
  }

  function updateTabAccessibility(tabId: string, disabled: boolean) {
    // Find and update the tab in CREATE_TABS (mutate directly)
    const tab = CREATE_TABS.find((t) => t.id === tabId);
    if (tab) {
      tab.disabled = disabled;
    }
  }

  return {
    // Current state
    get currentCreateMode() {
      return currentCreateMode;
    },
    get currentLearnMode() {
      return currentLearnMode;
    },

    // Module-based readonly state
    get currentModule() {
      return currentModule;
    },
    get activeTab() {
      return activeTab;
    },
    get previousModule() {
      return previousModule;
    },
    get previousTab() {
      return previousTab;
    },

    // Tab configurations
    get createTabs() {
      return CREATE_TABS;
    },
    get learnTabs() {
      return LEARN_TABS;
    },
    get discoverTabs() {
      return DISCOVER_TABS;
    },
    get communityTabs() {
      return COMMUNITY_TABS;
    },
    get libraryTabs() {
      return LIBRARY_TABS;
    },
    get adminTabs() {
      return ADMIN_TABS;
    },
    get accountTabs() {
      return ACCOUNT_TABS;
    },
    get settingsTabs() {
      return SETTINGS_TABS;
    },
    get moduleDefinitions() {
      return MODULE_DEFINITIONS;
    },

    // Legacy getters (deprecated)
    /** @deprecated Use createTabs instead */
    get CreateModules() {
      return CREATE_TABS;
    },
    /** @deprecated Use createTabs instead */
    get buildModes() {
      return CREATE_TABS;
    },
    /** @deprecated Use createTabs instead */
    get createModes() {
      return CREATE_TABS;
    },
    /** @deprecated Use currentCreateMode instead */
    get currentBuildMode() {
      return currentCreateMode;
    },
    /** @deprecated Use learnTabs instead */
    get learnModes() {
      return LEARN_TABS;
    },
    /** @deprecated Use discoverTabs instead */
    get discoverModes() {
      return DISCOVER_TABS;
    },
    /** @deprecated Use discoverTabs instead */
    get DiscoverModes() {
      return DISCOVER_TABS;
    },
    /** @deprecated Use activeTab instead */
    get currentSection() {
      return activeTab;
    },

    // Actions
    setCreateMode,
    setLearnMode,

    // Module-based actions
    setCurrentModule,
    setActiveTab,
    getCurrentModule,
    getActiveTab,
    getTabsForModule,
    getModuleDefinition,
    updateTabAccessibility,

    // ─────────────────────────────────────────────────────────────────────────
    // Panel Persistence (delegated to panelPersistenceState)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get the last open panel for a specific tab
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     * @returns The panel ID (e.g., "animation", "edit", "share") or null if no panel was open
     */
    getLastPanelForTab(moduleId?: ModuleId, tabId?: string): string | null {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      return panelPersistenceState.getLastPanel(`${module}:${tab}`);
    },

    /**
     * Set the last open panel for a specific tab
     * @param panelId The panel ID to save (e.g., "animation", "edit", "share") or null to clear
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     */
    setLastPanelForTab(
      panelId: string | null,
      moduleId?: ModuleId,
      tabId?: string
    ) {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      panelPersistenceState.setLastPanel(`${module}:${tab}`, panelId);
    },

    /**
     * Clear the panel state for a tab (use when explicitly closing a panel)
     * @param moduleId The module (defaults to current module)
     * @param tabId The tab within the module (defaults to active tab)
     */
    clearPanelForTab(moduleId?: ModuleId, tabId?: string) {
      const module = moduleId ?? currentModule;
      const tab = tabId ?? activeTab;
      panelPersistenceState.clearPanel(`${module}:${tab}`);
    },

    // Legacy action aliases (deprecated)
    /** @deprecated Use setCreateMode instead */
    setBuildMode: setCreateMode,
    /** @deprecated Use setActiveTab instead */
    setCurrentSection: setActiveTab,
    /** @deprecated Use getActiveTab instead */
    getCurrentSection: getActiveTab,
    /** @deprecated Use getTabsForModule instead */
    getSectionsForModule: getTabsForModule,
  };
}

/**
 * Type for NavigationState - the return type of createNavigationState
 */
export type NavigationState = ReturnType<typeof createNavigationState>;

// Global navigation state instance
export const navigationState = createNavigationState();
